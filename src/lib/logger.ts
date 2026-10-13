/**
 * src/lib/logger.ts — Journalisation structurée (événements applicatifs).
 *
 * ⚠️ Exception assumée et unique au projet : c'est le SEUL fichier autorisé à
 * utiliser `console.log`. Tout le reste du code continue d'utiliser
 * `console.error` / `console.warn` comme auparavant.
 *
 * Garde-fou : toute valeur dont la CLÉ matche `/secret|token|password|key|
 * authorization|apikey/i` est remplacée par "[redacted]" (récursivement, y
 * compris dans les objets imbriqués et les tableaux). Le logger ne lève
 * jamais d'exception : une erreur de sérialisation (structure circulaire,
 * etc.) est elle-même journalisée proprement.
 *
 * Format de ligne : `{ ts, event, ...data }` (JSON sur une seule ligne).
 * Aucune dépendance externe.
 */

/** Clés dont la valeur ne doit JAMAIS figurer dans les logs. */
const SENSITIVE_KEY_PATTERN = /secret|token|password|key|authorization|apikey/i;

const REDACTED = "[redacted]";

/** Réservés : toujours positionnés par le logger, jamais écrasés par `data`. */
const RESERVED_KEYS = new Set(["ts", "event"]);

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

/** Journalise un événement structuré : une ligne JSON `{ ts, event, ...data }`. */
export function logEvent(event: string, data: Record<string, unknown>): void {
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
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
  } catch {
    // Le logger ne doit JAMAIS faire échouer l'appelant.
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event,
        logError: "log_serialization_failed",
      })
    );
  }
}
