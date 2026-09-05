import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const GET = auth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const article = await db.article.findUnique({
      where: { id },
      include: {
        analyses: {
          orderBy: { dateAnalyse: "desc" },
          take: 1,
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article non trouvé" },
        { status: 404 }
      );
    }

    if (article.userId !== req.auth.user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    const latestAnalyse = article.analyses[0];
    if (!latestAnalyse) {
      return NextResponse.json(
        { error: "Aucune analyse trouvée pour cet article" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      article: {
        id: article.id,
        titre: article.titre,
        contenu: article.contenu,
        auteur: article.auteur,
        revueCiblee: article.revueCiblee,
        dateCreation: article.dateCreation,
      },
      analyse: {
        id: latestAnalyse.id,
        rapport: JSON.parse(latestAnalyse.rapport as string),
        noteGlobale: latestAnalyse.noteGlobale,
        noteParCritere: latestAnalyse.noteParCritere,
        dateAnalyse: latestAnalyse.dateAnalyse,
      },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 }
    );
  }
});
