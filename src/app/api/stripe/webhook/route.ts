import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import type Stripe from "stripe";
import {
  customerIdOf,
  isPlanKey,
  recordInvoice,
  resolveUserIdFromCustomer,
  syncSubscriptionFromStripe,
} from "@/lib/stripe-sync";

/**
 * Webhook Stripe — idempotent et exhaustif.
 *
 * Ordre impératif (aucune écriture avant le verrou de signature) :
 *   1. lecture du body brut + `constructEvent` (400 si signature invalide) ;
 *   2. insertion d'une ligne `WebhookEvent` — l'unicité de `stripeEventId`
 *      sert de verrou d'idempotence (voir « Verrou » ci-dessous) ;
 *   3. traitement de l'event ;
 *   4. `processedAt = now()` ⇒ 200 `{ received: true }`.
 *
 * Invariant : **200 ⇔ `processedAt != null`** (pour les events gérés).
 *   - Ligne déjà présente AVEC `processedAt` → 200 `duplicate` (traité).
 *   - Ligne déjà présente SANS `processedAt` (crash en cours de traitement,
 *     ex. pendant un appel réseau `stripe.subscriptions.retrieve`) :
 *     - créée depuis plus de `LOCK_TTL_MS` (30 s) → « takeover » péremptionné :
 *       on retraite l'event (at-least-once) ;
 *     - sinon un traitement est probablement en cours → 500 (Stripe rejoue).
 *
 * Stratégie d'échec : si le traitement échoue de façon rejouable (`retry`),
 * la ligne est SUPPRIMÉE (`releaseLock`) puis un 500 est renvoyé — le prochain
 * rejeu de Stripe réinsère la ligne et retraite réellement l'event.
 * Ce nettoyage n'est PLUS le seul mécanisme : s'il échoue silencieusement,
 * la ligne orpheline (sans `processedAt`) est reprise par le takeover
 * péremptionné au rejeu suivant. Un event ne peut donc plus être « perdu »
 * par un 200 servi à tort sur un verrou non corrélé à `processedAt`.
 * `processedAt` EST le marqueur de « traité avec succès » (et non un simple
 * audit : il décide de la réponse 200).
 *
 * Ce handler est volontairement EXEMPT d'auth applicative : l'authenticité
 * du payload est prouvée par la signature HMAC Stripe.
 */

/** Événements réellement traités — les autres sont acquittés en 200. */
function isHandledEvent(type: string): boolean {
  switch (type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "customer.subscription.trial_will_end":
      return true;
    default:
      return false;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function errorTag(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN";
}

/**
 * Délai au-delà duquel un verrou `WebhookEvent` abandonné (ligné sans
 * `processedAt`, ex. crash en pleine fenêtre réseau) peut être repris.
 */
const LOCK_TTL_MS = 30_000;

/** Convertit un timestamp Unix Stripe (secondes) en `Date`, ou `null`. */
function toUtcDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : null;
}

/** Résout `session.subscription` (souvent transmis sous forme d'ID). */
async function resolveCheckoutSubscription(
  ref: string | Stripe.Subscription | null
): Promise<Stripe.Subscription | null> {
  if (!ref) {
    return null;
  }
  if (typeof ref !== "string") {
    return ref;
  }
  return stripe.subscriptions.retrieve(ref);
}

/**
 * Issue de la résolution d'un verrou déjà présent (violation `P2002`).
 * - `processed` : la ligne existe avec `processedAt` → 200 (invariant tenu) ;
 * - `busy`      : traitement en cours ou état indécidable → 500 (Stripe rejoue) ;
 * - `takeover`  : verrou péremptionné sans `processedAt` → on retraite l'event.
 */
type LockResolution =
  | { kind: "processed" }
  | { kind: "busy" }
  | { kind: "takeover"; rowId: string };

/**
 * Analyse la ligne de verrou existante après un `P2002`.
 *
 * C'est ICI que `processedAt` corrèle la réponse 200 : une ligne sans
 * `processedAt` (traitement interrompu) n'est JAMAIS acquittée en 200 — elle
 * est soit reprise (`takeover` après `LOCK_TTL_MS`), soit refusée en 500.
 */
async function resolveExistingLock(
  event: Stripe.Event
): Promise<LockResolution> {
  let row: { id: string; processedAt: Date | null } | null;
  try {
    row = await db.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, processedAt: true },
    });
  } catch (error) {
    console.error("[stripe-webhook] Lecture du verrou impossible.", {
      eventId: event.id,
      code: errorTag(error),
    });
    return { kind: "busy" };
  }

  if (!row) {
    // Ligne disparue entre-temps (`releaseLock` concurrent) : rejouable.
    return { kind: "busy" };
  }

  if (row.processedAt !== null) {
    // Invariant tenu : traité → 200, Stripe cesse ses rejeux.
    return { kind: "processed" };
  }

  // Takeover péremptionné : l'écriture est volontairement neutre
  // (`processedAt` exige déjà `null` dans le `where`) — elle sert de verrou
  // atomique : PostgreSQL verrouille la ligne, ré-évalue le `where` (dont
  // l'âge `createdAt < now - 30 s`) et ne compte la ligne QUE si elle est
  // toujours abandonnée. `count !== 1` ⇒ un autre worker est en cours → 500.
  try {
    const takeover = await db.webhookEvent.updateMany({
      where: {
        id: row.id,
        processedAt: null,
        createdAt: { lt: new Date(Date.now() - LOCK_TTL_MS) },
      },
      data: { processedAt: null },
    });
    if (takeover.count === 1) {
      return { kind: "takeover", rowId: row.id };
    }
  } catch (error) {
    console.error("[stripe-webhook] Takeover du verrou impossible.", {
      eventId: event.id,
      code: errorTag(error),
    });
  }
  return { kind: "busy" };
}

