import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAIProvider, parseAIResponse } from "@/lib/ai";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { auth } from "@/lib/auth";
import { consumeQuota } from "@/lib/plan";
import { requireUser } from "@/lib/guards";

/**
 * Identifiant d'erreur réduit pour le log — jamais l'objet erreur complet.
 *
 * Le message d'une erreur du SDK Gemini (`GoogleGenerativeAIError`) embarque
 * l'URL complète de la requête, `?key=<GEMINI_API_KEY>` compris : on ne
 * journalise donc ni `error.message` ni `error.stack` brut, seulement le
 * `name`, le `status` HTTP éventuel et les frames `at …` (sans la ligne
 * d'en-tête qui contient le message).
 *
 * Équivalent local du helper `describeError` de `@/lib/ai`, qui n'est pas
 * exporté (donc non importable ici).
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

const articleSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().min(100, "Le contenu doit faire au moins 100 caractères"),
  auteur: z.string().optional(),
  revueCiblee: z.string().optional(),
  locale: z.string().optional().default("fr"),
});

export const POST = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const userId = currentUser.id;

    const body = await req.json();
    const validated = articleSchema.parse(body);

    // Quota vérifié ET consommé en une seule écriture atomique, AVANT l'appel IA
    // pour bloquer l'abus ; jamais sur un payload invalide (Zod échoue avant).
    const quota = await consumeQuota(userId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, code: "QUOTA_EXCEEDED" },
        { status: 403 }
      );
    }

    const isFreePlan = quota.plan.key === "free";

    // Appel IA + parsing AVANT toute écriture DB : si l'IA échoue
    // (timeout, quota Gemini, AIParseError...), aucune ligne n'est écrite
    // → plus d'articles orphelins. Le quota, lui, est déjà consommé
    // (décision de sécurité assumée, cf. plus haut).
    const prompt = buildAnalysisPrompt(validated, validated.locale, isFreePlan);
    const ai = getAIProvider();
    const startedAt = Date.now();
    const { text: rawResponse, usage } = await ai.generate(prompt);
    const durationMs = Date.now() - startedAt;

    const analyseResult = parseAIResponse(rawResponse, { freePlan: isFreePlan });

    // Création Article + Analyse atomique : si l'une échoue, rien n'est écrit.
    const { article, analyse } = await db.$transaction(async (tx) => {
      const createdArticle = await tx.article.create({
        data: {
          userId,
          titre: validated.titre,
          contenu: validated.contenu,
          auteur: validated.auteur || null,
          revueCiblee: validated.revueCiblee || null,
        },
      });

      const createdAnalyse = await tx.analyse.create({
        data: {
          articleId: createdArticle.id,
          rapport: JSON.stringify(analyseResult.rapport),
          noteGlobale: analyseResult.noteGlobale,
          noteParCritere: analyseResult.notesParCritere,
        },
      });

      return { article: createdArticle, analyse: createdAnalyse };
    });

    // Best-effort : trace d'usage (coût + durée). Un échec d'écriture ne doit
    // pas faire échouer une analyse déjà persistée — loggé seulement.
    try {
      await db.usageEvent.create({
        data: {
          userId,
          type: "ANALYSIS_CREATED",
          metadata: {
            articleId: article.id,
            analyseId: analyse.id,
            model: usage.model,
            promptTokens: usage.promptTokens ?? null,
            totalTokens: usage.totalTokens ?? null,
            durationMs,
          },
        },
      });
    } catch (error) {
      console.error(
        "UsageEvent write failed (best-effort):",
        error instanceof Error ? error.message : "unknown"
      );
    }

    return NextResponse.json({
      articleId: article.id,
      analyseId: analyse.id,
      result: analyseResult,
    });
  } catch (error) {
    // Log sécurisé : jamais l'objet erreur brut (le message du SDK Gemini
    // contient l'URL de requête avec `?key=<GEMINI_API_KEY>`).
    console.error("Analysis error:", describeError(error));

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erreur lors de l'analyse" },
      { status: 500 }
    );
  }
});
