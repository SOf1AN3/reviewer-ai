/**
 * src/lib/env.ts — Validation centralisée des variables d'environnement.
 *
 * SERVER-ONLY : ce module lit des secrets (DATABASE_URL, AUTH_SECRET, clés de
 * services tiers) et ne doit jamais être importé côté client.
 *
 * Règles :
 * - Toujours requises : DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL.
 * - Requises uniquement en production (NODE_ENV === "production") :
 *   GEMINI_API_KEY, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   STRIPE_PRO_PRICE_ID, STRIPE_BUSINESS_PRICE_ID, NEXT_APP_URL.
 *   En développement :
 *   - RESEND_API_KEY absente ⇒ vérification email désactivée (bypass automatique) ;
 *   - STRIPE_* absentes/placeholder ⇒ fonctionnalités Stripe désactivées proprement.
 * - STRIPE_WEBHOOK_SECRET commençant par « whsec_REPLACE_ME » = non configuré
 *   (warning en dev, erreur en prod).
 *
 * Comportement :
 * - production : UNE SEULE erreur listant TOUTES les variables manquantes/invalides ;
 * - développement : warnings structurés, aucun crash (l'app reste lancable).
 *
 * Les valeurs ne sont jamais journalisées : seuls les noms de variables
 * apparaissent dans les logs et les messages d'erreur.
 */

import { z } from "zod";

// --- Garde-fou server-only -------------------------------------------------
if (typeof window !== "undefined") {
  throw new Error(
    "[env] src/lib/env.ts est un module server-only : son import côté client est interdit."
  );
}

// --- Types -----------------------------------------------------------------

export type Env = {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  AUTH_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  // Optionnelles en dev, exigées en production :
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_BUSINESS_PRICE_ID?: string;
  NEXT_APP_URL?: string;
};

const IS_PROD = process.env.NODE_ENV === "production";
const STRIPE_WEBHOOK_PLACEHOLDER = "whsec_REPLACE_ME";

// --- Schéma Zod ------------------------------------------------------------

/**
 * Construit le schéma de l'environnement.
 *
 * @param strict `true` — toutes les variables exigées. Utilisé pour la
 *   validation initiale en dev comme en prod : en dev les manquantes sont
 *   seulement journalisées, en prod elles provoquent l'erreur agrégée.
 * @param strict `false` — mode tolérant appliqué en dev APRÈS le warning :
 *   chaque champ possède une valeur de repli (`""` ou `undefined`), donc
 *   jamais d'exception au chargement du module.
 */
function buildEnvSchema(strict: boolean) {
  /** Requise en toutes circonstances (et en prod). */
  const required = (name: string) =>
    strict
      ? z.string({ message: `${name} manquante` }).min(1, `${name} vide`)
      : z.string().catch("");

  /** Optionnelle en dev, exigée en production. */
  const optional = (name: string) =>
    strict
      ? z.string({ message: `${name} manquante` }).min(1, `${name} vide`)
      : z.string().min(1).optional().catch(undefined);

  /** Placeholder Stripe détecté comme « non configuré ». */
  const stripeWebhookSecret = strict
    ? required("STRIPE_WEBHOOK_SECRET").refine(
        (value) => !value.startsWith(STRIPE_WEBHOOK_PLACEHOLDER),
        {
          message: `STRIPE_WEBHOOK_SECRET non configurée : la valeur de démonstration « ${STRIPE_WEBHOOK_PLACEHOLDER}… » doit être remplacée par le secret réel du webhook Stripe`,
        }
      )
    : optional("STRIPE_WEBHOOK_SECRET");

  return z.object({
    NODE_ENV: strict
      ? z.enum(["development", "production", "test"], {
          message: "NODE_ENV invalide : development, production ou test attendu",
        })
      : z.enum(["development", "production", "test"]).catch("development"),

    // --- Toujours requises ---
    DATABASE_URL: required("DATABASE_URL"),
    AUTH_SECRET: required("AUTH_SECRET"),
    NEXT_PUBLIC_APP_URL: strict
      ? z.url({
          message:
            "NEXT_PUBLIC_APP_URL manquante ou invalide : une URL absolue est attendue (ex. https://app.example.com)",
        })
      : z.url().catch(""),

    // --- Requises uniquement en production ---
    GEMINI_API_KEY: optional("GEMINI_API_KEY"),
    RESEND_API_KEY: optional("RESEND_API_KEY"),
    STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
    GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),

    // --- Optionnelles en dev, exigées en production ---
    STRIPE_PRO_PRICE_ID: optional("STRIPE_PRO_PRICE_ID"),
    STRIPE_BUSINESS_PRICE_ID: optional("STRIPE_BUSINESS_PRICE_ID"),
    NEXT_APP_URL: optional("NEXT_APP_URL"),
  });
}

