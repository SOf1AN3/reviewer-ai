import { db } from "./db";
import { PLANS, type PlanKey } from "./stripe";

export async function getUserPlan(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, analysesThisMonth: true, analysesResetAt: true },
  });

  if (!user) return null;

  const planKey = (user.plan as PlanKey) || "free";
  const plan = PLANS[planKey] || PLANS.free;

  const now = new Date();
  const shouldReset =
    !user.analysesResetAt || user.analysesResetAt.getMonth() !== now.getMonth() || user.analysesResetAt.getFullYear() !== now.getFullYear();

  if (shouldReset && user.analysesThisMonth > 0) {
    await db.user.update({
      where: { id: userId },
      data: { analysesThisMonth: 0, analysesResetAt: now },
    });
    return { ...plan, key: planKey as PlanKey, analysesUsed: 0 };
  }

  return {
    ...plan,
    key: planKey as PlanKey,
    analysesUsed: user.analysesThisMonth,
  };
}

export async function canAnalyze(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const userPlan = await getUserPlan(userId);
  if (!userPlan) return { allowed: false, reason: "Utilisateur non trouvé" };

  if (userPlan.monthlyLimit === -1) {
    return { allowed: true };
  }

  if (userPlan.analysesUsed >= userPlan.monthlyLimit) {
    return {
      allowed: false,
      reason: `Vous avez atteint la limite de ${userPlan.monthlyLimit} analyses pour ce mois. Passez à un plan supérieur pour continuer.`,
    };
  }

  return { allowed: true };
}

export async function incrementUsage(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { analysesResetAt: true },
  });

  const now = new Date();
  const shouldReset =
    !user?.analysesResetAt || user.analysesResetAt.getMonth() !== now.getMonth() || user.analysesResetAt.getFullYear() !== now.getFullYear();

  await db.user.update({
    where: { id: userId },
    data: {
      analysesThisMonth: shouldReset ? 1 : { increment: 1 },
      analysesResetAt: now,
    },
  });
}
