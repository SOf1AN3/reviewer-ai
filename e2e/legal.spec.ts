import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

const LEGAL_PAGES: ReadonlyArray<{ path: string; heading: string }> = [
  { path: "/fr/legal/privacy", heading: "Politique de confidentialité" },
  { path: "/fr/legal/terms", heading: "Conditions générales" },
  { path: "/fr/legal/cookies", heading: "Politique cookies" },
];

test.describe("Pages légales", () => {
  for (const { path, heading } of LEGAL_PAGES) {
    test(`${path} répond 200 et rend son contenu`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }

  test("le bandeau cookies s'affiche et se ferme", async ({ page }) => {
    await gotoHydrated(page, "/fr/legal/cookies");

    const banner = page.getByRole("status").filter({ hasText: "cookies techniques" });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(banner).toBeHidden();
  });
});
