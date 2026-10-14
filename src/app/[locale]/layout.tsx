import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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

  return (
    <html
      lang={validLocale}
      dir={dir}
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
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
