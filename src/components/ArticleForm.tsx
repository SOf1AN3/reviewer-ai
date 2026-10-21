"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Upload, Loader2, FileUp, LogIn, Sparkles } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

interface ArticleFormProps {
  onAnalysisStart?: () => void;
  onAnalysisEnd?: () => void;
}

/** Phase du flux d'analyse asynchrone (POST /api/analyze répond 202). */
type SubmitPhase = "sending" | "analyzing";

interface FormError {
  message: string;
  /** Affiche un CTA contextuel sous le message d'erreur. */
  action?: "pricing" | "login";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Extrait un message lisible depuis la réponse d'erreur d'/api/analyze,
 * y compris les `details` retournés par Zod sur un payload invalide (400).
 */
function formatErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && Array.isArray(payload.details)) {
    const messages = payload.details
      .filter(isRecord)
      .map((issue) => (typeof issue.message === "string" ? issue.message : null))
      .filter((message): message is string => message !== null);
    if (messages.length > 0) {
      return messages.join(" • ");
    }
  }
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

export function ArticleForm({ onAnalysisStart, onAnalysisEnd }: ArticleFormProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [auteur, setAuteur] = useState("");
  const [revueCiblee, setRevueCiblee] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const redirectTimerRef = useRef<number | null>(null);

  // Nettoyage du timer de redirection en cas de démontage pendant l'envoi.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || dict.articleForm.errorUpload);
      }

      setContenu(data.text);
      if (!titre) {
        setTitre(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : dict.articleForm.errorUploadImport,
      });
    } finally {
      setIsUploading(false);
    }
  }, [titre, dict.articleForm.errorUpload, dict.articleForm.errorUploadImport]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Anti double-soumission.
    setError(null);
    setIsLoading(true);
    setSubmitPhase("sending");
    onAnalysisStart?.();

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, contenu, auteur, revueCiblee, locale }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        let formError: FormError;
        if (response.status === 401) {
          formError = {
            message: dict.articleForm.errorNotLoggedIn,
            action: "login",
          };
        } else if (
          response.status === 403 &&
          isRecord(data) &&
          data.code === "QUOTA_EXCEEDED"
        ) {
          formError = {
            message: formatErrorMessage(data, dict.articleForm.errorQuota),
            action: "pricing",
          };
        } else {
          formError = {
            message: formatErrorMessage(data, dict.articleForm.errorAnalysis),
          };
        }
        setError(formError);
        setIsLoading(false);
        setSubmitPhase(null);
        onAnalysisEnd?.();
        return;
      }

      // 202 : l'analyse tourne en arrière-plan, on redirige vers la page de
      // résultat qui gère elle-même l'attente (polling).
      const articleId = isRecord(data) ? data.articleId : null;
      if (typeof articleId !== "string" || articleId.length === 0) {
        setError({ message: dict.articleForm.errorUnknown });
        setIsLoading(false);
        setSubmitPhase(null);
        onAnalysisEnd?.();
        return;
      }

      onAnalysisEnd?.();
      setSubmitPhase("analyzing");
      redirectTimerRef.current = window.setTimeout(() => {
        router.push(`/${locale}/analyse/${articleId}`);
      }, 700);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : dict.articleForm.errorUnknown,
      });
      setIsLoading(false);
      setSubmitPhase(null);
      onAnalysisEnd?.();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    e.target.value = "";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative space-y-6"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-4 border-dashed border-primary bg-background/90 backdrop-blur-sm">
          <div className="text-center">
            <FileUp className="mx-auto mb-4 h-12 w-12 animate-bounce text-primary" />
            <p className="text-lg font-bold uppercase tracking-wider">
              {dict.articleForm.dropzoneTitle}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {dict.articleForm.dropzoneFormats}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="titre"
          className="text-sm font-bold uppercase tracking-wider"
        >
          {dict.articleForm.titleLabel}
        </label>
        <input
          id="titre"
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder={dict.articleForm.titlePlaceholder}
          className="pn-input w-full"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="auteur"
            className="text-sm font-bold uppercase tracking-wider"
          >
            {dict.articleForm.author}
          </label>
          <input
            id="auteur"
            type="text"
            value={auteur}
            onChange={(e) => setAuteur(e.target.value)}
            placeholder={dict.articleForm.authorPlaceholder}
            className="pn-input w-full"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="revue"
            className="text-sm font-bold uppercase tracking-wider"
          >
            {dict.articleForm.journal}
          </label>
          <input
            id="revue"
            type="text"
            value={revueCiblee}
            onChange={(e) => setRevueCiblee(e.target.value)}
            placeholder={dict.articleForm.journalPlaceholder}
            className="pn-input w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label
            htmlFor="contenu"
            className="text-sm font-bold uppercase tracking-wider"
          >
            {dict.articleForm.contentLabel}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? dict.articleForm.importing : dict.articleForm.importFile}
            <input
              type="file"
              accept=".txt,.md,.docx,.pdf,.tex"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
        <textarea
          id="contenu"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder={dict.articleForm.contentPlaceholder}
          className="pn-input h-48 sm:h-72 w-full resize-none"
          required
        />
        <p className="text-xs font-mono font-bold text-muted-foreground">
          {contenu.length} {dict.articleForm.charCount}
        </p>
      </div>

      {submitPhase && (
        <div
          role="status"
          aria-live="polite"
          className="border-2 border-primary bg-primary/5 p-4 shadow-[2px_2px_0px_var(--primary)]"
        >
          <div className="flex items-start gap-3">
            <Loader2
              className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">
                {submitPhase === "sending"
                  ? dict.articleForm.progressSending
                  : dict.articleForm.progressAnalyzing}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {submitPhase === "sending"
                  ? dict.articleForm.progressHintSending
                  : `${dict.articleForm.progressHintAnalyzing} (${dict.articleForm.progressDelay})`}
              </p>
            </div>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden border-2 border-primary bg-background"
            aria-hidden="true"
          >
            <div
              className="h-full w-1/3 animate-pulse bg-primary"
              style={{ marginLeft: submitPhase === "sending" ? "0%" : "33%" }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold shadow-[2px_2px_0px_var(--destructive)]"
        >
          <p>{error.message}</p>
          {error.action === "pricing" && (
            <button
              type="button"
              onClick={() => router.push(`/${locale}/pricing`)}
              className="pn-btn mt-3 inline-flex items-center gap-2 text-xs"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {dict.articleForm.ctaPricing}
            </button>
          )}
          {error.action === "login" && (
            <button
              type="button"
              onClick={() => router.push(`/${locale}/login`)}
              className="pn-btn mt-3 inline-flex items-center gap-2 text-xs"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {dict.articleForm.ctaLogin}
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || isUploading || contenu.length < 100}
        aria-busy={isLoading}
        className="pn-btn flex w-full items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {submitPhase === "analyzing"
              ? dict.articleForm.progressAnalyzing
              : dict.articleForm.submitAnalyzing}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            {dict.articleForm.submitButton}
          </>
        )}
      </button>
    </form>
  );
}
