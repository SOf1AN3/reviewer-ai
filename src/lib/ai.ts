import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  analyseResultSchema,
  freeAnalyseResultSchema,
  type AnalyseResult,
} from "./types";

export interface AIProvider {
  generate(prompt: string): Promise<string>;
}

class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-3.6-flash") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generate(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
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
