import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";
import {
  analyseResultSchema,
  freeAnalyseResultSchema,
  type AnalyseResult,
} from "./types";

/** Nombre maximal de tentatives (1 initiale + 2 retries sur erreur transitoire). */
const MAX_ATTEMPTS = 3;
/**
 * Timeout global par tentative (45 s). Le SDK supporte nativement
 * `RequestOptions.timeout` : il annule le fetch via un AbortController
 * interne et lève `GoogleGenerativeAIAbortError` — pas de `Promise.race`.
 */
const ATTEMPT_TIMEOUT_MS = 45_000;
/** Backoff exponentiel de base entre tentatives : 1 s puis 2 s. */
const BACKOFF_BASE_MS = 1_000;
/** Jitter aléatoire ±30 % pour éviter les effets de synchronisation. */
const JITTER_RATIO = 0.3;

/**
 * Métadonnées de coût retournées par Gemini (`usageMetadata`),
 * quand le SDK les expose.
 */
export interface AIGenerateUsage {
  /** Modèle effectivement appelé. */
  model: string;
  /** Tokens d'entrée (prompt). */
  promptTokens?: number;
  /** Tokens totaux (prompt + candidats). */
  totalTokens?: number;
}

/** Résultat d'un appel IA : texte brut + métriques de coût. */
export interface AIGenerateResult {
  text: string;
  usage: AIGenerateUsage;
}

export interface AIProvider {
  generate(prompt: string): Promise<AIGenerateResult>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponentiel (1 s, 2 s, 4 s…) avec jitter ±30 %. */
function backoffDelayMs(attempt: number): number {
  const base = BACKOFF_BASE_MS * 2 ** (attempt - 1);
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

/**
 * Classement d'une erreur : transitoire (retry autorisé) vs définitive
 * (un seul essai). Couvre 429/5xx, timeout/abort et échecs réseau ;
 * ne réessaie jamais sur une requête invalide (400/403/404…) ou une
 * réponse bloquée/illisible.
 */
function isTransientError(error: unknown): boolean {
  // Timeout/abort côté client (y compris RequestOptions.timeout du SDK).
  if (error instanceof GoogleGenerativeAIAbortError) return true;
  // Erreur HTTP Gemini : 429 (rate limit) et 5xx transitoires ;
  // sans statut identifiable → réseau, donc transitoire aussi.
  if (error instanceof GoogleGenerativeAIFetchError) {
    if (error.status === undefined) return true;
    return error.status === 429 || error.status >= 500;
  }
  // Erreurs SDK définitives : payload invalide ou réponse bloquée/illisible.
  if (
    error instanceof GoogleGenerativeAIRequestInputError ||
    error instanceof GoogleGenerativeAIResponseError
  ) {
    return false;
  }
  // GoogleGenerativeAIError générique : le SDK enveloppe les échecs
  // réseau fetch dans cette classe (message « Error fetching from … »).
  if (error instanceof GoogleGenerativeAIError) {
    return error.message.startsWith("Error fetching from");
  }
  // Erreurs fetch « brutes » (DOM/Node) : TypeError réseau ou abort/timeout.
  if (error instanceof Error) {
    return (
      error.name === "TypeError" ||
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    );
  }
  return false;
}

/** Identifiant d'erreur pour les logs — jamais le prompt ni la réponse. */
function describeError(error: unknown): string {
  if (error instanceof GoogleGenerativeAIFetchError) {
    return `fetch status=${error.status ?? "unknown"}`;
  }
  if (error instanceof Error) return error.name;
  return "non-Error";
}

class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-3.6-flash") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  /**
   * Appel Gemini avec retry à backoff exponentiel (+jitter) sur les seules
   * erreurs transitoires, et timeout de 45 s par tentative.
   *
   * @throws la dernière erreur rencontrée (transitoire après épuisement des
   * tentatives, ou définitive immédiatement).
   */
  async generate(prompt: string): Promise<AIGenerateResult> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.generateOnce(prompt);
      } catch (error) {
        if (!isTransientError(error) || attempt >= MAX_ATTEMPTS) {
          console.error(
            `[ai] Gemini call failed (${describeError(error)}, attempt ${attempt}/${MAX_ATTEMPTS}, model=${this.modelName})`
          );
          throw error;
        }
        const delayMs = backoffDelayMs(attempt);
        console.warn(
          `[ai] Gemini transient error (${describeError(error)}, attempt ${attempt}/${MAX_ATTEMPTS}, model=${this.modelName}) → retry in ${delayMs}ms`
        );
        await sleep(delayMs);
      }
    }
  }

  private async generateOnce(prompt: string): Promise<AIGenerateResult> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt, {
      timeout: ATTEMPT_TIMEOUT_MS,
    });
    const response = await result.response;
    const usage = response.usageMetadata;
    return {
      text: response.text(),
      usage: {
        model: this.modelName,
        promptTokens: usage?.promptTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
    };
  }
}

export function getAIProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GeminiProvider(apiKey);
}

/** Longueur maximale de la réponse IA conservée dans un message d'erreur. */
const PREVIEW_LENGTH = 200;

/**
 * Erreur typée levée quand la réponse IA est illisible ou invalide.
 * `code` permet une identification fiable sans dépendre du message.
 */
export class AIParseError extends Error {
  readonly code = "AI_PARSE_ERROR" as const;
  /** Issues Zod agrégées (`chemin: message`), sans le payload complet. */
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "AIParseError";
    this.issues = issues;
  }
}

export function isAIParseError(error: unknown): error is AIParseError {
  return error instanceof AIParseError;
}

/** Aperçu tronqué et mis sur une ligne : jamais le payload complet en mémoire de log. */
function truncateForLog(value: string): string {
  const flattened = value.replace(/\s+/g, " ").trim();
  if (flattened.length <= PREVIEW_LENGTH) return flattened;
  return `${flattened.slice(0, PREVIEW_LENGTH)}…`;
}

/**
 * Options de validation de la réponse IA.
 */
export interface ParseAIResponseOptions {
  /**
   * `true` → plan gratuit : validation via `freeAnalyseResultSchema`
   * (`notesParCritere` et `rapport.sections` peuvent être vides, clés
   * présentes validées strictement). Absent/false → schéma payant strict.
   */
  freePlan?: boolean;
}

/**
 * Analyse la réponse brute de l'IA et la valide contre le schéma adapté au plan.
 *
 * @throws {AIParseError} code `AI_PARSE_ERROR` si le JSON est illisible ou si
 * le schéma échoue (champ manquant, type faux, note hors [0, 100]).
 * Jamais de donnée non validée n'est retournée.
 */
export function parseAIResponse(
  raw: string,
  options: ParseAIResponseOptions = {}
): AnalyseResult {
  let cleaned = raw.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AIParseError(
      `Réponse IA illisible (JSON invalide) : ${reason} — aperçu : ${truncateForLog(cleaned)}`
    );
  }

  // Sélection du schéma selon le plan : payant strict par défaut.
  const result = options.freePlan
    ? freeAnalyseResultSchema.safeParse(parsed)
    : analyseResultSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) =>
        `${issue.path.map(String).join(".") || "(racine)"}: ${issue.message}`
    );
    throw new AIParseError(
      `Réponse IA invalide (${issues.length} problème(s)) : ${issues.join(" | ")} — aperçu : ${truncateForLog(cleaned)}`,
      issues
    );
  }

  return result.data;
}
