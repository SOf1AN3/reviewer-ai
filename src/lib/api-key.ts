/**
 * src/lib/api-key.ts — Génération, hash et authentification des clés API.
 *
 * ## Architecture (décision documentée)
 *
 * | Étape        | Détail                                                        |
 * |--------------|---------------------------------------------------------------|
 * | Génération   | `crypto.randomBytes(32).toString("hex")` : 256 bits d'entropie |
 * | Format       | `pn_live_<64 hex>` (72 caractères)                            |
 * | Stockage     | SHA-256 hex du brut dans `ApiKey.keyHash` (`@unique`)         |
 * | Recherche    | SHA-256 hex du brut saisi → `findUnique({ keyHash })`         |
 * | Affichage    | `keyPrefix` = partie visible (`pn_live_ab12…`)                |
 * | Révocation   | `revokedAt` non null → refus immédiat (aucune suppression)    |
 *
 * **Pourquoi SHA-256 (et non bcrypt/argon2) ?** Contrairement aux mots de
 * passe, une clé API est un jeton de 256 bits tiré au sort : elle est déjà
 * immunisée contre les attaques par dictionnaire et les tables rainbow. Le
 * hash n'a donc pas besoin d'être lent ; il sert uniquement à éviter de
 * persister la clé en clair (une fuite de table ne révèle aucune clé réelle).
 *
 * **Pourquoi une recherche par `keyHash` plutôt qu'une comparaison constante
 * de chaînes ?** `keyHash` est `@unique` : la comparaison est déléguée à
 * l'index B-tree de PostgreSQL (lookup en O(1)). SHA-256 étant déterministe
 * et la clé ayant 256 bits d'entropie, il n'existe aucun scénario d'attaque
 * par « timing » exploitable ici — la fuite d'information temporelle d'une
 * comparaison de hash n'apporte rien à l'adversaire (il faudrait déjà
 * reconstituer une clé valide). On documente donc le choix : pas de
 * `timingSafeEqual`, le lookup indexé suffit et reste le standard des clés
 * API (Stripe, GitHub…).
 *
 * ROBUSTESSE : `authenticateApiKey` NE LÈVE JAMAIS. Toute erreur interne
 * (base injoignable, en-tête malformé…) est absorbée et retourne `null` →
 * la route appelante répond 401. La mise à jour de `lastUsedAt` est
 * best-effort (try/catch isolé) : un échec d'écriture ne doit jamais faire
 * échouer une authentification par ailleurs valide.
 *
 * SERVER-ONLY : accède à la base (`db`). Ne jamais importer depuis un
 * composant client.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";

/** Préfixe public des clés API PaperNote (format `pn_live_…`). */
const KEY_PREFIX = "pn_live_";

/** Octets aléatoires : 32 octets → 64 caractères hex → 256 bits d'entropie. */
const KEY_RANDOM_BYTES = 32;

/** Longueur de la partie visible conservée pour l'affichage (`keyPrefix`). */
const PREFIX_VISIBLE_LENGTH = 12;

/** Résultat de la génération d'une clé. */
export interface GeneratedApiKey {
  /** Clé BRUTE — retournée UNIQUEMENT à la création, jamais persistée. */
  raw: string;
  /** SHA-256 hex du brut — seule valeur stockée en base. */
  hash: string;
  /** Partie visible (ex. `pn_live_ab12…`) pour l'affichage en base. */
  prefix: string;
}

/** Identité extraite d'une clé API authentifiée. */
export interface ApiKeyIdentity {
  /** Utilisateur propriétaire de la clé (pour le quota de plan). */
  userId: string;
  /** Identifiant de la clé (pour le quota par clé et la trace d'usage). */
  apiKeyId: string;
  /** Limite mensuelle optionnelle de la CLÉ (`null` = illimitée). */
  monthlyLimit: number | null;
}

/** SHA-256 hex : fonction de hash utilisée pour la génération ET la recherche. */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Génère une clé API valide : brut + hash + préfixe visible. */
export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(KEY_RANDOM_BYTES).toString("hex");
  const raw = `${KEY_PREFIX}${random}`;
  return {
    raw,
    hash: sha256Hex(raw),
    prefix: raw.slice(0, PREFIX_VISIBLE_LENGTH),
  };
}

/** Hash SHA-256 hex d'une clé brute (utilisé aussi à l'authentification). */
export function hashApiKey(raw: string): string {
  return sha256Hex(raw);
}

/**
 * Extrait la clé brute d'un en-tête `Authorization: Bearer <clé>`.
 * Retourne `null` si l'en-tête est absent ou malformé.
 */
function extractBearerToken(header: string): string | null {
  const match = /^Bearer\s+(\S+)$/iu.exec(header.trim());
  const token = match?.[1] ?? "";
  return token.length > 0 ? token : null;
}

/**
 * Authentifie une requête par clé API.
 *
 * Lit `Authorization: Bearer <clé>`, hache la clé, fait un lookup par
 * `keyHash`, refuse si la clé est révoquée, puis met à jour `lastUsedAt`
 * en best-effort.
 *
 * @returns L'identité de la clé si elle est valide, sinon `null`.
 *   NE LÈVE JAMAIS (toute erreur interne → `null`).
 */
export async function authenticateApiKey(
  req: Request
): Promise<ApiKeyIdentity | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;

  const raw = extractBearerToken(header);
  if (!raw) return null;

  let record: {
    id: string;
    userId: string;
    monthlyLimit: number | null;
    revokedAt: Date | null;
  } | null = null;

  try {
    record = await db.apiKey.findUnique({
      where: { keyHash: sha256Hex(raw) },
      select: { id: true, userId: true, monthlyLimit: true, revokedAt: true },
    });
  } catch (error) {
    logEvent(
      "api_key",
      {
        step: "auth_lookup_failed",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      "error"
    );
    return null;
  }

  // Clé inconnue ou révoquée → refus (même réponse, aucun signal d'existence).
  if (!record || record.revokedAt !== null) return null;

  // Best-effort : traçabilité de la dernière utilisation. Un échec d'écriture
  // ne doit JAMAIS faire échouer cette authentification (try/catch isolé).
  try {
    await db.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });
  } catch (error) {
    logEvent(
      "api_key",
      {
        step: "update_last_used_failed",
        apiKeyId: record.id,
        error: error instanceof Error ? error.message : "unknown_error",
      },
      "warn"
    );
  }

  return {
    userId: record.userId,
    apiKeyId: record.id,
    monthlyLimit: record.monthlyLimit,
  };
}