/**
 * Remise à zéro du quota à l'upgrade — écriture CONDITIONNELLE et convergente.
 *
 * Contrairement à une écriture inconditionnelle `analysesThisMonth: 0`
 * (interdite par `src/lib/plan.ts` : elle écraserait un compteur fraîchement
 * incrémenté et SERAIT RE-CRÉDITÉE à chaque rejeu de Stripe), cette écriture
 * n'a lieu QUE si `analysesResetAt` est nul ou antérieur à `reference`
 * (période payante issue de Stripe), et elle pose `analysesResetAt = reference`
 * (pas « maintenant »). Un rejeu retrouve `analysesResetAt == reference` →
 * `count = 0` → aucune écriture → compteur préservé.
 */
async function resetQuotaOnUpgrade(
  userId: string,
  reference: Date
): Promise<void> {
  await db.user.updateMany({
    where: {
      id: userId,
      OR: [{ analysesResetAt: null }, { analysesResetAt: { lt: reference } }],
    },
    data: { analysesThisMonth: 0, analysesResetAt: reference },
  });
}

/**
 * Issue du traitement d'un event.
 * - `ok`       : appliqué → `processedAt` + 200 ;
 * - `retry`    : échec transitoire → suppression du verrou + 500 (Stripe rejoue) ;
 * - `permanent`: échec non rejouable (payload incomplet) → 200 pour ne pas
 *                gaspiller les rejeux de Stripe sur une condition définitive.
 */
type ProcessOutcome = "ok" | "retry" | "permanent";

/** Traduit un `SyncResult` en issue de traitement. */
function outcomeOf(
  result: { ok: boolean; code?: string },
  eventId: string,
  label: string
): ProcessOutcome {
  if (result.ok) {
    return "ok";
  }
  console.error(`[stripe-webhook] ${label} refusé.`, {
    eventId,
    code: result.code,
  });
  // `invalid_payload` : rejouer produirait exactement la même erreur.
  return result.code === "invalid_payload" ? "permanent" : "retry";
}

