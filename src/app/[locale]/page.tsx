"use client";

import Link from "next/link";
import {
  FlaskConical,
  FileText,
  BarChart3,
  CheckCircle,
  Upload,
  Brain,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

export default function Home() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  const features = dict.home.features.map(
    (f: { title: string; description: string }, i: number) => ({
      ...f,
      icon: [Brain, BarChart3, FileText, CheckCircle][i],
    })
  );

  const steps = dict.home.steps.map(
    (
      s: { number: string; title: string; description: string },
      i: number
    ) => ({
      ...s,
      icon: [Upload, Sparkles, FileText][i],
    })
  );

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container mx-auto px-4 pb-16 pt-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 inline-flex items-center justify-center bg-secondary px-4 py-3 sm:px-6 sm:py-4 border-3 border-border shadow-[4px_4px_0px_var(--border)]">
            <FlaskConical className="h-10 w-10 sm:h-14 sm:w-14 text-foreground" />
          </div>
          <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight sm:text-5xl lg:text-6xl">
            {dict.home.heroTitle}
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            {dict.home.heroDescription}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`/${locale}/analyser`}
              className="brutal-btn flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base"
            >
              {dict.home.heroCta}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="border-y-[3px] border-border bg-card py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {dict.home.featuresTitle}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(
              (feature: {
                icon: React.ComponentType<{ className?: string }>;
                title: string;
                description: string;
              }) => (
                <div
                  key={feature.title}
                  className="brutal-card-hover flex flex-col items-start gap-4"
                >
                  <div className="flex items-center justify-center bg-secondary px-3 py-2 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
                    <feature.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold uppercase">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {dict.home.stepsTitle}
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map(
              (step: {
                number: string;
                title: string;
                description: string;
                icon: React.ComponentType<{ className?: string }>;
              }) => (
                <div
                  key={step.number}
                  className="brutal-card flex flex-col items-center text-center"
                >
                  <div className="mb-4 flex items-center justify-center bg-primary px-4 py-2 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
                    <span className="font-mono text-xl font-bold text-primary-foreground">
                      {step.number}
                    </span>
                  </div>
                  <step.icon className="mb-4 h-8 w-8 text-foreground" />
                  <h3 className="mb-2 text-lg font-bold uppercase">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Critères d'analyse */}
      <section className="border-y-[3px] border-border bg-card py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {dict.home.criteriaTitle}
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            {dict.home.criteriaDescription}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              Object.entries(dict.criteria) as [
                string,
                string
              ][]
            ).map(([id, label]) => (
              <div
                key={id}
                className="brutal-card-hover flex flex-col gap-3"
              >
                <h3 className="font-bold uppercase">{label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-10 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-2xl sm:text-3xl font-bold uppercase tracking-tight">
              {dict.home.ctaTitle}
            </h2>
            <p className="mb-8 text-muted-foreground">
              {dict.home.ctaDescription}
            </p>
            <Link
              href={`/${locale}/register`}
              className="brutal-btn inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base"
            >
              {dict.home.ctaButton}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-border bg-card py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-block border-2 border-border bg-background px-6 py-3 shadow-[2px_2px_0px_var(--border)]">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {dict.home.footerDisclaimer1}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {dict.home.footerDisclaimer2}
            </p>
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Link
              href={`/${locale}/login`}
              className="hover:text-foreground transition-colors"
            >
              {dict.home.footerLogin}
            </Link>
            <span>·</span>
            <Link
              href={`/${locale}/register`}
              className="hover:text-foreground transition-colors"
            >
              {dict.home.footerRegister}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
