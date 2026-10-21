"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, UserPlus } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Locale } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const dict = getDictionary(locale as Locale);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || dict.register.errorGeneric);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(dict.register.errorLoginFailed);
        router.push(`/${locale}/login`);
      } else {
        router.push(`/${locale}`);
        router.refresh();
      }
    } catch {
      setError(dict.register.errorUnexpected);
    } finally {
      setLoading(false);
    }
  };

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
            <FlaskConical className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-cream-text">
            {dict.register.title}
          </h1>
          <span
            aria-hidden="true"
            className="mx-auto mt-3 block h-px w-12 bg-teal-highlight"
          />
          <p className="mt-3 text-sm text-cream-muted">
            {dict.register.subtitle}
          </p>
        </div>

        <div className="pn-card w-full max-w-md rounded-xl">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-error"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted"
              >
                {dict.register.nameLabel}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pn-input w-full"
                placeholder={dict.register.namePlaceholder}
                required
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted"
              >
                {dict.register.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pn-input w-full"
                placeholder="vous@example.com"
                required
              />
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="pn-btn w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {dict.register.submit}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-glass-border" />
            <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
              {dict.register.or}
            </span>
            <div className="h-px flex-1 bg-glass-border" />
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: `/${locale}` })}
            className="pn-btn-secondary pn-btn w-full flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {dict.register.googleSubmit}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-cream-muted">
          {dict.register.hasAccount}{" "}
          <Link
            href={`/${locale}/login`}
            className="text-teal-highlight hover:underline"
          >
            {dict.register.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
