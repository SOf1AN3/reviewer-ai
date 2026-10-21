"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

type ReportData = Dictionary["home"]["report"];
type CriteriaDictionary = Dictionary["criteria"];

export interface ReportConsoleProps {
  report: ReportData;
  criteria: CriteriaDictionary;
}

type ReportTab = "verdict" | "criteria" | "checklist";

const TAB_ORDER: readonly ReportTab[] = ["verdict", "criteria", "checklist"];

/** Demo scores, fixed at build time so the console renders identically on server and client. */
const CRITERIA_DEMO_SCORES: readonly number[] = [94, 82, 74, 88, 96, 91, 98, 85];

const PRIORITY_STYLES: readonly string[] = [
  "bg-tertiary-container/20 text-cream-text",
  "bg-secondary-container text-teal-highlight",
  "bg-surface-container-lowest text-on-surface-variant",
];

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getTabLabel(report: ReportData, tab: ReportTab): string {
  switch (tab) {
    case "criteria":
      return report.tabCriteria;
    case "checklist":
      return report.tabChecklist;
    case "verdict":
      return report.tabVerdict;
  }
}

function parseScore(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

interface VerdictPanelProps {
  report: ReportData;
}

function VerdictPanel({ report }: VerdictPanelProps) {
  const score = parseScore(report.scoreValue);
  const dashOffset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
      {/* Left: radial score display */}
      <div className="flex flex-col justify-between rounded-xl bg-surface-container p-6 text-center lg:col-span-5">
        <div className="flex w-full items-center justify-between gap-2 pb-2 text-start">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
            {report.scoreLabel}
          </span>
          <span className="rounded bg-surface-sage px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-teal-highlight">
            {report.scoreTag}
          </span>
        </div>

        <div className="relative my-4 mx-auto flex h-44 w-44 items-center justify-center">
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 120 120"
            role="img"
            aria-label={`${report.scoreLabel}: ${score} ${report.scoreSuffix}`}
          >
            <circle
              className="text-surface-container-highest"
              cx="60"
              cy="60"
              fill="none"
              r={RADIUS}
              stroke="currentColor"
              strokeWidth="8"
            />
            <circle
              className="text-teal-highlight"
              cx="60"
              cy="60"
              fill="none"
              r={RADIUS}
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[48px] font-light leading-none text-cream-text">
              {score}
            </span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
              {report.scoreSuffix}
            </span>
          </div>
        </div>

        <div className="w-full rounded-lg bg-surface-container-high p-3 text-start">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-amber-badge">
            {report.simulationTag}
          </span>
          <p className="mt-1 text-sm text-cream-text">{report.simulationText}</p>
        </div>
      </div>

      {/* Right: strategic recommendations */}
      <div className="flex flex-col justify-between rounded-xl bg-surface-container p-6 lg:col-span-7">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[20px] font-semibold text-cream-text">
              {report.synthTitle}
            </h3>
            <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
              {report.synthMeta}
            </span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-on-surface-variant md:text-base">
            {report.synthText}
          </p>

          <div className="flex flex-col gap-3">
            {report.priorities.map((priority, index) => (
              <div
                key={priority.label}
                className="flex items-start gap-3 rounded-lg bg-surface-container-high p-3"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] ${
                    PRIORITY_STYLES[index] ?? PRIORITY_STYLES[0]
                  }`}
                >
                  {priority.label}
                </span>
                <div className="flex flex-col">
                  <span className="font-display text-[16px] font-semibold leading-snug text-cream-text">
                    {priority.title}
                  </span>
                  <span className="mt-1 text-sm text-on-surface-variant">
                    {priority.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container-high pt-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
            {report.exportNote}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-highlight">
            {report.downloadLink}
            <Download className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}

interface CriteriaPanelProps {
  report: ReportData;
  criteria: CriteriaDictionary;
}

function CriteriaPanel({ report, criteria }: CriteriaPanelProps) {
  const entries: Array<[string, string]> = Object.entries(criteria);

  return (
    <div className="pt-2">
      <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
        {report.criteriaHint}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {entries.map(([id, label], index) => {
          const score = CRITERIA_DEMO_SCORES[index % CRITERIA_DEMO_SCORES.length];
          const isLow = score < 80;

          return (
            <div key={id} className="rounded-xl bg-surface-container p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                  {label}
                </span>
                <span
                  className={`font-display text-[20px] font-semibold ${
                    isLow ? "text-amber-badge" : "text-teal-highlight"
                  }`}
                >
                  {score}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full ${
                    isLow ? "bg-amber-badge" : "bg-teal-highlight"
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ChecklistPanelProps {
  report: ReportData;
}

function ChecklistPanel({ report }: ChecklistPanelProps) {
  return (
    <div className="pt-2">
      <div className="flex flex-col gap-4 rounded-xl bg-surface-container p-6">
        {report.checklist.map((item, index) => (
          <div
            key={item.title}
            className={`flex items-start gap-4 ${
              index < report.checklist.length - 1
                ? "border-b border-surface-container-high pb-4"
                : ""
            }`}
          >
            <input
              type="checkbox"
              defaultChecked={index < 2}
              disabled
              className="mt-1 h-4 w-4 shrink-0 accent-teal-highlight"
              aria-label={item.title}
            />
            <div className="flex-1">
              <span className="font-display text-[16px] font-semibold text-cream-text">
                {item.title}
              </span>
              <p className="mt-1 text-sm text-on-surface-variant">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportConsole({ report, criteria }: ReportConsoleProps) {
  const [tab, setTab] = useState<ReportTab>("verdict");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TAB_ORDER.indexOf(tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_ORDER.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = TAB_ORDER[nextIndex];
      setTab(nextTab);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="w-full rounded-xl bg-surface-container-lowest p-4 shadow-2xl md:p-6">
      {/* Console topbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-error" aria-hidden="true" />
          <span className="h-3 w-3 rounded-full bg-amber-badge" aria-hidden="true" />
          <span className="h-3 w-3 rounded-full bg-teal-highlight" aria-hidden="true" />
          <span className="ms-2 break-all font-mono text-[11px] text-cream-muted">
            {report.fileName}
          </span>
        </div>
        <div
          role="tablist"
          aria-label={report.fileName}
          onKeyDown={handleTabKeyDown}
          className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-container p-1"
        >
          {TAB_ORDER.map((tabId, index) => {
            const isActive = tab === tabId;

            return (
              <button
                key={tabId}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`report-tab-${tabId}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="report-tabpanel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setTab(tabId)}
                className={
                  isActive
                    ? "rounded-lg bg-surface-sage px-3 py-1.5 text-sm font-semibold text-teal-highlight shadow-sm transition-all"
                    : "rounded-lg px-3 py-1.5 text-sm text-on-surface-variant transition-all hover:text-cream-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                }
              >
                {getTabLabel(report, tabId)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panels */}
      <div
        id="report-tabpanel"
        role="tabpanel"
        aria-labelledby={`report-tab-${tab}`}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tab === "verdict" && <VerdictPanel report={report} />}
        {tab === "criteria" && <CriteriaPanel report={report} criteria={criteria} />}
        {tab === "checklist" && <ChecklistPanel report={report} />}
      </div>
    </div>
  );
}