/** Traite un event. */
async function processEvent(event: Stripe.Event): Promise<ProcessOutcome> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) {
        // Metadata absente : rejouer ne la fera pas apparaître.
        console.error(
          "[stripe-webhook] checkout.session.completed sans metadata.userId — abandonné."
        );
        return "permanent";
      }

      const subscription = await resolveCheckoutSubscription(
        session.subscription
      );

      if (subscription) {
        const hint = session.metadata?.plan;
        const result = await syncSubscriptionFromStripe(subscription, userId, {
          planHint: isPlanKey(hint) ? hint : undefined,
        });
        const outcome = outcomeOf(result, event.id, "Sync de l'abonnement");
        if (outcome !== "ok") {
          return outcome;
        }

        // Remise à zéro du quota à l'upgrade — CONDITIONNELLE (M2) : la
        // référence est la période payante (`currentPeriodStart`), ce qui rend
        // l'écriture convergente sur rejeu et interdit tout re-crédit.
        const periodStart = toUtcDate(
          subscription.items.data[0]?.current_period_start
        );
        const reference = periodStart ?? toUtcDate(session.created);
        if (reference) {
          await resetQuotaOnUpgrade(userId, reference);
        }
        return "ok";
      }

      // Fallback sans abonnement (paiement non récurrent / session anormale).
      const plan = session.metadata?.plan;
      if (!isPlanKey(plan) || plan === "free") {
        console.error(
          "[stripe-webhook] checkout.session.completed sans abonnement ni plan valide — abandonné.",
          { eventId: event.id }
        );
        return "permanent";
      }

      const updated = await db.user.updateMany({
        where: { id: userId },
        data: { plan },
      });
      if (updated.count === 0) {
        // `userId` inexistant : rejouer ne le fera pas apparaître.
        console.error(
          "[stripe-webhook] Utilisateur introuvable pour la session de checkout.",
          { eventId: event.id }
        );
        return "permanent";
      }

      // Remise à zéro du quota — CONDITIONNELLE (M2) : sans abonnement, la
      // référence est la création de la session ; l'écriture n'a lieu que si
      // `analysesResetAt` lui est antérieur → aucun re-crédit sur rejeu.
      const sessionCreatedAt = toUtcDate(session.created);
      if (sessionCreatedAt) {
        await resetQuotaOnUpgrade(userId, sessionCreatedAt);
      }
      return "ok";
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = customerIdOf(subscription.customer);
      const userId = customerId ? await resolveUserIdFromCustomer(customerId) : null;
      if (!userId) {
        // Customer non lié / lecture en échec : rejouable (at-least-once).
        console.error("[stripe-webhook] Customer introuvable.", {
          eventId: event.id,
          type: event.type,
        });
        return "retry";
      }

      // `customer.subscription.deleted` arrive avec `status: "canceled"` :
      // `planForSubscription` rétrograde alors `User.plan` vers `free`.
      const result = await syncSubscriptionFromStripe(subscription, userId);
      return outcomeOf(result, event.id, "Sync de l'abonnement");
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = customerIdOf(invoice.customer);
      const userId = customerId ? await resolveUserIdFromCustomer(customerId) : null;
      if (!userId) {
        console.error("[stripe-webhook] Customer introuvable pour la facture.", {
          eventId: event.id,
          type: event.type,
        });
        return "retry";
      }

      const result = await recordInvoice(invoice, userId);
      const outcome = outcomeOf(result, event.id, "Facture");
      if (outcome !== "ok") {
        return outcome;
      }

      if (event.type === "invoice.payment_failed") {
        // Décision documentée (stripe-sync.ts) : PAS de rétrogradation sur un
        // échec transitoire. On synchronise uniquement le statut de l'abonnement
        // (`past_due`) pour traçabilité ; `User.plan` est conservé tant que le
        // statut n'est pas `unpaid` / `canceled` / `incomplete_expired`.
        const subRef = invoice.parent?.subscription_details?.subscription;
        if (subRef) {
          const subscription =
            typeof subRef === "string"
              ? await stripe.subscriptions.retrieve(subRef)
              : subRef;
          // M1 : le résultat NE DOIT PLUS être ignoré — un sync en échec doit
          // repartir en `retry` (libération du verrou + 500) plutôt que de se
          // voir infliger `processedAt` (et donc un 200) à tort.
          const syncResult = await syncSubscriptionFromStripe(
            subscription,
            userId
          );
          const syncOutcome = outcomeOf(
            syncResult,
            event.id,
            "Sync de l'abonnement (paiement échoué)"
          );
          if (syncOutcome !== "ok") {
            return syncOutcome;
          }
        }
      }
      return "ok";
    }

    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object;
      const customerId = customerIdOf(subscription.customer);
      const userId = customerId ? await resolveUserIdFromCustomer(customerId) : null;
      if (!userId) {
        console.error("[stripe-webhook] Customer introuvable (fin d'essai).", {
          eventId: event.id,
        });
        return "retry";
      }

      // Trace interne uniquement — aucun envoi d'email dans ce périmètre.
      // M3 : écriture idempotentée sur (type + subscriptionId) — un rejeu de
      // Stripe ne crée pas de doublon (le verrou `WebhookEvent` sérialise les
      // rejeux d'un même event, la garde couvre les events distincts).
      const alreadyTraced = await db.usageEvent.findFirst({
        where: {
          userId,
          type: "subscription.trial_will_end",
          metadata: { path: ["subscriptionId"], equals: subscription.id },
        },
        select: { id: true },
      });
      if (!alreadyTraced) {
        await db.usageEvent.create({
          data: {
            userId,
            type: "subscription.trial_will_end",
            metadata: {
              subscriptionId: subscription.id,
              trialEnd: subscription.trial_end,
              status: subscription.status,
            },
          },
        });
      }
      return "ok";
    }

    default:
      // Event inconnu : traité (200) pour ne pas faire rejouer Stripe inutilement.
      return "ok";
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Signature : le tout premier verrou, avant toute écriture DB. ------
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Jamais d'écriture possible tant que le secret n'est pas configuré.
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET absente.");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (!isHandledEvent(event.type)) {
    // Event inconnu : acquitté en 200 (aucune écriture) pour ne pas forcer
    // Stripe à rejouer inutilement.
    return NextResponse.json({ received: true });
  }

  // --- 2. Idempotence : verrou par unicité de `stripeEventId`. --------------
  let rowId: string;
  try {
    const row = await db.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
    rowId = row.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Ligne déjà présente : la réponse est déterminée par `processedAt`
      // (invariant 200 ⇔ `processedAt != null`), jamais par la simple
      // existence de la ligne.
      const lock = await resolveExistingLock(event);
      if (lock.kind === "processed") {
        // Déjà traité : 200 pour stopper les rejeux.
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (lock.kind === "takeover") {
        // Verrou abandonné depuis > 30 s : on retraite l'event (at-least-once).
        rowId = lock.rowId;
      } else {
        // Traitement probablement en cours → Stripe rejouera.
        return NextResponse.json(
          { error: "Traitement du webhook déjà en cours" },
          { status: 500 }
        );
      }
    } else {
      console.error("[stripe-webhook] Impossible d'enregistrer l'event.", {
        eventId: event.id,
        type: event.type,
        code: errorTag(error),
      });
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
  }

  // --- 3. Traitement. --------------------------------------------------------
  // Suppression du verrou en cas d'échec rejouable — le MÉCANISME PRIMAIRE de
  // reprise, mais PAS le seul : si ce nettoyage échoue silencieusement, la
  // ligne orpheline (sans `processedAt`) est reprise par le takeover
  // péremptionné (`resolveExistingLock`, 30 s) au rejeu suivant de Stripe.
  const releaseLock = async (): Promise<void> => {
    await db.webhookEvent.delete({ where: { id: rowId } }).catch((err: unknown) => {
      console.error("[stripe-webhook] Nettoyage de l'event impossible.", {
        eventId: event.id,
        code: errorTag(err),
      });
    });
  };

  try {
    const outcome = await processEvent(event);

    if (outcome !== "ok") {
      // `retry`      → on libère le verrou pour que Stripe rejoue (500).
      // `permanent`  → on marque comme traité : rejouer ne changerait rien.
      if (outcome === "retry") {
        await releaseLock();
        return NextResponse.json(
          { error: "Erreur lors du traitement du webhook" },
          { status: 500 }
        );
      }
      await db.webhookEvent.update({
        where: { id: rowId },
        data: { processedAt: new Date() },
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    // --- 4. Marquage « traité ». --------------------------------------------
    await db.webhookEvent.update({
      where: { id: rowId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", errorTag(error), {
      eventId: event.id,
      type: event.type,
    });

    // Même stratégie : supprimer la ligne pour rendre le rejeu possible
    // (et, à défaut de nettoyage effectif, takeover péremptionné au rejeu).
    await releaseLock();

    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook" },
      { status: 500 }
    );
  }
}
