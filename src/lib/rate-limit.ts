/**
 * src/lib/rate-limit.ts — Rate limiting à fenêtre fixe avec store interchangeable.
 *
 * SERVER-ONLY (utilisé depuis le middleware/proxy et les routes API).
 *
 * Stores :
 * - Par défaut : Map en mémoire (par processus). Aucune dépendance externe,
 *   fonctionne immédiatement en développement. Les entrées expirées sont
 *   purgées périodiquement (toutes les 60 s au maximum, lors d'un appel).
 * - Upstash Redis (API REST, via `fetch` natif — aucune dépendance npm) :
 *   activé UNIQUEMENT si UPSTASH_REDIS_REST_URL ET UPSTASH_REDIS_REST_TOKEN
 *   sont présentes. Requis en prod serverless partagée (plusieurs instances).
 *
 * Comportement :
 * - Absence totale de config Redis ⇒ store mémoire, aucune erreur.
 * - Config Redis présente mais erreur réseau/HTTP ⇒ repli silencieux (une fois
 *   par intervalle de 5 min) sur le store mémoire : jamais de crash bouchon.
 * - Options invalides (bug d'appelant) ⇒ fail-open (la requête passe), on ne
 *   bloque jamais du trafic à cause d'une erreur de programmation.
 *
 * La clé est TOUJOURS construite par l'appelant (ex. "analyze:ip:1.2.3.4"),
 * jamais issue directement de l'utilisateur final.
 */

import { z } from "zod";

// --- Types -----------------------------------------------------------------

export type RateLimitResult = {
  /** `false` si la limite est dépassée (l'appelant doit répondre 429). */
  success: boolean;
  /** Requêtes restantes dans la fenêtre courante (0 si dépassée). */
  remaining: number;
  /** Fin de la fenêtre courante en millisecondes epoch (pour `Retry-After`). */
  resetAt: number;
};

const rateLimitOptionsSchema = z.object({
  key: z.string().min(1).max(256),
  limit: z.number().int().min(1),
  windowSec: z.number().int().min(1),
});

export type RateLimitOptions = z.infer<typeof rateLimitOptionsSchema>;

// --- Store mémoire (par défaut) --------------------------------------------

type MemoryEntry = { count: number; resetAt: number };

/**
 * Le store est attaché à `globalThis` pour survivre au HMR en développement
 * (chaque rechargement de module crée sinon une nouvelle Map et perd l'état).
 */
type GlobalWithRateLimitStore = typeof globalThis & {
  __papernoteRateLimitStore?: Map<string, MemoryEntry>;
};

const globalRef = globalThis as GlobalWithRateLimitStore;
const memoryStore: Map<string, MemoryEntry> =
  globalRef.__papernoteRateLimitStore ?? new Map<string, MemoryEntry>();
globalRef.__papernoteRateLimitStore = memoryStore;

const MEMORY_PURGE_INTERVAL_MS = 60_000;
let lastPurgeAt = 0;

/** Supprime les entrées expirées, au plus une fois par minute. */
function purgeExpiredEntries(now: number): void {
  if (now - lastPurgeAt < MEMORY_PURGE_INTERVAL_MS) return;
  lastPurgeAt = now;
  for (const [entryKey, entry] of memoryStore) {
    if (entry.resetAt <= now) {
      memoryStore.delete(entryKey);
    }
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  const now = Date.now();
  purgeExpiredEntries(now);

  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSec * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  existing.count += 1;
  return {
    success: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

// --- Store Upstash Redis (REST, fetch natif) --------------------------------

type RedisConfig = { url: string; token: string };

const REDIS_KEY_PREFIX = "papernote:rate-limit:";
const REDIS_WARN_INTERVAL_MS = 5 * 60_000;
let lastRedisWarnAt = 0;

/** Config Redis détectée uniquement si les DEUX variables sont présentes. */
function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/+$/u, ""), token };
}

/** Convertit un résultat Redis en nombre fini, sinon `NaN`. */
function toFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

type UpstashPipelineEntry = { result: unknown };

/**
 * Extrait la valeur `result` d'une réponse Upstash (`{"result": ...}`).
 * Tolère aussi une valeur brute par robustesse.
 */
function extractUpstashResult(entry: unknown): unknown {
  if (typeof entry === "object" && entry !== null && "result" in entry) {
    return (entry as UpstashPipelineEntry).result;
  }
  return entry;
}

/** Appel REST unique envoyant plusieurs commandes (pipeline Upstash). */
async function callUpstashPipeline(
  config: RedisConfig,
  commands: string[][]
): Promise<unknown[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`[rate-limit] Upstash HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("[rate-limit] Réponse Upstash pipeline invalide");
  }
  return data.map(extractUpstashResult);
}

async function callUpstash(
  config: RedisConfig,
  command: string[]
): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`[rate-limit] Upstash HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  return extractUpstashResult(data);
}

/**
 * Fenêtre fixe Upstash. `INCR` + `PTTL` regroupés en UN appel pipeline REST ;
 * `PEXPIRE` (uniquement à la création du compteur) est le 2e et dernier appel
 * possible → au plus 2 requêtes REST par opération.
 */
async function redisRateLimit(
  config: RedisConfig,
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redisKey = `${REDIS_KEY_PREFIX}${key}`;
  const now = Date.now();

  const [rawCount, rawTtl] = await callUpstashPipeline(config, [
    ["INCR", redisKey],
    ["PTTL", redisKey],
  ]);

  const count = toFiniteNumber(rawCount);
  if (Number.isNaN(count)) {
    throw new Error("[rate-limit] Réponse Upstash invalide (INCR)");
  }

  const ttlMs = toFiniteNumber(rawTtl);

  let resetAt: number;
  if (ttlMs > 0) {
    resetAt = now + ttlMs;
  } else {
    // Compteur tout juste créé (ou sans TTL) : on pose la fenêtre.
    await callUpstash(config, [
      "PEXPIRE",
      redisKey,
      String(windowSec * 1000),
    ]);
    resetAt = now + windowSec * 1000;
  }

  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/** Avertit au plus une fois par intervalle de 5 min (pas de spam de logs). */
function warnRedisFallbackOnce(): void {
  const now = Date.now();
  if (now - lastRedisWarnAt < REDIS_WARN_INTERVAL_MS) return;
  lastRedisWarnAt = now;
  console.warn(
    "[rate-limit] Appel Upstash Redis échoué → repli sur le store mémoire local (limites non partagées entre instances)."
  );
}

// --- API publique ------------------------------------------------------------

/**
 * Vérifie et incrémente le compteur de rate limiting pour une clé donnée.
 *
 * @param opts Clé construite par l'appelant, limite et taille de fenêtre (s).
 * @returns Le résultat courant ; si `success === false`, l'appelant doit
 *   répondre 429 avec l'en-tête `Retry-After` dérivé de `resetAt`.
 */
export async function rateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const parsed = rateLimitOptionsSchema.safeParse(opts);

  if (!parsed.success) {
    // Fail-open : une mauvaise configuration d'appelant ne doit jamais
    // bloquer du trafic légitime.
    return {
      success: true,
      remaining: opts.limit ?? 0,
      resetAt: Date.now() + ((opts.windowSec ?? 0) * 1000),
    };
  }

  const { key, limit, windowSec } = parsed.data;
  const redisConfig = getRedisConfig();

  if (redisConfig) {
    try {
      return await redisRateLimit(redisConfig, key, limit, windowSec);
    } catch {
      warnRedisFallbackOnce();
    }
  }

  return memoryRateLimit(key, limit, windowSec);
}
