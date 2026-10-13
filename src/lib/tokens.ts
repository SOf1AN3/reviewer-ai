/**
 * src/lib/tokens.ts — Jetons de vérification email et de réinitialisation mdp.
 *
 * ## Architecture des jetons (décision documentée)
 *
 * | Étape        | Détail                                                        |
 * |--------------|---------------------------------------------------------------|
 * | Génération   | `crypto.randomBytes(32).toString("hex")` : 256 bits d'entropie |
 * | Stockage     | SHA-256 hex du jeton brut dans `VerificationToken.token`       |
 * | Recherche    | SHA-256 hex du jeton saisi puis `findUnique({ token })`        |
 * | Durée de vie | `expires` — 24 h pour `verify`, 60 min pour `reset`            |
 * | Révocation   | suppression de la ligne : usage unique (jeton « à usage unique ») |
 * | Isolation    | couple (`identifier`, `type`) : un jeton `verify` n'est jamais accepté comme `reset` et inversement |
 *
 * **Pourquoi hasher (SHA-256) plutôt que stocker le brut ?** Si la table est
 * exfiltrée (dump SQL, sauvegarde), les valeurs stockées ne sont pas
 * réutilisables pour fabriquer un lien valide. Le coût est un re-hash de
 * l'entrée utilisateur à la vérification — négligeable, et rendu possible par
 * le fait que `token` est `@unique` (recherche en O(1), pas de scan).
 *
 * **Anti-accumulation** : `createToken` supprime les jetons précédents du même
 * couple (`identifier`, `type`) avant d'insérer le nouveau → un seul lien
 * valide à la fois ; demander un nouveau lien invalide systématiquement
 * l'ancien (utile aussi contre le « flooding » de liens).
 *
 * **Robustesse** : aucune de ces fonctions ne lève une exception côté
 * appelant — tout résultat est typé, toute erreur interne est journalisée via
 * `logEvent` (le logger caviarde de toute façon les clés `token`, `secret`,
 * `password`, `key`…).
 *
 * SERVER-ONLY : accède à la base (db) et à `env` (constrution des liens
 * absolus). Ne jamais importer depuis un composant client.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n";
import { logEvent } from "@/lib/logger";

/** Type de jeton — sépare les usages pour interdire tout croisement. */
export type TokenType = "verify" | "reset";

/** Nombre d'octets aléatoires générés (32 octets = 256 bits = 64 hex). */
const TOKEN_BYTES = 32;

/** SHA-256 hex : fonction de hash utilisée pour le stockage ET la recherche. */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type CreateTokenParams = {
  /** Identifiant du jeton : l'adresse email cible (telle que stockée en base). */
  identifier: string;
  /** Usage du jeton : `"verify"` (vérification) ou `"reset"` (mot de passe). */
  type: TokenType;
  /** Durée de vie en minutes (ex. 1440 = 24 h, 60 = 1 h). */
  ttlMinutes: number;
};

/** Résultat typé de `createToken` — jamais d'exception non attrapée. */
export type CreateTokenResult =
  | { ok: true; token: string } // jeton BRUT, à transmettre dans le lien email
  | { ok: false; error: string }; // message sûr à journaliser, jamais de jeton

export type VerifyTokenParams = {
  /** Même valeur `identifier` que celle utilisée à la création (l'email). */
  identifier: string;
  type: TokenType;
  /** Jeton BRUT fourni par l'utilisateur via le lien. */
  token: string;
};

/**
 * Crée un jeton (jeton brut renvoyé à l'appelant, hash stocké en base).
 *
 * Supprime au préalable les jetons existants du même (`identifier`, `type`).
 * Ne lève jamais : en cas d'erreur, `{ ok: false, error }`.
 */
