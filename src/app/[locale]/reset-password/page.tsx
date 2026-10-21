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
        <div className="mb-4 inline-flex items-center justify-center border-2 border-border bg-secondary p-3">
          <KeyRound className="h-6 w-6 text-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-bold uppercase tracking-tight">
          {COPY.successTitle}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{COPY.successText}</p>
        <Link href={`/${locale}/login`} className="pn-btn inline-block">
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
      {status === "error" && error && (
        <div className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
          <span className="mb-1 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {COPY.errorTitle}
          </span>
          <span className="font-normal">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{COPY.intro}</p>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-xs font-bold uppercase tracking-wider"
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
            className="mb-1 block text-xs font-bold uppercase tracking-wider"
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
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center bg-secondary px-4 py-3 border-2 border-border shadow-[3px_3px_0px_var(--border)]">
            <KeyRound className="h-8 w-8 text-foreground" />
          </div>
          <h1 className="mb-2 text-2xl sm:text-3xl font-bold uppercase tracking-tight">
            {COPY.title}
          </h1>
          <p className="text-sm text-muted-foreground">{COPY.subtitle}</p>
        </div>

        <div className="pn-card">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
            <ResetPasswordForm />
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
