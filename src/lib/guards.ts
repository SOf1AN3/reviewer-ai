import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Shape minimal de la session NextAuth telle qu'exposée sur `req.auth`
 * par le wrapper `auth()` (next-auth v5). volontairement structurel pour
 * rester découplé des augmentations de types du projet.
 */
interface AuthSessionLike {
  user?: { id?: string | null } | null;
}

/**
 * Requête enrichie par le wrapper `auth()` de next-auth : `NextRequest`
 * + propriété `auth` (session nullable).
 */
export interface AuthedRequest extends NextRequest {
  auth?: AuthSessionLike | null;
}

/** Identifiant garanti de l'utilisateur connecté. */
export interface AuthUser {
  id: string;
}

/**
 * Exige une session authentifiée (contrôle 401 systématique).
 *
 * Retourne `{ id: string }` si l'utilisateur est connecté,
 * sinon une `NextResponse` 401 JSON à retourner telle quelle :
 *
 * ```ts
 * const user = await requireUser(req);
 * if (user instanceof NextResponse) return user;
 * ```
 */
export async function requireUser(
  req: AuthedRequest
): Promise<AuthUser | NextResponse> {
  const id = req.auth?.user?.id;
  if (!id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return { id };
}

/**
 * Contrôle de propriété (anti-IDOR).
 *
 * Retourne `null` si la ressource appartient bien à l'utilisateur
 * connecté, sinon une `NextResponse` 403 JSON.
 *
 * Note de sécurité : cette fonction ne masque pas l'existence d'une
 * ressource. Conformément au comportement de `GET /api/analyse/[id]`,
 * la route doit d'abord renvoyer 404 si la ressource est absente,
 * puis appeler ce guard pour un éventuel 403 :
 *
 * ```ts
 * if (!record) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
 * const denied = assertOwnership(record.userId, currentUser.id);
 * if (denied) return denied;
 * ```
 */
export function assertOwnership(
  recordUserId: string,
  currentUserId: string
): NextResponse | null {
  if (recordUserId !== currentUserId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  return null;
}
