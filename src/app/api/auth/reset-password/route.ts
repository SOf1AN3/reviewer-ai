import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/tokens";

/**
 * `/api/auth/*` (hors `register`) est exempté du rate limiting du middleware
 * — et `src/middleware.ts` est hors périmètre. Un plafond local est donc
 * appliqué ICI (même modèle que `/api/auth/forgot-password`) : chaque appel
 * coûte un hash bcrypt (coût 12) et consomme un jeton, il faut empêcher le
 * brute-force et l'épuisement des jetons par un client unique.
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

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Jeton manquant"),
  email: z.string().trim().email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

/**
 * POST /api/auth/reset-password — { token, email, password }
 *
 * Vérifie (et consomme, usage unique) le jeton `reset` puis remplace le mot de
 * passe hashé (bcrypt, coût 12), pose `User.emailVerified` (le lien prouve la
 * maîtrise de la boîte mail) et purge les lignes `Session` de l'utilisateur.
 *
 * ⚠️ LIMITATION DOCUMENTÉE — sessions JWT : NextAuth est configuré en
 * `session: { strategy: "jwt" }`, les sessions ne vivent donc PAS en base
 * (les lignes `Session` sont ici un filet de sécurité, quasi toujours vides).
 * Un JWT déjà émis reste valide jusqu'à son expiration (maxAge par défaut :
 * 30 jours) : la révocation immédiate des sessions existantes n'est pas
 * possible sans champ supplémentaire en base (ex. `passwordChangedAt` vérifié
 * dans le callback `jwt`) — `prisma/schema.prisma` étant hors périmètre, ce
 * suivi est signalé au Lead. Le seul levier global disponible aujourd'hui est
 * la rotation de `AUTH_SECRET` (invalide TOUTES les sessions, y compris
 * celles des autres utilisateurs — à réserver à une compromission).
 *
 * Réponses : `{ ok: true }` ; 400 générique `Lien invalide ou expiré` ou
 * `Données invalides` ; 429 `Trop de requêtes` (rate limiting local) ;
 * 500 en cas d'erreur serveur.
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

    const parsed = resetPasswordSchema.safeParse(body);
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

    const { token, email, password } = parsed.data;

    // --- Rate limiting local (10 req/min/IP, même modèle que forgot-password) ---
    const limit = await rateLimit({
      key: `reset-password:ip:${getClientIp(request).slice(0, 64)}`,
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
      type: "reset",
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
      select: { id: true },
    });

    if (user === null) {
      // Jeton consommé mais compte supprimé entre-temps : réponse générique.
      logEvent("auth", {
        step: "reset_password",
        outcome: "user_missing_after_valid_token",
      });
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Mot de passe remplacé + sessions DB purgées dans une transaction.
    // `emailVerified` est également posé : la maîtrise de la boîte mail est
    // prouvée par la possession du lien de reset. Sans ce champ, un compte
    // créé AVANT l'activation de la vérification email (`emailVerified`
    // initialisé à null en prod, où `RESEND_API_KEY` est exigée) serait
    // bloqué DÉFINITIVEMENT : le callback `signIn` refuse la connexion tant
    // que `emailVerified` est null, et le reset était le seul chemin de
    // secours — il doit donc débloquer le compte.
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, emailVerified: new Date() },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);

    logEvent("auth", { step: "reset_password", outcome: "password_updated" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logEvent("auth", {
      step: "reset_password_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation du mot de passe" },
      { status: 500 }
    );
  }
}
