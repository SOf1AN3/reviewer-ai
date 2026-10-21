"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Clock } from "lucide-react";
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

/** Statut de la ressource côté serveur (contrat GET /api/analyse/[id]). */
type RemoteStatus = "pending" | "completed";

interface AnalysePayload {
  status: RemoteStatus;
  article: ArticleData;
  analyse: AnalyseData | null;
}

type PageState =
  | { kind: "loading" }
  | { kind: "pending" }
  | { kind: "ready"; analyse: AnalyseData }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 90_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArticleData(value: unknown): value is ArticleData {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.titre === "string" &&
    typeof value.contenu === "string" &&
    (value.auteur === null || typeof value.auteur === "string") &&
    (value.revueCiblee === null || typeof value.revueCiblee === "string") &&
    typeof value.dateCreation === "string"
  );
}

function isAnalyseData(value: unknown): value is AnalyseData {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.noteGlobale === "number" &&
    isRecord(value.noteParCritere) &&
    isRecord(value.rapport) &&
    typeof value.dateAnalyse === "string"
  );
}

function isPayload(value: unknown): value is AnalysePayload {
  return (
    isRecord(value) &&
    (value.status === "pending" || value.status === "completed") &&
    isArticleData(value.article) &&
    (value.analyse === null || value.analyse === undefined || isAnalyseData(value.analyse))
  );
}

export default function AnalysePage() {
  const params = useParams();
  const router = useRouter();
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const articleId = params.id;
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [trackedArticleId, setTrackedArticleId] = useState(articleId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialise l'état à chaque changement de route (navigation client vers
  // une autre analyse). Pattern officiel React « adjust state during render » :
  // évite un setState synchrone dans l'effet (react-hooks/set-state-in-effect)
  // tout en garantissant un écran de chargement au premier rendu de chaque id.
  if (trackedArticleId !== articleId) {
    setTrackedArticleId(articleId);
    setState({ kind: "loading" });
    setArticle(null);
  }

  const dateLocale = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";

  useEffect(() => {
    let cancelled = false;

    const stopTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/analyse/${articleId}`);
        const data: unknown = await response.json().catch(() => null);

        if (cancelled) return;

        // Erreurs définitives : on arrête immédiatement (jamais de polling
        // sur une ressource interdite ou inexistante).
        if (!response.ok) {
          const message = isRecord(data) && typeof data.error === "string"
            ? data.error
            : dict.analyseDetail.notFound;
          setState({ kind: "error", message });
          return;
        }

        if (!isPayload(data)) {
          setState({ kind: "error", message: dict.analyseDetail.notFound });
          return;
        }

        setArticle(data.article);

        if (data.status === "completed" && data.analyse) {
          setState({ kind: "ready", analyse: data.analyse });
          return;
        }

        // Toujours en attente : on replanifie si le plafond n'est pas atteint.
        if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
          setState({ kind: "timeout" });
          return;
        }
        setState({ kind: "pending" });
        timerRef.current = setTimeout(fetchStatus, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        setState({ kind: "error", message: dict.analyseDetail.errorGeneric });
      }
    };

    const startedAt = Date.now();
    fetchStatus();

    return () => {
      cancelled = true;
      stopTimer();
    };
    // `attempt` force un re-fetch au clic sur « Réessayer ».
  }, [articleId, attempt, dict.analyseDetail.errorGeneric, dict.analyseDetail.notFound]);

  const handleRetry = () => {
    setState((prev) => (prev.kind === "error" ? prev : { kind: "loading" }));
    setAttempt((a) => a + 1);
  };

  if (state.kind === "loading") {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="font-bold uppercase tracking-wider text-muted-foreground">
            {dict.analyseDetail.loading}
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "pending") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.push(`/${locale}/analyser`)}
            className="pn-btn mb-6 inline-flex items-center gap-2 text-xs"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {dict.analyseDetail.newAnalysis}
          </button>

          <div
            role="status"
            aria-live="polite"
            className="pn-card mx-auto max-w-2xl text-center"
          >
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <p className="text-lg font-bold uppercase tracking-wider">
              {dict.analyseDetail.pendingTitle}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {dict.analyseDetail.pendingDescription}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {dict.articleForm.progressDelay}
            </p>
            {article && (
              <p className="mt-4 truncate border-t-2 border-border pt-4 text-sm font-bold uppercase tracking-wider">
                {article.titre}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "timeout") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="pn-card p-8">
            <Clock className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden="true" />
            <p className="text-lg font-bold">
              {dict.analyseDetail.timeoutTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dict.analyseDetail.timeoutDescription}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleRetry}
                className="pn-btn inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {dict.analyseDetail.retry}
              </button>
              <button
                onClick={() => router.push(`/${locale}/analyser`)}
                className="pn-btn pn-btn-secondary inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {dict.analyseDetail.newAnalysis}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="pn-card p-8">
            <p className="text-lg font-bold text-destructive">{state.message}</p>
            <button
              onClick={() => router.push(`/${locale}/analyser`)}
              className="pn-btn mt-4 inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {dict.analyseDetail.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    // Garde-fou : l'état « ready » implique un article validé par isPayload.
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="pn-card p-8">
            <p className="text-lg font-bold text-destructive">
              {dict.analyseDetail.notFound}
            </p>
            <button
              onClick={() => router.push(`/${locale}/analyser`)}
              className="pn-btn mt-4 inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {dict.analyseDetail.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { analyse } = state;
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
          className="pn-btn mb-6 inline-flex items-center gap-2 text-xs"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {dict.analyseDetail.newAnalysis}
        </button>

        {/* Article info */}
        <div className="pn-card mb-6">
          <h1 className="mb-3 text-2xl font-bold uppercase tracking-tight">
            {article.titre}
          </h1>
          <div className="flex flex-wrap gap-2">
            {article.auteur && (
              <span className="pn-tag">{article.auteur}</span>
            )}
            {article.revueCiblee && (
              <span className="pn-tag">{article.revueCiblee}</span>
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
