/**
 * src/app/api/health/route.ts — Endpoint de santé (public, sans donnée sensible).
 *
 * GET /api/health →
 *   { status: "ok" | "degraded", uptimeSec, version, db: "up" | "down", timestamp }
 *
 * Choix d'implémentation (documentés) :
 * - HTTP 200 si la DB répond, HTTP 503 si elle est injoignable : le 503 est
 *   le standard des health checks (load balancers, Kubernetes, moniteurs
 *   d'uptime le comprennent nativement). Le corps JSON reste identique et
 *   lisible dans les deux cas.
 * - La vérification DB est RÉELLE (`SELECT 1` via requête préparée Prisma),
 *   bornée à 2 s pour ne jamais suspendre la route indéfiniment.
 * - Aucune donnée interne exposée : ni message d'erreur DB brute, ni
 *   variable d'environnement, ni version de stack. `version` est la version
 *   applicative (package.json), pas la version de framework.
 * - Les métriques (src/lib/metrics.ts) ne sont PAS exposées ici : cet
 *   endpoint est NON authentifié et les séries peuvent porter des labels
 *   dérivés d'un userId. Elles seront lues plus tard via une route admin
 *   dédiée (auth+role), pas via ce health check.
 * - Rate limiting : `/api/health` tombe sur la règle `api-read` du
 *   middleware (60 req/min/IP) — acceptable pour un health check.
 * - Le logger (`logEvent` niveau "warn") trace un incident de santé sans
 *   fuite de détail interne.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import packageJson from "../../../../package.json";

/** Délai maximal d'une sonde DB avant de conclure « down ». */
const DB_PROBE_TIMEOUT_MS = 2000;

type HealthStatus = "ok" | "degraded";
type DbStatus = "up" | "down";

type HealthPayload = {
  status: HealthStatus;
  uptimeSec: number;
  version: string;
  db: DbStatus;
  timestamp: string;
};

/**
 * Sonde DB légère : `SELECT 1` via tagged template Prisma (requête
 * préparée, aucune interpolation de chaîne). Timeout 2 s → considéré « down ».
 */
async function checkDatabase(): Promise<boolean> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<false>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(false), DB_PROBE_TIMEOUT_MS);
    });
    const probe = db.$queryRaw`SELECT 1`.then(
      (): true => true,
      (): false => false
    );
    return await Promise.race([probe, timeout]);
  } catch {
    return false;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function GET(): Promise<NextResponse<HealthPayload>> {
  let dbUp = false;
  try {
    dbUp = await checkDatabase();
  } catch {
    dbUp = false;
  }

  const status: HealthStatus = dbUp ? "ok" : "degraded";

  if (!dbUp) {
    // Journalisé côté serveur uniquement ; aucun détail interne en réponse.
    logEvent("health_check", { db: "down" }, "warn");
  }

  const payload: HealthPayload = {
    status,
    uptimeSec: Math.round(process.uptime()),
    version: packageJson.version,
    db: dbUp ? "up" : "down",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: dbUp ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
