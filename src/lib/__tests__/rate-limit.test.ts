/**
 * src/lib/__tests__/rate-limit.test.ts — Rate limiting (store mémoire local).
 *
 * Aucune DB ni réseau : le store par défaut est une Map sur `globalThis`.
 * Les variables Upstash sont supprimées du `process.env` des tests pour
 * garantir le chemin mémoire (jamais d'appel fetch vers Redis).
 *
 * L'isolement entre tests passe par le vidage de la Map (`__papernoteRateLimitStore`)
 * et par des timers faux (`vi.setSystemTime`) pour contrôler les fenêtres.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";

type MemoryEntry = { count: number; resetAt: number };
type GlobalWithStore = typeof globalThis & {
  __papernoteRateLimitStore?: Map<string, MemoryEntry>;
};

/** Vide le store partagé entre tests (l'état vit sur globalThis). */
function clearMemoryStore(): void {
  const store = (globalThis as GlobalWithStore).__papernoteRateLimitStore;
  store?.clear();
}

const T0 = new Date("2026-10-13T12:00:00.000Z");

describe("rateLimit — store mémoire", () => {
  beforeEach(() => {
    // Forcer le store mémoire : jamais d'appel réseau Upstash en test.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    clearMemoryStore();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise « limit » appels puis refuse le suivant", async () => {
    const opts = { key: "analyze:ip:1.2.3.4", limit: 5, windowSec: 60 };

    const results: RateLimitResult[] = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(await rateLimit(opts));
    }

    expect(results.slice(0, 5).every((r) => r.success)).toBe(true);
    expect(results[5]?.success).toBe(false);
    expect(results[0]?.remaining).toBe(4);
    expect(results[4]?.remaining).toBe(0);
    expect(results[5]?.remaining).toBe(0);
    // La fenêtre court jusqu'à T0 + 60 s.
    expect(results[0]?.resetAt).toBe(T0.getTime() + 60_000);
  });

  it("la fenêtre se réinitialise après expiration", async () => {
    const opts = { key: "analyze:ip:9.9.9.9", limit: 2, windowSec: 60 };

    expect((await rateLimit(opts)).success).toBe(true);
    expect((await rateLimit(opts)).success).toBe(true);
    expect((await rateLimit(opts)).success).toBe(false); // limite atteinte

    // On dépasse la fin de fenêtre : nouveau compteur, nouvelle fenêtre.
    vi.setSystemTime(new Date(T0.getTime() + 61_000));

    const afterWindow = await rateLimit(opts);
    expect(afterWindow.success).toBe(true);
    expect(afterWindow.remaining).toBe(1);
    expect(afterWindow.resetAt).toBe(T0.getTime() + 121_000);
  });

  it("deux clés sont strictement indépendantes", async () => {
    const limitOne = { key: "login:ip:1.1.1.1", limit: 1, windowSec: 60 };
    const limitTwo = { key: "login:ip:2.2.2.2", limit: 1, windowSec: 60 };

    expect((await rateLimit(limitOne)).success).toBe(true);
    expect((await rateLimit(limitOne)).success).toBe(false); // consommée

    // La seconde clé n'a pas été affectée par la première.
    expect((await rateLimit(limitTwo)).success).toBe(true);
    expect((await rateLimit(limitTwo)).success).toBe(false);
  });

  it("fail-open : des options invalides ne bloquent jamais le trafic", async () => {
    const result = await rateLimit({
      key: "",
      limit: 0,
      windowSec: 0,
    });

    expect(result.success).toBe(true);
    // Aucune entrée n'a été créée dans le store pour ces options invalides.
    const store = (globalThis as GlobalWithStore).__papernoteRateLimitStore;
    expect(store?.size ?? 0).toBe(0);
  });
});
