/**
 * src/lib/logger.ts — Journalisation structurée (événements applicatifs).
 *
 * ⚠️ Exception assumée et unique au projet : c'est le SEUL fichier autorisé à
 * utiliser `console.log`. Tout le reste du code continue d'utiliser
 * `console.error` / `console.warn` comme auparavant.
 *
 * Niveaux (3e paramètre optionnel, défaut `"info"`) :
 * - `"info"`  → `console.log`   : événements métier courants ;
 * - `"warn"`  → `console.warn`  : anomalies dégradées non bloquantes ;
 * - `"error"` → `console.error` : échecs / incidents.
 * Le niveau est inclus dans la ligne (`level`), clé réservée non écrasable
 * par l'appelant. Les appels existants (2 paramètres) sont inchangés.
 *
 * Corrélation : incluez un champ `requestId` dans `data` (par ex.
 * `{ requestId }`) pour relier tous les événements d'une même requête.
 * La signature n'a pas bougé — c'est un champ de `data`, pas un paramètre.
 *
 * Garde-fou : toute valeur dont la CLÉ matche `/secret|token|password|key|
 * authorization|apikey/i` est remplacée par "[redacted]" (récursivement, y
 * compris dans les objets imbriqués et les tableaux). Le logger ne lève
 * jamais d'exception : une erreur de sérialisation (structure circulaire,
 * etc.) est elle-même journalisée proprement.
 *
 * Format de ligne : `{ ts, level, event, ...data }` (JSON sur une seule
 * ligne). Aucune dépendance externe.
 */

/** Clés dont la valeur ne doit JAMAIS figurer dans les logs. */
const SENSITIVE_KEY_PATTERN = /secret|token|password|key|authorization|apikey/i;

const REDACTED = "[redacted]";

/** Réservés : toujours positionnés par le logger, jamais écrasés par `data`. */
const RESERVED_KEYS = new Set(["ts", "level", "event"]);

/** Niveau de journalisation. */
export type LogLevel = "info" | "warn" | "error";

const VALID_LEVELS = new Set<LogLevel>(["info", "warn", "error"]);

/**
 * Défend contre un niveau invalide passé en JS non typé : retourne `"info"`
 * plutôt que de lever (règle « ne lève jamais »).
 */
function resolveLevel(level: LogLevel | undefined): LogLevel {
  return level !== undefined && VALID_LEVELS.has(level) ? level : "info";
}

/** Émet la ligne JSON sur la console correspondant au niveau. */
function emit(level: LogLevel, line: string): void {
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

/**
 * Recopie `value` en remplaçant par "[redacted]" toute valeur dont la clé est
 * sensible. descend dans les objets et tableaux ; les structures circulaires
 * sont coupées.
 */
function redact(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key !== undefined && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, undefined, seen));
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    result[childKey] = redact(childValue, childKey, seen);
  }
  return result;
}

/**
 * Journalise un événement structuré : une ligne JSON
 * `{ ts, level, event, ...data }`.
 *
 * @param event Nom court de l'événement (ex. `"auth"`, `"analysis_job"`).
 * @param data Données structurées ; utilisez `data.requestId` pour la
 *   corrélation entre événements d'une même requête.
 * @param level Niveau optionnel (`"info"` par défaut).
 */
export function logEvent(
  event: string,
  data: Record<string, unknown>,
  level: LogLevel = "info"
): void {
  const resolvedLevel = resolveLevel(level);
  try {
    const sanitized = redact(data, undefined, new WeakSet<object>()) as Record<
      string,
      unknown
    >;
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sanitized)) {
      if (!RESERVED_KEYS.has(key)) {
        payload[key] = value;
      }
    }
    emit(
      resolvedLevel,
      JSON.stringify({
        ts: new Date().toISOString(),
        level: resolvedLevel,
        event,
        ...payload,
      })
    );
  } catch {
    // Le logger ne doit JAMAIS faire échouer l'appelant.
    emit(
      resolvedLevel,
      JSON.stringify({
        ts: new Date().toISOString(),
        level: resolvedLevel,
        event,
        logError: "log_serialization_failed",
      })
    );
  }
}
