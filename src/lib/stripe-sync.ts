/**
 * src/lib/stripe-sync.ts — Synchronisation Stripe → base de données.
 *
 * Source de vérité = Stripe. Ces fonctions traduisent les objets Stripe en
 * écritures Prisma idempotentes (upserts) et ne modifient JAMAIS la DB sans
 * être appelées par un handler contrôlé (webhook signé).
 *
 * Contrat d'erreur :
 * - Aucune fonction de ce module ne lève d'exception. Toute anomalie est
 *   convertie en `SyncResult` typé, et c'est le route handler qui décide
 *   (200 = traité / non rejouable, 500 = rejouable par Stripe).
 * - Codes :
 *   - `invalid_payload` → non rejouable (le rejeu produirait la même erreur) ;
 *   - `user_not_found`  → rejouable (peut être transitoire : utilisateur non
 *                          encore persistant au moment de l'event) ;
 *   - `db_error`        → rejouable (anomalie de persistance).
 *
 * Décision documentée — rétrogradation de plan :
 *   Un statut `past_due` (échec de paiement en cours de relance Stripe) est
 *   TRANSITOIRE : on conserve donc le plan courant et on ne rétrograde pas.
 *   La rétrogradation vers `free` n'a lieu que sur un statut DÉFINITIF :
 *   `canceled`, `unpaid`, `incomplete_expired`. Un échec éphémère ne doit pas
 *   priver un client qui paie habituellement de son accès. Voir
 *   `planForSubscription()` — la rétrogradation `past_due → free` proposée
 *   comme option a été explicitement écartée.
 *
 * Décision documentée — statut éligible sans price mappable :
 *   En développement, `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` sont
 *   absentes (prix créés dynamiquement, lookup_key `papernote_<plan>`) :
 *   `mapPriceIdToPlan` ne peut alors pas reconnaître le price. Un abonnement
 *   `active`/`trialing` reste PAYANT par définition — on ne rétrograde JAMAIS
 *   vers `free` sur un tel statut. Le plan vient, dans l'ordre, du price
 *   mappé, puis de `planHint` (`session.metadata.plan` ou
 *   `sub.metadata.plan`, porté par `subscription_data` à la création du
 *   Checkout), sinon le plan courant est CONSERVÉ (`null`).
 */

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { PLANS, type PlanKey } from "@/lib/stripe";

// --- Types ------------------------------------------------------------------

export type SyncErrorCode = "invalid_payload" | "user_not_found" | "db_error";

export type SyncResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: SyncErrorCode; message: string };

export interface SyncSubscriptionOptions {
  /**
   * Plan déclaré dans les metadata du Checkout Session (`session.metadata.plan`).
   * Utilisé UNIQUEMENT quand `mapPriceIdToPlan` renvoie `free` alors que le
   * statut Stripe est `active`/`trialing` : c'est le cas en développement où
   * `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` sont absentes et où les
   * prix sont créés dynamiquement (lookup_key `papernote_<plan>`), donc non
   * mappables depuis la config.
   *
   * À défaut de hint explicite, `syncSubscriptionFromStripe` lit aussi
   * `sub.metadata.plan` (porté par `subscription_data.metadata` à la création
   * de la session Checkout) : les events `customer.subscription.*` arrivent
   * sans la metadata de la session et dans un ordre non garanti.
   */
  planHint?: PlanKey;
}

export type SyncSubscriptionData = {
  subscriptionId: string;
  status: string;
  /** Plan appliqué à `User.plan`, ou `null` si le plan courant est conservé. */
  plan: PlanKey | null;
};

export type SyncInvoiceData = {
  stripeInvoiceId: string;
  userId: string;
};

// --- Helpers purs -----------------------------------------------------------

const PLAN_KEYS: readonly PlanKey[] = ["free", "pro", "business"];

/** Valide une valeur inconnue comme clé de `PLANS`. */
export function isPlanKey(value: string | undefined): value is PlanKey {
  return typeof value === "string" && PLAN_KEYS.includes(value as PlanKey);
}

/**
 * Mappe un Stripe Price ID vers une clé de plan.
 *
 * `free` n'a pas de prix : toute valeur inconnue (price ID absent, non
 * configuré, ou prix étranger) retombe sur `free`.
 */
