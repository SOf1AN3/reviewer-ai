/**
 * src/lib/jobs/retention.ts — Balayage de rétention de l'historique.
 *
 * La page `/pricing` promet une rétention selon le plan
 * (`PLANS[*].features.historyRetention`, en jours) :
 *   - `free` (7 jours)  : les `Article` antérieurs à `now - 7 jours` sont
 *     supprimés, avec leurs `Analyse` (cascade `onDelete: Cascade`).
 *   - `pro` / `business` (`-1` = illimité) : JAMAIS de purge.
 *
 * Invariants :
 *   - `UsageEvent` (données de facturation/audit) ne sont **jamais** touchés —
 *     seuls `Article`/`Analyse` sont supprimés.
 *   - Traitement **lot par lot** (transaction par lot) : jamais de scan de
 *     milliers de lignes ni de transaction interminable.
 *   - **Idempotent** : une seconde exécution ne supprime plus rien.
 *   - **Ne lève jamais** : toute erreur est attrapée, loguée et reportée dans
 *     le champ `error` du résumé.
 *
 * Journalisation : uniquement via `logEvent` (compteurs et dates, jamais de
 * contenus d'articles ni de rapports).
 */

import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { PLANS, type PlanKey } from "@/lib/stripe";

/** Nombre d'articles supprimés par lot (et par transaction). */
const DEFAULT_BATCH_SIZE = 200;

/** Secondes dans une journée (la rétention est exprimée en jours). */
const MS_PER_DAY = 86_400_000;

/** Résumé typé du balayage. */
export type RetentionSweepSummary = {
  /** Nombre d'articles candidats lus (hors lignes déjà supprimées par un lot précédent). */
  scanned: number;
  /** Nombre d'articles supprimés (dont les analyses, par cascade). */
  deletedArticles: number;
  /** Nombre d'analyses supprimées par cascade. */
  deletedAnalyses: number;
  /** Date de coupure effective par plan purgé (absente pour les plans illimités). */
  cutoffs: Partial<Record<PlanKey, Date>>;
  /** Durée totale du balayage en millisecondes. */
  durationMs: number;
  /** Message d'erreur si le balayage a échoué partiellement ou totalement. */
  error?: string;
};

/** Options facultatives du balayage (injectables pour les tests). */
export type RetentionSweepOptions = {
  /** Instant de référence (défaut : `new Date()`). */
  now?: Date;
  /** Taille de lot (défaut : 200). Bornée à [1, 1000]. */
  batchSize?: number;
};

/**
 * Détermine si un plan est **réellement purgeable** : sa rétention est un
 * nombre de jours strictement positif (`historyRetention > 0`).
 * Tout le reste est explicitement exclu de toute purge : `-1` (illimité),
 * `0`, ou toute valeur négative qu'un futur plan pourrait porter.
 */
function isPurgeablePlan(key: PlanKey): boolean {
  return PLANS[key].features.historyRetention > 0;
}

/** Plans réellement purgeables (aujourd'hui : `free` seul, rétention 7 jours). */
const PURGEABLE_PLANS: PlanKey[] = (Object.keys(PLANS) as PlanKey[]).filter(
  isPurgeablePlan
);

/**
 * Plans connus explicitement exclus de la purge `free` : **tous** les plans
 * connus sauf `free`. Couvre à la fois les plans non purgeables
 * (`historyRetention ≤ 0` ou `-1` : aujourd'hui `pro`/`business`) et, par
 * sûreté de construction, tout autre plan purgeable : la purge `free` ne
 * balaye donc jamais un autre plan avec sa coupure à 7 jours.
 *
 * Les valeurs de `User.plan` inconnues restent incluses : `resolvePlan` de
 * `src/lib/plan.ts` les fait déjà basculer en `free`, la purge doit suivre la
 * même convention.
 */
const FREE_EXCLUDED_PLANS: PlanKey[] = (Object.keys(PLANS) as PlanKey[]).filter(
  (key) => key !== "free"
);

/**
 * Calcule la date de coupure par plan purgé.
 * Seuls les plans réellement purgeables (`historyRetention > 0`) sont retenus :
 * les plans illimités, nuls ou négatifs n'ont aucune coupure et ne sont jamais
 * balayés.
 */
