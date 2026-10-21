"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { isValidLocale, type Locale } from "@/lib/i18n";

// TODO(i18n): move these labels into an "errors" namespace in
// src/messages/{fr,en,ar}.json. The messages files are out of scope for T3.1,
// so labels are inlined here and resolved per locale at runtime.
interface ErrorStateLabels {
  errorTitle: string;
  errorMessage: string;
  notFoundTitle: string;
  notFoundMessage: string;
  retry: string;
  backHome: string;
  devDetails: string;
}

const labels: Record<Locale, ErrorStateLabels> = {
  fr: {
    errorTitle: "Une erreur est survenue",
    errorMessage:
      "Une erreur inattendue s'est produite. Votre travail n'a pas été perdu — vous pouvez réessayer.",
    notFoundTitle: "Page introuvable",
    notFoundMessage:
      "La page que vous recherchez n'existe pas ou a été déplacée.",
    retry: "Réessayer",
    backHome: "Retour à l'accueil",
    devDetails: "Détails techniques (développement uniquement)",
  },
  en: {
    errorTitle: "Something went wrong",
    errorMessage:
      "An unexpected error occurred. Your work has not been lost — you can try again.",
    notFoundTitle: "Page not found",
    notFoundMessage:
      "The page you are looking for does not exist or has been moved.",
    retry: "Try again",
    backHome: "Back to home",
    devDetails: "Technical details (development only)",
  },
  ar: {
    errorTitle: "حدث خطأ ما",
    errorMessage:
      "حدث خطأ غير متوقع. لم يُفقد عملك — يمكنك المحاولة مرة أخرى.",
    notFoundTitle: "الصفحة غير موجودة",
    notFoundMessage: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    retry: "إعادة المحاولة",
    backHome: "العودة إلى الصفحة الرئيسية",
    devDetails: "التفاصيل التقنية (وضع التطوير فقط)",
  },
};

export interface ErrorStateProps {
  /** "error" for crash boundaries, "notFound" for 404 states. */
  kind?: "error" | "notFound";
  error?: Error & { digest?: string };
  /** Re-renders the failed segment (Next.js `retry` prop of `error.tsx`). */
  retry?: () => void;
}

/**
 * Resolves the active locale from the URL first (the `I18nProvider` may be
 * unavailable when the root layout itself failed), then falls back to the
 * i18n context.
 */
function useResolvedLocale(): Locale {
  const { locale: contextLocale } = useI18n();
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return isValidLocale(segment) ? segment : contextLocale;
}

export function ErrorState({ kind = "error", error, retry }: ErrorStateProps) {
  const locale = useResolvedLocale();
  const t = labels[locale];
  const isNotFound = kind === "notFound";

  // Exposed for display only in development builds.
  const devDetails =
    process.env.NODE_ENV === "development" && error != null
      ? [
          error.message,
          error.digest ? `Digest: ${error.digest}` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n")
      : null;

  return (
    <section
      role={isNotFound ? "status" : "alert"}
      aria-labelledby="error-state-title"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="pn-badge mb-6" aria-hidden="true">
        {isNotFound ? "404" : "500"}
      </span>
      <h1 id="error-state-title" className="mb-3 text-3xl font-bold">
        {isNotFound ? t.notFoundTitle : t.errorTitle}
      </h1>
      <p className="mb-8 max-w-md text-muted-foreground">
        {isNotFound ? t.notFoundMessage : t.errorMessage}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {retry ? (
          <button
            type="button"
            onClick={() => retry()}
            className="pn-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t.retry}
          </button>
        ) : null}
        <Link
          href={`/${locale}`}
          className="pn-btn pn-btn-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t.backHome}
        </Link>
      </div>
      {devDetails ? (
        <details className="mt-8 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {t.devDetails}
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap border-2 border-border bg-card p-4 font-mono text-xs">
            {devDetails}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
