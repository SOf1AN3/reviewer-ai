/**
 * src/lib/__tests__/plan.test.ts — Quota mensuel par plan (consumeQuota / getUserPlan).
 *
 * `@/lib/db` est mocké (aucune PrismaClient instanciée, zéro DB). Le mock
 * rejoue les contrats exacts de Prisma : `findUnique`, `updateMany` (retourne
 * `{ count }`) et `update`. Les timers sont figés pour maîtriser les
 * frontières de mois UTC.
 *
 * Note honnête : ces tests valident la DÉCISION et les REQUÊTES produites
 * (where conditionnel, fusion reset+incrément) — l'atomicité réelle du
 * `updateMany` PostgreSQL (verrou de ligne) n'est pas reproduisible sans DB
 * et relève des tests d'intégration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateManyMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: findUniqueMock,
      updateMany: updateManyMock,
      update: updateMock,
    },
  },
}));

// stripe.ts (importé par plan.ts) lit l'env au chargement du module.
vi.mock("@/lib/env", () => ({
  env: { STRIPE_PRO_PRICE_ID: "price_pro", STRIPE_BUSINESS_PRICE_ID: "price_business" },
  isStripeConfigured: false,
}));

import { consumeQuota, getUserPlan } from "@/lib/plan";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const MONTH_START = new Date("2026-10-01T00:00:00.000Z");
const PREV_MONTH = new Date("2026-09-15T00:00:00.000Z");

type UserRow = {
  plan: string | null;
  analysesThisMonth: number;
  analysesResetAt: Date | null;
};

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    plan: "free", // monthlyLimit: 3
    analysesThisMonth: 0,
    analysesResetAt: MONTH_START,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  findUniqueMock.mockResolvedValue(null);
  updateManyMock.mockResolvedValue({ count: 0 });
  updateMock.mockResolvedValue({ analysesThisMonth: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("consumeQuota — refus / autorisation", () => {
  it("utilisateur introuvable → refus", async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await consumeQuota("user-404");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("Utilisateur non trouvé");
    }
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("updateMany count = 0 (quota épuisé) → refus avec message explicite", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "free", analysesThisMonth: 3 })
    );
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("limite de 3 analyses");
    }
    // La décision est portée par le WHERE conditionnel de l'updateMany.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        analysesResetAt: { gte: MONTH_START },
        analysesThisMonth: { lt: 3 },
      },
      data: { analysesThisMonth: { increment: 1 } },
    });
  });

  it("updateMany count = 1 (place restante) → autorisé, compteur incrémenté", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "free", analysesThisMonth: 2 })
    );
    updateManyMock.mockResolvedValue({ count: 1 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.plan.key).toBe("free");
      expect(result.plan.monthlyLimit).toBe(3);
      expect(result.plan.analysesUsed).toBe(3); // 2 + 1
    }
  });

  it("plan illimité (monthlyLimit: -1) → jamais bloqué, incrémenté pour le reporting", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "business", analysesThisMonth: 999 })
    );
    updateMock.mockResolvedValue({ analysesThisMonth: 1000 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.plan.key).toBe("business");
      expect(result.plan.monthlyLimit).toBe(-1);
      expect(result.plan.analysesUsed).toBe(1000);
    }
    // Aucun gatekeeping : pas d'updateMany conditionnel, un simple incrément.
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { analysesThisMonth: { increment: 1 } },
    });
  });

  it("plan inconnu en base → normalisé en « free » (limite 3 appliquée)", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "enterprise", analysesThisMonth: 3 })
    );
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("limite de 3 analyses");
    }
  });
});

describe("consumeQuota — remise à zéro mensuelle (UTC)", () => {
  it("compteur du mois précédent → reset fusionné + autorisation (analysesUsed: 1)", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "free", analysesThisMonth: 3, analysesResetAt: PREV_MONTH })
    );
    updateManyMock.mockResolvedValue({ count: 1 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      // Le quota du mois N-1 (épuisé) ne bloque pas le mois courant.
      expect(result.plan.analysesUsed).toBe(1);
    }
    // Reset atômique : valeur absolue 1 + condition OR (null | mois antérieur).
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        OR: [{ analysesResetAt: null }, { analysesResetAt: { lt: MONTH_START } }],
      },
      data: { analysesThisMonth: 1, analysesResetAt: NOW },
    });
  });

  it("plan illimité avec compteur périmé → le reset passe avant le gate", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "business", analysesThisMonth: 42, analysesResetAt: PREV_MONTH })
    );
    updateManyMock.mockResolvedValue({ count: 1 });

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.plan.analysesUsed).toBe(1);
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("reset perdu au profit d'une requête concurrente → repli sur l'incrément + relecture", async () => {
    // 1re lecture : compteur périmé. Le reset échoue (count 0, concurrent gagnant).
    findUniqueMock
      .mockResolvedValueOnce(
        userRow({ plan: "free", analysesThisMonth: 2, analysesResetAt: PREV_MONTH })
      )
      // Relecture après incrément concurrent : le compteur vaut déjà 3.
      .mockResolvedValueOnce({ analysesThisMonth: 3 });
    updateManyMock
      .mockResolvedValueOnce({ count: 0 }) // chemin reset → 0 ligne
      .mockResolvedValueOnce({ count: 1 }); // chemin incrément → 1 ligne

    const result = await consumeQuota("user-1");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      // Valeur RELUE (3), pas l'ancien relevé local + 1.
      expect(result.plan.analysesUsed).toBe(3);
    }
    expect(updateManyMock).toHaveBeenCalledTimes(2);
  });
});

describe("getUserPlan — lecture seule", () => {
  it("utilisateur introuvable → null", async () => {
    findUniqueMock.mockResolvedValue(null);

    expect(await getUserPlan("user-404")).toBeNull();
  });

  it("consommation du mois courant retournée telle quelle, sans écriture", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "pro", analysesThisMonth: 7 })
    );

    const info = await getUserPlan("user-1");

    expect(info).not.toBeNull();
    expect(info?.key).toBe("pro");
    expect(info?.monthlyLimit).toBe(50);
    expect(info?.analysesUsed).toBe(7);
    // Lecture seule garantie.
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("compteur d'un mois antérieur → affiché à 0 (sans écriture)", async () => {
    findUniqueMock.mockResolvedValue(
      userRow({ plan: "free", analysesThisMonth: 3, analysesResetAt: PREV_MONTH })
    );

    const info = await getUserPlan("user-1");

    expect(info?.analysesUsed).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
