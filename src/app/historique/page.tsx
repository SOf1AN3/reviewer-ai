"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, FlaskConical, ArrowRight } from "lucide-react";

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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/history");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erreur lors du chargement");
        }

        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getNoteStyle = (note: number) => {
    if (note >= 80)
      return "text-score-great border-score-great bg-score-great/10 shadow-[2px_2px_0px_var(--score-great)]";
    if (note >= 60)
      return "text-score-good border-score-good bg-score-good/10 shadow-[2px_2px_0px_var(--score-good)]";
    if (note >= 40)
      return "text-score-ok border-score-ok bg-score-ok/10 shadow-[2px_2px_0px_var(--score-ok)]";
    return "text-score-bad border-score-bad bg-score-bad/10 shadow-[2px_2px_0px_var(--score-bad)]";
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="font-bold uppercase tracking-wider text-muted-foreground">
            Chargement de l&apos;historique...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="brutal-card p-8">
            <p className="text-lg font-bold text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold uppercase tracking-tight">
          Historique des analyses
        </h1>

        {history.length === 0 ? (
          <div className="brutal-card p-12 text-center">
            <FlaskConical className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-bold uppercase">
              Aucune analyse pour le moment
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Analysez votre premier article pour commencer.
            </p>
            <button
              onClick={() => router.push("/")}
              className="brutal-btn mt-6 inline-flex items-center gap-2"
            >
              Analyser un article
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/analyse/${item.id}`)}
                className="brutal-card-hover w-full text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold uppercase tracking-wider">
                      {item.titre}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.auteur && (
                        <span className="brutal-tag">{item.auteur}</span>
                      )}
                      {item.revueCiblee && (
                        <span className="brutal-tag">{item.revueCiblee}</span>
                      )}
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.dateAnalyse).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`flex h-14 w-14 flex-shrink-0 items-center justify-center border-2 border-border font-mono text-xl font-bold ${getNoteStyle(
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
