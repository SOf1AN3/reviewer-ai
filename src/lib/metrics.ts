/**
 * src/lib/metrics.ts — Métriques en mémoire (compteurs + histogrammes).
 *
 * Conception :
 * - Aucune dépendance externe. L'état est attaché à `globalThis` pour
 *   survivre au HMR en développement (même motif que `rate-limit.ts`).
 * - « Thread-safe » à l'échelle du processus : toutes les mutations sont
 *   synchrones et atomiques sur l'event-loop Node.js (un seul thread).
 * - Les fonctions ne lèvent JAMAIS : un appel invalide (nom/mesure non fini)
 *   est ignoré silencieusement ; un bug interne est avalé pour ne jamais
 *   faire échouer l'appelant (philosophie du `logger.ts`).
 *
 * Bornage mémoire (anti-fuite via labels arbitraires) :
 * - MAX_SERIES séries au total ; au-delà, la série la moins récemment
 *   touchée est évincée (LRU approximatif basé sur l'ordre d'insertion).
 * - MAX_SERIES_PER_METRIC séries par nom de métrique ; au-delà, toutes les
 *   observations suivantes pour ce nom sont agrégées dans UNE série
 *   « overflow » (perte de granularité contrôlée, mémoire stable).
 * - Chaque valeur de label est normalisée : caractères de contrôle retirés,
 *   troncature à MAX_LABEL_VALUE_LEN caractères ; au plus
 * - MAX_LABEL_KEYS labels par série (les clés sont triées pour une clé de
 *   série déterministe).
 *
 * ⚠️ Sécurité : les labels viendront partiellement de l'application. Une
 * valeur « utilisateur » (email, id…) ne peut PAS créer une série infinie
 * grâce aux bornes ci-dessus, mais ne placez JAMAIS de donnée sensible brute
 * dans un label (préférez un identifiant déjà pseudonymisé, ex. userId).
 *
 * API :
 * - `increment(name, labels?, value?)` : compteur monotone
 *   (ex. `analyses_total`, `ai_errors_total`, `emails_sent`…).
 * - `observe(name, value, labels?)` : histogramme simple
 *   (count/sum/min/max + p50 approché) pour `analysis_duration_ms`.
 * - `snapshot()` : structure JSON-serialisable (utilisée par la route
 *   d'administration / santé).
 * - `reset()` : vide l'état (tests uniquement).
 */

// --- Bornes -----------------------------------------------------------------

/** Plafond global de séries (compteurs + histogrammes confondus). */
const MAX_SERIES = 1000;

/** Plafond de séries par nom de métrique (dépassement → série « overflow »). */
const MAX_SERIES_PER_METRIC = 100;

/** Nombre maximal de labels conservés par série. */
const MAX_LABEL_KEYS = 8;

/** Troncature d'une valeur (ou d'un nom) de label. */
const MAX_LABEL_VALUE_LEN = 64;

/** Nom de métrique : identifiant type Prometheus. */
const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

/** Bornes des buckets de l'histogramme (unité de `analysis_duration_ms` : ms). */
const HISTOGRAM_BOUNDS = [
  1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000,
] as const;

/** Dernier bucket : les valeurs au-delà de la dernière borne. */
const OVERFLOW_LABELS: Readonly<Record<string, string>> = {
  cardinality: "overflow",
};

// --- Types ------------------------------------------------------------------

export type MetricLabels = Record<string, string>;

export type CounterSnapshot = {
  name: string;
  labels: MetricLabels;
  value: number;
};

export type HistogramSnapshot = {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  /** Médiane approchée (milieu du bucket cumulé atteignant 50 %). */
  p50: number;
};

export type MetricsSnapshot = {
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  /** Nombre de séries actuellement stockées. */
  series: number;
  maxSeries: number;
  /** Date de création du store (epoch ms) — utile pour un taux sur période. */
  startedAt: number;
};

type CounterEntry = {
  kind: "counter";
  name: string;
  labels: MetricLabels;
  value: number;
  touchedAt: number;
};

type HistogramEntry = {
  kind: "histogram";
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
  /** Compteurs par bucket, alignés sur HISTOGRAM_BOUNDS (+1 pour la queue). */
  buckets: number[];
  touchedAt: number;
};

type SeriesEntry = CounterEntry | HistogramEntry;

type MetricsStore = {
  /** Ordre d'insertion = ordre LRU (delete + set pour « toucher »). */
  series: Map<string, SeriesEntry>;
  /** Nombre de séries par nom de métrique (pour le plafond par nom). */
  seriesPerName: Map<string, number>;
  startedAt: number;
};

/**
 * Le store est attaché à `globalThis` pour survivre au HMR en développement
 * (chaque rechargement de module crée sinon un nouveau Map et perd l'état).
 */
type GlobalWithMetricsStore = typeof globalThis & {
  __papernoteMetricsStore?: MetricsStore;
};

