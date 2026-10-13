import Stripe from "stripe";
import { env, isStripeConfigured } from "@/lib/env";

let stripeClient: Stripe | null = null;

/**
 * Retourne le client Stripe, instancié paresseusement à la première utilisation.
 * Lève une erreur explicite si Stripe n'est pas configuré (cas du développement
 * sans STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).
 */
export function getStripe(): Stripe {
  if (!isStripeConfigured) {
    throw new Error(
      "Stripe non configuré : renseigner STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET (absentes ou placeholder de démonstration)."
    );
  }

  const apiKey = env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    // Garde-fou typé : isStripeConfigured garantit déjà la présence de la clé.
    throw new Error("Stripe non configuré : renseigner STRIPE_SECRET_KEY.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey, {
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}

/**
 * Client Stripe lazy : les routes existantes continuent d'importer `stripe`,
 * mais le client n'est créé qu'au premier appel. Une utilisation sans
 * configuration lève l'erreur claire de `getStripe()` au lieu de crasher
 * au chargement du module.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const instance = getStripe();
    const value = Reflect.get(instance, property, instance) as unknown;

    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const PLANS = {
  free: {
    name: "Free",
    monthlyLimit: 3,
    price: 0,
    stripePriceId: null,
    features: {
      fullReport: false,
      fileFormats: ["txt", "pdf"],
      historyRetention: 7,
      exportPdf: false,
      support: "community",
    },
  },
  pro: {
    name: "Pro",
    monthlyLimit: 50,
    price: 19,
    stripePriceId: env.STRIPE_PRO_PRICE_ID,
    features: {
      fullReport: true,
      fileFormats: ["txt", "pdf", "docx", "tex", "md"],
      historyRetention: -1,
      exportPdf: true,
      support: "email",
    },
  },
  business: {
    name: "Business",
    monthlyLimit: -1,
    price: 49,
    stripePriceId: env.STRIPE_BUSINESS_PRICE_ID,
    features: {
      fullReport: true,
      fileFormats: ["txt", "pdf", "docx", "tex", "md"],
      historyRetention: -1,
      exportPdf: true,
      support: "priority",
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;
