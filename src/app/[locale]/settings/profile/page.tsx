"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { z } from "zod";
import {
  AlertTriangle,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary } from "@/lib/i18n";

/** Contrat de `GET /api/user/profile` (validé côté client, sans `any`). */
const profileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  plan: z.string(),
  stripeConfigured: z.boolean(),
});

type UserProfile = z.infer<typeof profileSchema>;

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

type SaveState = "idle" | "saving" | "success" | "error";

export default function SettingsProfilePage() {
  const router = useRouter();
  const { locale } = useI18n();
  const settings = getDictionary(locale).settings;
  const { status } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Vrai pendant la séquence « suppression → déconnexion → accueil » :
   * il empêche l'effet de redirection ci-dessous de renvoyer l'utilisateur
   * vers `/login` lorsque le statut de session bascule à `unauthenticated`
   * entre le `signOut` et le `router.push` (course à résoudre).
   */
  const leavingRef = useRef(false);

  const [nameInput, setNameInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Protection + chargement du profil : sans session → page de connexion.
  useEffect(() => {
    if (status === "unauthenticated") {
      // Séquence de suppression en cours : la redirection vers `/login` est
      // déléguée à l'accueil (l'utilisateur vient de supprimer son compte).
      if (leavingRef.current) {
        return;
      }
      router.replace(`/${locale}/login`);
      return;
    }
    if (status !== "authenticated") {
      return;
    }

    const loadProfile = async (): Promise<void> => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });

        if (res.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (!res.ok) {
          setLoadError(settings.profile.loadError);
          return;
        }

        const body: unknown = await res.json();
        const parsed = profileSchema.safeParse(body);
        if (!parsed.success) {
          setLoadError(settings.common.invalidResponse);
          return;
        }

        setProfile(parsed.data);
        setNameInput(parsed.data.name ?? "");
      } catch {
        setLoadError(settings.profile.loadError);
      }
    };

    void loadProfile();
  }, [status, locale, router, settings.profile.loadError, settings.common.invalidResponse]);

  const trimmedName = nameInput.trim();
  const canSave = trimmedName.length >= 2 && trimmedName.length <= 100;

  const handleSaveName = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!profile || !canSave) return;

    setSaveState("saving");
    setSaveError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const body: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setSaveState("error");
        setSaveError(readApiError(body) ?? settings.profile.saveError);
        return;
      }

      setProfile({ ...profile, name: trimmedName });
      setNameInput(trimmedName);
      setSaveState("success");
    } catch {
      setSaveState("error");
      setSaveError(settings.profile.saveError);
    }
  };

  const canDelete =
    profile !== null &&
    profile.email !== null &&
    confirmInput === profile.email;

  const handleDeleteAccount = async (): Promise<void> => {
    if (!profile || !canDelete) return;

    leavingRef.current = true;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmInput }),
      });
      const body: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        leavingRef.current = false;
        setDeleteError(
          readApiError(body) ?? settings.profile.danger.deleteErrorInvalidEmail
        );
        setDeleting(false);
        return;
      }
    } catch {
      leavingRef.current = false;
      setDeleteError(settings.profile.danger.deleteErrorGeneric);
      setDeleting(false);
      return;
    }

    // Compte supprimé : purge du cookie de session (best-effort, jamais
    // bloquante) puis navigation client vers l'accueil, comme recommandé
    // pour les pages internes (`router.push`) — avec `router.refresh()` pour
    // re-rendre les Server Components avec l'état déconnecté.
    try {
      await signOut({ redirect: false });
    } catch {
      // La session est peut-être déjà invalide : on navigue quand même.
    }
    router.push(`/${locale}`);
    router.refresh();
  };

  if (status === "loading" || status === "unauthenticated" || !profile) {
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

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            {settings.profile.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {settings.profile.subtitle}
          </p>
        </div>

        {/* --- Profil --- */}
        <section className="brutal-card mb-6">
          <h2 className="mb-6 text-lg font-bold uppercase tracking-wider">
            {settings.profile.sectionTitle}
          </h2>

          <dl className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {settings.profile.emailLabel}
              </dt>
              <dd className="flex items-center gap-3">
                <span className="text-sm font-bold">
                  {profile.email ?? "—"}
                </span>
                {profile.emailVerified ? (
                  <span className="brutal-badge flex items-center gap-1 text-score-great">
                    <ShieldCheck className="h-3 w-3" />
                    {settings.profile.verified}
                  </span>
                ) : (
                  <span className="brutal-badge flex items-center gap-1 text-destructive">
                    <ShieldAlert className="h-3 w-3" />
                    {settings.profile.unverified}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {settings.profile.planLabel}
              </dt>
              <dd>
                <span className="brutal-tag">{profile.plan}</span>
              </dd>
            </div>
          </dl>

          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label
                htmlFor="profile-name"
                className="mb-1 block text-xs font-bold uppercase tracking-wider"
              >
                {settings.profile.nameLabel}
              </label>
              <input
                id="profile-name"
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setSaveState("idle");
                  setSaveError(null);
                }}
                minLength={2}
                maxLength={100}
                className="brutal-input w-full"
                placeholder={settings.profile.namePlaceholder}
                required
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saveState === "saving" || !canSave}
                className="brutal-btn inline-flex items-center gap-2"
              >
                {saveState === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {settings.profile.saveButton}
              </button>

              {saveState === "success" && (
                <span className="text-sm font-bold text-score-great">
                  {settings.profile.saveSuccess}
                </span>
              )}
              {saveState === "error" && saveError && (
                <span className="text-sm font-bold text-destructive">
                  {saveError}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* --- Zone dangereuse --- */}
        <section className="border-2 border-destructive bg-destructive/10 p-4 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {settings.profile.danger.title}
          </h2>

          <p className="mb-3 text-sm">
            <strong>{settings.profile.danger.warningStrong}</strong>{" "}
            {settings.profile.danger.warningBody}
          </p>

          <label
            htmlFor="confirm-delete-email"
            className="mb-1 block text-xs font-bold uppercase tracking-wider"
          >
            {settings.profile.danger.confirmLabel}{" "}
            <span className="text-destructive">{profile.email}</span>
          </label>
          <input
            id="confirm-delete-email"
            type="email"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            className="brutal-input mb-4 w-full"
            placeholder={
              profile.email ?? settings.profile.danger.confirmPlaceholder
            }
            autoComplete="off"
          />

          {deleteError && (
            <p className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
              {deleteError}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              void handleDeleteAccount();
            }}
            disabled={!canDelete || deleting}
            className="brutal-btn brutal-btn-destructive inline-flex items-center gap-2"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {settings.profile.danger.deleteButton}
          </button>

          {!canDelete && !deleteError && (
            <p className="mt-3 text-xs text-muted-foreground">
              {settings.profile.danger.deleteHint}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
