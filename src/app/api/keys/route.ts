import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { generateApiKey } from "@/lib/api-key";
import { logEvent } from "@/lib/logger";

/**
 * /api/keys — gestion des clés API de l'utilisateur connecté (session).
 *
 * - `GET`    : liste les clés (jamais `keyHash`, jamais la clé brute).
 * - `POST`   : crée une clé et renvoie la clé BRUTE une SEULE fois.
 * - `DELETE ?id=` : révoque une clé (`revokedAt = now`) — jamais de
 *   suppression physique, jamais une clé d'un autre utilisateur (403).
 *
 * Tous les points d'entrée exigent une session (`requireUser`) : la clé brute
 * n'est exposée qu'à la création, dans la réponse du `POST`.
 */

/** Corps attendu par `POST /api/keys`. */
const createKeySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom ne peut dépasser 100 caractères"),
  monthlyLimit: z.number().int().min(1).nullable().optional(),
});

/** Champs sûrs retournés par la liste — `keyHash` et la clé brute exclus. */
const keySelect = {
  id: true,
  name: true,
  keyPrefix: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
  monthlyLimit: true,
} as const;

/** Identifiant d'erreur réduit pour le log — jamais l'objet erreur complet. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "non-Error";
  const status =
    "status" in error && typeof error.status === "number"
      ? ` status=${error.status}`
      : "";
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => /^\s*at\s/.test(line));
  const stack = frames.length > 0 ? `\n${frames.join("\n")}` : "";
  return `${error.name}${status}${stack}`;
}

/** GET /api/keys — liste des clés de l'utilisateur (sans hash ni brut). */
export const GET = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const keys = await db.apiKey.findMany({
      where: { userId: currentUser.id },
      select: keySelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    logEvent(
      "api_keys",
      { step: "list_failed", userId: currentUser.id, error: describeError(error) },
      "error"
    );
    return NextResponse.json(
      { error: "Erreur lors de la récupération des clés" },
      { status: 500 }
    );
  }
});

/** POST /api/keys — crée une clé, renvoie le brut une seule fois. */
export const POST = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête invalide" },
        { status: 400 }
      );
    }

    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { name, monthlyLimit } = parsed.data;
    const { raw, hash, prefix } = generateApiKey();

    const created = await db.apiKey.create({
      data: {
        userId: currentUser.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        monthlyLimit: monthlyLimit ?? null,
      },
      select: { id: true, name: true, keyPrefix: true },
    });

    logEvent("api_keys", {
      step: "created",
      userId: currentUser.id,
      apiKeyId: created.id,
    });

    // La clé BRUTE n'apparaît qu'ICI, une seule fois. Elle n'est ni journalisée
    // ni persistée en clair (seul le hash est stocké).
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        key: raw,
        warning:
          "Copiez cette clé maintenant : elle ne sera plus jamais affichée. Conservez-la en sécurité.",
      },
      { status: 201 }
    );
  } catch (error) {
    logEvent(
      "api_keys",
      { step: "create_failed", userId: currentUser.id, error: describeError(error) },
      "error"
    );
    return NextResponse.json(
      { error: "Erreur lors de la création de la clé" },
      { status: 500 }
    );
  }
});

/** DELETE /api/keys?id= — révoque une clé (jamais de suppression physique). */
export const DELETE = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre `id` requis" },
        { status: 400 }
      );
    }

    const key = await db.apiKey.findUnique({
      where: { id },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (!key) {
      return NextResponse.json({ error: "Clé non trouvée" }, { status: 404 });
    }
    if (key.userId !== currentUser.id) {
      // Anti-IDOR : jamais une clé d'un autre utilisateur.
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    if (key.revokedAt === null) {
      await db.apiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      });
    }

    logEvent("api_keys", {
      step: "revoked",
      userId: currentUser.id,
      apiKeyId: key.id,
    });

    return NextResponse.json({ ok: true, id: key.id });
  } catch (error) {
    logEvent(
      "api_keys",
      { step: "revoke_failed", userId: currentUser.id, error: describeError(error) },
      "error"
    );
    return NextResponse.json(
      { error: "Erreur lors de la révocation de la clé" },
      { status: 500 }
    );
  }
});
