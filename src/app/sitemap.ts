import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { defaultLocale } from "@/lib/i18n";

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

/**
 * Pages publiques uniquement, sans préfixe de locale (le préfixe est ajouté
 * ci-dessous pour chaque locale).
 *
 * Exclus volontairement : `/historique`, `/analyser`, `/analyse/[id]`,
 * `/settings/**`, `/admin`, `/reset-password`, `/verify` — toutes privées ou
 * fonctionnant derrière une session.
 */
const PUBLIC_PATHS: readonly string[] = [
  "/",
  "/pricing",
  "/login",
  "/register",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date();

  return PUBLIC_PATHS.map((path) => {
    // `path === "/"` → `/{locale}` (pas de double slash).
    const localizedPath = (locale: string): string =>
      path === "/" ? `/${locale}` : `/${locale}${path}`;

    return {
      url: `${baseUrl}${localizedPath(defaultLocale)}`,
      lastModified,
      changeFrequency: path === "/" ? "weekly" : "monthly",
      priority: path === "/" ? 1 : 0.7,
      alternates: {
        languages: {
          fr: `${baseUrl}${localizedPath("fr")}`,
          en: `${baseUrl}${localizedPath("en")}`,
          ar: `${baseUrl}${localizedPath("ar")}`,
          "x-default": `${baseUrl}${localizedPath(defaultLocale)}`,
        },
      },
    };
  });
}
