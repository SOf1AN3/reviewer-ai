import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { isStripeConfigured } from "@/lib/env";

/**
 * PATCH /api/user/profile — mise à jour STRICTEMENT LIMITÉE du profil.
 *
 * Seul `name` est accepté. `z.object()` est en mode « strip » par défaut
 * (Zod v4) : toute clé inconnue du body (`email`, `plan`, `role`,
 * `stripeCustomerId`, `emailVerified`, `password`…) est supprimée avant
 * traitement et ne peut donc jamais être écrite par cette route.
 */
const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
});

/** Corps JSON décodé, ou `null` si le body n'est pas un JSON valide. */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * GET /api/user/profile — profil de l'utilisateur de la session (anti-IDOR :
 * aucun `userId` lisible depuis la requête).
 *
 * Ne renvoie jamais `password`, `stripeCustomerId`, `role` ni aucun
 * autre champ sensible.
 */
export const GET = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        plan: true,
        // `createdAt` : absent du modèle `User` (prisma/schema.prisma) →
        // non renvoyé (aucune colonne improvisée).
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      plan: user.plan,
      // Flag PUBLIC : un simple booléen, aucun secret. Il est consommé par
      // la page `settings/billing` pour afficher un état honnête (« facturation
      // non activée ») au lieu d'un bouton Stripe cassé. Le module `@/lib/env`
      // reste server-only : aucun import côté client.
      stripeConfigured: isStripeConfigured,
    });
  } catch (error) {
    console.error("User profile GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du profil" },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/user/profile — renomme le compte (champ `name` uniquement).
 *
 * @returns 401 sans session · 400 body invalide · 404 compte absent ·
 *   200 `{ ok: true, name }` · 500 erreur serveur.
 */
export const PATCH = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const rawBody = await readJsonBody(req);
  const parsed = updateProfileSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nom invalide : entrez 2 à 100 caractères." },
      { status: 400 }
    );
  }

  try {
    // `updateMany` conditionné à l'ID de session : aucune écriture possible
    // sur un autre compte, et aucun throw si la ligne a disparu.
    const updated = await db.user.updateMany({
      where: { id: currentUser.id },
      data: { name: parsed.data.name },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, name: parsed.data.name });
  } catch (error) {
    console.error("User profile PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du profil" },
      { status: 500 }
    );
  }
});
