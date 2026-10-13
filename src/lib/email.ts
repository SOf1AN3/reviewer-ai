/**
 * src/lib/email.ts — Infra email transactionnelle (Resend).
 *
 * Décision produit : tant que `RESEND_API_KEY` est absente, l'envoi est un
 * no-op SILENCIEUX — jamais d'exception, jamais de requête réseau. Un
 * événement structuré `{ email: "skipped", reason: "no_resend_key", ... }`
 * est journalisé. Dès que la clé est ajoutée à l'environnement, l'envoi réel
 * s'active SANS AUCUN changement de code.
 *
 * Choix d'implémentation : SDK officiel `resend` (installé en dépendance
 * explicite de `package.json`). Le rendu des gabarits React n'utilise PAS
 * react-email : les `React.ReactNode` sont rendus en HTML statique via
 * `react-dom/server` (déjà présent dans le projet) puis envoyés via le champ
 * `html` de l'API Resend. Conséquence : si un appelant transmet un composant
 * issu de `@react-email/components`, cette dépendance devra être ajoutée par
 * l'appelant — le SDK n'a alors pas besoin de son peer optionnel
 * `@react-email/render`.
 *
 * Contrat :
 * - sans clé    → `{ ok: true, skipped: true }`, log « email skipped », zéro throw ;
 * - avec clé    → envoi réel avec 2 tentatives maximum, erreur Resend
 *                 remontée dans `error` (jamais de throw : c'est l'appelant
 *                 qui décide).
 *
 * SERVER-ONLY : importe `env.ts` (lecture de secrets), interdit côté client.
 */

import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { env, isEmailEnabled } from "@/lib/env";
import { logEvent } from "@/lib/logger";

export { isEmailEnabled };

/** Expéditeur réservé au développement (domaine de test Resend). */
const DEV_SENDER = "onboarding@resend.dev";

/** Nom d'affichage de l'expéditeur par défaut. */
const SENDER_NAME = "PaperNote";

/** Nombre maximal de tentatives d'envoi (1 tentative + 1 retry). */
const MAX_ATTEMPTS = 2;

/** Délai entre deux tentatives. */
const RETRY_DELAY_MS = 250;

export type SendEmailOptions = {
  /** Destinataire (adresse email unique). */
  to: string;
  /** Objet de l'email. */
  subject: string;
  /** Gabarit React optionnel (rendu en HTML statique). */
  react?: ReactNode;
  /** Version texte brut optionnelle (repli d'affichage). */
  text?: string;
  /**
   * Expéditeur, au format « Nom <adresse@domaine.tld> » ou « adresse@domaine.tld ».
   * En production, un domaine vérifié Resend est obligatoire : cet objet est
   * alors la seule façon de fournir un expéditeur valide.
   */
  from?: string;
};

export type SendEmailResult = {
  /** `true` si l'email a été envoyé, ou silencieusement contourné (skip). */
  ok: boolean;
  /** `true` si aucun envoi n'a eu lieu (RESEND_API_KEY absente). */
  skipped: boolean;
  /** Identifiant Resend de l'email envoyé (uniquement si `ok && !skipped`). */
  id?: string;
  /** Message d'erreur (uniquement si `ok === false`). */
  error?: string;
};

/** Résultat du bypass silencieux (aucune exception, aucun réseau). */
function skippedResult(to: string, subject: string): SendEmailResult {
  logEvent("email", { email: "skipped", reason: "no_resend_key", to, subject });
  return { ok: true, skipped: true };
}

/**
 * Résout l'expéditeur final.
 * - dev : `from` si fourni, sinon le domaine de test `onboarding@resend.dev` ;
 * - prod : `from` obligatoire (domaine vérifié Resend), sinon `null`.
 */
function resolveSender(from: string | undefined): string | null {
  if (from && from.trim().length > 0) {
    return from.trim();
  }
  return env.NODE_ENV === "production" ? null : `${SENDER_NAME} <${DEV_SENDER}>`;
}

/** Formate une erreur Resend (ou une exception réseau) en message lisible. */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
}

/** Petite pause entre deux tentatives. */
function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Envoie un email transactionnel via Resend.
 *
 * Ne lève JAMAIS : en cas d'échec, `ok: false` et `error` contiennent le
 * détail (c'est à l'appelant de décider de la suite).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject } = opts;

  // --- Bypass silencieux tant que la clé est absente (décision produit) ---
  // `isEmailEnabled` est exactement `Boolean(env.RESEND_API_KEY)` (voir env.ts),
  // jamais un booléen codé en dur. Le second test sert uniquement au rétrécissement
  // de type de `apiKey` et n'est jamais atteint indépendamment du premier.
  if (!isEmailEnabled) {
    return skippedResult(to, subject);
  }

  const apiKey: string | undefined = env.RESEND_API_KEY;
  if (!apiKey) {
    return skippedResult(to, subject);
  }

  // --- Expéditeur ---
  const from = resolveSender(opts.from);
  if (from === null) {
    logEvent("email", {
      email: "failed",
      reason: "from_required_in_prod",
      to,
      subject,
    });
    return {
      ok: false,
      skipped: false,
      error:
        "Expéditeur requis en production : fournissez `from` avec une adresse d'un domaine vérifié Resend.",
    };
  }

  // --- Corps de l'email (React optionnel, rendu statique) ---
  let html: string | undefined;
  try {
    html = opts.react ? renderToStaticMarkup(opts.react) : undefined;
  } catch (error) {
    const message = `render_failed: ${formatError(error)}`;
    logEvent("email", { email: "failed", reason: "render_failed", to, subject });
    return { ok: false, skipped: false, error: message };
  }

  if (html === undefined && (opts.text === undefined || opts.text.length === 0)) {
    logEvent("email", { email: "failed", reason: "empty_body", to, subject });
    return {
      ok: false,
      skipped: false,
      error: "Email vide : fournissez `react` ou `text`.",
    };
  }

  const text: string | undefined =
    opts.text !== undefined && opts.text.length > 0 ? opts.text : undefined;

  // `CreateEmailOptions` exige au moins un corps (`html` ou `text`) :
  // l'un des deux est toujours renseigné grâce au garde-fou ci-dessus.
  const payload: CreateEmailOptions =
    html !== undefined
      ? text !== undefined
        ? { from, to, subject, html, text }
        : { from, to, subject, html }
      : { from, to, subject, text: text ?? "" };

  // --- Envoi réel, avec retry léger ---
  const resend = new Resend(apiKey);
  let lastError = "unknown_error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { data, error } = await resend.emails.send(payload);

      if (error !== null) {
        lastError = `${error.name}: ${error.message}`;
        logEvent("email", {
          email: "send_failed",
          to,
          subject,
          attempt,
          error: lastError,
        });
      } else {
        logEvent("email", {
          email: "sent",
          to,
          subject,
          id: data.id,
        });
        return { ok: true, skipped: false, id: data.id };
      }
    } catch (error) {
      // Erreur réseau / exception inattendue du SDK : jamais de throw.
      lastError = formatError(error);
      logEvent("email", {
        email: "send_failed",
        to,
        subject,
        attempt,
        error: lastError,
      });
    }

    if (attempt < MAX_ATTEMPTS) {
      await wait(RETRY_DELAY_MS);
    }
  }

  return { ok: false, skipped: false, error: lastError };
}
