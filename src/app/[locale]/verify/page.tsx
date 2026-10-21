"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * TODO(i18n) : aucun bloc `verify.*` n'existe dans `src/messages/{fr,en,ar}.json`
 * (fichiers explicitement hors périmètre de cette tâche). Les libellés propres à
 * la vérification sont donc en FR hardcodés ci-dessous ; seuls les libellés
 * déjà présents dans le dictionnaire (connexion, erreurs génériques) sont
 * réutilisés. À migrer vers `dict.verify.*` dès que les messages seront ajoutés.
 */
const COPY = {
  title: "Vérification de l'email",
  subtitle: "Confirmez votre adresse email pour activer votre compte.",
  intro: "Cliquez sur le bouton ci-dessous pour valider votre adresse email.",
  missingParams:
    "Ce lien est incomplet : il manque le jeton ou l'adresse email.",
  submit: "Vérifier mon adresse email",
  submitting: "Vérification en cours…",
  successTitle: "Adresse email vérifiée",
  successText: "Votre compte est actif, vous pouvez maintenant vous connecter.",
  errorTitle: "Lien invalide ou expiré",
  errorText:
    "Ce lien n'est plus valide ou a déjà été utilisé. Un nouveau lien est nécessaire pour vérifier votre adresse.",
} as const;

type Status = "idle" | "loading" | "success" | "error";

function VerifyForm() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const hasParams = Boolean(token && email);

  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="py-4 text-center">
        <div
          aria-hidden="true"
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-glass-border bg-surface-sage text-teal-highlight"
        >
          <MailCheck className="h-6 w-6" />
        </div>
        <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-cream-text">
          {COPY.successTitle}
        </h2>
        <p className="mb-6 text-sm text-cream-muted">{COPY.successText}</p>
        <Link href={`/${locale}/login`} className="pn-btn inline-block">
          {dict.login.submit}
        </Link>
      </div>
    );
  }

  if (!hasParams) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-error"
      >
        {COPY.missingParams}
      </div>
    );
  }

  return (
    <>
      {status === "error" && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-error"
        >
          <span className="mb-1 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            {COPY.errorTitle}
          </span>
          <span className="font-normal">{COPY.errorText}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-cream-muted">{COPY.intro}</p>

        <button
          type="submit"
          disabled={status === "loading"}
          className="pn-btn w-full flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {status === "loading" ? COPY.submitting : COPY.submit}
        </button>
      </form>
    </>
  );
}

export default function VerifyPage() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);

  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-sage-glow blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-amber-glow blur-3xl -z-10"
      />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            aria-hidden="true"
            className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-glass-border bg-surface-sage text-teal-highlight"
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-cream-text">
            {COPY.title}
          </h1>
          <span
            aria-hidden="true"
            className="mx-auto mt-3 block h-px w-12 bg-teal-highlight"
          />
          <p className="mt-3 text-sm text-cream-muted">{COPY.subtitle}</p>
        </div>

        <div className="pn-card w-full max-w-md rounded-xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-highlight" />
              </div>
            }
          >
            <VerifyForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-cream-muted">
          <Link
            href={`/${locale}/login`}
            className="text-teal-highlight hover:underline"
          >
            {dict.login.submit}
          </Link>
        </p>
      </div>
    </div>
  );
}
