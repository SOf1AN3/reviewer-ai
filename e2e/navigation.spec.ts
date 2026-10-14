import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.describe("Navigation et internationalisation", () => {
  test("l'accueil /fr répond 200, rend le Header et un lien vers /fr/analyser", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(200);

    // Le Header (marque PaperNote) est présent.
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("PaperNote", { exact: true })).toBeVisible();

    // Le Header n'affiche le libellé « Analyser » (src/components/Header.tsx)
    // que lorsque la session est active. En navigation anonyme, l'accès à
    // l'analyse est porté par le CTA « Commencer l'analyse » de l'accueil,
    // qui pointe vers /fr/analyser. Le libellé « Analyser » du Header est
    // couvert une fois connecté dans e2e/auth.spec.ts.
    await expect(page.locator('a[href="/fr/analyser"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Commencer l'analyse" })).toBeVisible();
  });

  test("bascule de locale : /en affiche les libellés anglais", async ({ page }) => {
    await gotoHydrated(page, "/fr");
    await page.getByRole("button", { name: "Changer de langue" }).click();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.waitForURL("**/en", { timeout: 15_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Start Analysis" })).toBeVisible();
  });

  test("bascule de locale : /ar bascule le document en RTL", async ({ page }) => {
    const response = await page.goto("/ar");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("GET /fr/page-inexistante renvoie un 404 affiché (pas un 500)", async ({ page }) => {
    const response = await page.goto("/fr/page-inexistante");
    expect(response?.status()).toBe(404);
    // L'état 404 du composant ErrorState est rendu, et pas l'état « 500 ».
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expect(page.getByText("Une erreur est survenue")).toHaveCount(0);
  });
});
