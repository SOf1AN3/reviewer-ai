import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

export const POST = auth(async (req) => {
  // Customer Stripe opéré exclusivement depuis la session : aucun
  // `customerId`/`userId` accepté depuis le body ou la query (anti-IDOR).
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Aucun abonnement trouvé" },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/analyser`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'accès au portail" },
      { status: 500 }
    );
  }
});
