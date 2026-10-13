import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";

export const GET = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ plan: "free", analysesUsed: 0, monthlyLimit: 3 });
  }

  const userPlan = await getUserPlan(req.auth.user.id!);
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
});
