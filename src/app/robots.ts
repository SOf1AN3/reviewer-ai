import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * URL de base normalisée (sans slash final), dérivée de `NEXT_PUBLIC_APP_URL`.
 * Repli sur `http://localhost:3000` si la variable est absente ou invalide.
 */
function getBaseUrl(): string {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).toString().replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

// Routes privées bloquées pour tous les robots.
//
// Les locales (fr, en, ar) forment un segment dynamique du chemin : on utilise
// donc le wildcard « * » supporté par Google/Bing/Yandex (extension non
// standard mais universellement adoptée) — p. ex. « * /settings » couvre
// /fr/settings, /en/settings, /ar/settings. (Espace inséré dans le motif ci-
// dessus uniquement pour ne pas refermer ce commentaire.)
//
// Les variantes sans préfixe de locale (/settings, /admin…) sont également
// listées : le middleware les redirige, mais un crawler ne doit jamais les
// considérer comme des URLs canoniques.
//
// /api/ est une racine absolue : les routes API ne portent jamais de locale.
const PRIVATE_PATTERNS: readonly string[] = [
  "/*/historique",
  "/*/analyse/",
  "/*/settings",
  "/*/admin",
  "/*/reset-password",
  "/*/verify",
  "/historique",
  "/analyse/",
  "/settings",
  "/admin",
  "/reset-password",
  "/verify",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PATTERNS],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
