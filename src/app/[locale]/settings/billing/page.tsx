"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Receipt,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Dictionary } from "@/lib/i18n";

/** Bloc traduit `settings.billing` (structure identique dans fr/en/ar). */
type BillingDict = Dictionary["settings"]["billing"];

/**
 * Config d'affichage PUBLIQUE des prix (aucun secret, aucun price ID Stripe,
 * aucune lecture de `src/lib/stripe.ts` ni de `@/lib/env` côté client).
 * Les données de features sont lues depuis `GET /api/user/plan`, qui renvoie
 * la config du plan courant côté serveur.
 */
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 19,
  business: 49,
};

/** Contrat de `GET /api/user/plan` (validé côté client, sans `any`). */
const planFeaturesSchema = z.object({
  fullReport: z.boolean(),
  fileFormats: z.array(z.string()),
  historyRetention: z.number(),
  exportPdf: z.boolean(),
  support: z.string(),
});

const planSchema = z.object({
  plan: z.string(),
  analysesUsed: z.number(),
  monthlyLimit: z.number(),
  name: z.string().optional(),
  features: planFeaturesSchema.optional(),
});

/** Seul champ utile de `GET /api/user/profile` pour cette page. */
const billingFlagSchema = z.object({
  stripeConfigured: z.boolean(),
});

type PlanInfo = z.infer<typeof planSchema>;
type PlanFeatures = z.infer<typeof planFeaturesSchema>;

interface FeatureRow {
  label: string;
  included: boolean;
}

/** Transforme les features brutes du plan en lignes affichables. */
function buildFeatureRows(
  features: PlanFeatures,
  billing: BillingDict
): FeatureRow[] {
  const supportLabel =
    features.support === "priority"
      ? billing.features.supportPriority
      : features.support === "email"
        ? billing.features.supportEmail
        : billing.features.supportCommunity;

  return [
    { label: billing.features.fullReport, included: features.fullReport },
    {
      label: billing.features.formats.replace(
        "{list}",
        features.fileFormats.join(", ")
      ),
      included: features.fileFormats.length > 2,
    },
    {
      label:
        features.historyRetention === -1
          ? billing.features.historyUnlimited
          : billing.features.historyDays.replace(
              "{days}",
              String(features.historyRetention)
            ),
      included: features.historyRetention === -1,
    },
    { label: billing.features.exportPdf, included: features.exportPdf },
    { label: supportLabel, included: true },
  ];
}

/** Extracteur du champ `error` d'une réponse JSON d'API. */
function readApiError(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "error" in body) {
    const message: unknown = (body as { error?: unknown }).error;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return null;
}

