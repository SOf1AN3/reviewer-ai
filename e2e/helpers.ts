import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/**
 * Helpers partagés des specs E2E PaperNote.
 *
 * Tous les sélecteurs de ce fichier ont été vérifiés contre l'application
 * réelle (serveur `next dev` déjà lancé sur http://localhost:3001) avant
 * d'être écrits — cf. rapport T4.2.
 */

/** Mot de passe commun aux comptes de test (≥ 8 caractères, exigence Zod). */
export const TEST_PASSWORD = "MotDePasse123!";

/** Préfixe des emails de test : seuls les comptes `e2e-…` sont nettoyés. */
const E2E_EMAIL_PREFIX = "e2e-";
/** Domaine réservé aux tests : aucun compte réel n'utilise `@example.com`. */
const E2E_EMAIL_DOMAIN = "@example.com";
/**
 * Forme exacte produite par `uniqueEmail` : `e2e-<préfixe>-<timestamp>@example.com`.
 * Sert de SECONDE vérification, côté JS, avant toute suppression en base —
 * au-delà du filtre SQL `startsWith`/`endsWith`.
 */
const E2E_EMAIL_PATTERN = /^e2e-[a-z0-9-]+-\d+@example\.com$/;

/** Adresse email unique par exécution (évite toute collision en base).
 *  Nettoyée en fin de suite par {@link cleanupE2eTestData}. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Détecte si `GEMINI_API_KEY` est configurée POUR LE SERVEUR.
 *
 * Le runner Playwright est un processus Node distinct de `next dev` : il ne
 * lit pas `.env.local` automatiquement. On vérifie donc `process.env` puis
 * les fichiers d'environnement — uniquement la PRÉSENCE d'une clé
 * exploitable, jamais sa valeur (qui n'est ni copiée ni journalisée).
 */
export function hasGeminiApiKey(): boolean {
  if (isUsableKey(process.env.GEMINI_API_KEY)) {
    return true;
  }
  for (const file of [".env.local", ".env"]) {
    try {
      const match = /^GEMINI_API_KEY\s*=\s*(.+)$/m.exec(readFileSync(file, "utf8"));
      if (match && isUsableKey(match[1])) {
        return true;
      }
    } catch {
      // Fichier absent : on passe au suivant.
    }
  }
  return false;
}

function isUsableKey(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().replace(/^["']|["']$/g, "");
  if (normalized.length === 0) {
    return false;
  }
  return !/(placeholder|your[-_]?key|exemple|example|\.\.\.)/i.test(normalized);
}

/**
 * Attend la fin de l'hydratation React : le `SessionProvider` déclenche
 * `GET /api/auth/session` depuis un effet, donc APRÈS l'hydratation. La
 * promesse doit être créée AVANT la navigation concernée (sinon la réponse
 * peut être manquée).
 */
export function trackHydration(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) => response.url().includes("/api/auth/session"),
    { timeout: 30_000 }
  );
}

/**
 * Navigation vers `path` en attendant l'hydratation. Garantit que les
 * gestionnaires React (onSubmit, onChange, onClick) sont attachés avant
 * toute saisie ou tout clic — sans quoi les actions sont avalées.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  // On laisse une éventuelle navigation en cours se terminer : ses effets
  // (fetch session) sont alors déjà consommés, et le tracking ci-dessous ne
  // pourra capturer que la session du NOUVEAU document.
  await page.waitForLoadState("load").catch(() => undefined);
  const hydrated = trackHydration(page);
  // Évite un rejet non traité si la navigation échoue avant l'attente.
  void hydrated.catch(() => undefined);
  await page.goto(path);
  await hydrated;
}

/**
 * Ferme le bandeau d'information cookies s'il est présent (chaque contexte
 * de test démarre avec un `localStorage` vide → le bandeau s'affiche).
 * Empêche le bandeau (positionné en bas d'écran) d'intercepter les clics.
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const banner = page.getByRole("status").filter({ hasText: "cookies techniques" });
  if ((await banner.count()) === 0) {
    return;
  }
  await banner.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(banner).toBeHidden();
}

/** Navigation hydratée + refermeture du bandeau cookies. */
export async function openPage(page: Page, path: string): Promise<void> {
  await gotoHydrated(page, path);
  await dismissCookieBanner(page);
}

/**
 * Clic sur « Créer mon compte » en tolérant le rate limit du middleware.
 *
 * `POST /api/auth/register` est limité à 3 requêtes/60 s/IP (RULE_REGISTER,
 * src/middleware.ts). Si une exécution précédente a consommé le quota, le
 * serveur répond 429 avec l'en-tête `Retry-After` : on attend la
 * réinitialisation puis on relance le clic (le formulaire reste rempli).
 */
export async function submitRegister(page: Page): Promise<void> {
  const submit = page.getByRole("button", { name: "Créer mon compte", exact: true });
  // Pas d'annotation de type explicite : `Response` serait résolu comme le
  // `Response` DOM (lib: dom dans tsconfig) et non le type Playwright.
  const registerCall = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/register") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );

  for (let attempt = 0; attempt < 3; attempt++) {
    const [response] = await Promise.all([registerCall(), submit.click()]);
    if (response.status() !== 429) {
      return;
    }
    const retryAfterSec = Number(response.headers()["retry-after"] ?? "60");
    const waitSec = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 60;
    // Le bandeau cookies a pu être refermé pendant l'attente : inutile ici,
    // il ne bloque pas le bouton de soumission.
    await page.waitForTimeout((waitSec + 1) * 1000);
  }
  // 3 × 429 consécutifs : on laisse le test échouer sur l'assertion suivante
  // plutôt que de masquer une indisponibilité réelle du endpoint.
}

