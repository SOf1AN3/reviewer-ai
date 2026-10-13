import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAIProvider, parseAIResponse } from "@/lib/ai";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { auth } from "@/lib/auth";
import { consumeQuota } from "@/lib/plan";

const articleSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().min(100, "Le contenu doit faire au moins 100 caractères"),
  auteur: z.string().optional(),
  revueCiblee: z.string().optional(),
  locale: z.string().optional().default("fr"),
});

export const POST = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const userId = req.auth.user.id!;

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
    const rawResponse = await ai.generate(prompt);

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

    return NextResponse.json({
      articleId: article.id,
      analyseId: analyse.id,
      result: analyseResult,
    });
  } catch (error) {
    console.error("Analysis error:", error);

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
