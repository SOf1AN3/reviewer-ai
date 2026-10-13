import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { auth } from "@/lib/auth";
import { consumeQuota } from "@/lib/plan";
import { requireUser } from "@/lib/guards";
import { runAnalysisJob } from "@/lib/jobs/analyze";

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

/**
 * POST /api/analyze — CHANGE DE CONTRAT (T2.7) : la réponse n'attend plus
 * l'appel IA. La route valide, consomme le quota, crée l'`Article` seul (état
 * « pending » détectable : pas d'`Analyse` tant que le job n'a pas abouti),
 * planifie le job via `after()` (API native Next 16 — voir
 * `src/lib/jobs/analyze.ts`) et répond immédiatement :
 *
 *   202 { articleId, status: "pending" }
 *
 * ⚠️ Ancien contrat supprimé : `{ articleId, analyseId, result }` en 200.
 * Le front (`src/components/ArticleForm.tsx`) n'utilise que `data.articleId`
 * pour rediriger → il fonctionne toujours ; l'adaptation UI (polling de
 * `GET /api/analyse/[id]`) est portée par la tâche T3.2.
 */
export const POST = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const userId = currentUser.id;

    const body = await req.json();
    const validated = articleSchema.parse(body);

    // Quota vérifié ET consommé en une seule écriture atomique, AVANT le
    // lancement du job (anti-abus inchangé : jamais sur un payload invalide,
    // Zod échoue avant). En cas d'échec ultérieur du job, le quota reste
    // consommé — décision de sécurité assumée.
    const quota = await consumeQuota(userId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, code: "QUOTA_EXCEEDED" },
        { status: 403 }
      );
    }

    const isFreePlan = quota.plan.key === "free";

    // L'Article est créé DÈS MAINTENANT : sa seule existence (sans `Analyse`)
    // est le marqueur d'état « pending » de GET /api/analyse/[id]. Le job
    // créera l'`Analyse` en fin de parcours. Aucune modification de schéma.
    const article = await db.article.create({
      data: {
        userId,
        titre: validated.titre,
        contenu: validated.contenu,
        auteur: validated.auteur || null,
        revueCiblee: validated.revueCiblee || null,
      },
    });

    // Prompt construit ICI pour que le job reste auto-porteur (aucune dépendance
    // à la requête HTTP, migrable vers un orchestreur externe tel quel).
    const prompt = buildAnalysisPrompt(validated, validated.locale, isFreePlan);

    // after() = équivalent public et stable (Next ≥ 15.1) de waitUntil : le
    // callback s'exécute APRÈS l'envoi de la réponse, sans bloquer le client.
    // runAnalysisJob ne rejette jamais (erreurs avalées + journalisées).
    after(() =>
      runAnalysisJob({ userId, articleId: article.id, prompt, isFreePlan })
    );

    return NextResponse.json(
      { articleId: article.id, status: "pending" },
      { status: 202 }
    );
  } catch (error) {
    // Log sécurisé : jamais l'objet erreur brut.
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
