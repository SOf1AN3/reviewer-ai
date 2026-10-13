import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-08-26.dahlia",
  typescript: true,
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
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID!,
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
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID!,
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
