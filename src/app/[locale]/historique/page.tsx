"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Loader2, FlaskConical, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

interface HistoryItem {
  id: string;
  titre: string;
  auteur: string | null;
  revueCiblee: string | null;
  dateCreation: string;
  noteGlobale: number;
  dateAnalyse: string;
}

export default function HistoriquePage() {
  const router = useRouter();
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/history");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || dict.historique.errorLoading);
        }

        setHistory(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : dict.historique.errorUnknown
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [dict.historique.errorLoading, dict.historique.errorUnknown]);

  const getNoteStyle = (note: number) => {
    if (note >= 80) return "text-score-great bg-score-great/10";
    if (note >= 60) return "text-score-good bg-score-good/10";
    if (note >= 40) return "text-score-ok bg-score-ok/10";
    return "text-score-bad bg-score-bad/10";
  };

  const dateLocale = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <div className="pn-card relative w-full max-w-sm overflow-hidden p-8 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-14 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-teal-highlight/20 blur-3xl"
          />
          <Loader2
            className="relative mx-auto mb-4 h-8 w-8 animate-spin text-teal-highlight"
            aria-hidden="true"
          />
          <p className="relative font-mono text-[11px] text-cream-muted sm:text-xs">
            {dict.historique.loading}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="pn-card relative overflow-hidden p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-teal-highlight/15 blur-3xl"
            />
            <p className="relative font-display text-lg font-semibold text-error">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 font-display text-2xl font-semibold text-cream-text tracking-tight sm:text-3xl">
          {dict.historique.title}
        </h1>

        {history.length === 0 ? (
          <div className="pn-card relative overflow-hidden p-8 text-center sm:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-teal-highlight/20 blur-3xl"
            />
            <FlaskConical
              className="relative mx-auto mb-4 h-12 w-12 text-teal-highlight"
              aria-hidden="true"
            />
            <h2 className="relative font-display text-xl font-semibold text-cream-text">
              {dict.historique.emptyTitle}
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-cream-muted">
              {dict.historique.emptyDescription}
            </p>
            <Link
              href={`/${locale}/analyser`}
              className="pn-btn relative mt-6 inline-flex items-center gap-2"
            >
              {dict.historique.emptyButton}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/${locale}/analyse/${item.id}`)}
                className="pn-card-hover group w-full rounded-xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-highlight/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-base font-semibold text-cream-text transition-colors group-hover:text-teal-highlight sm:text-lg">
                      {item.titre}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.auteur && (
                        <span className="pn-tag">{item.auteur}</span>
                      )}
                      {item.revueCiblee && (
                        <span className="pn-tag">{item.revueCiblee}</span>
                      )}
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cream-muted sm:text-xs">
                        <Clock className="h-3 w-3 text-teal-highlight" aria-hidden="true" />
                        {new Date(item.dateAnalyse).toLocaleDateString(dateLocale)}
                      </span>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-teal-highlight opacity-0 transition-opacity group-hover:opacity-100 sm:text-xs">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <div
                    className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-current font-mono text-xl font-semibold ${getNoteStyle(
                      item.noteGlobale
                    )}`}
                  >
                    {item.noteGlobale}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
