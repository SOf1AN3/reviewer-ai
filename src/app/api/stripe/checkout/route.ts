import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { db } from "@/lib/db";

async function getOrCreatePriceId(plan: PlanKey): Promise<string> {
  const planConfig = PLANS[plan];

  if (planConfig.stripePriceId) {
    return planConfig.stripePriceId;
  }

  const existingPrices = await stripe.prices.list({
    lookup_keys: [`papernote_${plan}`],
    limit: 1,
  });

  if (existingPrices.data.length > 0) {
    return existingPrices.data[0].id;
  }

  const product = await stripe.products.create({
    name: `PaperNote ${planConfig.name}`,
    metadata: { plan },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: planConfig.price * 100,
    currency: "eur",
    recurring: { interval: "month" },
    lookup_key: `papernote_${plan}`,
  });

  return price.id;
}

export const POST = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { plan } = await req.json();

    if (!plan || !["pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: req.auth.user.id! },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: user.name || undefined,
        metadata: { userId: req.auth.user.id! },
      });
      customerId = customer.id;

      await db.user.update({
        where: { id: req.auth.user.id! },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = await getOrCreatePriceId(plan as PlanKey);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/analyser?upgraded=true`,
      cancel_url: `${process.env.NEXT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
      metadata: {
        userId: req.auth.user.id!,
        plan: plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la session" },
      { status: 500 }
    );
  }
});
