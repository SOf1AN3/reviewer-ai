/**
 * src/app/api/cron/retention/route.ts — Point d'entrée cron de la purge de
 * rétention (voir `src/lib/jobs/retention.ts`).
 *
 * GET /api/cron/retention
 *
 * Sécurité (la route SUPPRIME des données) :
 *   - authentification OBLIGATOIRE par en-tête `Authorization: Bearer <CRON_SECRET>` ;
 *   - comparaison en temps constant (`crypto.timingSafeEqual` sur des SHA-256,
 *     pour éviter toute fuite de longueur) — jamais d'égalité simple ;
 *   - sans `CRON_SECRET` configuré : **503**, la purge n'est JAMAIS exécutée
 *     à l'aveugle (ni en dev, ni en prod) ;
 *   - secret absent/incorrect : **401** ;
 *   - le détail d'erreur du balayage (champ `error` du résumé) n'est **jamais**
 *     renvoyé au client : il reste réservé aux logs serveur (`logEvent`).
 *
 * Méthode GET : usage typique des planificateurs de cron (Vercel Cron envoie
 * un GET). Aucun body n'est lu, aucun état n'est muté en dehors de la purge.
 *
 * Note middleware : `/api/cron/retention` n'est PAS dans la liste d'exemption
 * de `src/middleware.ts` (`isRateLimitExempt`), donc il est soumis au rate
 * limiting GET générique (60 req/min/IP, règle `api-read`). C'est largement
 * suffisant pour un cron et constitue un garde-fou supplémentaire.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { runRetentionSweep, type RetentionSweepSummary } from "@/lib/jobs/retention";

/** Force le runtime Node.js (la purge utilise Prisma + `node:crypto`). */
export const runtime = "nodejs";

/** Digest SHA-256 : deux tampons de longueur égale, comparables en temps constant. */
function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Vrai si l'en-tête `Authorization` vaut exactement `Bearer <secret>`. */
function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) {
    return false;
  }

  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return false;
  }

  const candidate = header.slice(prefix.length);
  const candidateDigest = digest(candidate);
  const secretDigest = digest(secret);

  // Même longueur (32 octets pour SHA-256) ⇒ timingSafeEqual est applicable.
  return timingSafeEqual(candidateDigest, secretDigest);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1) Secret de cron configuré ? Jamais de purge sans secret.
  const secret = env.CRON_SECRET;

  if (!secret) {
    // En production, `src/lib/env.ts` a déjà refusé le démarrage sans
    // CRON_SECRET : ce 503 est un filet de sécurité défensif.
    logEvent("retention_cron_unconfigured", {});
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET non configuré : la purge de rétention est désactivée. Renseignez CRON_SECRET dans l'environnement.",
      },
      { status: 503 }
    );
  }

  // 2) Authentification par secret (comparaison en temps constant).
  const authorization = request.headers.get("authorization");

  if (!isAuthorized(authorization, secret)) {
    logEvent("retention_cron_unauthorized", {
      hasAuthorizationHeader: authorization !== null,
    });
    return NextResponse.json(
      { ok: false, error: "Non autorisé" },
      { status: 401 }
    );
  }

  // 3) Purge exécutée (elle-même ne lève jamais).
  const summary = await runRetentionSweep();

  // Le champ `error` (message d'erreur Prisma brut : IDs, détails de
  // l'invocation…) ne quitte JAMAIS le serveur. Le détail reste dans les logs
  // (`logEvent` côté job) ; le client ne reçoit que des compteurs et des dates.
  const publicSummary: Omit<RetentionSweepSummary, "error"> = {
    scanned: summary.scanned,
    deletedArticles: summary.deletedArticles,
    deletedAnalyses: summary.deletedAnalyses,
    cutoffs: summary.cutoffs,
    durationMs: summary.durationMs,
  };

  return NextResponse.json({ ok: true, summary: publicSummary }, { status: 200 });
}
