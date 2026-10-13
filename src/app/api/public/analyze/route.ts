import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { getAIProvider, parseAIResponse, isAIParseError } from "@/lib/ai";
import { consumeQuota } from "@/lib/plan";
import { authenticateApiKey } from "@/lib/api-key";
import { logEvent } from "@/lib/logger";

/**
 * POST /api/public/analyze — endpoint PUBLIC authentifié par CLÉ API.
 *
 * Contrairement à `POST /api/analyze` (session, réponse 202 + job asynchrone),
 * ce point d'entrée est synchrone : il exécute l'appel IA en ligne et renvoie
 * directement le résultat. Il est destiné aux intégrations tierces.
 *
 * Sécurité :
 * - Auth par clé API (`Authorization: Bearer pn_live_…`), JAMAIS par session.
 * - Le quota du plan de l'utilisateur PROPRIÉTAIRE (`consumeQuota`) s'applique
 *   toujours : une clé API ne permet pas de contourner le quota du plan.
 * - Un quota optionnel PAR CLÉ (`ApiKey.monthlyLimit`) peut restreindre
 *   davantage une clé donnée.
 *
 * Réponse 200 : `{ analyseId, noteGlobale, notesParCritere, rapport }`
 * (pas de `contenu` de l'article — l'endpoint est public).
 *
 * Erreurs normalisées : `{ error: { code, message } }` avec `unauthorized`,
 * `invalid_request`, `quota_exceeded`, `ai_error` (et `internal_error` en
 * dernier recours).
 */

/** Codes d'erreur normalisés de l'API publique. */
type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "quota_exceeded"
  | "ai_error"
  | "internal_error";

/** Construit une réponse d'erreur normalisée `{ error: { code, message } }`. */
function apiError(
  code: ApiErrorCode,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Même schéma de corps que `POST /api/analyze` (T2.7). */
const analyzeSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().min(100, "Le contenu doit faire au moins 100 caractères"),
  auteur: z.string().optional(),
  revueCiblee: z.string().optional(),
  locale: z.string().optional().default("fr"),
});

type AnalyzeInput = z.infer<typeof analyzeSchema>;

/** Début (minuit) du mois UTC courant — fenêtre de quota mensuelle en UTC. */
function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Identifiant d'erreur réduit pour le log — jamais l'objet erreur complet.
 * Copie locale de `describeError` (non exporté par `@/lib/ai` ni les routes).
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
 * Contrôle optionnel du quota PAR CLÉ.
 *
 * ⚠️ Limite assumée (documentée) : `UsageEvent` n'a AUCUNE contrainte
 * d'unicité en base, il est donc impossible — sans migration — de verrouiller
 * atomiquement le compteur « appels de ce mois pour cette clé ». On procède
 * par un `count` suivi de l'insertion de l'événement : sous requêtes
 * concurrentes très simultanées, deux appels peuvent passer le `count` juste
 * avant l'insertion et dépasser `monthlyLimit` d'une unité (fenêtre de
 * millisecondes). C'est un contrôle de quota « best-effort » par clé ; le
 * quota du PLAN, lui, reste strictement atomique (via `consumeQuota`).
 *
 * @returns `true` si la clé a encore du budget ce mois-ci.
 */
async function hasKeyQuotaRemaining(
  userId: string,
  apiKeyId: string,
  monthlyLimit: number
): Promise<boolean> {
  const monthStart = startOfUtcMonth(new Date());
  const count = await db.usageEvent.count({
    where: {
      userId,
      type: "API_CALL",
      createdAt: { gte: monthStart },
      // Filtre JSON : ne compte que les événements de CETTE clé.
      metadata: { path: ["apiKeyId"], equals: apiKeyId },
    },
  });
  return count < monthlyLimit;
}

/** Résultat de l'étape IA enrichi des métriques pour la trace d'usage. */
interface PublicAIResult {
  result: Awaited<ReturnType<typeof parseAIResponse>>;
  model: string;
  durationMs: number;
}

/** Exécute l'étape IA (prompt → génération → parsing) en ligne. */
async function runAI(
  input: AnalyzeInput,
  isFreePlan: boolean
): Promise<PublicAIResult> {
  const ai = getAIProvider();
  const prompt = buildAnalysisPrompt(input, input.locale, isFreePlan);
  const startedAt = Date.now();
  const { text, usage } = await ai.generate(prompt);
  const durationMs = Date.now() - startedAt;
  const result = parseAIResponse(text, { freePlan: isFreePlan });
  return { result, model: usage.model, durationMs };
}