export function mapPriceIdToPlan(priceId: string | undefined): PlanKey {
  if (!priceId) {
    return "free";
  }
  if (PLANS.pro.stripePriceId && priceId === PLANS.pro.stripePriceId) {
    return "pro";
  }
  if (PLANS.business.stripePriceId && priceId === PLANS.business.stripePriceId) {
    return "business";
  }
  return "free";
}

/** Statuts qui donnent effectivement droit au plan payant. */
const ENTITLED_STATUSES: ReadonlySet<string> = new Set(["active", "trialing"]);

/**
 * Statuts définitifs qui entraînent une rétrogradation vers `free`.
 * `past_due` est volontairement ABSENT : échec transitoire (voir en-tête).
 */
const DEFINITIVE_DOWNGRADE_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

/**
 * Détermine le plan à appliquer pour un statut d'abonnement Stripe.
 *
 * @returns le plan à écrire, ou `null` pour « conserver le plan courant ».
 */
export function planForSubscription(
  status: string,
  priceId: string | undefined,
  planHint?: PlanKey
): PlanKey | null {
  if (ENTITLED_STATUSES.has(status)) {
    const mapped = mapPriceIdToPlan(priceId);
    if (mapped !== "free") {
      return mapped;
    }
    // Price non mappable (dev sans price IDs) : le hint porte le plan.
    // Sans hint, on conserve le plan courant — un statut `active`/`trialing`
    // ne doit JAMAIS rétrograder vers `free` faute de reconnaissance.
    return planHint ?? null;
  }

  if (DEFINITIVE_DOWNGRADE_STATUSES.has(status)) {
    return "free";
  }

  // `past_due`, `incomplete`, `paused`, statuts inconnus → aucun changement.
  return null;
}

/** Convertit un timestamp Unix Stripe (secondes) en `Date`, ou `null`. */
function toDateTime(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : null;
}

/** Extrait l'ID d'un `customer` Stripe (string, objet enrichi ou supprimé). */
export function customerIdOf(
  customer: string | { id: string } | null | undefined
): string | null {
  if (typeof customer === "string") {
    return customer.length > 0 ? customer : null;
  }
  if (customer && typeof customer.id === "string" && customer.id.length > 0) {
    return customer.id;
  }
  return null;
}

function invalid(message: string): SyncResult<never> {
  return { ok: false, code: "invalid_payload", message };
}

// --- Résolution d'utilisateur ------------------------------------------------

/**
 * Résout l'utilisateur propriétaire d'un customer Stripe.
 *
 * Retourne `string | null` (jamais d'exception) : `null` signifie soit
 * « aucun utilisateur lié », soit « erreur de lecture » — les deux cas sont
 * traités comme rejouables par le webhook, donc perdre un événement est
 * impossible (at-least-once).
 */
export async function resolveUserIdFromCustomer(
  customerId: string
): Promise<string | null> {
  if (typeof customerId !== "string" || customerId.length === 0) {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch (error) {
    console.error("[stripe-sync] Lecture de l'utilisateur échouée.", {
      customerId,
      code: extractErrorCode(error),
    });
    return null;
  }
}

/** Extrait un code d'erreur court (Prisma / Node) sans journaliser de détails. */
function extractErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }
  return "UNKNOWN";
}

// --- Abonnement -------------------------------------------------------------

