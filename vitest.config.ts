import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest — tests unitaires de la logique serveur.
 *
 * - `environment: "node"` : aucun test de composant React dans ce projet de
 *   tests (logique pure, Prisma/Stripe mockés, zéro DB ni réseau).
 * - Alias `@/*` aligné sur `paths` de `tsconfig.json`.
 * - `globals: false` : les helpers (`describe`, `it`, `expect`, `vi`) sont
 *   importés explicitement depuis `vitest` dans chaque fichier de test.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
