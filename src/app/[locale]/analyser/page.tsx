"use client";

import { useState, useRef, useCallback } from "react";
import { ArticleForm } from "@/components/ArticleForm";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

export default function AnalyserPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  const startProgress = useCallback(() => {
    setIsAnalyzing(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progressValue = Math.min(
        90,
        Math.round((1 - Math.exp(-elapsed / 18)) * 90)
      );
      setProgress(progressValue);
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    setTimeout(() => {
      setIsAnalyzing(false);
      setProgress(0);
    }, 600);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-display text-2xl sm:text-3xl font-semibold text-cream-text tracking-tight">
            {dict.analyze.title}
          </h1>
          <p className="text-sm text-cream-muted sm:text-base">
            {dict.analyze.subtitle}
          </p>
        </div>

        {isAnalyzing ? (
          <div className="pn-card relative overflow-hidden p-6 text-center sm:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-teal-highlight/20 blur-3xl"
            />
            <div className="relative mx-auto mb-6 h-24 w-24 sm:h-32 sm:w-32">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--outline)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--teal-highlight)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 263.89} 263.89`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-semibold text-cream-text">
                  {progress}
                </span>
                <span className="font-mono text-xs text-cream-muted">%</span>
              </div>
            </div>
            <p className="relative font-display text-lg font-semibold text-cream-text sm:text-xl">
              {dict.analyze.progressTitle}
            </p>
            <p className="relative mt-2 text-sm text-cream-muted">
              {dict.analyze.progressDescription}
            </p>
            <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full border border-glass-border bg-surface-container-low">
              <div
                className="h-full rounded-full bg-teal-highlight transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="pn-card rounded-xl">
            <ArticleForm
              onAnalysisStart={startProgress}
              onAnalysisEnd={stopProgress}
            />
          </div>
        )}
      </div>
    </div>
  );
}
