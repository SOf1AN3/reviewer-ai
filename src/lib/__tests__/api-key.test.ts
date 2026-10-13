/**
 * src/lib/__tests__/api-key.test.ts — Génération, hash et authentification
 * des clés API.
 *
 * `@/lib/db` est mocké (aucune PrismaClient instanciée, zéro DB) et le
 * logger neutralisé. La cryptographie (`node:crypto`) est RÉELLE : on
 * valide que la clé brute n'est jamais stockée telle quelle et que le hash
 * est déterministe (SHA-256), ainsi que le format `pn_live_…`.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    apiKey: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
}));

import {
  authenticateApiKey,
  generateApiKey,
  hashApiKey,
} from "@/lib/api-key";

function bearerRequest(header: string | null): Request {
  return new Request("http://localhost/api/protected", {
    headers: header === null ? {} : { authorization: header },
  });
}

describe("generateApiKey", () => {
  it("produit une clé au format pn_live_<64 hex> (72 caractères)", () => {
    const key = generateApiKey();

    expect(key.raw).toMatch(/^pn_live_[0-9a-f]{64}$/u);
    expect(key.raw).toHaveLength(72);
    expect(key.prefix).toBe(key.raw.slice(0, 12));
    expect(key.prefix).toMatch(/^pn_live_[0-9a-f]{4}$/u);
  });

  it("le hash stocké est différent de la clé brute et vaut SHA-256(brut)", () => {
    const key = generateApiKey();
    const expected = createHash("sha256")
      .update(key.raw, "utf8")
      .digest("hex");

    expect(key.hash).not.toBe(key.raw);
    expect(key.hash).toBe(expected);
    // Le hash ne contient jamais le préfixe en clair.
    expect(key.hash).not.toContain("pn_live_");
  });

  it("deux générations produisent des clés distinctes (entropie réelle)", () => {
    const a = generateApiKey();
    const b = generateApiKey();

    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashApiKey", () => {
  it("est déterministe et cohérent avec generateApiKey", () => {
    const key = generateApiKey();

    expect(hashApiKey(key.raw)).toBe(key.hash);
    expect(hashApiKey(key.raw)).toBe(hashApiKey(key.raw));
    expect(hashApiKey("autre-clé")).not.toBe(hashApiKey(key.raw));
  });
});

describe("authenticateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue(null);
    updateMock.mockResolvedValue({});
  });

  it("retourne null sans en-tête Authorization", async () => {
    const identity = await authenticateApiKey(bearerRequest(null));

    expect(identity).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("retourne null pour un en-tête malformé (pas de Bearer)", async () => {
    const identity = await authenticateApiKey(bearerRequest("Basic dXNlcjpwdw=="));

    expect(identity).toBeNull();
  });

  it("retourne null pour une clé inconnue", async () => {
    findUniqueMock.mockResolvedValue(null);

    const identity = await authenticateApiKey(
      bearerRequest("Bearer pn_live_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    );

    expect(identity).toBeNull();
  });

  it("retourne null pour une clé révoquée (revokedAt non null)", async () => {
    const key = generateApiKey();
    findUniqueMock.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      monthlyLimit: 100,
      revokedAt: new Date(),
    });

    const identity = await authenticateApiKey(bearerRequest(`Bearer ${key.raw}`));

    expect(identity).toBeNull();
    // Aucune mise à jour de lastUsedAt pour une clé révoquée.
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retourne l'identité pour une clé valide (et trace lastUsedAt en best-effort)", async () => {
    const key = generateApiKey();
    findUniqueMock.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      monthlyLimit: null,
      revokedAt: null,
    });

    const identity = await authenticateApiKey(bearerRequest(`Bearer ${key.raw}`));

    expect(identity).toEqual({
      userId: "user-1",
      apiKeyId: "key-1",
      monthlyLimit: null,
    });
    // La lookup se fait par le HASH, jamais par la clé brute.
    const lookupArg = findUniqueMock.mock.calls[0]?.[0] as {
      where: { keyHash: string };
    };
    expect(lookupArg.where.keyHash).toBe(key.hash);
    // lastUsedAt mis à jour (best-effort).
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("un échec d'écriture de lastUsedAt ne fait PAS échouer l'authentification", async () => {
    const key = generateApiKey();
    findUniqueMock.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      monthlyLimit: 10,
      revokedAt: null,
    });
    updateMock.mockRejectedValue(new Error("db down"));

    const identity = await authenticateApiKey(bearerRequest(`Bearer ${key.raw}`));

    expect(identity).toEqual({
      userId: "user-1",
      apiKeyId: "key-1",
      monthlyLimit: 10,
    });
  });

  it("une erreur de lookup (base injoignable) retourne null sans lever", async () => {
    const key = generateApiKey();
    findUniqueMock.mockRejectedValue(new Error("db down"));

    await expect(
      authenticateApiKey(bearerRequest(`Bearer ${key.raw}`))
    ).resolves.toBeNull();
  });
});
