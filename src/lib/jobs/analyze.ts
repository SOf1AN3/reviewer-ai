import { db } from "@/lib/db";
import { getAIProvider, parseAIResponse } from "@/lib/ai";
import { logEvent } from "@/lib/logger";

/**
 * src/lib/jobs/analyze.ts — Job d'analyse asynchrone (T2.7).
 *
 * Le POST /api/analyze ne bloque plus la réponse sur l'appel IA : il crée
 * l'`Article` (état « en attente » détectable, cf. `GET /api/analyse/[id]`),
 * puis planifie ce job via `after()` de `next/server` (API stable de Next 16,
 * l'équivalent public de `waitUntil`) et répond immédiatement en 202.
 *
 * Choix d'état SANS MIGRATION : le modèle `Analyse` n'a pas de colonne de
 * statut (`noteGlobale` est un `Float` NOT NULL, pas de sentinel possible) et
 * `prisma/schema.prisma` ne doit pas être modifié. On adopte donc l'option (a)
 * : un article SANS `Analyse` = « pending », un article AVEC `Analyse` =
 * « completed ». Ce job crée l'`Analyse` à la fin de l'étape IA.
 *
 * Le job est AUTO-PORTEUR : il reçoit tout ce dont il a besoin (userId,
 * articleId, prompt pré-construit, isFreePlan) et ne dépend d'aucun objet de
 * requête HTTP — il pourra être déplacé vers un orchestreur externe (Inngest,
 * QStash, queue…) sans toucher aux routes.
 *
 * TOLÉRANCE AUX ÉCHECS : ce job s'exécute APRÈS l'envoi de la réponse. Il
 * attrape donc TOUTES ses erreurs et les journalise via `logEvent` — une
 * exception propagée depuis un callback `after()` ferait crasher le serveur.
 * En cas d'échec, l'article reste sans analyse → l'API GET continue de
 * répondre `status: "pending"` (limite assumée de l'option (a) : pas d'état
 * « failed » sans colonne de statut ; journal `analysis_job / step=failed`).
 */

/** Paramètres auto-porteurs du job — aucun contexte HTTP requis. */
export interface RunAnalysisJobParams {
  /** Propriétaire de l'article (trace d'usage + UsageEvent). */
  userId: string;
  /** Article déjà créé par la route avant le lancement du job. */
  articleId: string;
  /** Prompt déjà construit par la route via `buildAnalysisPrompt`. */
  prompt: string;
  /** `true` → plan gratuit (validation Zod allégée de la réponse IA). */
  isFreePlan: boolean;
}

/**
 * Identifiant d'erreur réduit pour le log — jamais l'objet erreur complet.
 *
 * Le message d'une erreur du SDK Gemini (`GoogleGenerativeAIError`) embarque
 * l'URL complète de la requête, `?key=<GEMINI_API_KEY>` compris. `logEvent`
 * remplace les valeurs de clés sensibles, mais renvoie `error.message` tel
 * quel pour les `Error` : on ne lui passe donc QUE le `name`, le `status`
 * HTTP éventuel et les frames `at …` (jamais le message).
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "non-Error";
  const status =
    "status" in error && typeof error.status === "number"
      ? ` status=${error.status}`
      : "";
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => /^\s*at\s/.test(line));
  const stack = frames.length > 0 ? `\n${frames.join("\n")}` : "";
  return `${error.name}${status}${stack}`;
}

/**
 * Exécute le pipeline d'analyse en arrière-plan :
 * appel IA (retry ×3, timeout 45 s) → validation Zod → création de l'`Analyse`
 * → `UsageEvent` best-effort.
 *
 * Ne JAMAIS rejette : toute erreur est journalisée (`analysis_job /
 * step=failed`) puis avalée.
 */
export async function runAnalysisJob(
  params: RunAnalysisJobParams
): Promise<void> {
  const { userId, articleId, prompt, isFreePlan } = params;

  try {
    const ai = getAIProvider();
    const startedAt = Date.now();
    const { text: rawResponse, usage } = await ai.generate(prompt);
    const durationMs = Date.now() - startedAt;

    // Aucune donnée non validée n'est persistée : AIParseError → job en échec.
    const analyseResult = parseAIResponse(rawResponse, {
      freePlan: isFreePlan,
    });

    // Écriture unique : à partir de là l'article bascule en « completed »
    // (visible immédiatement par GET /api/analyse/[id]).
    const analyse = await db.analyse.create({
      data: {
        articleId,
        rapport: JSON.stringify(analyseResult.rapport),
        noteGlobale: analyseResult.noteGlobale,
        noteParCritere: analyseResult.notesParCritere,
      },
    });

    logEvent("analysis_job", {
      step: "completed",
      userId,
      articleId,
      analyseId: analyse.id,
      model: usage.model,
      promptTokens: usage.promptTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      durationMs,
    });

    // Best-effort : trace d'usage (coût + durée). Un échec d'écriture ne doit
    // pas remettre en cause une analyse déjà persistée — loggé seulement.
    try {
      await db.usageEvent.create({
        data: {
          userId,
          type: "ANALYSIS_CREATED",
          metadata: {
            articleId,
            analyseId: analyse.id,
            model: usage.model,
            promptTokens: usage.promptTokens ?? null,
            totalTokens: usage.totalTokens ?? null,
            durationMs,
          },
        },
      });
    } catch (error) {
      logEvent("analysis_job", {
        step: "usage_event_failed",
        userId,
        articleId,
        error: describeError(error),
      });
    }
  } catch (error) {
    // Ne jamais propager : ce code s'exécute après la réponse (after()).
    logEvent("analysis_job", {
      step: "failed",
      userId,
      articleId,
      isFreePlan,
      error: describeError(error),
    });
  }
}
