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
          <h1 className="mb-2 text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {dict.analyze.title}
          </h1>
          <p className="text-muted-foreground">
            {dict.analyze.subtitle}
          </p>
        </div>

        {isAnalyzing ? (
          <div className="brutal-card p-6 sm:p-12 text-center">
            <div className="relative mx-auto mb-6 h-24 w-24 sm:h-32 sm:w-32">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="8"
                  strokeLinecap="square"
                  strokeDasharray={`${(progress / 100) * 263.89} 263.89`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-mono">{progress}</span>
                <span className="text-xs font-bold text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold uppercase">
              {dict.analyze.progressTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dict.analyze.progressDescription}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden border-2 border-border bg-muted shadow-[2px_2px_0px_var(--border)]">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="brutal-card">
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
