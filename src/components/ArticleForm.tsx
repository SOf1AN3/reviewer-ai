"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Upload, Loader2, FileUp } from "lucide-react";

interface ArticleFormProps {
  onAnalysisStart?: () => void;
  onAnalysisEnd?: () => void;
}

export function ArticleForm({ onAnalysisStart, onAnalysisEnd }: ArticleFormProps) {
  const router = useRouter();
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [auteur, setAuteur] = useState("");
  const [revueCiblee, setRevueCiblee] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

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
        throw new Error(data.error || "Erreur lors de la lecture du fichier");
      }

      setContenu(data.text);
      if (!titre) {
        setTitre(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import du fichier");
    } finally {
      setIsUploading(false);
    }
  }, [titre]);

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
    setError(null);
    setIsLoading(true);
    onAnalysisStart?.();

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, contenu, auteur, revueCiblee }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      onAnalysisEnd?.();
      router.push(`/analyse/${data.articleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setIsLoading(false);
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
              Déposez votre fichier ici
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PDF, DOCX, TEX, TXT ou MD
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="titre"
          className="text-sm font-bold uppercase tracking-wider"
        >
          Titre de l&apos;article *
        </label>
        <input
          id="titre"
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Titre de votre article scientifique"
          className="brutal-input w-full"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="auteur"
            className="text-sm font-bold uppercase tracking-wider"
          >
            Auteur(s)
          </label>
          <input
            id="auteur"
            type="text"
            value={auteur}
            onChange={(e) => setAuteur(e.target.value)}
            placeholder="Nom de(s) auteur(s)"
            className="brutal-input w-full"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="revue"
            className="text-sm font-bold uppercase tracking-wider"
          >
            Revue ciblée
          </label>
          <input
            id="revue"
            type="text"
            value={revueCiblee}
            onChange={(e) => setRevueCiblee(e.target.value)}
            placeholder="Ex: Nature, Science, Lancet..."
            className="brutal-input w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label
            htmlFor="contenu"
            className="text-sm font-bold uppercase tracking-wider"
          >
            Contenu de l&apos;article *
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? "Import..." : "Importer un fichier"}
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
          placeholder="Collez ici le contenu complet de votre article scientifique..."
          className="brutal-input h-48 sm:h-72 w-full resize-none"
          required
        />
        <p className="text-xs font-mono font-bold text-muted-foreground">
          {contenu.length} caractères • Min. 100 requis
        </p>
      </div>

      {error && (
        <div className="border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold shadow-[2px_2px_0px_var(--destructive)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || contenu.length < 100}
        className="brutal-btn flex w-full items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse en cours...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Analyser l&apos;article
          </>
        )}
      </button>
    </form>
  );
}
