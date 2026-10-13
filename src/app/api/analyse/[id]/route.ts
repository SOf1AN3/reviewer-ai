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

    const articlePayload = {
      id: article.id,
      titre: article.titre,
      contenu: article.contenu,
      auteur: article.auteur,
      revueCiblee: article.revueCiblee,
      dateCreation: article.dateCreation,
    };

    const latestAnalyse = article.analyses[0];

    // T2.7 (option a, sans migration) : un article SANS `Analyse` = job
    // d'analyse encore en cours (ou en échec, cf. journal `analysis_job`) →
    // ce n'est plus une 404 mais un statut explicite. Un article inexistant
    // reste bien une 404 (testé plus haut).
    if (!latestAnalyse) {
      return NextResponse.json({
        articleId: article.id,
        status: "pending",
        article: articlePayload,
      });
    }

    // Contrat conservé pour la page de résultat (`src/app/[locale]/
    // analyse/[id]/page.tsx` lit `data.article` et `data.analyse`) :
    // les champs `articleId` / `status` sont purement additionnels.
    return NextResponse.json({
      articleId: article.id,
      status: "completed",
      article: articlePayload,
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