function computeCutoffs(now: Date): Partial<Record<PlanKey, Date>> {
  const cutoffs: Partial<Record<PlanKey, Date>> = {};

  for (const key of PURGEABLE_PLANS) {
    const retention = PLANS[key].features.historyRetention;
    cutoffs[key] = new Date(now.getTime() - retention * MS_PER_DAY);
  }

  return cutoffs;
}

/** Filtre « plan de l'utilisateur » pour une date de coupure donnée. */
function planUserFilter(plan: PlanKey): { plan: string } | { plan: { notIn: PlanKey[] } } {
  // Pour `free`, inclure aussi les plans inconnus (convention identique à
  // `resolvePlan` : valeur inconnue ⇒ traitée comme `free`), tout en excluant
  // explicitement tous les autres plans connus (purgeables ou non).
  if (plan === "free") {
    return { plan: { notIn: FREE_EXCLUDED_PLANS } };
  }
  return { plan };
}

/**
 * Supprime, pour un plan purgé, les articles antérieurs à `cutoff`, lot par lot.
 * Chaque lot s'exécute dans sa propre transaction : le comptage des analyses
 * et la suppression des articles sont atomiques.
 */
async function purgePlanBatches(
  plan: PlanKey,
  cutoff: Date,
  batchSize: number,
  counters: { scanned: number; deletedArticles: number; deletedAnalyses: number }
): Promise<void> {
  for (;;) {
    const batch = await db.article.findMany({
      where: {
        dateCreation: { lt: cutoff },
        user: planUserFilter(plan),
      },
      select: { id: true },
      take: batchSize,
    });

    if (batch.length === 0) {
      return;
    }

    counters.scanned += batch.length;
    const ids = batch.map((article) => article.id);

    const result = await db.$transaction(async (tx) => {
      const analysesCount = await tx.analyse.count({
        where: { articleId: { in: ids } },
      });
      const deleted = await tx.article.deleteMany({
        where: { id: { in: ids } },
      });
      return { analysesCount, deletedCount: deleted.count };
    });

    counters.deletedArticles += result.deletedCount;
    counters.deletedAnalyses += result.analysesCount;

    // Idempotence naturelle : les articles supprimés ne réapparaissent pas
    // dans la requête suivante ; la boucle s'arrête quand il n'y a plus rien.
  }
}

/**
 * Exécute le balayage de rétention complet. **Ne lève jamais.**
 *
 * @returns résumé typé (compteurs, coupures, durée) — `error` renseigné en cas
 *   d'échec partiel ou total.
 */
export async function runRetentionSweep(
  options: RetentionSweepOptions = {}
): Promise<RetentionSweepSummary> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const batchSize = Math.min(
    Math.max(Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE), 1),
    1000
  );

  const cutoffs = computeCutoffs(now);
  const counters = { scanned: 0, deletedArticles: 0, deletedAnalyses: 0 };
  let error: string | undefined;

  try {
    for (const [plan, cutoff] of Object.entries(cutoffs) as [PlanKey, Date][]) {
      await purgePlanBatches(plan, cutoff, batchSize, counters);
    }
  } catch (caught) {
    // Ne jamais lever : l'erreur est loguée (sans détail sensible) et retournée.
    error = caught instanceof Error ? caught.message : "Erreur inconnue";
    logEvent("retention_sweep_error", {
      error,
      scanned: counters.scanned,
      deletedArticles: counters.deletedArticles,
      deletedAnalyses: counters.deletedAnalyses,
    });
  }

  const summary: RetentionSweepSummary = {
    scanned: counters.scanned,
    deletedArticles: counters.deletedArticles,
    deletedAnalyses: counters.deletedAnalyses,
    cutoffs,
    durationMs: Date.now() - startedAt,
    ...(error !== undefined ? { error } : {}),
  };

  logEvent("retention_sweep_completed", {
    scanned: summary.scanned,
    deletedArticles: summary.deletedArticles,
    deletedAnalyses: summary.deletedAnalyses,
    cutoffFree: cutoffs.free ? cutoffs.free.toISOString() : null,
    durationMs: summary.durationMs,
    error: summary.error ?? null,
  });

  return summary;
}
