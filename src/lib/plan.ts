import { db } from "./db";
import { PLANS, type PlanKey } from "./stripe";

/** Définition d'un plan, enrichie de sa clé. */
type PlanDefinition = (typeof PLANS)[PlanKey] & { key: PlanKey };

/** Plan de l'utilisateur + consommation du mois courant. */
export type UserPlanInfo = PlanDefinition & { analysesUsed: number };

/** Résultat d'une consommation de quota (opération atomique). */
export type ConsumeQuotaResult =
  | { allowed: true; plan: UserPlanInfo }
  | { allowed: false; reason: string };

/** Début (minuit) du mois UTC courant — la fenêtre de quota est mensuelle en UTC. */
function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Vrai si le compteur appartient à un mois UTC précédent (ou n'a jamais été initialisé). */
function needsMonthlyReset(resetAt: Date | null, monthStart: Date): boolean {
  return resetAt === null || resetAt.getTime() < monthStart.getTime();
}

/** Normalise la colonne `User.plan` : valeur absente ou inconnue → "free". */
function resolvePlan(planField: string | null): PlanDefinition {
  const known =
    typeof planField === "string" &&
    Object.prototype.hasOwnProperty.call(PLANS, planField);
  const key: PlanKey = known ? (planField as PlanKey) : "free";
  return { ...PLANS[key], key };
}

/**
 * Lecture seule : plan + consommation affichable du mois courant.
 *
 * Cette fonction n'écrit plus rien en base : les remises à zéro mensuelles sont
 * exclusivement faites par `consumeQuota`, de façon atomique, afin qu'une écriture
 * « reset d'affichage » ne puisse jamais écraser un compteur fraîchement incrémenté.
 */
export async function getUserPlan(userId: string): Promise<UserPlanInfo | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, analysesThisMonth: true, analysesResetAt: true },
  });

  if (!user) return null;

  const plan = resolvePlan(user.plan);
  const resetRequired = needsMonthlyReset(user.analysesResetAt, startOfUtcMonth(new Date()));

  return { ...plan, analysesUsed: resetRequired ? 0 : user.analysesThisMonth };
}

/**
 * Vérifie ET consomme le quota mensuel dans une seule écriture conditionnelle atomique.
 *
 * Le refus n'est jamais décidé par une lecture préalable : il est porté par le `where`
 * de l'`updateMany`. PostgreSQL résout le verrou de ligne puis ré-évalue ce `where` sur
 * la version à jour de la ligne, donc deux requêtes concurrentes avec une seule place
 * restante ne peuvent pas toutes les deux obtenir `count = 1`.
 *
 * Le remise à zéro mensuelle est fusionnée dans la même écriture atomique (valeur
 * absolue `analysesThisMonth: 1` lorsqu'un reset est requis, `increment: 1` sinon).
 */
export async function consumeQuota(userId: string): Promise<ConsumeQuotaResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, analysesThisMonth: true, analysesResetAt: true },
  });

  if (!user) {
    return { allowed: false, reason: "Utilisateur non trouvé" };
  }

  const plan = resolvePlan(user.plan);
  const now = new Date();
  const monthStart = startOfUtcMonth(now);
  const resetRequired = needsMonthlyReset(user.analysesResetAt, monthStart);

  // 1) Mois précédent (ou compteur jamais initialisé) : remise à zéro + consommation
  //    fusionnées en UNE écriture, et uniquement si la ligne est encore périmée.
  if (resetRequired) {
    const reset = await db.user.updateMany({
      where: {
        id: userId,
        OR: [{ analysesResetAt: null }, { analysesResetAt: { lt: monthStart } }],
      },
      data: { analysesThisMonth: 1, analysesResetAt: now },
    });

    if (reset.count > 0) {
      return { allowed: true, plan: { ...plan, analysesUsed: 1 } };
    }
    // Reset déjà effectué par une requête concurrente → voie incrément ci-dessous.
  }

  // 2) Plan illimité : rien à vérifier, on incrémente quand même (reporting admin).
  if (plan.monthlyLimit === -1) {
    const updated = await db.user.update({
      where: { id: userId },
      data: { analysesThisMonth: { increment: 1 } },
    });
    return { allowed: true, plan: { ...plan, analysesUsed: updated.analysesThisMonth } };
  }

  // 3) Plan limité : la décision ET l'incrémentation sont portées par le même `updateMany`.
  //    Aucune écriture ne peut faire passer `analysesThisMonth` au-delà de `monthlyLimit`.
  const consumed = await db.user.updateMany({
    where: {
      id: userId,
      analysesResetAt: { gte: monthStart },
      analysesThisMonth: { lt: plan.monthlyLimit },
    },
    data: { analysesThisMonth: { increment: 1 } },
  });

  if (consumed.count === 0) {
    return {
      allowed: false,
      reason: `Vous avez atteint la limite de ${plan.monthlyLimit} analyses pour ce mois. Passez à un plan supérieur pour continuer.`,
    };
  }

  // Compteur remis à zéro pendant un concours : la lecture initiale n'est plus valide,
  // on relit la ligne. Sinon la lecture initiale + 1 est la valeur exacte.
  const analysesUsed = resetRequired
    ? ((await db.user.findUnique({
        where: { id: userId },
        select: { analysesThisMonth: true },
      }))?.analysesThisMonth ?? 0)
    : user.analysesThisMonth + 1;

  return { allowed: true, plan: { ...plan, analysesUsed } };
}