// --- Aide ------------------------------------------------------------------

/** Formate les issues Zod en lignes « - NOM_VARIABLE : message » (sans valeurs). */
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const variable = issue.path.length > 0 ? String(issue.path[0]) : "global";
    return `  - ${variable} : ${issue.message}`;
  });
}

/** Stripe n'est considéré configuré que si la clé ET un vrai secret webhook sont présents. */
function hasRealStripeConfig(config: Env): boolean {
  const apiKey = config.STRIPE_SECRET_KEY;
  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret) {
    return false;
  }

  return !webhookSecret.startsWith(STRIPE_WEBHOOK_PLACEHOLDER);
}

function loadEnv(): Env {
  const validation = buildEnvSchema(true).safeParse(process.env);

  if (validation.success) {
    return validation.data;
  }

  const issues = formatIssues(validation.error);

  // Production : une seule erreur listant TOUTES les variables concernées.
  if (IS_PROD) {
    throw new Error(
      [
        "Configuration d'environnement invalide — variables manquantes ou invalides (production) :",
        ...issues,
        "Renseignez TOUTES les variables ci-dessus (fichier .env ou variables de l'hébergeur) avant de démarrer en production.",
      ].join("\n")
    );
  }

  // Développement : warning structuré, aucun crash.
  console.warn(
    [
      "[env] Variables d'environnement manquantes ou invalides (développement) :",
      ...issues,
      "[env] Démarrage poursuivi en mode dégradé, sans crash. Seuls les noms des variables sont affichés (jamais leurs valeurs).",
    ].join("\n")
  );

  // Mode tolérant : valeurs de repli, le chargement du module ne peut pas échouer.
  const fallback = buildEnvSchema(false).safeParse(process.env);

  if (fallback.success) {
    return fallback.data;
  }

  // Inatteignable en pratique (chaque champ tolérant possède un `.catch`).
  return {
    NODE_ENV: "development",
    DATABASE_URL: "",
    AUTH_SECRET: "",
    NEXT_PUBLIC_APP_URL: "",
  };
}

// --- Exports ---------------------------------------------------------------

/** Variables d'environnement validées et typées (server-only). */
export const env: Env = loadEnv();

/** Vrai si la vérification email est active (faux en dev sans RESEND_API_KEY). */
export const isEmailEnabled: boolean = Boolean(env.RESEND_API_KEY);

/** Vrai si Stripe est réellement configuré (clé secrète + vrai secret webhook). */
export const isStripeConfigured: boolean = hasRealStripeConfig(env);

// En développement, on précise l'impact fonctionnel des variables absentes.
// (En production, `loadEnv()` a déjà levé l'erreur agrégée ci-dessus.)
if (!IS_PROD) {
  if (!isEmailEnabled) {
    console.warn(
      "[env] RESEND_API_KEY absente → vérification email désactivée (bypass automatique en développement)."
    );
  }
  if (!isStripeConfigured) {
    console.warn(
      "[env] Stripe non configuré (STRIPE_SECRET_KEY et/ou STRIPE_WEBHOOK_SECRET absentes ou placeholder) → fonctionnalités Stripe désactivées."
    );
  }
}
