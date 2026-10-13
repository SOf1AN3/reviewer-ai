import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/tokens";

/**
 * `/api/auth/*` (hors `register`) est exempté du rate limiting du middleware
 * — et `src/middleware.ts` est hors périmètre. Un plafond local est donc
 * appliqué ICI (même modèle que `/api/auth/forgot-password`) : chaque appel
 * consomme un jeton `verify`, il faut empêcher le brute-force et
 * l'épuisement des jetons par un client unique.
 */
const RATE_LIMIT = { limit: 10, windowSec: 60 } as const;

/** Première IP de `x-forwarded-for`, sinon `x-real-ip`, sinon `localhost`. */
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return "localhost";
}

const verifyRequestSchema = z.object({
  token: z.string().min(1, "Jeton manquant"),
  email: z.string().trim().email("Email invalide"),
});

/**
 * POST /api/auth/verify-request — { token, email }
 *
 * Consomme (usage unique) le jeton `verify` lié à l'email, puis pose
 * `User.emailVerified`. Réponses : `{ ok: true }` ; 400
 * `{ error: "Lien invalide ou expiré" }` (aucun détail n'est retourné, pour ne
 * pas permettre de distinguer un jeton inconnu, expiré ou soumis par un autre
 * destinataire) ; 429 `Trop de requêtes` (rate limiting local).
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête invalide" },
        { status: 400 }
      );
    }

    const parsed = verifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { token, email } = parsed.data;

    // --- Rate limiting local (10 req/min/IP, même modèle que forgot-password) ---
    const limit = await rateLimit({
      key: `verify-request:ip:${getClientIp(request).slice(0, 64)}`,
      limit: RATE_LIMIT.limit,
      windowSec: RATE_LIMIT.windowSec,
    });
    if (!limit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((limit.resetAt - Date.now()) / 1000)
      );
      return NextResponse.json(
        { error: "Trop de requêtes", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const isValid = await verifyToken({
      identifier: email,
      type: "verify",
      token,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (user === null) {
      // Jeton valide mais compte supprimé entre-temps : on répond tout de même
      // `{ ok: true }` (le jeton a été consommé, aucun détail à exposer).
      logEvent("auth", {
        step: "verify_request",
        outcome: "user_missing_after_valid_token",
      });
      return NextResponse.json({ ok: true });
    }

    if (user.emailVerified === null) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      logEvent("auth", { step: "verify_request", outcome: "verified" });
    } else {
      logEvent("auth", { step: "verify_request", outcome: "already_verified" });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Une exception ici ne vient que de la base (verifyToken ne lève jamais) :
    // 500 générique + journalisation, sans détail interne.
    logEvent("auth", {
      step: "verify_request_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Erreur lors de la vérification de l'email" },
      { status: 500 }
    );
  }
}
