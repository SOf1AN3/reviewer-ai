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
}

export function PricingCard({
  plan,
  price,
  features,
  cta,
  highlighted = false,
  currentPlan = false,
  onSelect,
}: PricingCardProps) {
  return (
    <div
      className={`brutal-card flex flex-col ${
        highlighted
          ? "border-primary shadow-[6px_6px_0px_var(--primary)]"
          : ""
      } ${currentPlan ? "opacity-60" : ""}`}
    >
      {highlighted && (
        <div className="mb-4 inline-flex items-center gap-1 self-start border-2 border-primary bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          <Zap className="h-3 w-3" />
          Populaire
        </div>
      )}
      <h3 className="text-xl font-bold uppercase tracking-wider">{plan}</h3>
      <div className="mt-3 mb-6">
        <span className="text-4xl font-bold">{price}€</span>
        <span className="text-sm text-muted-foreground">/mois</span>
      </div>
      <ul className="mb-8 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f.label} className="flex items-center gap-2 text-sm">
            {f.included ? (
              <Check className="h-4 w-4 flex-shrink-0 text-score-great" />
            ) : (
              <X className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <span className={f.included ? "" : "text-muted-foreground"}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={currentPlan}
        className={`brutal-btn w-full text-center ${
          highlighted ? "" : "brutal-btn-secondary"
        } ${currentPlan ? "pointer-events-none" : ""}`}
      >
        {currentPlan ? "Plan actuel" : cta}
      </button>
    </div>
  );
}
