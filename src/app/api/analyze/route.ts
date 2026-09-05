import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAIProvider, parseAIResponse } from "@/lib/ai";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { auth } from "@/lib/auth";

const articleSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().min(100, "Le contenu doit faire au moins 100 caractères"),
  auteur: z.string().optional(),
  revueCiblee: z.string().optional(),
});

export const POST = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = articleSchema.parse(body);

    const article = await db.article.create({
      data: {
        userId: req.auth.user.id!,
        titre: validated.titre,
        contenu: validated.contenu,
        auteur: validated.auteur || null,
        revueCiblee: validated.revueCiblee || null,
      },
    });

    const prompt = buildAnalysisPrompt(validated);
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
