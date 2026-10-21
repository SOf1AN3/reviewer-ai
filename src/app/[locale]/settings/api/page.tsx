"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Dictionary } from "@/lib/i18n";

/** Bloc traduit `settings.api` (structure identique dans fr/en/ar). */
type ApiDict = Dictionary["settings"]["api"];

/** Contrat de `GET /api/keys` (validé côté client, sans `any`). */
const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
  monthlyLimit: z.number().nullable(),
});
type ApiKey = z.infer<typeof apiKeySchema>;

const listResponseSchema = z.object({ keys: z.array(apiKeySchema) });

/** Contrat de `POST /api/keys` — la clé brute n'est presente qu'ici. */
const createdKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  key: z.string(),
  warning: z.string().optional(),
});
type CreatedKey = z.infer<typeof createdKeySchema>;

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

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SettingsApiPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const api: ApiDict = getDictionary(locale).settings.api;
  const { status } = useSession();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nameInput, setNameInput] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Clé brute affichée une seule fois après création.
  const [newKey, setNewKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Protection + chargement : sans session → page de connexion.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/${locale}/login`);
      return;
    }
    if (status !== "authenticated") {
      return;
    }

    const loadKeys = async (): Promise<void> => {
      try {
        const res = await fetch("/api/keys", { cache: "no-store" });
        if (res.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (!res.ok) {
          setLoadError(api.loadError);
          setLoading(false);
          return;
        }
        const body: unknown = await res.json();
        const parsed = listResponseSchema.safeParse(body);
        if (!parsed.success) {
          setLoadError(api.loadError);
          setLoading(false);
          return;
        }
        setKeys(parsed.data.keys);
      } catch {
        setLoadError(api.loadError);
      } finally {
        setLoading(false);
      }
    };

    void loadKeys();
  }, [status, locale, router, api.loadError]);

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setCreateError(null);
    setFormError(null);

    const name = nameInput.trim();
    if (name.length === 0) {
      setFormError(api.nameRequired);
      return;
    }

    let monthlyLimit: number | null = null;
    const limitRaw = limitInput.trim();
    if (limitRaw.length > 0) {
      const parsedLimit = Number(limitRaw);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        setFormError(api.limitInvalid);
        return;
      }
      monthlyLimit = parsedLimit;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthlyLimit }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateError(readApiError(body) ?? api.createError);
        return;
      }
      const parsed = createdKeySchema.safeParse(body);
      if (!parsed.success) {
        setCreateError(api.createError);
        return;
      }

      // La clé brute n'est affichée qu'ici, une seule fois.
      setNewKey(parsed.data);
      setCopied(false);
      setNameInput("");
      setLimitInput("");
      // Rafraîchit la liste (sans la clé brute).
      setKeys((prev) => [
        {
          id: parsed.data.id,
          name: parsed.data.name,
          keyPrefix: parsed.data.keyPrefix,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          revokedAt: null,
          monthlyLimit,
        },
        ...prev,
      ]);
    } catch {
      setCreateError(api.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
    } catch {
      // Clipboard indisponible : l'utilisateur peut copier manuellement.
    }
  };

  const handleRevoke = async (): Promise<void> => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch(`/api/keys?id=${encodeURIComponent(revokeTarget.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setRevokeError(readApiError(await res.json().catch(() => null)) ?? api.revokeError);
        return;
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id ? { ...k, revokedAt: new Date().toISOString() } : k
        )
      );
      setRevokeTarget(null);
    } catch {
      setRevokeError(api.revokeError);
    } finally {
      setRevoking(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            {api.title}
          </h1>
          <p className="text-sm text-muted-foreground">{api.subtitle}</p>
        </div>

        {/* --- Clé brute affichée une seule fois --- */}
        {newKey && (
          <section className="pn-card mb-6 border-2 border-primary">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
              <KeyRound className="h-5 w-5 text-primary" />
              {api.createdTitle}
            </h2>
            <div className="mb-3 flex items-start gap-2 border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{api.createdWarning}</span>
            </div>
            <div className="mb-3 flex items-center gap-2 border-2 border-border bg-secondary px-3 py-2">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-sm">
                {newKey.key}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                className="pn-btn inline-flex items-center gap-2"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? api.copied : api.copyButton}
              </button>
              <button
                type="button"
                onClick={() => setNewKey(null)}
                className="pn-btn inline-flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {api.dismiss}
              </button>
            </div>
          </section>
        )}

        {/* --- Formulaire de création --- */}
        <section className="pn-card mb-6">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wider">
            {api.createTitle}
          </h2>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <label
                htmlFor="api-key-name"
                className="mb-1 block text-sm font-bold"
              >
                {api.nameLabel}
              </label>
              <input
                id="api-key-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={api.namePlaceholder}
                maxLength={100}
                className="pn-input w-full"
              />
            </div>
            <div>
              <label
                htmlFor="api-key-limit"
                className="mb-1 block text-sm font-bold"
              >
                {api.limitLabel}
              </label>
              <input
                id="api-key-limit"
                type="number"
                min={1}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder={api.limitPlaceholder}
                className="pn-input w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">{api.limitHelp}</p>
            </div>

            {formError && (
              <p className="border-2 border-destructive bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
                {formError}
              </p>
            )}
            {createError && (
              <p className="border-2 border-destructive bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
                {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="pn-btn inline-flex items-center gap-2"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? api.creating : api.createButton}
            </button>
          </form>
        </section>

        {/* --- Liste des clés --- */}
        <section className="pn-card">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wider">
            {api.keysTitle}
          </h2>

          {revokeError && (
            <p className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
              {revokeError}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <p className="border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
              {loadError}
            </p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {api.emptyDescription}
            </p>
          ) : (
            <ul className="space-y-3">
              {keys.map((key) => {
                const revoked = key.revokedAt !== null;
                return (
                  <li
                    key={key.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-2 border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{key.name}</span>
                        <span
                          className={`pn-tag ${
                            revoked
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {revoked ? api.badgeRevoked : api.badgeActive}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}…
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {api.lastUsedLabel}:{" "}
                        {key.lastUsedAt
                          ? formatDate(key.lastUsedAt, locale)
                          : api.lastUsedNever}
                        {" · "}
                        {api.createdLabel}: {formatDate(key.createdAt, locale)}
                        {" · "}
                        {api.monthlyLimitLabel}:{" "}
                        {key.monthlyLimit === null
                          ? api.monthlyLimitUnlimited
                          : key.monthlyLimit}
                      </div>
                    </div>
                    {!revoked && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokeTarget(key);
                          setRevokeError(null);
                        }}
                        className="pn-btn inline-flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {api.revokeButton}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- Confirmation de révocation --- */}
        {revokeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="pn-card w-full max-w-md">
              <h3 className="mb-2 text-lg font-bold uppercase tracking-wider">
                {api.revokeConfirmTitle}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {api.revokeConfirmBody.replace("{name}", revokeTarget.name)}
              </p>
              {revokeError && (
                <p className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
                  {revokeError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleRevoke();
                  }}
                  disabled={revoking}
                  className="pn-btn inline-flex items-center gap-2"
                >
                  {revoking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {api.revokeConfirmYes}
                </button>
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  disabled={revoking}
                  className="pn-btn inline-flex items-center gap-2"
                >
                  {api.revokeCancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
