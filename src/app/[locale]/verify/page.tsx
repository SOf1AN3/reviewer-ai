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
        <div className="mb-4 inline-flex items-center justify-center border-2 border-border bg-secondary p-3">
          <MailCheck className="h-6 w-6 text-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-bold uppercase tracking-tight">
          {COPY.successTitle}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{COPY.successText}</p>
        <Link href={`/${locale}/login`} className="brutal-btn inline-block">
          {dict.login.submit}
        </Link>
      </div>
    );
  }

  if (!hasParams) {
    return (
      <div className="border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
        {COPY.missingParams}
      </div>
    );
  }

  return (
    <>
      {status === "error" && (
        <div className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
          <span className="mb-1 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {COPY.errorTitle}
          </span>
          <span className="font-normal">{COPY.errorText}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{COPY.intro}</p>

        <button
          type="submit"
          disabled={status === "loading"}
          className="brutal-btn w-full flex items-center justify-center gap-2"
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
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center bg-secondary px-4 py-3 border-2 border-border shadow-[3px_3px_0px_var(--border)]">
            <ShieldCheck className="h-8 w-8 text-foreground" />
          </div>
          <h1 className="mb-2 text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {COPY.title}
          </h1>
          <p className="text-sm text-muted-foreground">{COPY.subtitle}</p>
        </div>

        <div className="brutal-card">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
            <VerifyForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href={`/${locale}/login`}
            className="font-bold text-primary underline-offset-4 hover:underline"
          >
            {dict.login.submit}
          </Link>
        </p>
      </div>
    </div>
  );
}
