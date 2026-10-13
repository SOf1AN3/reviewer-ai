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

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ErrorState error={error} retry={retry} />
      </body>
    </html>
  );
}
