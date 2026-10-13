import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { isStripeConfigured } from "@/lib/env";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/user/delete — suppression RGPD du compte de la session.
 *
 * Exige une confirmation explicite : `confirmEmail` doit correspondre
 * EXACTEMENT à l'adresse email du compte (double confirmation côté client).
 */
const deleteAccountSchema = z.object({
  confirmEmail: z.string().min(1, "Confirmation de l'adresse email requise"),
});

/** Statuts Stripe d'un abonnement encore « vivant » (à annuler). */
function isActiveSubscriptionStatus(status: string): boolean {
  return status !== "canceled" && status !== "incomplete_expired";
}

/**
 * Nettoyage Stripe BEST-EFFORT : chaque appel est isolé dans son propre
 * `try/catch` pour maximiser les chances de succès, et AUCUNE erreur ne
 * remonte — la suppression locale ne doit jamais être bloquée par Stripe.
 */
async function cleanupStripeCustomer(customerId: string): Promise<void> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
    });

    for (const subscription of subscriptions.data) {
      if (!isActiveSubscriptionStatus(subscription.status)) continue;
      try {
        await stripe.subscriptions.cancel(subscription.id);
      } catch (error) {
        console.error(
          "Account delete: annulation de l'abonnement Stripe impossible (non bloquant)",
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "Account delete: listing des abonnements Stripe impossible (non bloquant)",
      error
    );
  }

  try {
    await stripe.customers.del(customerId);
  } catch (error) {
    console.error(
      "Account delete: suppression du customer Stripe impossible (non bloquant)",
      error
    );
  }
}

/**
 * POST /api/user/delete — suppression définitive du compte (RGPD).
 *
 * Sécurité :
 * - authentification obligatoire (`requireUser`) → 401 sans session ;
 * - l'ID supprimé est TOUJOURS celui de la session (jamais lisible depuis
 *   le body ni la query) → pas d'IDOR ;
 * - `confirmEmail` doit valoir exactement l'email du compte → 400 sinon.
 *
 * Cascade Prisma (`onDelete: Cascade`) : articles, analyses, abonnements,
 * factures, usage, api keys, comptes OAuth et sessions sont supprimés avec
 * l'utilisateur. Les `VerificationToken` (indexés sur l'email, sans clé
 * étrangère) sont nettoyés explicitement.
 *
 * @returns 401 sans session · 400 confirmation invalide · 404 compte absent ·
 *   200 `{ ok: true }` · 500 erreur serveur.
 */
export const POST = auth(async (req) => {
  const currentUser = await requireUser(req);
  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  let rawBody: unknown = null;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = deleteAccountSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirmation de l'adresse email requise" },
      { status: 400 }
    );
  }

  try {
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Confirmation stricte : comparaison exacte, sans normalisation.
    if (!user.email || parsed.data.confirmEmail !== user.email) {
      return NextResponse.json(
        { error: "L'adresse email de confirmation n'est pas exacte." },
        { status: 400 }
      );
    }

    // 1) Suppression locale (cascade Prisma sur toutes les données liées).
    await db.user.delete({ where: { id: currentUser.id } });

    // 2) Tokens de vérification / réinitialisation indexés sur l'email
    //    (pas de clé étrangère ⇒ pas de cascade).
    try {
      await db.verificationToken.deleteMany({
        where: { identifier: user.email },
      });
    } catch (error) {
      console.error(
        "Account delete: suppression des tokens de vérification impossible (non bloquant)",
        error
      );
    }

    // 3) Stripe en best-effort : un échec est journalisé mais ne bloque
    //    jamais la suppression déjà effectuée côté local.
    if (isStripeConfigured && user.stripeCustomerId) {
      await cleanupStripeCustomer(user.stripeCustomerId);
    }

    // `signOut` n'est pas proprement exécutable côté API : le client
    // déconnecte la session et redirige vers l'accueil.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account delete error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du compte" },
      { status: 500 }
    );
  }
});
