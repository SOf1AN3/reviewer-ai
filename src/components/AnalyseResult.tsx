"use client";

import type { AnalyseResult } from "@/lib/types";
import { useI18n } from "./I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";
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
      <div className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-full border border-glass-border bg-surface-glass">
        <svg className="h-28 w-28 sm:h-36 sm:w-36 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-surface-container-highest"
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
          <span className={`font-display text-3xl sm:text-4xl font-bold ${getColorClass(note)}`}>
            {note}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
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
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
          {label}
        </span>
        <span className="font-mono text-sm font-bold text-cream-text">{note}/100</span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(note)}`}
          style={{ width: `${note}%` }}
        />
      </div>
    </div>
  );
}

const criteriaIds = [
  "rigueur_methode",
  "originalite",
  "revue_litterature",
  "clarte_redaction",
  "resultats_analyse",
  "discussion_implications",
  "conformite_normes",
  "impact_potentiel",
] as const;

export function NoteGlobaleCard({
  noteGlobale,
  verdict,
  resume,
}: {
  noteGlobale: number;
  verdict: string;
  resume: string;
}) {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-tight">
        <Target className="h-5 w-5" />
        {dict.result.overallScore}
      </h2>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <NoteGauge note={noteGlobale} />
        <div className="flex-1">
          <p className="font-display text-xl font-semibold tracking-tight">{verdict}</p>
          <p className="mt-3 text-sm leading-relaxed text-cream-muted">
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
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-tight">
        <TrendingUp className="h-5 w-5" />
        {dict.result.scoreByCriteria}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {criteriaIds.map((id) => (
          <CritereBar
            key={id}
            note={notesParCritere[id] || 0}
            label={dict.criteria[id]}
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
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-tight text-score-great">
        <CheckCircle className="h-5 w-5" />
        {dict.result.strengths}
      </h2>
      <ul className="space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-score-great bg-score-great/10 text-xs font-bold text-score-great">
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
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-tight text-score-ok">
        <AlertCircle className="h-5 w-5" />
        {dict.result.weaknesses}
      </h2>
      <ul className="space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-score-ok bg-score-ok/10 text-xs font-bold text-score-ok">
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
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-tight">
        <Lightbulb className="h-5 w-5" />
        {dict.result.recommendations}
      </h2>
      <ul className="space-y-3">
        {recommandations.map((rec, i) => (
          <li key={i} className="flex items-start gap-3">
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-highlight" />
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
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="pn-card rounded-xl">
      <h2 className="mb-4 font-display text-lg tracking-tight">
        {dict.result.detailedAnalysis}
      </h2>
      <div className="space-y-4">
        {criteriaIds.map((id) => {
          const section = rapport.sections[id];
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
              key={id}
              className="border-b border-glass-border pb-4 last:border-0"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                  {dict.criteria[id]}
                </h3>
                <span
                  className={`font-mono text-sm font-bold rounded-md border px-2 py-0.5 ${scoreColor}`}
                >
                  {section.note}/100
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-cream-muted">
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
