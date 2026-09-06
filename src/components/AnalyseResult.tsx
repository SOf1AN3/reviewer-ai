"use client";

import type { AnalyseResult } from "@/lib/types";
import { criteres } from "@/config/crits";
import {
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface AnalyseResultProps {
  result: AnalyseResult;
}

function NoteGauge({ note }: { note: number }) {
  const getColorClass = (n: number) => {
    if (n >= 80) return "text-score-great";
    if (n >= 60) return "text-score-good";
    if (n >= 40) return "text-score-ok";
    return "text-score-bad";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28 sm:h-36 sm:w-36 border-3 border-border shadow-[4px_4px_0px_var(--border)] bg-card">
        <svg className="h-28 w-28 sm:h-36 sm:w-36 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${(note / 100) * 238.76} 238.76`}
            className={getColorClass(note)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl sm:text-4xl font-bold ${getColorClass(note)}`}>
            {note}
          </span>
          <span className="text-xs font-bold uppercase text-muted-foreground">
            /100
          </span>
        </div>
      </div>
    </div>
  );
}

function CritereBar({ note, label }: { note: number; label: string }) {
  const getBarColor = (n: number) => {
    if (n >= 80) return "bg-score-great";
    if (n >= 60) return "bg-score-good";
    if (n >= 40) return "bg-score-ok";
    return "bg-score-bad";
  };

  return (
    <div className="flex flex-col justify-between h-16">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider">
          {label}
        </span>
        <span className="font-mono text-sm font-bold">{note}/100</span>
      </div>
      <div className="h-4 overflow-hidden border-2 border-border bg-muted shadow-[2px_2px_0px_var(--border)]">
        <div
          className={`h-full transition-all ${getBarColor(note)}`}
          style={{ width: `${note}%` }}
        />
      </div>
    </div>
  );
}

export function NoteGlobaleCard({
  noteGlobale,
  verdict,
  resume,
}: {
  noteGlobale: number;
  verdict: string;
  resume: string;
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
        <Target className="h-5 w-5" />
        Note globale
      </h2>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <NoteGauge note={noteGlobale} />
        <div className="flex-1">
          <p className="text-xl font-bold">{verdict}</p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {resume}
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotesParCritereCard({
  notesParCritere,
}: {
  notesParCritere: Record<string, number>;
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
        <TrendingUp className="h-5 w-5" />
        Notes par critère
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {criteres.map((critere) => (
          <CritereBar
            key={critere.id}
            note={notesParCritere[critere.id] || 0}
            label={critere.label}
          />
        ))}
      </div>
    </div>
  );
}

export function PointsFortsCard({
  points,
}: {
  points: string[];
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-score-great">
        <CheckCircle className="h-5 w-5" />
        Points forts
      </h2>
      <ul className="space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 border-score-great bg-score-great/10 text-xs font-bold">
              ✓
            </span>
            <span className="text-sm leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PointsAmeliorerCard({
  points,
}: {
  points: string[];
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-score-ok">
        <AlertCircle className="h-5 w-5" />
        Points à améliorer
      </h2>
      <ul className="space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 border-score-ok bg-score-ok/10 text-xs font-bold">
              !
            </span>
            <span className="text-sm leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecommandationsCard({
  recommandations,
}: {
  recommandations: string[];
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
        <Lightbulb className="h-5 w-5" />
        Recommandations
      </h2>
      <ul className="space-y-3">
        {recommandations.map((rec, i) => (
          <li key={i} className="flex items-start gap-3">
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-sm leading-relaxed">{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyseDetailleeCard({
  rapport,
}: {
  rapport: AnalyseResult["rapport"];
}) {
  return (
    <div className="brutal-card">
      <h2 className="mb-4 text-lg font-bold uppercase tracking-wider">
        Analyse détaillée par critère
      </h2>
      <div className="space-y-4">
        {criteres.map((critere) => {
          const section = rapport.sections[critere.id];
          if (!section) return null;
          const scoreColor =
            section.note >= 80
              ? "text-score-great border-score-great"
              : section.note >= 60
              ? "text-score-good border-score-good"
              : section.note >= 40
              ? "text-score-ok border-score-ok"
              : "text-score-bad border-score-bad";
          return (
            <div
              key={critere.id}
              className="border-b-2 border-border pb-4 last:border-0"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-sm">
                  {critere.label}
                </h3>
                <span
                  className={`font-mono text-sm font-bold border-2 px-2 py-0.5 ${scoreColor}`}
                >
                  {section.note}/100
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {section.commentaire}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyseResultDisplay({ result }: AnalyseResultProps) {
  const { rapport, noteGlobale, notesParCritere } = result;

  return (
    <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
      {/* Colonne gauche : score + critères + points forts/améliorer + recommandations */}
      <div className="space-y-6">
        <NoteGlobaleCard
          noteGlobale={noteGlobale}
          verdict={rapport.verdict}
          resume={rapport.resume}
        />
        <NotesParCritereCard notesParCritere={notesParCritere} />
        <PointsFortsCard points={rapport.points_forts} />
        <PointsAmeliorerCard points={rapport.points_a_ameliorer} />
        <RecommandationsCard recommandations={rapport.recommandations} />
      </div>

      {/* Colonne droite : analyse détaillée */}
      <div>
        <AnalyseDetailleeCard rapport={rapport} />
      </div>
    </div>
  );
}
