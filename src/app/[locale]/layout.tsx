import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { getDictionary, type Locale, isValidLocale } from "@/lib/i18n";

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
  const dict = getDictionary(isValidLocale(locale) ? locale : "fr");
  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
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
  const validLocale: Locale = isValidLocale(locale) ? locale : "fr";
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
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
