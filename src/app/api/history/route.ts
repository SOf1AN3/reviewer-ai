import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

interface HistoryItem {
  id: string;
  titre: string;
  auteur: string | null;
  revueCiblee: string | null;
  dateCreation: Date;
  noteGlobale: number;
  dateAnalyse: Date;
}

export const GET = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const articles = await db.article.findMany({
      where: { userId: req.auth.user.id! },
      include: {
        analyses: {
          orderBy: { dateAnalyse: "desc" },
          take: 1,
        },
      },
      orderBy: { dateCreation: "desc" },
    });

    const history: HistoryItem[] = articles
      .filter((article) => article.analyses.length > 0)
      .map((article) => ({
        id: article.id,
        titre: article.titre,
        auteur: article.auteur,
        revueCiblee: article.revueCiblee,
        dateCreation: article.dateCreation,
        noteGlobale: article.analyses[0].noteGlobale,
        dateAnalyse: article.analyses[0].dateAnalyse,
      }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'historique" },
      { status: 500 }
    );
  }
});
