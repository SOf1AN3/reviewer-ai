"use client";

import { Check, X, Zap } from "lucide-react";

interface PricingCardProps {
  plan: string;
  price: number;
  features: { label: string; included: boolean }[];
  cta: string;
  highlighted?: boolean;
  currentPlan?: boolean;
  onSelect: () => void;
  tag?: string;
  popularLabel?: string;
}

export function PricingCard({
  plan,
  price,
  features,
  cta,
  highlighted = false,
  currentPlan = false,
  onSelect,
  tag,
  popularLabel,
}: PricingCardProps) {
  return (
    <div
      className={`pn-card relative isolate flex flex-col justify-between rounded-xl p-6 ${
        highlighted ? "bg-surface-container-high shadow-2xl" : ""
      } ${currentPlan ? "opacity-60" : ""}`}
    >
      {highlighted && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 -top-4 -z-10 h-24 rounded-full bg-amber-glow blur-2xl"
        />
      )}

      {highlighted && popularLabel && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-amber-badge px-3 py-1 text-xs font-semibold text-background shadow-md">
          <Zap aria-hidden="true" className="h-3.5 w-3.5" />
          {popularLabel}
        </span>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-cream-text">
          {plan}
        </h3>
        {tag && <span className="pn-tag shrink-0">{tag}</span>}
      </div>

      <div className="mt-4 mb-6 flex items-baseline gap-1">
        <span className="font-display text-[40px] font-light leading-none text-cream-text md:text-[48px]">
          {price} €
        </span>
        {price > 0 && (
          <span className="text-sm text-cream-muted">/mois</span>
        )}
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-2 text-sm">
            {f.included ? (
              <Check
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-highlight"
              />
            ) : (
              <X
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-outline"
              />
            )}
            <span
              className={
                f.included ? "text-cream-text" : "text-muted-foreground line-through"
              }
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={currentPlan}
        className={`mt-6 w-full rounded-lg py-3 text-sm font-semibold ${
          highlighted ? "pn-btn" : "pn-btn pn-btn-secondary"
        } ${currentPlan ? "pointer-events-none" : ""}`}
      >
        {currentPlan ? "Plan actuel" : cta}
      </button>
    </div>
  );
}
