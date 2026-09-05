"use client";

import Link from "next/link";
import {
  FlaskConical,
  Zap,
  FileText,
  BarChart3,
  CheckCircle,
  Upload,
  Brain,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { criteres } from "@/config/crits";

const features = [
  {
    icon: Brain,
    title: "Analyse IA avancée",
    description:
      "Notre IA évalue votre article selon 8 critères scientifiques et fournit une note sur 100.",
  },
  {
    icon: BarChart3,
    title: "Note détaillée",
    description:
      "Obtenez une évaluation chiffrée par critère avec un rapport complet forces/faiblesses.",
  },
  {
    icon: FileText,
    title: "Formats multiples",
    description:
      "Importez vos articles en PDF, DOCX, TEX, TXT ou MD. Glissez-déposez ou collez le texte.",
  },
  {
    icon: CheckCircle,
    title: "Recommandations",
    description:
      "Un verdict clair : Accepté, Révisions mineures, Révisions majeures, ou Rejeté.",
  },
];

const steps = [
  {
    number: "01",
    title: "Soumettez votre article",
    description:
      "Collez le contenu ou importez un fichier. Ajoutez titre, auteur(s) et revue ciblée.",
    icon: Upload,
  },
  {
    number: "02",
    title: "L'IA analyse en profondeur",
    description:
      "Gemini AI évalue votre article selon 8 critères scientifiques rigoureux.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Recevez votre rapport",
    description:
      "Note globale, détails par critère, forces, faiblesses et recommandations concrètes.",
    icon: FileText,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container mx-auto px-4 pb-16 pt-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 inline-flex items-center justify-center bg-secondary px-6 py-4 border-3 border-border shadow-[4px_4px_0px_var(--border)]">
            <FlaskConical className="h-14 w-14 text-foreground" />
          </div>
          <h1 className="mb-6 text-5xl font-bold uppercase tracking-tight sm:text-6xl">
            Peer review augmenté par l&apos;IA
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Soumettez votre article scientifique et obtenez une analyse
            détaillée avec une note, un rapport complet et des recommandations
            concrètes.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register" className="brutal-btn flex items-center gap-2 px-8 py-4 text-base">
              Commencer l&apos;analyse
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-secondary" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Propulsé par Gemini AI
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="border-y-[3px] border-border bg-card py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold uppercase tracking-tight">
            Tout pour analyser vos articles
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="brutal-card-hover flex flex-col items-start gap-4">
                <div className="flex items-center justify-center bg-secondary px-3 py-2 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
                  <feature.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-lg font-bold uppercase">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold uppercase tracking-tight">
            Comment ça marche
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="brutal-card flex flex-col items-center text-center">
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
            ))}
          </div>
        </div>
      </section>

      {/* Critères d'analyse */}
      <section className="border-y-[3px] border-border bg-card py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold uppercase tracking-tight">
            8 critères d&apos;évaluation
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            Chaque article est analysé selon ces critères scientifiques.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {criteres.map((critere) => (
              <div
                key={critere.id}
                className="brutal-card-hover flex flex-col gap-3"
              >
                <h3 className="font-bold uppercase">{critere.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {critere.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold uppercase tracking-tight">
              Prêt à analyser votre article ?
            </h2>
            <p className="mb-8 text-muted-foreground">
              Créez votre compte gratuitement et obtenez une analyse détaillée
              de votre article scientifique.
            </p>
            <Link
              href="/register"
              className="brutal-btn inline-flex items-center gap-2 px-8 py-4 text-base"
            >
              Créer un compte gratuit
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
              PaperLens utilise l&apos;IA pour fournir des analyses indicatives.
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Les résultats ne remplacent pas la relecture par un pair expert.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Connexion
            </Link>
            <span>·</span>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Inscription
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
