"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/ErrorState";
import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n";

// global-error replaces the root layout: it renders its own <html>/<body>
// and has no access to the I18nProvider, so the locale is read from the URL.
function useUrlLocale(): Locale {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return isValidLocale(segment) ? segment : defaultLocale;
}

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = useUrlLocale();

  // `dark` est posé ici aussi : ce composant remplace le root layout, donc
  // sans cette classe une erreur globale repasserait en thème clair (flash).
  // Les variables de police du layout étant perdues, `globals.css` applique
  // ses fallbacks système (`ui-sans-serif` / `ui-monospace`).
  // Habillage aligné sur `not-found` / `error` : canvas + carte glass ;
  // props et comportement (reset via `retry`) inchangés.
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="dark"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-4 py-16">
          <div className="w-full max-w-2xl rounded-2xl border border-glass-border bg-surface-glass p-8">
            <ErrorState error={error} retry={retry} />
          </div>
        </div>
      </body>
    </html>
  );
}