export async function createToken(
  params: CreateTokenParams
): Promise<CreateTokenResult> {
  const { identifier, type, ttlMinutes } = params;

  if (
    identifier.trim().length === 0 ||
    !Number.isFinite(ttlMinutes) ||
    ttlMinutes <= 0
  ) {
    return { ok: false, error: "Paramètres de jeton invalides" };
  }

  try {
    const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
    const storedToken = sha256Hex(rawToken);
    const expires = new Date(Date.now() + Math.round(ttlMinutes * 60_000));

    // Un seul jeton actif par couple (identifier, type) : pas d'accumulation.
    await db.verificationToken.deleteMany({ where: { identifier, type } });
    await db.verificationToken.create({
      data: { identifier, token: storedToken, expires, type },
    });

    return { ok: true, token: rawToken };
  } catch (error) {
    logEvent("auth", {
      step: "create_token_failed",
      type,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { ok: false, error: "Génération du jeton impossible" };
  }
}

/**
 * Vérifie un jeton : correspondance (`identifier`, `type`), non-expiré, puis
 * **révocation immédiate** (suppression) pour garantir l'usage unique.
 *
 * @returns `true` uniquement si le jeton était valide et vient d'être consommé ;
 *   `false` sinon (inconnu, périmètre invalide, expiré, déjà utilisé, erreur).
 *   Ne lève jamais.
 */
export async function verifyToken(params: VerifyTokenParams): Promise<boolean> {
  const { identifier, type, token } = params;

  if (identifier.trim().length === 0 || token.length === 0) {
    return false;
  }

  try {
    const storedToken = sha256Hex(token);
    const record = await db.verificationToken.findUnique({
      where: { token: storedToken },
    });

    if (!record) {
      logEvent("auth", { step: "verify_token", type, outcome: "unknown_token" });
      return false;
    }

    // Mauvais destinataire ou mauvais usage (ex. jeton `reset` réutilisé en
    // `verify`) : refus SANS suppression (le lien légitime reste utilisable).
    if (record.identifier !== identifier || record.type !== type) {
      logEvent("auth", { step: "verify_token", type, outcome: "scope_mismatch" });
      return false;
    }

    if (record.expires.getTime() <= Date.now()) {
      // Nettoyage du jeton périmé (meilleure pratique : pas d'accumulation).
      await db.verificationToken.deleteMany({ where: { token: storedToken } });
      logEvent("auth", { step: "verify_token", type, outcome: "expired" });
      return false;
    }

    // Révocation à l'usage : suppression atomique. `count === 0` signifie qu'une
    // requête concurrente a consommé le jeton entre-temps → refus (usage unique).
    const deleted = await db.verificationToken.deleteMany({
      where: { token: storedToken },
    });
    if (deleted.count === 0) {
      logEvent("auth", {
        step: "verify_token",
        type,
        outcome: "already_used",
      });
      return false;
    }

    return true;
  } catch (error) {
    logEvent("auth", {
      step: "verify_token_failed",
      type,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return false;
  }
}

// --- Liens (routes horodatées transportant le jeton) -------------------------

export type AuthLinkParams = {
  /** Page de destination après le locale, ex. `"/verify"` ou `"/reset-password"`. */
  pagePath: "/verify" | "/reset-password";
  locale: Locale;
  /** Jeton BRUT (jamais hashé) : c'est lui qui part dans l'email. */
  token: string;
  email: string;
};

/** Résultat typé de `buildAuthLink` — jamais d'exception non attrapée. */
export type AuthLinkResult =
  | { ok: true; link: string } // lien absolu prêt à partir dans l'email
  | { ok: false; error: string }; // message sûr à journaliser, jamais de lien

/**
 * Construit le lien absolu `${base}/${locale}${pagePath}?token=…&email=…`.
 *
 * Base : UNIQUEMENT `NEXT_PUBLIC_APP_URL` (validée par `env.ts`), suivie et
 * nettoyée des « / » de fin.
 *
 * ⚠️ FAIL-CLOSED : aucun repli sur l'en-tête `Origin` de la requête. Cet
 * en-tête est contrôlé par le client : un `Origin: https://evil.com` ferait
 * pointer le lien de réinitialisation (transportant le jeton) vers le
 * serveur de l'attaquant — vol de jeton. Si `NEXT_PUBLIC_APP_URL` est vide
 * (uniquement possible en mode dégradé de dev), l'échec est JOURNALISÉ et
 * `{ ok: false }` est retourné : aucun lien n'est ni renvoyé ni envoyé.
 *
 * Le query string est encodé via `URLSearchParams` (email et jeton sûrs).
 */
export function buildAuthLink(params: AuthLinkParams): AuthLinkResult {
  const base = env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/u, "");

  if (base.length === 0) {
    // Aucune valeur sensible ni lien journalisés : seulement le motif
    // d'échec (le caviardage du logger couvrirait de toute façon toute clé
    // `token|secret|password|key`).
    logEvent("auth", {
      step: "build_auth_link_failed",
      reason: "app_url_missing",
      pagePath: params.pagePath,
    });
    return {
      ok: false,
      error: "NEXT_PUBLIC_APP_URL absente : lien d'authentification non construit",
    };
  }

  const query = new URLSearchParams({
    token: params.token,
    email: params.email,
  });
  return {
    ok: true,
    link: `${base}/${params.locale}${params.pagePath}?${query.toString()}`,
  };
}

/**
 * Résout le locale des emails transactionnels :
 * cookie `NEXT_LOCALE` (posé par l'UI i18n) → `Accept-Language` → défaut (`fr`).
 * Copie volontairement alignée sur la logique de `src/middleware.ts`
 * (le middleware ne s'applique pas aux routes API).
 */
export function resolveLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = /(?:^|;\s*)NEXT_LOCALE=([A-Za-z-]+)/u.exec(cookieHeader);
    const cookieLocale = match?.[1] ?? "";
    if (isValidLocale(cookieLocale)) {
      return cookieLocale;
    }
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const primary = (
      acceptLanguage.split(",")[0]?.split("-")[0]?.trim() ?? ""
    ).toLowerCase();
    if (isValidLocale(primary)) {
      return primary;
    }
  }

  return defaultLocale;
}
