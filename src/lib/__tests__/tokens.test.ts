/**
 * src/lib/__tests__/tokens.test.ts — Jetons de vérification / réinitialisation.
 *
 * `@/lib/db` est mocké (aucune PrismaClient instanciée, zéro DB) et le
 * logger est neutralisé. La cryptographie (`node:crypto`) est RÉELLE : c'est
 * elle qu'on veut valider (hash SHA-256 du jeton stocké, usage unique,
 * isolation verify/reset).
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, deleteManyMock, findUniqueMock, mockEnv } = vi.hoisted(
  () => ({
    createMock: vi.fn(),
    deleteManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    mockEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000/" },
  })
);

vi.mock("@/lib/db", () => ({
  db: {
    verificationToken: {
      create: createMock,
      deleteMany: deleteManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
}));

import { buildAuthLink, createToken, verifyToken } from "@/lib/tokens";

/** Reproduit le hash de stockage : SHA-256 hex du jeton brut. */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

type TokenRecord = {
  identifier: string;
  type: "verify" | "reset";
  token: string;
  expires: Date;
};

const EMAIL = "user@example.com";

/** Crée un jeton réel et prépare le mock `findUnique` pour ce jeton. */
async function createRealToken(
  type: "verify" | "reset" = "verify"
): Promise<string> {
  const created = await createToken({
    identifier: EMAIL,
    type,
    ttlMinutes: 60,
  });
  if (!created.ok) {
    throw new Error(`createToken a échoué : ${created.error}`);
  }
  findUniqueMock.mockResolvedValue({
    identifier: EMAIL,
    type,
    token: sha256Hex(created.token),
    expires: new Date(Date.now() + 60_000),
  } satisfies TokenRecord);
  return created.token;
}

describe("tokens — cycle create/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({});
    deleteManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue(null);
    mockEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000/";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stocke le HASH SHA-256 du jeton, jamais le brut", async () => {
    const created = await createToken({
      identifier: EMAIL,
      type: "verify",
      ttlMinutes: 60,
    });

    expect(created.ok).toBe(true);
    const storedData = createMock.mock.calls[0]?.[0]?.data as {
      token: string;
      identifier: string;
      type: string;
      expires: Date;
    };
    expect(storedData.identifier).toBe(EMAIL);
    expect(storedData.type).toBe("verify");
    if (created.ok) {
      expect(storedData.token).not.toBe(created.token);
      expect(storedData.token).toBe(sha256Hex(created.token));
    }
    expect(storedData.expires.getTime()).toBeGreaterThan(Date.now());
  });

  it("un jeton créé puis vérifié avec le bon identifiant et le bon type → true", async () => {
    const raw = await createRealToken("verify");

    const ok = await verifyToken({
      identifier: EMAIL,
      type: "verify",
      token: raw,
    });

    expect(ok).toBe(true);
    // Révocation à l'usage : le jeton est supprimé (usage unique).
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { token: sha256Hex(raw) },
    });
  });

  it("un mauvais identifiant (email) → false, SANS suppression du jeton légitime", async () => {
    const raw = await createRealToken("verify");
    deleteManyMock.mockClear();

    const ok = await verifyToken({
      identifier: "intrus@example.com",
      type: "verify",
      token: raw,
    });

    expect(ok).toBe(false);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("cross-type : un jeton « reset » testé en « verify » → false, sans suppression", async () => {
    const raw = await createRealToken("reset");
    deleteManyMock.mockClear();

    const ok = await verifyToken({
      identifier: EMAIL,
      type: "verify",
      token: raw,
    });

    expect(ok).toBe(false);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("un jeton inconnu → false", async () => {
    findUniqueMock.mockResolvedValue(null);

    const ok = await verifyToken({
      identifier: EMAIL,
      type: "verify",
      token: "0".repeat(64),
    });

    expect(ok).toBe(false);
  });

  it("un jeton expiré → false + nettoyage du jeton périmé", async () => {
    const raw = await createRealToken("verify");
    findUniqueMock.mockResolvedValue({
      identifier: EMAIL,
      type: "verify",
      token: sha256Hex(raw),
      expires: new Date(Date.now() - 1_000),
    } satisfies TokenRecord);
    deleteManyMock.mockClear();

    const ok = await verifyToken({
      identifier: EMAIL,
      type: "verify",
      token: raw,
    });

    expect(ok).toBe(false);
    // Purge du jeton périmé.
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { token: sha256Hex(raw) },
    });
  });

  it("réutilisation après usage → false (ligne déjà consommée)", async () => {
    const raw = await createRealToken("verify");

    // Premier usage : le jeton existe → true, et il est supprimé.
    expect(
      await verifyToken({ identifier: EMAIL, type: "verify", token: raw })
    ).toBe(true);

    // Deuxième usage : la ligne n'existe plus → false.
    findUniqueMock.mockResolvedValue(null);
    expect(
      await verifyToken({ identifier: EMAIL, type: "verify", token: raw })
    ).toBe(false);
  });

  it("consommation concurrente (deleteMany count = 0) → false", async () => {
    const raw = await createRealToken("verify");
    deleteManyMock.mockResolvedValue({ count: 0 });

    const ok = await verifyToken({
      identifier: EMAIL,
      type: "verify",
      token: raw,
    });

    expect(ok).toBe(false);
  });

  it("createToken refuse des paramètres invalides sans toucher à la base", async () => {
    const result = await createToken({
      identifier: "   ",
      type: "verify",
      ttlMinutes: 60,
    });

    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("tokens — buildAuthLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000/";
  });

  it("construit le lien absolu (base nettoyée des « / » finaux, query encodée)", () => {
    const result = buildAuthLink({
      pagePath: "/verify",
      locale: "fr",
      token: "abc123",
      email: EMAIL,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link).toBe(
        `http://localhost:3000/fr/verify?token=abc123&email=${encodeURIComponent(EMAIL)}`
      );
    }
  });

  it("FAIL-CLOSED : sans NEXT_PUBLIC_APP_URL, aucun lien n'est retourné", () => {
    mockEnv.NEXT_PUBLIC_APP_URL = "";

    const result = buildAuthLink({
      pagePath: "/reset-password",
      locale: "en",
      token: "abc123",
      email: EMAIL,
    });

    expect(result.ok).toBe(false);
  });
});