const globalRef = globalThis as GlobalWithMetricsStore;
const store: MetricsStore = globalRef.__papernoteMetricsStore ?? {
  series: new Map<string, SeriesEntry>(),
  seriesPerName: new Map<string, number>(),
  startedAt: Date.now(),
};
globalRef.__papernoteMetricsStore = store;

// --- Normalisation ----------------------------------------------------------

/** Nettoie une valeur de label : contrôle retiré, troncature bornée. */
function normalizeLabelValue(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned.length > MAX_LABEL_VALUE_LEN
    ? cleaned.slice(0, MAX_LABEL_VALUE_LEN)
    : cleaned;
}

/**
 * Normalise un nom de métrique ; `null` si le nom est invalide (l'appel est
 * alors ignoré — jamais d'exception).
 */
function normalizeMetricName(name: string): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, MAX_LABEL_VALUE_LEN);
  if (trimmed.length === 0) return null;
  if (!METRIC_NAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Normalise et borne l'ensemble des labels (clés triées, valeurs tronquées). */
function normalizeLabels(labels: MetricLabels | undefined): MetricLabels {
  const result: MetricLabels = {};
  if (labels === undefined || labels === null || typeof labels !== "object") {
    return result;
  }

  const sortedKeys = Object.keys(labels).sort();
  let taken = 0;
  let truncated = false;

  for (const key of sortedKeys) {
    if (taken >= MAX_LABEL_KEYS) {
      truncated = true;
      break;
    }
    const cleanKey = normalizeLabelValue(key);
    const rawValue = labels[key];
    if (cleanKey.length === 0 || typeof rawValue !== "string") continue;
    result[cleanKey] = normalizeLabelValue(rawValue);
    taken += 1;
  }

  if (truncated) {
    result.__labels_truncated = "true";
  }
  return result;
}

/** Clé de série déterministe (JSON de [nom, labels triés]) — pas de collision d'échappement. */
function buildSeriesKey(
  kind: "counter" | "histogram",
  name: string,
  labels: MetricLabels
): string {
  return `${kind}:${JSON.stringify([name, Object.entries(labels)])}`;
}

// --- Gestion du store (LRU + bornes) ----------------------------------------

/** Décrémente le compteur de séries du nom (suppression de série). */
function decrementNameCount(name: string): void {
  const current = store.seriesPerName.get(name);
  if (current === undefined) return;
  if (current <= 1) {
    store.seriesPerName.delete(name);
  } else {
    store.seriesPerName.set(name, current - 1);
  }
}

/** Évince la série la moins récemment touchée (tête de la Map). */
function evictOldestSeries(): void {
  const oldest = store.series.keys().next();
  if (oldest.done === true || oldest.value === undefined) return;
  const entry = store.series.get(oldest.value);
  store.series.delete(oldest.value);
  if (entry !== undefined) {
    decrementNameCount(entry.name);
  }
}

/** Garantit de la place pour UNE nouvelle série. */
function makeRoomForOneSeries(): void {
  while (store.series.size >= MAX_SERIES) {
    evictOldestSeries();
  }
}

/** Marque une série comme récemment utilisée (LRU). */
function touchSeries(key: string, entry: SeriesEntry): void {
  store.series.delete(key);
  entry.touchedAt = Date.now();
  store.series.set(key, entry);
}

function createCounterEntry(name: string, labels: MetricLabels): CounterEntry {
  return { kind: "counter", name, labels, value: 0, touchedAt: Date.now() };
}

function createHistogramEntry(name: string, labels: MetricLabels): HistogramEntry {
  return {
    kind: "histogram",
    name,
    labels,
    count: 0,
    sum: 0,
    min: 0,
    max: 0,
    buckets: new Array<number>(HISTOGRAM_BOUNDS.length + 1).fill(0),
    touchedAt: Date.now(),
  };
}

/**
 * Renvoie la série existante (et la « touche »), ou en crée une en respectant
 * les bornes de cardinalité. `null` si l'appel est invalide.
 */
function getOrCreateSeries(
  kind: "counter" | "histogram",
  name: string,
  labels: MetricLabels
): SeriesEntry | null {
  const key = buildSeriesKey(kind, name, labels);
  const existing = store.series.get(key);
  if (existing !== undefined) {
    touchSeries(key, existing);
    return existing;
  }

  const countForName = store.seriesPerName.get(name) ?? 0;

  // Plafond par nom atteint : agrège dans UNE série « overflow ».
  if (countForName >= MAX_SERIES_PER_METRIC) {
    const overflowKey = buildSeriesKey(kind, name, OVERFLOW_LABELS);
    const overflow = store.series.get(overflowKey);
    if (overflow !== undefined) {
      touchSeries(overflowKey, overflow);
      return overflow;
    }
    makeRoomForOneSeries();
    const created =
      kind === "counter"
        ? createCounterEntry(name, { ...OVERFLOW_LABELS })
        : createHistogramEntry(name, { ...OVERFLOW_LABELS });
    store.series.set(overflowKey, created);
    store.seriesPerName.set(name, countForName + 1);
    return created;
  }

  makeRoomForOneSeries();
  const created =
    kind === "counter"
      ? createCounterEntry(name, labels)
      : createHistogramEntry(name, labels);
  store.series.set(key, created);
  store.seriesPerName.set(name, countForName + 1);
  return created;
}

// --- API publique ------------------------------------------------------------

/**
 * Incrémente un compteur. `value` défaut : 1. Les valeurs non finies sont
 * ignorées. Exemples : `analyses_total`, `analyses_failed`, `ai_errors_total`,
 * `emails_sent`, `emails_skipped`, `api_requests_total`.
 */
export function increment(
  name: string,
  labels?: MetricLabels,
  value: number = 1
): void {
  try {
    if (!Number.isFinite(value)) return;
    const normalizedName = normalizeMetricName(name);
    if (normalizedName === null) return;
    const normalizedLabels = normalizeLabels(labels);
    const entry = getOrCreateSeries("counter", normalizedName, normalizedLabels);
    if (entry === null || entry.kind !== "counter") return;
    entry.value += value;
  } catch {
    // Une métrique ne doit JAMAIS faire échouer l'appelant.
  }
}

/**
 * Observe une valeur dans un histogramme simple (count/sum/min/max + p50
 * approché). Exemple : `observe("analysis_duration_ms", elapsed, { step })`.
 */
export function observe(
  name: string,
  value: number,
  labels?: MetricLabels
): void {
  try {
    if (!Number.isFinite(value)) return;
    const normalizedName = normalizeMetricName(name);
    if (normalizedName === null) return;
    const normalizedLabels = normalizeLabels(labels);
    const entry = getOrCreateSeries(
      "histogram",
      normalizedName,
      normalizedLabels
    );
    if (entry === null || entry.kind !== "histogram") return;

    if (entry.count === 0) {
      entry.min = value;
      entry.max = value;
    } else {
      if (value < entry.min) entry.min = value;
      if (value > entry.max) entry.max = value;
    }
    entry.count += 1;
    entry.sum += value;
    entry.buckets[findBucketIndex(value)] += 1;
  } catch {
    // Une métrique ne doit JAMAIS faire échouer l'appelant.
  }
}

/** Index du premier bucket dont la borne est >= value ( sinon la queue ). */
function findBucketIndex(value: number): number {
  for (let i = 0; i < HISTOGRAM_BOUNDS.length; i += 1) {
    if (value <= HISTOGRAM_BOUNDS[i]) return i;
  }
  return HISTOGRAM_BOUNDS.length;
}

/** Médiane approchée : milieu du bucket atteignant 50 % des observations. */
function estimateP50(count: number, buckets: number[]): number {
  if (count === 0) return 0;
  const target = count / 2;
  let cumulative = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    cumulative += buckets[i];
    if (cumulative >= target) {
      if (i >= HISTOGRAM_BOUNDS.length) {
        // Queue : au-delà de la dernière borne, retourne cette borne.
        return HISTOGRAM_BOUNDS[HISTOGRAM_BOUNDS.length - 1];
      }
      const lower = i === 0 ? 0 : HISTOGRAM_BOUNDS[i - 1];
      return (lower + HISTOGRAM_BOUNDS[i]) / 2;
    }
  }
  return HISTOGRAM_BOUNDS[HISTOGRAM_BOUNDS.length - 1];
}

