"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Search,
  ShieldAlert,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { getDictionary, type Dictionary } from "@/lib/i18n";

/** Bloc traduit `admin` (structure identique dans fr/en/ar). */
type AdminDict = Dictionary["admin"];

/** Contrat de `GET /api/admin/stats` (validé côté client, sans `any`). */
const currencyTotalsSchema = z.object({
  byCurrencyCents: z.record(z.string(), z.number()),
  eurCents: z.number(),
  eur: z.number(),
});

const statsSchema = z.object({
  users: z.object({
    total: z.number(),
    newThisMonth: z.number().nullable(),
    byPlan: z.record(z.string(), z.number()),
  }),
  usage: z.object({
    analysesThisMonth: z.number(),
    analysesTotal: z.number(),
  }),
  revenue: z.object({
    referenceCurrency: z.string(),
    month: currencyTotalsSchema,
    total: currencyTotalsSchema,
    mrr: z.object({ euros: z.number(), complete: z.boolean() }).nullable(),
  }),
  subscriptions: z.object({
    byStatus: z.record(z.string(), z.number()),
  }),
  generatedAt: z.string(),
});

/** Contrat de `GET /api/admin/users`. */
const adminUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string(),
  plan: z.string(),
  analysesThisMonth: z.number(),
  analysesCount: z.number(),
});

