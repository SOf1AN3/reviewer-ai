"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * TODO(i18n) : aucun bloc `resetPassword.*` n'existe dans
 * `src/messages/{fr,en,ar}.json` (fichiers hors périmètre de cette tâche) :
 * libellés propres à la page en FR hardcodés ci-dessous, seuls les libellés
 * déjà présents dans le dictionnaire (mot de passe, erreurs) sont réutilisés.
 * À migrer vers `dict.resetPassword.*` dès que les messages seront ajoutés.
 */
const COPY = {
  title: "Nouveau mot de passe",
  subtitle: "Choisissez un nouveau mot de passe pour votre compte.",
  intro: "Ce lien vous permet de définir un nouveau mot de passe.",
  confirmLabel: "Confirmer le mot de passe",
  submit: "Mettre à jour le mot de passe",
  submitting: "Enregistrement en cours…",
  mismatch: "Les deux mots de passe ne correspondent pas.",
  passwordTooShort: "Le mot de passe doit faire au moins 8 caractères.",
  missingParams:
    "Ce lien est incomplet : il manque le jeton ou l'adresse email.",
  errorTitle: "Lien invalide ou expiré",
  errorText:
    "Ce lien n'est plus valide. Demandez un nouveau lien depuis la page de connexion.",
  successTitle: "Mot de passe mis à jour",
  successText:
    "Votre nouveau mot de passe est actif, vous pouvez maintenant vous connecter.",
} as const;

type Status = "idle" | "loading" | "success" | "error";

function ResetPasswordForm() {
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const hasParams = Boolean(token && email);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token || !email) {
      setStatus("error");
      setError(COPY.missingParams);
      return;
    }
    if (password.length < 8) {
      setError(COPY.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(COPY.mismatch);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });

      if (res.ok) {
        setStatus("success");
        return;
      }

      // Message public renvoyé par l'API (aucun détail interne).
      const data: unknown = await res.json().catch(() => null);
      const serverError =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : "";
      setStatus("error");
      setError(serverError || COPY.errorText);
    } catch {
      setStatus("error");
      setError(dict.login.errorGeneric);
    }
  };

  if (status === "success") {
    return (
      <div className="py-4 text-center">
        <div
          aria-hidden="true"
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-glass-border bg-surface-sage text-teal-highlight"
        >
          <KeyRound className="h-6 w-6" />
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
      {status === "error" && error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-error"
        >
          <span className="mb-1 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            {COPY.errorTitle}
          </span>
          <span className="font-normal">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-cream-muted">{COPY.intro}</p>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted"
          >
            {dict.register.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pn-input w-full"
            placeholder={dict.register.passwordPlaceholder}
            minLength={8}
            required
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted"
          >
            {COPY.confirmLabel}
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="pn-input w-full"
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="pn-btn w-full flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          {status === "loading" ? COPY.submitting : COPY.submit}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
            <KeyRound className="h-6 w-6" />
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
            <ResetPasswordForm />
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
