import { expect, test } from "@playwright/test";
import {
  dismissCookieBanner,
  gotoHydrated,
  submitRegister,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers";

test.describe("Authentification (flux critique)", () => {
  test("inscription via l'UI → session active → déconnexion → reconnexion", async ({ page }) => {
    // Dev : compilation des routes à la volée + marge (y compris une attente
    // éventuelle de réinitialisation du rate limit d'inscription).
    test.setTimeout(180_000);
    const email = uniqueEmail("e2e-auth");
    const header = page.locator("header");

    // --- Inscription -------------------------------------------------------
    // Formulaire réel /fr/register (vérifié dans src/app/[locale]/register/
    // page.tsx) : champs #name, #email, #password, bouton « Créer mon compte ».
    await gotoHydrated(page, "/fr/register");
    await dismissCookieBanner(page);
    await page.locator("#name").fill(email);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    // Tolère le rate limit d'inscription (3/min/IP, RULE_REGISTER).
    await submitRegister(page);

    // Après succès : signIn credentials + router.push('/${locale}').
    await page.waitForURL("**/fr", { timeout: 30_000 });

    // --- Session active ----------------------------------------------------
    await expect(header.getByRole("button", { name: "Déconnexion", exact: true })).toBeVisible();
    // Le Header affiche `session.user.name` (ici l'email) de l'utilisateur.
    await expect(header.getByText(email)).toBeVisible();
    // En session, le Header expose aussi le libellé « Analyser ».
    await expect(header.getByRole("link", { name: "Analyser", exact: true })).toBeVisible();

    // --- Déconnexion -------------------------------------------------------
    // ⚠️ Particularité connue du projet : `AUTH_URL` vaut http://localhost:3000
    // (.env / .env.local) alors que l'app tourne sur :3001 → le 302 de
    // `/api/auth/signout` pointe vers une AUTRE origine que celle du test.
    // On laisse la navigation partir (sans jamais assérer sur son contenu),
    // puis on revient sur l'origine du serveur testé pour vérifier l'état
    // réel de la session. Voir rapport T4.2.
    const loginNavigation = page
      .waitForURL(/\/login/, { timeout: 15_000 })
      .catch(() => undefined);
    // On attend AUSSI la réponse du POST signout : c'est elle qui vide le
    // cookie de session. Sans ce garde-fou, revenir sur :3001 trop tôt
    // renvoie une session encore active (course non déterministe).
    const signoutResponse = page.waitForResponse(
      (response) => response.url().includes("/api/auth/signout"),
      { timeout: 15_000 }
    );
    await header.getByRole("button", { name: "Déconnexion", exact: true }).click();
    await signoutResponse;
    await loginNavigation;

    // Retour sur l'origine testée, en état anonyme.
    await gotoHydrated(page, "/fr/login");
    await expect(header.getByRole("button", { name: "Déconnexion", exact: true })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "Connexion", exact: true })).toBeVisible();
    await expect(header.getByText(email)).toHaveCount(0);

    // --- Reconnexion -------------------------------------------------------
    // Formulaire réel /fr/login : #email, #password, bouton « Se connecter ».
    // Le bouton Google « Se connecter avec Google » partage le préfixe →
    // matching exact obligatoire.
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();

    // Callback par défaut : router.push('/') → middleware → redirection /fr.
    await page.waitForURL("**/fr", { timeout: 30_000 });
    await expect(header.getByRole("button", { name: "Déconnexion", exact: true })).toBeVisible();
    await expect(header.getByText(email)).toBeVisible();
  });
});
