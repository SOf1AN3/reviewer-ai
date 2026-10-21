"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PricingCard } from "@/components/PricingCard";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

type PlanFeature = { label: string; included: boolean };

/**
 * Les dictionnaires exposent les features comme des tables de strings
 * (incluses + exclues). PricingCard attend { label, included }[] :
 * on liste d'abord les features incluses, puis les features exclues.
 */
function toIncludedFeatures(labels: readonly string[]): PlanFeature[] {
  return labels.map((label) => ({ label, included: true }));
}

function toFeatures(
  included: readonly string[],
  excluded: readonly string[]
): PlanFeature[] {
  return [
    ...toIncludedFeatures(included),
    ...excluded.map((label) => ({ label, included: false })),
  ];
}

export default function PricingPage() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const pricing = dict.pricing;
  const { tierTags, popularBadge: popularLabel } = dict.home.pricingSection;

  const handleSelect = async (plan: string) => {
    if (!session) {
      router.push(`/${locale}/login`);
      return;
    }

    if (plan === "free") {
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      console.error("Checkout error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Blobs atmosphériques décoratifs derrière le titre */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-sage-glow blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-48 h-56 w-56 rounded-full bg-amber-glow blur-3xl"
      />

      <div className="mx-auto w-full max-w-[1140px] px-4 py-16">
        <div className="relative mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream-text sm:text-5xl">
            {pricing.title}
          </h1>
          <p className="mt-4 text-lg text-cream-muted">{pricing.subtitle}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          <PricingCard
            plan={pricing.free.name}
            price={0}
            features={toFeatures(
              pricing.free.features,
              pricing.free.excludedFeatures
            )}
            cta={pricing.free.cta}
            tag={tierTags.free}
            popularLabel={popularLabel}
            onSelect={() => handleSelect("free")}
          />
          <PricingCard
            plan={pricing.pro.name}
            price={19}
            features={toFeatures(
              pricing.pro.features,
              pricing.pro.excludedFeatures
            )}
            cta={loading === "pro" ? "..." : pricing.pro.cta}
            highlighted
            tag={tierTags.pro}
            popularLabel={popularLabel}
            onSelect={() => handleSelect("pro")}
          />
          <PricingCard
            plan={pricing.business.name}
            price={49}
            features={toFeatures(
              pricing.business.features,
              pricing.business.excludedFeatures
            )}
            cta={loading === "business" ? "..." : pricing.business.cta}
            tag={tierTags.business}
            popularLabel={popularLabel}
            onSelect={() => handleSelect("business")}
          />
        </div>

        <p className="mt-12 text-center text-sm text-cream-muted">
          {pricing.guarantee}
        </p>
      </div>
    </div>
  );
}