export default function SettingsBillingPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const settings = getDictionary(locale).settings;
  const { status } = useSession();

  const [plan, setPlan] = useState<PlanInfo | null>(null);
  // `null` = inconnu (chargement), `false` = Stripe non configuré.
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Protection + chargement : sans session → page de connexion.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/${locale}/login`);
      return;
    }
    if (status !== "authenticated") {
      return;
    }

    const loadBillingData = async (): Promise<void> => {
      try {
        const [planRes, profileRes] = await Promise.all([
          fetch("/api/user/plan", { cache: "no-store" }),
          fetch("/api/user/profile", { cache: "no-store" }),
        ]);

        if (planRes.status === 401 || profileRes.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (!planRes.ok) {
          setLoadError(settings.billing.loadErrorPlan);
          return;
        }

        const planBody: unknown = await planRes.json();
        const parsedPlan = planSchema.safeParse(planBody);
        if (!parsedPlan.success) {
          setLoadError(settings.common.invalidResponse);
          return;
        }

        // Flag lu AVANT tout setState : les deux mises à jour partent dans le
        // même lot, sans rendu intermédiaire « état inconnu ».
        let flag: boolean | null = null;
        if (profileRes.ok) {
          const profileBody: unknown = await profileRes.json();
          const parsedProfile = billingFlagSchema.safeParse(profileBody);
          // Champ absent ou invalide → `null` (état inconnu, jamais un booléen inventé).
          flag = parsedProfile.success
            ? parsedProfile.data.stripeConfigured
            : null;
        }

        setPlan(parsedPlan.data);
        setStripeConfigured(flag);
      } catch {
        setLoadError(settings.billing.loadErrorBilling);
      }
    };

    void loadBillingData();
  }, [
    status,
    locale,
    router,
    settings.billing.loadErrorPlan,
    settings.billing.loadErrorBilling,
    settings.common.invalidResponse,
  ]);

  const handleManageSubscription = async (): Promise<void> => {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setPortalError(readApiError(body) ?? settings.billing.portalError);
        return;
      }

      const url: unknown =
        typeof body === "object" && body !== null && "url" in body
          ? (body as { url?: unknown }).url
          : undefined;

      if (typeof url === "string" && url.length > 0) {
        window.location.href = url;
      } else {
        setPortalError(settings.billing.portalError);
      }
    } catch {
      setPortalError(settings.billing.portalError);
    } finally {
      // Réactive le bouton sur chaque échec (l'erreur reste affichée) ;
      // inoffensif si la navigation Stripe vient de démarrer.
      setPortalLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated" || !plan) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        {loadError ? (
          <p className="border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {loadError}
          </p>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
      </div>
    );
  }

  const unlimited = plan.monthlyLimit === -1;
  const percent =
    unlimited || plan.monthlyLimit <= 0
      ? 0
      : Math.min(100, Math.round((plan.analysesUsed / plan.monthlyLimit) * 100));
  const price = PLAN_PRICES[plan.plan] ?? 0;
  const featureRows = plan.features
    ? buildFeatureRows(plan.features, settings.billing)
    : null;

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            {settings.billing.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {settings.billing.subtitle}
          </p>
        </div>

        {/* --- Plan & quota --- */}
        <section className="brutal-card mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {settings.billing.planLabel}
              </span>
              <div className="text-xl font-bold uppercase tracking-wider">
                {plan.name ?? plan.plan}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {price === 0
                    ? settings.billing.freePrice
                    : settings.billing.monthlyPrice.replace(
                        "{price}",
                        String(price)
                      )}
                </span>
              </div>
            </div>
            <span className="brutal-tag">{settings.billing.monthlyRenewal}</span>
          </div>

          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold">{settings.billing.usageLabel}</span>
            <span>
              {unlimited
                ? settings.billing.usageUnlimited.replace(
                    "{used}",
                    String(plan.analysesUsed)
                  )
                : settings.billing.usageValue
                    .replace("{used}", String(plan.analysesUsed))
                    .replace("{limit}", String(plan.monthlyLimit))}
            </span>
          </div>
          <div className="h-4 w-full border-2 border-border bg-secondary">
            <div
              className={`h-full transition-all ${
                percent >= 100 ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${unlimited ? 100 : percent}%` }}
            />
          </div>
          {unlimited && (
            <p className="mt-2 text-xs text-muted-foreground">
              {settings.billing.unlimitedNote}
            </p>
          )}
        </section>

        {/* --- Features du plan --- */}
        {featureRows && (
          <section className="brutal-card mb-6">
            <h2 className="mb-4 text-lg font-bold uppercase tracking-wider">
              {settings.billing.includedTitle}
            </h2>
            <ul className="space-y-3">
              {featureRows.map((row) => (
                <li key={row.label} className="flex items-center gap-2 text-sm">
                  {row.included ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-score-great" />
                  ) : (
                    <X className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={row.included ? "" : "text-muted-foreground"}
                  >
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- Abonnement Stripe --- */}
        <section className="brutal-card mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <CreditCard className="h-5 w-5" />
            {settings.billing.subscriptionTitle}
          </h2>

          {stripeConfigured === null ? (
            /* État inconnu (flag illisible) : ni bouton cassé, ni mensonge. */
            <p className="text-sm text-muted-foreground">
              {settings.billing.statusUnavailable}
            </p>
          ) : stripeConfigured ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {settings.billing.portalDescription}
              </p>
              {portalError && (
                <p className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                  {portalError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  void handleManageSubscription();
                }}
                disabled={portalLoading}
                className="brutal-btn inline-flex items-center gap-2"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {settings.billing.portalButton}
              </button>
            </>
          ) : (
            /* Stripe non configuré (cas actuel) : état honnête, pas de bouton cassé. */
            <p className="text-sm text-muted-foreground">
              {settings.billing.notActivated}
            </p>
          )}
        </section>

        {/* --- Historique des factures ---
            Emplacement réservé : nécessite une route `GET /api/user/invoices`
            (Stripe `invoices.list` ou table `Invoice`), volontairement vide. */}
        <section className="brutal-card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <Receipt className="h-5 w-5" />
            {settings.billing.invoicesTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {settings.billing.invoicesEmpty}
          </p>
        </section>
      </div>
    </div>
  );
}
