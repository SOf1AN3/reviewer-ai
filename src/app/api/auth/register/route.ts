import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, isEmailEnabled } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import type { Locale } from "@/lib/i18n";
import { buildAuthLink, createToken, resolveLocaleFromRequest } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";

/** Durée de vie du lien de vérification email : 24 heures. */
const VERIFY_TTL_MINUTES = 24 * 60;

/**
 * Réponse UNIQUE renvoyée quel que soit le résultat réel (création effectuée,
 * compte déjà existant, …) : elle ne permet donc jamais de savoir si une
 * adresse est déjà inscrite (anti-énumération). Aucun identifiant interne
 * (userId…) n'y figure.
 *
 * Le texte est décidé UNIQUEMENT par `isEmailEnabled` (globale, identique
 * pour toutes les requêtes) — jamais par le résultat de l'inscription : en
 * mode bypass (pas de `RESEND_API_KEY`), annoncer un « email de vérification »
 * serait faux, alors que la réponse reste strictement `{ ok: true, message }`
 * dans les deux branches (création / compte existant).
 */
function genericMessage(): string {
  return isEmailEnabled
    ? "Si ce compte est disponible, un email de vérification vous a été envoyé avec les prochaines étapes."
    : "Si ce compte est disponible, il a été créé : vous pouvez dès maintenant vous connecter.";
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères"),
  // `.trim()` uniquement (et PAS de mise en minuscules) : identique à la
  // saisie de connexion, pour ne pas rendre inaccessibles des comptes
  // existants. Aucun compte ne pouvait être créé avec des espaces en bord
  // (l'email validé était rejeté), donc le trim ne casse aucun accès.
  email: z.string().trim().email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

type RegisterBody = z.infer<typeof registerSchema>;

/** Réponse 200 générique (jamais de détail sur l'existence du compte). */
function genericResponse(): NextResponse {
  return NextResponse.json(
    { ok: true, message: genericMessage() },
    { status: 200 }
  );
}

/**
 * Crée le jeton `verify` (24 h), construit le lien de confirmation et tente
 * l'envoi réel de l'email de vérification via `sendEmail` (@/lib/email).
 *
 * L'envoi est BEST-EFFORT : `sendEmail` ne lève jamais, et toute exception
 * inattendue est absorbée ici — le client ne doit JAMAIS savoir si l'email a
 * échoué (la réponse reste la réponse générique anti-énumération).
 */
async function issueVerificationLink(email: string, locale: Locale): Promise<void> {
  const created = await createToken({
    identifier: email,
    type: "verify",
    ttlMinutes: VERIFY_TTL_MINUTES,
  });

  if (!created.ok) {
    logEvent("auth", {
      step: "register_verify_token_failed",
      reason: created.error,
    });
    return;
  }

  // Fail-closed (M3) : aucun repli sur l'en-tête `Origin` (injectable par un
  // tiers). Si `NEXT_PUBLIC_APP_URL` est absente, `buildAuthLink` journalise
  // l'échec et renvoie `{ ok: false }` : aucun lien n'est envoyé, la réponse
  // HTTP du compte reste la réponse générique anti-énumération.
  const built = buildAuthLink({
    pagePath: "/verify",
    locale,
    token: created.token,
    email,
  });

  if (!built.ok) {
    logEvent("auth", {
      step: "register_verify_link_failed",
      reason: built.error,
    });
    return;
  }

  const link = built.link;

  // Envoi réel (no-op silencieux si RESEND_API_KEY absente : `sendEmail`
  // retourne `{ ok: true, skipped: true }` sans rien envoyer ni throw).
  try {
    const result = await sendEmail({
      to: email,
      subject: "Vérifiez votre adresse email — PaperNote",
      text: [
        "Bienvenue sur PaperNote !",
        "",
        "Confirmez votre adresse email en ouvrant ce lien (valable 24 heures) :",
        link,
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      ].join("\n"),
    });

    if (!result.ok) {
      // Best-effort : l'échec est journalisé, jamais remonté au client.
      logEvent("auth", {
        step: "register_verify_email_failed",
        error: result.error ?? "unknown_error",
      });
    }
  } catch (error) {
    logEvent("auth", {
      step: "register_verify_email_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  if (env.NODE_ENV !== "production") {
    // Dev : lien journalisé pour rendre le flux testable de bout en bout,
    // jamais dans la réponse HTTP. En production, pas de lien dans les logs.
    logEvent("auth", {
      step: "register_verify_link_dev",
      email,
      verifyUrl: link,
    });
  }
}

export async function POST(request: Request) {
  try {
    // --- Corps + validation Zod (400 structuré, jamais de 500 pour ça) ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête invalide" },
        { status: 400 }
      );
    }

    const parsed = registerSchema.safeParse(body);
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

    const { name, email, password }: RegisterBody = parsed.data;
    const locale = resolveLocaleFromRequest(request);

    // Hash bcrypt AVANT toute interrogation en base : bcrypt (coût 12) coûte
    // ~100-250 ms et n'était exécuté QUE si le compte n'existait pas → un
    // attaquant pouvait déduire l'existence d'une adresse en mesurant le temps
    // de réponse (canal temporel d'énumération). Les deux branches paient
    // désormais exactement le même coût.
    const hashedPassword = await bcrypt.hash(password, 12);

    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser) {
      // Aucun side-effect : ni création de jeton, ni email (sinon un tiers
      // pourrait harceler la boîte mail de la victime en devinant son adresse).
      // La réponse est STRICTEMENT identique à celle d'une création réussie.
      logEvent("auth", {
        step: "register",
        outcome: "existing_account_ignored",
      });
      return genericResponse();
    }

    if (isEmailEnabled) {
      // Vérification email ACTIVE : `emailVerified` reste null, le compte
      // n'est utilisable qu'après ouverture du lien reçu par email (le
      // callback `signIn` de `src/lib/auth.ts` refuse la connexion tant que
      // `emailVerified` est null).
      await db.user.create({
        data: { name, email, password: hashedPassword },
      });
      await issueVerificationLink(email, locale);
    } else {
      // Bypass (RESEND_API_KEY absente) : le compte est utilisable
      // immédiatement, sans attente de vérification. C'est `isEmailEnabled`
      // — et lui seul — qui décide, aucun booléen codé en dur.
      await db.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          emailVerified: new Date(),
        },
      });
      logEvent("auth", {
        step: "register",
        outcome: "email_verified_bypass",
        reason: "email_disabled",
      });
    }

    return genericResponse();
  } catch (error) {
    // Course sur l'unicité de l'email (deux inscriptions simultanées) :
    // même réponse générique, sans révéler l'existence du compte.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      logEvent("auth", {
        step: "register",
        outcome: "existing_account_ignored",
      });
      return genericResponse();
    }

    logEvent("auth", {
      step: "register_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
