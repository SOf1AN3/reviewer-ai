"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PricingCard } from "@/components/PricingCard";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

export default function PricingPage() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const pricing = dict.pricing;

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
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-4 text-3xl font-bold uppercase tracking-tight sm:text-5xl">
          {pricing.title}
        </h1>
        <p className="mb-12 text-lg text-muted-foreground">
          {pricing.subtitle}
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        <PricingCard
          plan={pricing.free.name}
          price={0}
          features={[
            { label: "3 analyses/mois", included: true },
            { label: "Note globale uniquement", included: true },
            { label: "PDF, TXT", included: true },
            { label: "Historique 7 jours", included: true },
            { label: "Rapport détaillé 8 critères", included: false },
            { label: "Tous formats", included: false },
            { label: "Export PDF", included: false },
            { label: "Support prioritaire", included: false },
          ]}
          cta={pricing.free.cta}
          onSelect={() => handleSelect("free")}
        />
        <PricingCard
          plan={pricing.pro.name}
          price={19}
          features={[
            { label: "50 analyses/mois", included: true },
            { label: "Rapport détaillé 8 critères", included: true },
            { label: "Tous formats", included: true },
            { label: "Historique illimité", included: true },
            { label: "Export PDF", included: true },
            { label: "Support email", included: true },
            { label: "Support prioritaire", included: false },
          ]}
          cta={loading === "pro" ? "..." : pricing.pro.cta}
          highlighted
          onSelect={() => handleSelect("pro")}
        />
        <PricingCard
          plan={pricing.business.name}
          price={49}
          features={[
            { label: "Analyses illimitées", included: true },
            { label: "Rapport détaillé 8 critères", included: true },
            { label: "Tous formats", included: true },
            { label: "Historique illimité", included: true },
            { label: "Export PDF", included: true },
            { label: "Support prioritaire", included: true },
          ]}
          cta={loading === "business" ? "..." : pricing.business.cta}
          onSelect={() => handleSelect("business")}
        />
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          {pricing.guarantee}
        </p>
      </div>
    </div>
  );
}
