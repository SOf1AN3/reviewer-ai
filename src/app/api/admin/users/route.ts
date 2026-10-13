import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logEvent } from "@/lib/logger";

/**
 * GET /api/admin/users — liste paginée des utilisateurs (support admin).
 *
 * Lecture seule : aucun mot de passe, aucun `stripeCustomerId`, aucun token.
 * La pagination est bornée (`limit` max 50) et le compteur d'analyses par
 * utilisateur est calculé en DB (agrégation SQL paramétrée, une ligne par
 * utilisateur).
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Lit un paramètre de query, en traitant valeur vide comme absent. */
function readOptionalParam(
  searchParams: URLSearchParams,
  key: string
): string | undefined {
  const value = searchParams.get(key);
  return value !== null && value.trim() !== "" ? value : undefined;
}

/** Query string validée : `page` (≥1), `limit` (1–50), `search` (1–100). */
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

/** Élément de la liste admin (jamais de champ sensible). */
interface AdminUserItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  plan: string;
  analysesThisMonth: number;
  /** Nombre total d'analyses rattachées aux articles de l'utilisateur. */
  analysesCount: number;
  // `createdAt` absent du modèle `User` (prisma/schema.prisma) → non renvoyé.
}

/** Contrat JSON complet de `GET /api/admin/users`. */
interface AdminUsersResponse {
  users: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
}

export const GET = auth(async (req) => {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const { searchParams } = new URL(req.url);
  const parsedQuery = listQuerySchema.safeParse({
    page: readOptionalParam(searchParams, "page"),
    limit: readOptionalParam(searchParams, "limit"),
    search: readOptionalParam(searchParams, "search"),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Paramètres invalides : page ≥ 1, limit entre 1 et 50." },
      { status: 400 }
    );
  }

  const page = parsedQuery.data.page ?? DEFAULT_PAGE;
  const limit = parsedQuery.data.limit ?? DEFAULT_LIMIT;
  const search = parsedQuery.data.search;

  try {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const [total, rows] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { id: "asc" }, // Ordre total stable (pas de colonne `createdAt`).
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          plan: true,
          analysesThisMonth: true,
        },
      }),
    ]);

    // Compteur d'analyses par utilisateur : agrégation SQL paramétrée
    // (LEFT JOIN pour inclure les compteurs à 0), une seule ligne par user.
    let analysesCountByUserId = new Map<string, number>();
    if (rows.length > 0) {
      const userIds = rows.map((row) => row.id);
      const countRows = await db.$queryRaw<
        Array<{ userId: string; analysesCount: number }>
      >`
        SELECT u."id" AS "userId", COUNT(an."id")::int AS "analysesCount"
        FROM "User" u
        LEFT JOIN "Article" ar ON ar."userId" = u."id"
        LEFT JOIN "Analyse" an ON an."articleId" = ar."id"
        WHERE u."id" IN (${Prisma.join(userIds)})
        GROUP BY u."id"
      `;
      analysesCountByUserId = new Map(
        countRows.map((row) => [row.userId, row.analysesCount])
      );
    }

    const users: AdminUserItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      plan: row.plan,
      analysesThisMonth: row.analysesThisMonth,
      analysesCount: analysesCountByUserId.get(row.id) ?? 0,
    }));

    const response: AdminUsersResponse = { users, total, page, limit };

    // Audit d'accès : on journalise l'EXISTENCE d'une recherche, jamais son
    // contenu (une requête de support peut contenir des PII tapées par l'admin).
    logEvent("admin_access", {
      route: "users",
      adminId: admin.id,
      page,
      limit,
      hasSearch: search !== undefined,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
});
