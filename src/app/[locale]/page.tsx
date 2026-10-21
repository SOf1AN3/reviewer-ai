"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  CircleCheck,
  CloudUpload,
  FileText,
  Gauge,
  Gavel,
  Globe,
  Languages,
  Link2,
  Lock,
  Microscope,
  School,
  ShieldCheck,
  Star,
  Target,
  ThumbsDown,
  TimerOff,
  Trash,
  TriangleAlert,
  Users,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";
import ReportConsole from "@/components/landing/ReportConsole";

interface CompareRowProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  variant: "before" | "after";
}

function CompareRow({ icon: Icon, title, desc, variant }: CompareRowProps) {
  const isBefore = variant === "before";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-3.5 ${
        isBefore ? "bg-surface-container" : "bg-surface-container-high/80"
      }`}
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          isBefore ? "text-error" : "text-teal-highlight"
        }`}
        aria-hidden="true"
      />
      <div>
        <h3 className="font-display text-[16px] font-semibold text-cream-text">
          {title}
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">{desc}</p>
      </div>
    </div>
  );
}

const PILLAR_ICONS: readonly LucideIcon[] = [Target, Gavel, Gauge];
const AUDIENCE_ICONS: readonly LucideIcon[] = [School, Microscope, Languages];
const TRUST_ICONS: readonly LucideIcon[] = [ShieldCheck, Trash, BadgeCheck];