/**
 * Inscription via l'UI (`/fr/register`) puis vérification que la session est
 * active (bouton « Déconnexion » du Header).
 *
 * Le bypass de vérification email (pas de `RESEND_API_KEY` en dev) rend la
 * connexion immédiate : la page d'inscription déclenche elle-même
 * `signIn('credentials')` après la création du compte.
 */
export async function registerUser(page: Page, email: string): Promise<void> {
  await openPage(page, "/fr/register");
  // Le Header affiche `session.user.name || session.user.email` : on renseigne
  // le nom avec l'email pour pouvoir le retrouver à l'écran.
  await page.locator("#name").fill(email);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await submitRegister(page);
  // Après succès : `router.push('/${locale}')` → accueil.
  await page.waitForURL("**/fr", { timeout: 30_000 });
  await expect(
    page.locator("header").getByRole("button", { name: "Déconnexion", exact: true })
  ).toBeVisible();
}

/**
 * Nettoyage en fin de suite (global teardown Playwright).
 *
 * Supprime les comptes de test créés par la suite (`e2e-*@example.com`) et,
 * par cascade Prisma, l'ensemble de leurs données : Account, Session,
 * Article, Subscription, Invoice, UsageEvent, ApiKey sont en
 * `onDelete: Cascade` sur User, et Analyse l'est sur Article
 * (cf. prisma/schema.prisma).
 *
 * Sécurité (la suppression est irréversible — deux vérifications) :
 * 1. le filtre SQL ne retient QUE les emails commençant par `e2e-` ET
 *    finissant par `@example.com` — jamais de `deleteMany` sans `where` ;
 * 2. chaque email retenu est RE-VÉRIFIÉ par regex côté JS
 *    ({@link E2E_EMAIL_PATTERN}, calquée sur `uniqueEmail`) ; la suppression
 *    se fait ensuite par `id` uniquement. Un compte réel ne peut donc pas
 *    être touché, même s'il portait un nom proche.
 *
 * Cette fonction ne lève JAMAIS : un échec de nettoyage est un
 * avertissement, pas un échec de suite. Un compte résiduel est inoffensif —
 * les emails étant horodatés, la prochaine exécution crée des comptes neufs.
 */
export async function cleanupE2eTestData(): Promise<void> {
  try {
    // Le runner Playwright est un processus Node distinct de `next dev` : il
    // ne charge pas `.env.local` automatiquement, alors que Prisma y lit
    // `DATABASE_URL`. `process.loadEnvFile` n'écrase jamais une variable
    // déjà présente dans l'environnement.
    for (const file of [".env.local", ".env"]) {
      try {
        process.loadEnvFile(file);
      } catch {
        // Fichier absent : on passe au suivant.
      }
    }

    // Import dynamique : `src/lib/db.ts` instancie `PrismaClient` au chargement
    // du module, donc strictement APRÈS le chargement de l'environnement
    // ci-dessus (un import statique serait évalué avant).
    const { db } = await import("../src/lib/db");

    // 1er filtre — strictement ciblé sur le périmètre de test.
    const candidates = await db.user.findMany({
      where: {
        email: { startsWith: E2E_EMAIL_PREFIX, endsWith: E2E_EMAIL_DOMAIN },
      },
      select: { id: true, email: true },
    });
    // 2e vérification — regex côté JS avant toute suppression.
    const idsToDelete = candidates
      .filter((user) => user.email !== null && E2E_EMAIL_PATTERN.test(user.email))
      .map((user) => user.id);

    let deletedAccounts = 0;
    if (idsToDelete.length > 0) {
      // Cascade Prisma : articles, analyses, sessions, etc. partent avec le
      // compte — aucune suppression manuelle nécessaire.
      const result = await db.user.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      deletedAccounts = result.count;
    }

    // `VerificationToken` n'a pas de clé étrangère vers User (il est identifié
    // par l'email) : il ne cascade pas, on le nettoie explicitement — mêmes
    // garde-fous (filtre ciblé + regex) que pour les comptes.
    const verificationTokens = await db.verificationToken.findMany({
      where: {
        identifier: { startsWith: E2E_EMAIL_PREFIX, endsWith: E2E_EMAIL_DOMAIN },
      },
      select: { token: true, identifier: true },
    });
    const tokensToDelete = verificationTokens
      .filter((entry) => E2E_EMAIL_PATTERN.test(entry.identifier))
      .map((entry) => entry.token);
    if (tokensToDelete.length > 0) {
      await db.verificationToken.deleteMany({
        where: { token: { in: tokensToDelete } },
      });
    }

    await db.$disconnect();
    console.info(
      `[e2e teardown] Nettoyage terminé : ${deletedAccounts} compte(s) de test supprimé(s) (données en cascade).`
    );
  } catch (error) {
    // Un échec de nettoyage ne doit JAMAIS faire échouer la suite.
    console.warn(
      "[e2e teardown] Nettoyage des comptes de test impossible (la suite reste valide) :",
      error instanceof Error ? error.message : error
    );
  }
}