/** Tri déterministe par nom puis labels sérialisés. */
function byNameThenLabels(
  a: { name: string; labels: MetricLabels },
  b: { name: string; labels: MetricLabels }
): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  const la = JSON.stringify(Object.entries(a.labels));
  const lb = JSON.stringify(Object.entries(b.labels));
  if (la === lb) return 0;
  return la < lb ? -1 : 1;
}

/**
 * Instantané sérialisable de l'état : compteurs + histogrammes agrégés.
 * Utilisé par les routes d'administration / de santé (jamais exposé en clair
 * sur un endpoint non authentifié : les labels peuvent être dérivés
 * d'un userId).
 */
export function snapshot(): MetricsSnapshot {
  const counters: CounterSnapshot[] = [];
  const histograms: HistogramSnapshot[] = [];

  for (const entry of store.series.values()) {
    if (entry.kind === "counter") {
      counters.push({
        name: entry.name,
        labels: { ...entry.labels },
        value: entry.value,
      });
    } else {
      histograms.push({
        name: entry.name,
        labels: { ...entry.labels },
        count: entry.count,
        sum: entry.sum,
        min: entry.count === 0 ? 0 : entry.min,
        max: entry.count === 0 ? 0 : entry.max,
        avg: entry.count === 0 ? 0 : entry.sum / entry.count,
        p50: estimateP50(entry.count, entry.buckets),
      });
    }
  }

  counters.sort(byNameThenLabels);
  histograms.sort(byNameThenLabels);

  return {
    counters,
    histograms,
    series: store.series.size,
    maxSeries: MAX_SERIES,
    startedAt: store.startedAt,
  };
}

/** Vide l'état des métriques (tests uniquement). */
export function reset(): void {
  store.series.clear();
  store.seriesPerName.clear();
  store.startedAt = Date.now();
}
