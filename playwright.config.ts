import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright — tests E2E de PaperNote (T4.2).
 *
 * Points clés :
 * - `webServer` est ABSENT volontairement : le serveur `next dev` doit déjà
 *   tourner sur http://localhost:3001 (le port 3000 est occupé par une autre
 *   application). Playwright ne démarre donc jamais un second serveur.
 * - Chromium uniquement (projets mobile/tablette à ajouter ultérieurement).
 * - Reporter `list` : décompte lisible en local comme en CI.
 * - Aucun build de production : on teste le serveur de développement.
 * - Exécution SÉQUENTIELLE : `POST /api/auth/register` est limité à
 *   3 requêtes/60 s/IP (RULE_REGISTER, src/middleware.ts). Ce quota est
 *   partagé par IP, donc par TOUS les tests du runner : en `fullyParallel`,
 *   `auth.spec.ts` et `analyse.spec.ts` se battent pour le même compteur →
 *   cascade de 429 (2 échecs/5 relevés en revue). D'où `workers: 1`.
 * - `globalTeardown` : nettoyage en fin de suite des comptes de test
 *   (`e2e-*@example.com`) et de leurs données en cascade (cf. e2e/helpers.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  // Le rate limit `register` est partagé par IP → les tests tournent l'un
  // après l'autre. `workers: 1` implique déjà `fullyParallel: false` : on
  // l'explicite pour que l'intention survive à toute évolution de config.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  // Par test : doit absorber les attentes `Retry-After` du rate limit
  // register (jusqu'à 3 × 61 s dans `submitRegister`) en plus de la
  // compilation dev à la volée sur une première visite de route.
  timeout: 240_000,
  // Exécuté une fois, après toute la suite, même en cas d'échec.
  globalTeardown: "./e2e/global-teardown.ts",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3001",
    // Locale du navigateur : détermine l'en-tête `Accept-Language`, que le
    // middleware utilise pour résoudre la locale lors d'une navigation sans
    // segment de locale (ex. callbackUrl `/` après une connexion).
    locale: "fr-FR",
    // Première visite d'une route dans `next dev` = compilation à la volée,
    // potentiellement lente : on laisse large.
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
