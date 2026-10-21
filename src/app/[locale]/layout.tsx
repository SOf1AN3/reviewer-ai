import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { CookieBanner } from "@/components/CookieBanner";
import {
  getDictionary,
  defaultLocale,
  type Locale,
  isValidLocale,
} from "@/lib/i18n";
import { env } from "@/lib/env";

/** Nom du site utilisé dans les partages sociaux (Open Graph / Twitter). */
const SITE_NAME = "PaperNote";

/** Valeur `og:locale` par locale. */
const OG_LOCALE: Record<Locale, string> = {
  fr: "fr_FR",
  en: "en_US",
  ar: "ar_SA",
};

/**
 * URL de base normalisée (sans slash final), dérivée de `NEXT_PUBLIC_APP_URL`.
 *
 * Repli sur `http://localhost:3000` si la variable est absente ou invalide :
 * `env.ts` est tolérant en développement, donc ce cas est possible et ne doit
 * jamais lever d'exception au moment de la génération des métadonnées.
 */
function getBaseUrl(): string {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).toString().replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

/**
 * Polices du design system « Atmospheric Intelligence », exposées comme
 * variables CSS sur `<html>` puis consommées par `globals.css` :
 * `--font-hanken` → `--font-display`, `--font-jakarta` → `--font-sans`,
 * `--font-jetbrains-mono` → `--font-mono`.
 *
 * Choix des subsets : le layout sert aussi la locale `ar` (`dir="rtl"`), mais
 * **aucune de ces trois familles ne propose le subset `arabic`** chez Google
 * Fonts (Hanken Grotesk et Plus Jakarta Sans : `cyrillic-ext, latin, latin-ext,
 * vietnamese` ; JetBrains Mono : `cyrillic, greek, latin, latin-ext,
 * vietnamese` — vérifié dans `next/dist/compiled/@next/font/.../font-data.json`).
 * `next/font` fait échouer le build sur un subset inconnu, donc on garde
 * `latin` pour toutes les locales : pour `ar`, la couverture des glyphes
 * arabes repose sur les fallbacks système déjà déclarés dans les variables
 * `--font-display` / `--font-sans` (globals.css).
 *
 * Syntaxe conforme à `next/dist/docs/01-app/03-api-reference/02-components/font.md` :
 * `weight` accepte un tableau de poids pour ces fontes (poids tous présents
 * dans les métadonnées : Hanken Grotesk 100–900, Plus Jakarta Sans 200–800,
 * JetBrains Mono 100–800), et les variables sont posées via la méthode
 * « CSS variables » (`${font.variable}` sur `<html>`).
 */
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export async function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "en" }, { locale: "ar" }];
}

export async function generateMetadata(
  props: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await props.params;
  const validLocale: Locale = isValidLocale(locale) ? locale : defaultLocale;
  const dict = getDictionary(validLocale);
  const baseUrl = getBaseUrl();

  return {
    metadataBase: new URL(baseUrl),
    title: dict.metadata.title,
    description: dict.metadata.description,
    alternates: {
      // Le layout est partagé par toutes les pages : les variantes pointent
      // vers l'accueil de chaque locale. Un canonical par sous-page nécessite
      // le pathname, indisponible dans `generateMetadata` de layout (voir
      // rapport T3.6 — limite connue et documentée).
      languages: {
        fr: `${baseUrl}/fr`,
        en: `${baseUrl}/en`,
        ar: `${baseUrl}/ar`,
        "x-default": `${baseUrl}/${defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[validLocale],
      title: dict.metadata.title,
      description: dict.metadata.description,
      url: `${baseUrl}/${validLocale}`,
    },
    twitter: {
      card: "summary_large_image",
      title: dict.metadata.title,
      description: dict.metadata.description,
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale: Locale = isValidLocale(locale) ? locale : defaultLocale;
  const dir = validLocale === "ar" ? "rtl" : "ltr";

  // Thème sombre par défaut : la classe `dark` est rendue côté serveur, donc
  // présente dès le premier paint — aucun flash de thème clair. Elle n'est
  // retirée par le client que si l'utilisateur a explicitement choisi `light`
  // (choix persisté, voir `ThemeProvider`).
  return (
    <html
      lang={validLocale}
      dir={dir}
      suppressHydrationWarning
      className={`dark ${hankenGrotesk.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <SessionProvider>
          <ThemeProvider>
            <I18nProvider locale={validLocale}>
              <Header />
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
              <CookieBanner />
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
