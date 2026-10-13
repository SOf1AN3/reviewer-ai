import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { defaultLocale, isValidLocale, locales, type Locale } from "@/lib/i18n";

// Champs acceptés depuis le body : le plan, et optionnellement la locale à
// utiliser dans les URLs de retour Stripe. Aucun `userId`/`customerId`
// n'est lisible depuis la requête (anti-IDOR) — le customer Stripe est
// toujours celui de l'utilisateur de la session.
const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  locale: z.enum(locales).optional(),
});

/**
 * Détermine la locale des URLs `success_url` / `cancel_url` :
 * body → cookie `NEXT_LOCALE` → `defaultLocale` (`"fr"`).
 */
function resolveLocale(
  req: NextRequest,
  rawLocale: string | undefined
): Locale {
  if (rawLocale && isValidLocale(rawLocale)) {
    return rawLocale;
  }
  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale;
  }
  return defaultLocale;
}

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
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const body: unknown = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    const { plan } = parsed.data;
    const locale = resolveLocale(req, parsed.data.locale);

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
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
        metadata: { userId: currentUser.id },
      });
      customerId = customer.id;

      await db.user.update({
        where: { id: currentUser.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = await getOrCreatePriceId(plan as PlanKey);

    const base = (
      env.NEXT_APP_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");

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
      success_url: `${base}/${locale}/analyser?upgraded=true`,
      cancel_url: `${base}/${locale}/pricing`,
      metadata: {
        userId: currentUser.id,
        plan: plan,
      },
      // Porte le plan sur l'abonnement Stripe lui-même : les events
      // `customer.subscription.*` n'emportent PAS la metadata de la session et
      // arrivent dans un ordre non garanti — `sub.metadata.plan` sert alors de
      // hint à la résolution du plan (indispensable en dev où les price IDs
      // sont absents et les prix créés dynamiquement).
      subscription_data: {
        metadata: { plan },
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
