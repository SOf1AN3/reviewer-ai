import { expect, test } from "@playwright/test";
import { hasGeminiApiKey, openPage, registerUser, uniqueEmail } from "./helpers";

/** Contenu > 100 caractères (seuil minimal du formulaire). */
const ARTICLE_CONTENT =
  "Nous présentons dans cet article une méthode d'évaluation de la " +
  "reproductibilité des études empiriques en sciences sociales, appliquée " +
  "à un échantillon de deux cents publications issues de revues à comité " +
  "de lecture.";

test.describe("Formulaire d'analyse", () => {
  test("le bouton de soumission est désactivé sous 100 caractères", async ({ page }) => {
    await openPage(page, "/fr/analyser");

    await expect(page.getByRole("heading", { name: "Analyser un article" })).toBeVisible();
    await expect(page.locator("#titre")).toBeVisible();
    await expect(page.locator("#contenu")).toBeVisible();

    const submit = page.getByRole("button", { name: "Analyser l'article" });
    // Contenu vide → désactivé.
    await expect(submit).toBeDisabled();

    // Contenu court → toujours désactivé.
    await page.locator("#contenu").fill("Texte trop court.");
    await expect(submit).toBeDisabled();

    // Contenu ≥ 100 caractères → activé.
    await page.locator("#contenu").fill("x".repeat(100));
    await expect(submit).toBeEnabled();
  });

  test("soumission authentifiée : redirection vers /fr/analyse/<id>", async ({ page }) => {
    test.skip(
      !hasGeminiApiKey(),
      "GEMINI_API_KEY absente : le flux d'analyse IA n'est pas exécutable ici"
    );
    // L'API /api/analyze exige une session authentifiée (401 sinon).
    // Marge : compilation dev + attente éventuelle du rate limit register.
    test.setTimeout(240_000);

    // L'API /api/analyze exige une session authentifiée (401 sinon).
    await registerUser(page, uniqueEmail("e2e-analyse"));

    await openPage(page, "/fr/analyser");
    await page.locator("#titre").fill("Étude de reproductibilité — test E2E");
    await page.locator("#contenu").fill(ARTICLE_CONTENT);

    const submit = page.getByRole("button", { name: "Analyser l'article" });
    await expect(submit).toBeEnabled();
    await submit.click();

    // 202 immédiat (le job IA part en arrière-plan) puis redirection après
    // ~700 ms vers la page de résultat.
    await page.waitForURL(/\/fr\/analyse\/[^/?#]+/, { timeout: 90_000 });

    // On ne prétend PAS vérifier la note (10 à 45 s) : on tolère l'échec de
    // l'IA. L'assertion porte sur le fait que la page de résultat rend un état
    // reconnu — chargement, attente, résultat, timeout ou erreur gérée — et
    // donc ne casse pas.
    const loadingState = page.getByText("Chargement de l'analyse");
    const pendingState = page.getByText("Analyse en cours");
    const resultState = page.getByText("Note globale");
    const timeoutState = page.getByText("Analyse toujours en cours");
    // Carte d'erreur gérée (état `error` de la page, avec retour à l'accueil).
    const handledError = page.getByRole("button", { name: "Retour à l'accueil" });

    await expect(
      loadingState
        .or(pendingState)
        .or(resultState)
        .or(timeoutState)
        .or(handledError)
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