export default function Home() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const router = useRouter();

  const [uploadTab, setUploadTab] = useState<"file" | "url">("file");

  const { hero, compare, pillars, audience, stats, pricingSection, finalCta } =
    dict.home;

  const goToAnalyser = () => {
    router.push(`/${locale}/analyser`);
  };

  const goToPricing = () => {
    router.push(`/${locale}/pricing`);
  };

  const handleDropzoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToAnalyser();
    }
  };

  const compareBeforeIconSet: readonly LucideIcon[] = [ThumbsDown, Ban, TimerOff];
  const compareAfterIconSet: readonly LucideIcon[] = [CircleCheck, WandSparkles, ShieldCheck];

  const pricingTiers: ReadonlyArray<{
    plan: { name: string; price: string; period: string; features: string[] };
    tag: string;
    note: string;
    cta: string;
    featured: boolean;
  }> = [
    {
      plan: dict.pricing.free,
      tag: pricingSection.tierTags.free,
      note: pricingSection.freeNote,
      cta: pricingSection.freeCta,
      featured: false,
    },
    {
      plan: dict.pricing.pro,
      tag: pricingSection.tierTags.pro,
      note: pricingSection.proNote,
      cta: pricingSection.proCta,
      featured: true,
    },
    {
      plan: dict.pricing.business,
      tag: pricingSection.tierTags.business,
      note: pricingSection.businessNote,
      cta: pricingSection.businessCta,
      featured: false,
    },
  ];

  const sectionEyebrowClass =
    "font-mono text-xs uppercase tracking-[0.16em] text-teal-highlight";
  const sectionTitleClass =
    "font-display text-[28px] md:text-[40px] font-semibold leading-[1.15] tracking-[-0.03em] text-cream-text";
  const containerClass = "mx-auto w-full max-w-[1140px] px-4";

  return (
    <div className="flex flex-col">
      {/* 1. HERO */}
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[340px] w-[720px] -translate-x-1/2 rounded-full bg-sage-glow blur-[140px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 top-[560px] -z-10 h-[320px] w-[420px] rounded-full bg-amber-glow blur-[120px]"
          aria-hidden="true"
        />

        <section className="relative">
          <div className="mx-auto flex w-full max-w-[940px] flex-col items-center px-4 pb-16 pt-12 text-center md:pb-24 md:pt-16">
            {/* Live trust badge */}
            <div className="pn-badge mb-8 flex-wrap justify-center gap-2.5 px-4 py-1.5 text-cream-text shadow-md">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-amber-badge"
                aria-hidden="true"
              />
              <span>{hero.badge}</span>
              <span className="pn-tag">{hero.badgeTag}</span>
            </div>

            <h1 className="mb-6 max-w-[880px] font-display text-[36px] font-semibold leading-[1.07] tracking-[-0.03em] text-cream-text md:text-[56px]">
              {hero.titleLead}{" "}
              <span className="text-teal-highlight">{hero.titleHighlight}</span>
              {hero.titleTail}
            </h1>

            <p className="mb-10 max-w-[760px] text-base leading-relaxed text-on-surface-variant md:text-lg">
              {hero.subtitle}
            </p>

            {/* Direct submission CTA box */}
            <div className="w-full max-w-[820px] rounded-xl bg-surface-container-high/90 p-4 text-start shadow-2xl backdrop-blur-xl md:p-6">
              <div className="flex flex-col gap-4">
                {/* Upload tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={uploadTab === "file"}
                      onClick={() => setUploadTab("file")}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        uploadTab === "file"
                          ? "bg-surface-sage text-teal-highlight shadow-sm"
                          : "bg-surface-container-lowest text-on-surface-variant hover:text-cream-text"
                      }`}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      {hero.tabFile}
                    </button>
                    <button
                      type="button"
                      aria-pressed={uploadTab === "url"}
                      onClick={() => setUploadTab("url")}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        uploadTab === "url"
                          ? "bg-surface-sage text-teal-highlight shadow-sm"
                          : "bg-surface-container-lowest text-on-surface-variant hover:text-cream-text"
                      }`}
                    >
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      {hero.tabUrl}
                    </button>
                  </div>
                  <span className="hidden items-center gap-1.5 text-xs text-cream-muted sm:inline-flex">
                    <BadgeCheck className="h-4 w-4 text-teal-highlight" aria-hidden="true" />
                    {hero.formatsLabel}
                  </span>
                </div>

                {/* Dropzone (file tab) */}
                {uploadTab === "file" ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={hero.dropTitle}
                    onClick={goToAnalyser}
                    onKeyDown={handleDropzoneKeyDown}
                    className="group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg bg-surface-container-low p-6 text-center transition-all duration-200 hover:bg-surface-sage/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high transition-transform group-hover:scale-110">
                      <CloudUpload className="h-6 w-6 text-teal-highlight" aria-hidden="true" />
                    </div>
                    <span className="font-display text-[20px] font-semibold text-cream-text">
                      {hero.dropTitle}
                    </span>
                    <span className="mt-1 text-sm text-on-surface-variant">
                      {hero.dropHint}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
                    <label
                      htmlFor="hero-arxiv-input"
                      className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted"
                    >
                      {hero.arxivLabel}
                    </label>
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden="true" />
                      <input
                        id="hero-arxiv-input"
                        type="text"
                        className="pn-input w-full"
                        placeholder={hero.arxivPlaceholder}
                      />
                    </div>
                  </div>
                )}

                {/* Main CTA bar */}
                <div className="flex flex-col items-stretch justify-between gap-4 pt-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-teal-highlight shadow-[0_0_8px_rgba(166,201,197,0.7)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs text-cream-muted">{hero.engineNote}</span>
                  </div>
                  <button type="button" onClick={goToAnalyser} className="pn-btn">
                    {hero.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Micro-reassurance line */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-cream-muted">
              <span className="flex items-center gap-1.5">
                <CircleCheck className="h-4 w-4 text-teal-highlight" aria-hidden="true" />
                {hero.assurance1}
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-teal-highlight" aria-hidden="true" />
                {hero.assurance2}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-badge" aria-hidden="true" />
                {hero.assurance3}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* 2. BEFORE / AFTER COMPARISON */}
      <section id="comparison" className={`${containerClass} py-16 md:py-24`}>
        <div className="mb-10 text-center">
          <p className={sectionEyebrowClass}>{compare.eyebrow}</p>
          <h2 className={`mx-auto mt-2 max-w-[760px] ${sectionTitleClass}`}>
            {compare.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Without PaperNote */}
          <div className="flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-low p-6 shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-error-container" aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-error">
                    {compare.beforeTag}
                  </span>
                </div>
                <span className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
                  {compare.beforeBadge}
                </span>
              </div>
              <div className="my-4 flex flex-col gap-3">
                {compare.beforeItems.map((item, index) => (
                  <CompareRow
                    key={item.title}
                    icon={compareBeforeIconSet[index] ?? TriangleAlert}
                    title={item.title}
                    desc={item.desc}
                    variant="before"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-high/60 p-3">
              <span className="text-sm text-on-surface-variant">
                {compare.beforeVerdictLabel}
              </span>
              <span className="rounded bg-error-container/40 px-2.5 py-1 text-xs font-semibold text-error">
                {compare.beforeVerdict}
              </span>
            </div>
          </div>

          {/* With PaperNote */}
          <div className="flex flex-col justify-between overflow-hidden rounded-xl bg-surface-sage p-6 shadow-2xl">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 animate-pulse rounded-full bg-primary shadow-[0_0_8px_rgba(153,208,214,0.9)]"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-teal-highlight">
                    {compare.afterTag}
                  </span>
                </div>
                <span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-background">
                  {compare.afterBadge}
                </span>
              </div>
              <div className="my-4 flex flex-col gap-3">
                {compare.afterItems.map((item, index) => (
                  <CompareRow
                    key={item.title}
                    icon={compareAfterIconSet[index] ?? CircleCheck}
                    title={item.title}
                    desc={item.desc}
                    variant="after"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-lowest/80 p-3">
              <span className="text-sm text-cream-muted">{compare.afterVerdictLabel}</span>
              <span className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-semibold text-teal-highlight">
                {compare.afterVerdict}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THREE PILLARS */}
      <section id="features" className={`${containerClass} py-16 md:py-24`}>
        <div className="mx-auto mb-12 max-w-[760px] text-center">
          <p className={sectionEyebrowClass}>{pillars.eyebrow}</p>
          <h2 className={`mt-2 ${sectionTitleClass}`}>{pillars.title}</h2>
          <p className="mt-3 text-sm text-on-surface-variant md:text-base">
            {pillars.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.items.map((item, index) => {
            const Icon = PILLAR_ICONS[index] ?? Target;

            return (
              <div
                key={item.tag}
                className="pn-card flex flex-col justify-between rounded-xl"
              >
                <div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-sage shadow-sm">
                    <Icon className="h-6 w-6 text-teal-highlight" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-amber-badge">
                    {item.tag}
                  </span>
                  <h3 className="mb-3 mt-1 font-display text-[28px] font-semibold leading-tight text-cream-text">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-on-surface-variant md:text-base">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 border-t border-glass-border pt-4 text-xs text-cream-muted">
                  <Check className="h-4 w-4 shrink-0 text-teal-highlight" aria-hidden="true" />
                  {item.check}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. REPORT CONSOLE PREVIEW */}
      <section className={`${containerClass} py-16 md:py-24`}>
        <div className="mx-auto mb-12 max-w-[780px] text-center">
          <p className={sectionEyebrowClass}>{dict.home.report.eyebrow}</p>
          <h2 className={`mt-2 ${sectionTitleClass}`}>{dict.home.report.title}</h2>
          <p className="mt-3 text-sm text-on-surface-variant md:text-base">
            {dict.home.report.subtitle}
          </p>
        </div>
        <ReportConsole report={dict.home.report} criteria={dict.criteria} />
      </section>

      {/* 5. AUDIENCE */}
      <section className={`${containerClass} py-16 md:py-24`}>
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[620px]">
            <p className={sectionEyebrowClass}>{audience.eyebrow}</p>
            <h2 className={`mt-2 ${sectionTitleClass}`}>{audience.title}</h2>
          </div>
          <p className="max-w-sm text-sm text-on-surface-variant md:text-base">
            {audience.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {audience.items.map((item, index) => {
            const Icon = AUDIENCE_ICONS[index] ?? Users;

            return (
              <div
                key={item.title}
                className="flex flex-col justify-between rounded-xl bg-surface-container-low p-6 shadow-md"
              >
                <div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container">
                    <Icon className="h-5 w-5 text-teal-highlight" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 font-display text-[20px] font-semibold text-cream-text">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-on-surface-variant md:text-base">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 rounded-lg bg-surface-container p-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-text">
                    {item.benefitLabel}
                  </span>
                  <span className="mt-1 block text-sm text-teal-highlight">
                    {item.benefit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. STATS + 7. TESTIMONIALS */}
      <section className={`${containerClass} py-16 md:py-24`}>
        <div className="pn-card mb-16 rounded-xl p-6 shadow-xl">
          <div className="grid grid-cols-1 gap-6 divide-y text-center divide-outline/30 md:grid-cols-3 md:divide-x md:divide-y-0 md:text-left">
            {stats.items.map((item, index) => (
              <div
                key={item.label}
                className={`flex flex-col items-center md:items-start ${
                  index === 1
                    ? "pt-6 md:px-6 md:pt-0"
                    : index === 2
                      ? "pt-6 md:ps-6 md:pt-0"
                      : "md:pe-6"
                }`}
              >
                <span
                  className={`font-display text-[40px] font-light leading-none md:text-[48px] ${
                    index === 1 ? "text-teal-highlight" : "text-cream-text"
                  }`}
                >
                  {item.value}
                </span>
                <span className="mt-2 text-sm text-on-surface-variant md:text-base">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {dict.home.testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="flex flex-col justify-between rounded-xl bg-surface-container-low p-6 shadow-md"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1 text-amber-badge" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm italic leading-relaxed text-cream-text md:text-base">
                  {testimonial.quote}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-surface-container-high pt-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sage text-sm font-bold text-teal-highlight"
                  aria-hidden="true"
                >
                  {testimonial.initials}
                </div>
                <div>
                  <span className="block font-display text-[15px] font-semibold leading-tight text-cream-text">
                    {testimonial.name}
                  </span>
                  <span className="text-xs text-cream-muted">{testimonial.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. PRICING */}
      <section id="pricing" className={`${containerClass} py-16 md:py-24`}>
        <div className="mx-auto mb-12 max-w-[760px] text-center">
          <p className={sectionEyebrowClass}>{pricingSection.eyebrow}</p>
          <h2 className={`mt-2 ${sectionTitleClass}`}>{pricingSection.title}</h2>
          <p className="mt-3 text-sm text-on-surface-variant md:text-base">
            {pricingSection.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.plan.name}
              className={`relative flex flex-col justify-between rounded-xl p-6 ${
                tier.featured
                  ? "bg-surface-container-high shadow-2xl"
                  : "bg-surface-container shadow-md"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-badge px-3 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent-foreground shadow-md">
                  {pricingSection.popularBadge}
                </span>
              )}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[20px] font-semibold text-cream-text">
                    {tier.plan.name}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                      tier.featured
                        ? "bg-surface-sage text-teal-highlight"
                        : "bg-surface-container-high text-cream-muted"
                    }`}
                  >
                    {tier.tag}
                  </span>
                </div>
                <div className="my-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-[40px] font-light leading-none text-cream-text md:text-[48px]">
                      {tier.plan.price}
                    </span>
                    {tier.plan.period !== "" && (
                      <span className="text-sm text-cream-muted">{tier.plan.period}</span>
                    )}
                  </div>
                  <span className="mt-2 block text-xs text-cream-muted">{tier.note}</span>
                </div>
                <ul className="my-4 flex flex-col gap-2 text-sm text-on-surface-variant">
                  {tier.plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-teal-highlight" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={goToPricing}
                className={`mt-6 w-full ${tier.featured ? "pn-btn" : "pn-btn pn-btn-secondary"}`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 9. FINAL CTA */}
      <section className={`${containerClass} py-16 md:py-24`}>
        <div className="relative isolate overflow-hidden rounded-2xl bg-surface-sage p-10 text-center shadow-2xl md:p-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-teal-highlight/10 blur-[90px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-64 w-64 rounded-full bg-amber-glow blur-[90px]"
            aria-hidden="true"
          />

          <p className={sectionEyebrowClass}>{finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-3 max-w-[760px] font-display text-[36px] font-semibold leading-[1.07] tracking-[-0.03em] text-cream-text md:text-[56px]">
            {finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-sm text-on-surface-variant md:text-base">
            {finalCta.subtitle}
          </p>

          <div className="mt-8 flex justify-center">
            <button type="button" onClick={goToAnalyser} className="pn-btn w-full sm:w-auto">
              {finalCta.button}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-cream-muted">
            {finalCta.trust.map((mention, index) => {
              const Icon = TRUST_ICONS[index] ?? ShieldCheck;

              return (
                <span key={mention} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-teal-highlight" aria-hidden="true" />
                  {mention}
                </span>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