export async function POST(req: Request): Promise<NextResponse> {
  // --- Auth par CLÉ API (jamais de session) --------------------------------
  const identity = await authenticateApiKey(req);
  if (!identity) {
    return apiError("unauthorized", "Clé API manquante ou invalide.", 401);
  }

  try {
    // --- Validation Zod : 400 structuré avant toute consommation de quota ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("invalid_request", "Corps de requête invalide.", 400);
    }

    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "invalid_request",
        parsed.error.issues.map((i) => i.message).join(" | ") || "Données invalides.",
        400
      );
    }
    const input = parsed.data;

    // --- Quota PAR CLÉ (optionnel) : contrôle best-effort AVANT le quota plan
    // afin de ne pas brûler de quota de plan pour une clé déjà à sa limite.
    if (identity.monthlyLimit !== null) {
      const remaining = await hasKeyQuotaRemaining(
        identity.userId,
        identity.apiKeyId,
        identity.monthlyLimit
      );
      if (!remaining) {
        return apiError(
          "quota_exceeded",
          `Cette clé API a atteint sa limite de ${identity.monthlyLimit} appels pour ce mois.`,
          403
        );
      }
    }

    // --- Quota du PLAN (atomique, obligatoire) : une clé ne contourne pas le
    // quota du propriétaire. Consommé AVANT l'appel IA (anti-abus).
    const quota = await consumeQuota(identity.userId);
    if (!quota.allowed) {
      return apiError("quota_exceeded", quota.reason, 403);
    }

    const isFreePlan = quota.plan.key === "free";

    // --- Appel IA en ligne (synchrone). Les erreurs IA → 502 `ai_error`.
    let aiRun: PublicAIResult;
    try {
      aiRun = await runAI(input, isFreePlan);
    } catch (error) {
      // AIParseError (réponse illisible) ou erreur SDK Gemini / clé absente.
      logEvent("public_analyze", {
        step: "ai_failed",
        userId: identity.userId,
        apiKeyId: identity.apiKeyId,
        isAIParse: isAIParseError(error),
        error: describeError(error),
      });
      return apiError("ai_error", "Le service d'analyse IA a échoué.", 502);
    }
    const { result, model, durationMs } = aiRun;

    // --- Persistance : Article puis Analyse (réponse synchrone, pas de « pending »).
    const article = await db.article.create({
      data: {
        userId: identity.userId,
        titre: input.titre,
        contenu: input.contenu,
        auteur: input.auteur || null,
        revueCiblee: input.revueCiblee || null,
      },
    });

    const analyse = await db.analyse.create({
      data: {
        articleId: article.id,
        rapport: JSON.stringify(result.rapport),
        noteGlobale: result.noteGlobale,
        noteParCritere: result.notesParCritere,
      },
    });

    // --- Trace d'usage API_CALL (best-effort, jamais bloquante) -------------
    try {
      await db.usageEvent.create({
        data: {
          userId: identity.userId,
          type: "API_CALL",
          metadata: {
            apiKeyId: identity.apiKeyId,
            analyseId: analyse.id,
            model,
            durationMs,
          },
        },
      });
    } catch (error) {
      logEvent(
        "public_analyze",
        {
          step: "usage_event_failed",
          userId: identity.userId,
          apiKeyId: identity.apiKeyId,
          error: describeError(error),
        },
        "warn"
      );
    }

    // --- Réponse : mêmes données que l'API interne, sans `contenu` ---------
    return NextResponse.json({
      analyseId: analyse.id,
      noteGlobale: result.noteGlobale,
      notesParCritere: result.notesParCritere,
      rapport: result.rapport,
    });
  } catch (error) {
    // Erreur interne inattendue (base, etc.) — journalisée sans fuite.
    logEvent(
      "public_analyze",
      {
        step: "internal_error",
        userId: identity.userId,
        apiKeyId: identity.apiKeyId,
        error: describeError(error),
      },
      "error"
    );
    return apiError("internal_error", "Erreur interne.", 500);
  }
}