const usersPageSchema = z.object({
  users: z.array(adminUserSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

type AdminStats = z.infer<typeof statsSchema>;
type AdminUsersPage = z.infer<typeof usersPageSchema>;
type AdminUser = z.infer<typeof adminUserSchema>;

/** Pagination fixe (recoupement avec le `limit` max de l'API). */
const PAGE_SIZE = 20;

/** Une ligne « clé / valeur » de carte de stats. */
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-cream-muted">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-cream-text">
        {value}
      </span>
    </div>
  );
}

/** Affiche un compteur de plan/statut, absent → 0. */
function countOrZero(counts: Record<string, number>, key: string): number {
  return counts[key] ?? 0;
}

export default function AdminPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const admin: AdminDict = getDictionary(locale).admin;
  const { status } = useSession();

  // 403 API : protection serveur efficace mais UI qui ne casse pas.
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  const [usersPage, setUsersPage] = useState<AdminUsersPage | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Protection : sans session → page de connexion.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/${locale}/login`);
    }
  }, [status, locale, router]);

  // Chargement des stats (une seule fois, après authentification).
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    let cancelled = false;

    const loadStats = async (): Promise<void> => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) {
          setLoadError(admin.loadError);
          return;
        }
        const body: unknown = await res.json();
        const parsed = statsSchema.safeParse(body);
        if (!parsed.success) {
          setLoadError(admin.invalidResponse);
          return;
        }
        setStats(parsed.data);
      } catch {
        if (!cancelled) {
          setLoadError(admin.loadError);
        }
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [status, locale, router, admin.loadError, admin.invalidResponse]);

  // Chargement de la page d'utilisateurs (recalculé à chaque changement de
  // page ou de recherche appliquée).
  useEffect(() => {
    if (status !== "authenticated" || forbidden) {
      return;
    }
    let cancelled = false;

    const loadUsers = async (): Promise<void> => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (search) {
          params.set("search", search);
        }
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) {
          setUsersError(admin.users.loadError);
          return;
        }
        const body: unknown = await res.json();
        const parsed = usersPageSchema.safeParse(body);
        if (!parsed.success) {
          setUsersError(admin.invalidResponse);
          return;
        }
        setUsersPage(parsed.data);
      } catch {
        if (!cancelled) {
          setUsersError(admin.users.loadError);
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [
    status,
    forbidden,
    page,
    search,
    locale,
    router,
    admin.users.loadError,
    admin.invalidResponse,
  ]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  // --- Double garde : 403 renvoyé par l'API → écran « Accès refusé » -------
  if (forbidden) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="pn-card mx-auto max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-teal-highlight" />
          <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight text-cream-text">
            {admin.forbiddenTitle}
          </h1>
          <p className="mb-6 text-sm text-cream-muted">
            {admin.forbiddenDescription}
          </p>
          <Link href={`/${locale}`} className="pn-btn inline-block">
            {admin.backHome}
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-teal-highlight" />
      </div>
    );
  }

  if (loadError && !stats) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <p className="rounded-xl border border-error/40 bg-error-container px-4 py-3 text-sm text-error">
          {loadError}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-teal-highlight" />
      </div>
    );
  }

  const totalPages = Math.max(
    1,
    Math.ceil((usersPage?.total ?? 0) / PAGE_SIZE)
  );
  const formatEur = (value: number): string =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(value);

  return (
    <div className="container relative isolate mx-auto px-4 py-8 sm:py-12">
      {/* Halo décoratif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-amber-glow blur-3xl"
      />

      <div className="mb-8">
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight text-cream-text sm:text-3xl">
          {admin.title}
        </h1>
        <p className="text-sm text-cream-muted">{admin.subtitle}</p>
      </div>

      {/* --- Cartes de stats --- */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Utilisateurs */}
        <section className="pn-card rounded-xl p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-cream-text">
            <UsersIcon className="h-5 w-5 text-teal-highlight" />
            {admin.stats.usersCard}
          </h2>
          <StatRow
            label={admin.stats.totalLabel}
            value={stats.users.total}
          />
          <div className="mt-3 border-t border-glass-border pt-3">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
              {admin.stats.byPlan}
            </p>
            <StatRow
              label="Free"
              value={countOrZero(stats.users.byPlan, "free")}
            />
            <StatRow
              label="Pro"
              value={countOrZero(stats.users.byPlan, "pro")}
            />
            <StatRow
              label="Business"
              value={countOrZero(stats.users.byPlan, "business")}
            />
          </div>
        </section>

        {/* Analyses */}
        <section className="pn-card rounded-xl p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-cream-text">
            <BarChart3 className="h-5 w-5 text-teal-highlight" />
            {admin.stats.analysesCard}
          </h2>
          <StatRow
            label={admin.stats.analysesMonth}
            value={stats.usage.analysesThisMonth}
          />
          <StatRow
            label={admin.stats.analysesTotal}
            value={stats.usage.analysesTotal}
          />
        </section>

        {/* Revenus */}
        <section className="pn-card rounded-xl p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-cream-text">
            <CreditCard className="h-5 w-5 text-teal-highlight" />
            {admin.stats.revenueCard}
          </h2>
          <StatRow
            label={admin.stats.revenueMonth}
            value={formatEur(stats.revenue.month.eur)}
          />
          <StatRow
            label={admin.stats.revenueTotal}
            value={formatEur(stats.revenue.total.eur)}
          />
          <StatRow
            label={admin.stats.mrr}
            value={
              stats.revenue.mrr === null
                ? "—"
                : formatEur(stats.revenue.mrr.euros)
            }
          />
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
            {stats.revenue.mrr === null
              ? admin.stats.mrrUnavailable
              : !stats.revenue.mrr.complete
                ? admin.stats.mrrIncomplete
                : admin.stats.currencyNote}
          </p>
        </section>
      </div>

      {/* --- Abonnements par statut --- */}
      <section className="pn-card rounded-xl mb-8 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-cream-text">
          <TrendingUp className="h-5 w-5 text-teal-highlight" />
          {admin.stats.subscriptionsCard}
        </h2>
        {Object.keys(stats.subscriptions.byStatus).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <TrendingUp className="h-8 w-8 text-teal-highlight" />
            <p className="text-sm text-cream-muted">
              {admin.stats.subscriptionsEmpty}
            </p>
          </div>
        ) : (
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats.subscriptions.byStatus).map(
              ([statusKey, count]) => (
                <StatRow key={statusKey} label={statusKey} value={count} />
              )
            )}
          </div>
        )}
      </section>

      {/* --- Tableau des utilisateurs --- */}
      <section className="pn-card rounded-xl p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-cream-text">
          <UsersIcon className="h-5 w-5 text-teal-highlight" />
          {admin.users.cardTitle}
        </h2>

        <form
          onSubmit={handleSearchSubmit}
          className="mb-4 flex flex-wrap items-center gap-3"
        >
          <label htmlFor="admin-user-search" className="sr-only">
            {admin.users.searchLabel}
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder={admin.users.searchPlaceholder}
            className="pn-input w-full max-w-xs flex-1 text-sm"
          />
          <button
            type="submit"
            className="pn-btn inline-flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {admin.users.searchButton}
          </button>
        </form>

        {usersError ? (
          <p className="mb-4 rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-error">
            {usersError}
          </p>
        ) : null}

        {!usersPage ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-teal-highlight" />
          </div>
        ) : usersPage.users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <UsersIcon className="h-8 w-8 text-teal-highlight" />
            <p className="text-sm text-cream-muted">{admin.users.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-glass-border text-left">
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.name}
                  </th>
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.email}
                  </th>
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.role}
                  </th>
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.plan}
                  </th>
                  <th className="py-2 pr-4 text-right font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.analyses}
                  </th>
                  <th className="py-2 text-right font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
                    {admin.users.columns.analysesMonth}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersPage.users.map((user: AdminUser) => (
                  <tr
                    key={user.id}
                    className="border-b border-glass-border odd:bg-surface-container-low/50 last:border-b-0"
                  >
                    <td className="px-2 py-2 pr-4 text-cream-text">
                      {user.name ?? <span className="text-cream-muted">—</span>}
                    </td>
                    <td className="px-2 py-2 pr-4 font-mono text-cream-text">
                      {user.email ?? <span className="text-cream-muted">—</span>}
                    </td>
                    <td className="px-2 py-2 pr-4">
                      <span className="pn-tag">{user.role}</span>
                    </td>
                    <td className="px-2 py-2 pr-4">
                      <span className="pn-tag">{user.plan}</span>
                    </td>
                    <td className="px-2 py-2 pr-4 text-right font-mono tabular-nums text-cream-text">
                      {user.analysesCount}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-cream-text">
                      {user.analysesThisMonth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted">
            {admin.users.pagination
              .replace("{page}", String(usersPage?.page ?? page))
              .replace("{pages}", String(totalPages))}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={usersLoading || page <= 1}
              className="pn-btn pn-btn-secondary inline-flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {admin.users.prev}
            </button>
            <button
              type="button"
              onClick={() => {
                setPage((current) => Math.min(totalPages, current + 1));
              }}
              disabled={usersLoading || page >= totalPages}
              className="pn-btn pn-btn-secondary inline-flex items-center gap-1"
            >
              {admin.users.next}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
