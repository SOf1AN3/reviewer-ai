import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";
import { requireUser } from "@/lib/guards";

export const GET = auth(async (req) => {
  // Plan toujours lu depuis la session : aucun `userId` accepté depuis
  // le body ou la query (anti-IDOR).
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const userPlan = await getUserPlan(currentUser.id);
    if (!userPlan) {
      return NextResponse.json({ plan: "free", analysesUsed: 0, monthlyLimit: 3 });
    }

    return NextResponse.json({
      plan: userPlan.key,
      analysesUsed: userPlan.analysesUsed,
      monthlyLimit: userPlan.monthlyLimit,
      name: userPlan.name,
      features: userPlan.features,
    });
  } catch (error) {
    console.error("Plan error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du plan" },
      { status: 500 }
    );
  }
});