/**
 * Upsert de `Subscription` (clé : `stripeSubscriptionId`) + mise à jour de
 * `User.plan` quand le statut l'impose.
 *
 * Invariant : **exactement une ligne `Subscription` par user** (`userId` est
 * `@unique`) — toute ligne appartenant à un autre `stripeSubscriptionId` est
 * supprimée dans la même transaction que l'upsert (voir B2 plus bas).
 *
 * ⚠️ Stripe API récente (SDK `22.x`) : `current_period_start` /
 * `current_period_end` ne sont PLUS sur `Subscription` mais sur
 * `SubscriptionItem` (`sub.items.data[0]`).
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  userId: string,
  options: SyncSubscriptionOptions = {}
): Promise<SyncResult<SyncSubscriptionData>> {
  if (!sub || typeof sub.id !== "string" || sub.id.length === 0) {
    return invalid("Abonnement Stripe sans identifiant.");
  }
  if (typeof userId !== "string" || userId.length === 0) {
    return invalid("Identifiant utilisateur manquant.");
  }

  try {
    const owner = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!owner) {
      return {
        ok: false,
        code: "user_not_found",
        message: "Utilisateur introuvable pour cet abonnement.",
      };
    }

    const item = sub.items.data[0];
    const priceId: string | undefined = item?.price.id;
    const status: string = sub.status;

    // B3 : le plan est aussi porté par l'abonnement Stripe lui-même
    // (`subscription_data.metadata.plan` à la création du Checkout). Le hint
    // explicite (session Checkout) prime, `sub.metadata.plan` couvre tous les
    // autres events `customer.subscription.*` (ordre de livraison non garanti).
    const metadataPlan = sub.metadata?.plan;
    const hint: PlanKey | undefined =
      options.planHint ?? (isPlanKey(metadataPlan) ? metadataPlan : undefined);
    const nextPlan = planForSubscription(status, priceId, hint);

    const subscriptionFields = {
      userId,
      stripePriceId: priceId ?? "",
      status,
      currentPeriodStart: toDateTime(item?.current_period_start),
      currentPeriodEnd: toDateTime(item?.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      trialEnd: toDateTime(sub.trial_end),
    };

    // `PrismaPromise` : lazily évalué — exécuté soit par `await`, soit par
    // `$transaction`. Aucune écriture n'a lieu avant cette ligne.
    const upsertSubscription = db.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: { stripeSubscriptionId: sub.id, ...subscriptionFields },
      update: subscriptionFields,
    });

    // B2 : `Subscription.userId` est `@unique`. Un upgrade (pro → business)
    // crée un NOUVEAU `stripeSubscriptionId` pour le même user : sans
    // nettoyage, le `create` de l'upsert violerait `Subscription_userId_key`
    // en boucle (event rejoué jusqu'à abandon de Stripe, user débité non
    // honoré). On supprime l'ancienne ligne dans la MÊME transaction que
    // l'upsert : exactement 1 ligne `Subscription` par user, toujours.
    const deleteStaleSubscriptions = db.subscription.deleteMany({
      where: { userId, stripeSubscriptionId: { not: sub.id } },
    });

    if (nextPlan === null) {
      await db.$transaction([deleteStaleSubscriptions, upsertSubscription]);
    } else {
      await db.$transaction([
        deleteStaleSubscriptions,
        upsertSubscription,
        db.user.update({ where: { id: userId }, data: { plan: nextPlan } }),
      ]);
    }

    return {
      ok: true,
      data: { subscriptionId: sub.id, status, plan: nextPlan },
    };
  } catch (error) {
    console.error("[stripe-sync] Synchronisation de l'abonnement échouée.", {
      subscriptionId: sub.id,
      userId,
      code: extractErrorCode(error),
    });
    return {
      ok: false,
      code: "db_error",
      message: "Échec de la synchronisation de l'abonnement.",
    };
  }
}

// --- Facture ----------------------------------------------------------------

/**
 * Upsert de `Invoice` (clé : `stripeInvoiceId`).
 *
 * `Invoice` n'a pas de contrainte d'unicité sur `userId` : deux factures
 * distinctes pour un même utilisateur coexistent, c'est l'ID Stripe qui
 * garantit l'idempotence.
 */
export async function recordInvoice(
  inv: Stripe.Invoice,
  userId: string
): Promise<SyncResult<SyncInvoiceData>> {
  if (!inv || typeof inv.id !== "string" || inv.id.length === 0) {
    return invalid("Facture Stripe sans identifiant.");
  }
  if (typeof userId !== "string" || userId.length === 0) {
    return invalid("Identifiant utilisateur manquant.");
  }

  try {
    const fields = {
      amountPaid: typeof inv.amount_paid === "number" ? inv.amount_paid : 0,
      currency: inv.currency,
      // `status` est `null` sur les factures non finalisées (upcoming).
      status: inv.status ?? "open",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
      issuedAt:
        typeof inv.created === "number" && inv.created > 0
          ? new Date(inv.created * 1000)
          : new Date(),
    };

    await db.invoice.upsert({
      where: { stripeInvoiceId: inv.id },
      create: { stripeInvoiceId: inv.id, userId, ...fields },
      update: fields,
    });

    return { ok: true, data: { stripeInvoiceId: inv.id, userId } };
  } catch (error) {
    console.error("[stripe-sync] Enregistrement de la facture échoué.", {
      invoiceId: inv.id,
      userId,
      code: extractErrorCode(error),
    });
    return {
      ok: false,
      code: "db_error",
      message: "Échec de l'enregistrement de la facture.",
    };
  }
}
