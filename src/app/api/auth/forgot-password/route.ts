import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, isEmailEnabled } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { buildAuthLink, createToken, resolveLocaleFromRequest } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";

/** Durée de vie du lien de réinitialisation : 60 minutes. */
const RESET_TTL_MINUTES = 60;

/**
 * `/api/auth/*` (hors `register`) est exempté du rate limiting du middleware
 * — et `src/middleware.ts` est hors périmètre de cette tâche. Un plafond local
 * est donc appliqué ICI pour empêcher le harcellement d'une boîte mail via des
 * envois répétés (seul endpoint de ce lot qui déclenche un email sortant).
 */
const RATE_LIMIT = { limit: 10, windowSec: 60 } as const;

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email invalide"),
});

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

/**
 * POST /api/auth/forgot-password — { email }
 *
 * Réponse TOUJOURS `{ ok: true }` (200), que l'adresse existe ou non :
 * c'est le mécanisme anti-énumération. Aucun jeton, aucun lien n'apparaît
 * jamais dans la réponse HTTP.
 */
export async function POST(request: Request) {
  // --- Validation Zod : 400 structuré si corps invalide (aucun envoi) ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 }
    );
  }

  const parsed = forgotPasswordSchema.safeParse(body);
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

  // --- Rate limiting local (10 req/min/IP) ---
  const limit = await rateLimit({
    key: `forgot-password:ip:${getClientIp(request).slice(0, 64)}`,
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

  const { email } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });

    if (user === null) {
      // Jamais de signal d'existence : même réponse que pour un compte réel.
      logEvent("auth", {
        step: "forgot_password",
        outcome: "unknown_email_ignored",
      });
      return NextResponse.json({ ok: true });
    }

    const created = await createToken({
      identifier: email,
      type: "reset",
      ttlMinutes: RESET_TTL_MINUTES,
    });

    if (!created.ok) {
      // Réponse inchangée : l'échec interne ne doit pas être distinguable.
      logEvent("auth", {
        step: "forgot_password_token_failed",
        reason: created.error,
      });
      return NextResponse.json({ ok: true });
    }

    const locale = resolveLocaleFromRequest(request);

    // Fail-closed (M3) : aucun repli sur l'en-tête `Origin` (injectable par un
    // tiers : un `Origin: https://evil.com` ferait pointer le lien de reset —
    // et donc le jeton — vers le serveur de l'attaquant). Si
    // `NEXT_PUBLIC_APP_URL` est absente, `buildAuthLink` journalise l'échec et
    // renvoie `{ ok: false }` : aucun lien n'est envoyé, et la réponse HTTP
    // reste `{ ok: true }` (anti-énumération inchangée).
    const built = buildAuthLink({
      pagePath: "/reset-password",
      locale,
      token: created.token,
      email,
    });

    if (!built.ok) {
      logEvent("auth", {
        step: "forgot_password_link_failed",
        reason: built.error,
      });
      return NextResponse.json({ ok: true });
    }

    const link = built.link;

    if (isEmailEnabled) {
      // Envoi réel, BEST-EFFORT : `sendEmail` ne lève jamais, et toute
      // exception inattendue est absorbée ici — la réponse HTTP reste
      // strictement `{ ok: true }` (anti-énumération), le client ne doit
      // jamais savoir si l'email a échoué.
      try {
        const result = await sendEmail({
          to: email,
          subject: "Réinitialisation de votre mot de passe — PaperNote",
          text: [
            "Bonjour,",
            "",
            "Une réinitialisation de mot de passe a été demandée pour votre compte PaperNote.",
            "Ouvrez ce lien pour choisir un nouveau mot de passe (valable 60 minutes) :",
            link,
            "",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
          ].join("\n"),
        });

        if (!result.ok) {
          logEvent("auth", {
            step: "forgot_password_email_failed",
            error: result.error ?? "unknown_error",
          });
        }
      } catch (error) {
        logEvent("auth", {
          step: "forgot_password_email_failed",
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }

      if (env.NODE_ENV !== "production") {
        // Dev/test : lien journalisé pour rendre le flux testable de bout en
        // bout, jamais dans la réponse HTTP. En production, aucun lien n'est
        // écrit dans les logs (un log exposé équivaudrait à une prise de
        // contrôle de compte). Clé `resetUrl` choisie volontairement : le
        // pattern de caviardage du logger couvre `token|secret|password|key`,
        // donc « tokenUrl » serait remplacé par "[redacted]".
        logEvent("auth", {
          step: "forgot_password_link_dev",
          reason: "email_sent",
          email,
          resetUrl: link,
        });
      }
    } else if (env.NODE_ENV !== "production") {
      // Décision produit — sans RESEND_API_KEY : pas d'envoi réseau, le lien
      // est journalisé pour permettre de tester la réinitialisation en dev.
      // GARDE PRODUCTION identique au branchement `isEmailEnabled` ci-dessus :
      // en prod, aucun lien de reset ne doit jamais figurer dans les logs
      // (un log exposé équivaudrait à une prise de contrôle de compte).
      // Clé `resetUrl` choisie volontairement : le pattern de caviardage du
      // logger couvre `token|secret|password|key`, donc « tokenUrl » serait
      // remplacé par "[redacted]". Le lien n'est JAMAIS dans la réponse HTTP.
      logEvent("auth", {
        step: "forgot_password_link_dev",
        reason: "email_disabled",
        email,
        resetUrl: link,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Erreur interne : réponse identique (aucune fuite sur l'existence du
    // compte), le diagnostic passe par les logs structurés.
    logEvent("auth", {
      step: "forgot_password_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ ok: true });
  }
}
