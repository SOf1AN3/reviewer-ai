import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAIProvider, parseAIResponse } from "@/lib/ai";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { auth } from "@/lib/auth";
import { canAnalyze, incrementUsage, getUserPlan } from "@/lib/plan";

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

    const access = await canAnalyze(userId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason, code: "QUOTA_EXCEEDED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = articleSchema.parse(body);

    const userPlan = await getUserPlan(userId);
    const isFreePlan = !userPlan || userPlan.key === "free";

    const article = await db.article.create({
      data: {
        userId,
        titre: validated.titre,
        contenu: validated.contenu,
        auteur: validated.auteur || null,
        revueCiblee: validated.revueCiblee || null,
      },
    });

    const prompt = buildAnalysisPrompt(validated, validated.locale, isFreePlan);
    const ai = getAIProvider();
    const rawResponse = await ai.generate(prompt);

    const analyseResult = parseAIResponse(rawResponse);

    const analyse = await db.analyse.create({
      data: {
        articleId: article.id,
        rapport: JSON.stringify(analyseResult.rapport),
        noteGlobale: analyseResult.noteGlobale,
        noteParCritere: analyseResult.notesParCritere,
      },
    });

    await incrementUsage(userId);

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
