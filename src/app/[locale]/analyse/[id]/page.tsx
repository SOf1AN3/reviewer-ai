"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnalyseResultDisplay } from "@/components/AnalyseResult";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { AnalyseResult } from "@/lib/types";

interface ArticleData {
  id: string;
  titre: string;
  contenu: string;
  auteur: string | null;
  revueCiblee: string | null;
  dateCreation: string;
}

interface AnalyseData {
  id: string;
  rapport: AnalyseResult["rapport"];
  noteGlobale: number;
  noteParCritere: Record<string, number>;
  dateAnalyse: string;
}

export default function AnalysePage() {
  const params = useParams();
  const router = useRouter();
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateLocale = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analyse/${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || dict.analyseDetail.loading);
        }

        setArticle(data.article);
        setAnalyse(data.analyse);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : dict.analyseDetail.notFound
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, dict.analyseDetail.loading, dict.analyseDetail.notFound]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="font-bold uppercase tracking-wider text-muted-foreground">
            {dict.analyseDetail.loading}
          </p>
        </div>
      </div>
    );
  }

  if (error || !article || !analyse) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="brutal-card p-8">
            <p className="text-lg font-bold text-destructive">
              {error || dict.analyseDetail.notFound}
            </p>
            <button
              onClick={() => router.push(`/${locale}/analyser`)}
              className="brutal-btn mt-4 inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {dict.analyseDetail.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const result: AnalyseResult = {
    noteGlobale: analyse.noteGlobale,
    notesParCritere: analyse.noteParCritere,
    rapport: analyse.rapport,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}/analyser`)}
          className="brutal-btn mb-6 inline-flex items-center gap-2 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.analyseDetail.newAnalysis}
        </button>

        {/* Article info */}
        <div className="brutal-card mb-6">
          <h1 className="mb-3 text-2xl font-bold uppercase tracking-tight">
            {article.titre}
          </h1>
          <div className="flex flex-wrap gap-2">
            {article.auteur && (
              <span className="brutal-tag">{article.auteur}</span>
            )}
            {article.revueCiblee && (
              <span className="brutal-tag">{article.revueCiblee}</span>
            )}
            <span className="inline-flex items-center font-mono text-xs text-muted-foreground">
              {dict.analyseDetail.analyzedOn}{" "}
              {new Date(analyse.dateAnalyse).toLocaleDateString(dateLocale)}
            </span>
          </div>
        </div>

        {/* Result */}
        <AnalyseResultDisplay result={result} />
      </div>
    </div>
  );
}
