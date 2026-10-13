import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logEvent } from "@/lib/logger";
import { PLANS } from "@/lib/stripe";

/**
 * GET /api/admin/stats — agrégats de pilotage (réservé administrateurs).
 *
 * Toutes les valeurs sont agrégées CÔTÉ DB (`count` / `groupBy`), jamais par
 * chargement de lignes entières en mémoire. La réponse ne contient AUCUNE
 * donnée personnelle : uniquement des compteurs numériques (aucun email, nom,
 * id utilisateur, etc.).
 */

/** Début du mois courant en UTC (bornes des filtres `gte`). */
function startOfCurrentUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Totaux par devise. `Invoice.amountPaid` est stocké EN CENTIMES (unité
 * Stripe) : `eurCents / 100` convertit en euros. Seul EUR est converti —
 * aucune table de change n'est disponible côté serveur, donc les montants
 * non-EUR restent exposés bruts dans `byCurrencyCents` et ne sont JAMAIS
 * additionnés aux euros.
 */
interface CurrencyTotals {
  /** Centimes par devise (clé = devise ISO, ex. `"eur"`, `"usd"`). */
  byCurrencyCents: Record<string, number>;
  /** Centimes EUR uniquement (devise de référence de l'application). */
  eurCents: number;
  /** Montant EUR converti depuis les centimes (`eurCents / 100`). */
  eur: number;
}

/** MRR approximatif : abonnements actifs × prix du plan correspondant. */
interface MrrEstimate {
  /** Montant mensuel estimé, en euros. */
  euros: number;
  /** `false` si au moins un `stripePriceId` actif n'a pas pu être mappé. */
  complete: boolean;
}

/** Contrat JSON complet de `GET /api/admin/stats`. */
interface AdminStatsResponse {
  users: {
    total: number;
    /**
     * `null` : le modèle `User` ne possède pas de colonne de création
     * (voir `prisma/schema.prisma`), le nombre d'inscriptions du mois
     * n'est donc pas dérivable sans migration (hors périmètre de cette tâche).
     */
    newThisMonth: number | null;
    /** Compte d'utilisateurs par plan (`free` / `pro` / `business`). */
    byPlan: Record<string, number>;
  };
  usage: {
    /** Analyses dont `dateAnalyse` tombe dans le mois courant (UTC). */
    analysesThisMonth: number;
    analysesTotal: number;
  };
  revenue: {
    /** Devise de référence des champs `*Eur` : EUR. */
    referenceCurrency: "EUR";
    /** Revenus facturés depuis le début du mois courant (UTC). */
    month: CurrencyTotals;
    /** Revenus cumulés depuis toujours. */
    total: CurrencyTotals;
    /** `null` si Stripe n'est configuré (aucun price ID connu). */
    mrr: MrrEstimate | null;
  };
  subscriptions: {
    /** Abonnements par statut Stripe (`active`, `trialing`, `canceled`…). */
    byStatus: Record<string, number>;
  };
  /** Horodatage ISO de la génération de l'agrégat. */
  generatedAt: string;
}

/** Convertit le résultat d'un `groupBy` facture en `CurrencyTotals`. */
function toCurrencyTotals(
  rows: Array<{ currency: string; _sum: { amountPaid: number | null } }>
): CurrencyTotals {
  const byCurrencyCents: Record<string, number> = {};
  let eurCents = 0;
  for (const row of rows) {
    const cents = row._sum.amountPaid ?? 0;
    byCurrencyCents[row.currency] = (byCurrencyCents[row.currency] ?? 0) + cents;
    if (row.currency.toLowerCase() === "eur") {
      eurCents += cents;
    }
  }
  return { byCurrencyCents, eurCents, eur: eurCents / 100 };
}

/**
 * Estime le MRR : abonnements `active`/`trialing` regroupés par `stripePriceId`
 * (agrégation DB), puis mappés vers le prix du plan dans `PLANS` (server-only).
 */
function estimateMrr(
  rows: Array<{ stripePriceId: string; _count: { _all: number } }>
): MrrEstimate | null {
  const priceEurosByPriceId = new Map<string, number>();
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceId) {
      priceEurosByPriceId.set(plan.stripePriceId, plan.price);
    }
  }
  if (priceEurosByPriceId.size === 0) {
    // Stripe non configuré : aucun price ID connu, pas d'estimation honnête.
    return null;
  }

  let euros = 0;
  let complete = true;
  for (const row of rows) {
    const price = priceEurosByPriceId.get(row.stripePriceId);
    if (price === undefined) {
      // Price ID hors catalogue local : estimé partiellement, jamais inventé.
      complete = false;
      continue;
    }
    euros += price * row._count._all;
  }
  return { euros, complete };
}

export const GET = auth(async (req) => {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    return admin;
  }

  try {
    const monthStart = startOfCurrentUtcMonth();

    const [
      usersTotal,
      usersByPlan,
      analysesThisMonth,
      analysesTotal,
      invoicesMonth,
      invoicesTotal,
      subscriptionsByStatus,
      activeSubscriptionsByPrice,
    ] = await Promise.all([
      db.user.count(),
      db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
      db.analyse.count({ where: { dateAnalyse: { gte: monthStart } } }),
      db.analyse.count(),
      db.invoice.groupBy({
        by: ["currency"],
        _sum: { amountPaid: true },
        where: { issuedAt: { gte: monthStart } },
      }),
      db.invoice.groupBy({
        by: ["currency"],
        _sum: { amountPaid: true },
      }),
      db.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.subscription.groupBy({
        by: ["stripePriceId"],
        _count: { _all: true },
        where: { status: { in: ["active", "trialing"] } },
      }),
    ]);

    const byPlan: Record<string, number> = {};
    for (const row of usersByPlan) {
      byPlan[row.plan] = row._count._all;
    }

    const byStatus: Record<string, number> = {};
    for (const row of subscriptionsByStatus) {
      byStatus[row.status] = row._count._all;
    }

    const response: AdminStatsResponse = {
      users: {
        total: usersTotal,
        newThisMonth: null,
        byPlan,
      },
      usage: {
        analysesThisMonth,
        analysesTotal,
      },
      revenue: {
        referenceCurrency: "EUR",
        month: toCurrencyTotals(invoicesMonth),
        total: toCurrencyTotals(invoicesTotal),
        mrr: estimateMrr(activeSubscriptionsByPrice),
      },
      subscriptions: {
        byStatus,
      },
      generatedAt: new Date().toISOString(),
    };

    // Audit d'accès (id de l'admin uniquement, aucune donnée agrégée sensible).
    logEvent("admin_access", { route: "stats", adminId: admin.id });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Admin stats GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
});
