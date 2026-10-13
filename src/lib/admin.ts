import { NextResponse } from "next/server";
import type { AuthedRequest } from "@/lib/guards";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";

/**
 * src/lib/admin.ts — Garde d'administration des routes API.
 *
 * Réutilise le pattern de `src/lib/guards.ts` : la session est lue sur
 * `req.auth` (wrapper `auth()` de next-auth v5), mais le RÔLE EST RELU EN
 * BASE À CHAQUE REQUÊTE. C'est volontaire : le JWT de session ne contient
 * que `user.id` (voir le callback `jwt` de `src/lib/auth.ts`), et même s'il
 * contenait un rôle, un token pourrait dater d'avant une promotion ou d'une
 * révocation. La DB est donc la seule source de vérité.
 *
 * Codes renvoyés :
 * - 401 : pas de session (ou session orpheline, compte supprimé) ;
 * - 403 : session valide mais `role !== "admin"` (le refus est journalisé).
 *
 * Usage dans une route :
 * ```ts
 * export const GET = auth(async (req) => {
 *   const admin = await requireAdmin(req);
 *   if (admin instanceof NextResponse) return admin;
 *   // `admin` vaut ici { id, role: "admin" } — rôle vérifié en DB.
 * });
 * ```
 */

/** Identité administrative dont le rôle a été vérifié en base. */
export interface AdminUser {
  id: string;
  role: "admin";
}

/**
 * Exige une session authentifiée ET un rôle `admin` vérifié en DB.
 *
 * Retourne `{ id, role: "admin" }` si l'accès est autorisé, sinon une
 * `NextResponse` (401 ou 403) à retourner telle quelle.
 */
export async function requireAdmin(
  req: AuthedRequest
): Promise<AdminUser | NextResponse> {
  const id = req.auth?.user?.id;
  if (!id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Rôle lu EN DB — jamais depuis le JWT ni aucun cookie/header client.
  const user = await db.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!user) {
    // Session orpheline (compte supprimé) : traitée comme une connexion absente.
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (user.role !== "admin") {
    // Audit des tentatives d'accès refusé (id interne uniquement, aucun PII).
    logEvent("admin", { step: "access_denied", userId: id }, "warn");
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return { id, role: "admin" };
}
