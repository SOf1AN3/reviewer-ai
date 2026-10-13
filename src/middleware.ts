import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const locales = ["fr", "en", "ar"];
const defaultLocale = "fr";

function getLocaleFromCookie(request: NextRequest): string | null {
  const cookie = request.cookies.get("NEXT_LOCALE");
  if (cookie && locales.includes(cookie.value)) {
    return cookie.value;
  }
  return null;
}

function getLocaleFromAcceptLanguage(request: NextRequest): string | null {
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return null;
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
  if (preferred && locales.includes(preferred)) {
    return preferred;
  }
  return null;
}

// --- Rate limiting des routes API -------------------------------------------

type ApiRateLimitRule = {
  /** Préfixe de la clé interne (construite par l'app, jamais par le client). */
  name: string;
  limit: number;
  windowSec: number;
};

const RULE_ANALYZE: ApiRateLimitRule = { name: "analyze", limit: 5, windowSec: 60 };
const RULE_REGISTER: ApiRateLimitRule = { name: "register", limit: 3, windowSec: 60 };
const RULE_UPLOAD: ApiRateLimitRule = { name: "upload", limit: 10, windowSec: 60 };
const RULE_STRIPE: ApiRateLimitRule = { name: "stripe", limit: 5, windowSec: 3600 };
const RULE_API_READ: ApiRateLimitRule = { name: "api-read", limit: 60, windowSec: 60 };
const RULE_API_WRITE: ApiRateLimitRule = { name: "api-write", limit: 30, windowSec: 60 };

/**
 * Routes jamais limitées :
 * - `/api/stripe/webhook` : la vérification de signature Stripe doit toujours
 *   s'exécuter (un 429 en amont casserait le paiement) ;
 * - `/api/auth/[...nextauth]` (session, signin, signout, callbacks OAuth…)
 *   sauf `/api/auth/register` qui possède sa propre limite.
 */
function isRateLimitExempt(pathname: string): boolean {
  if (pathname === "/api/stripe/webhook") return true;
  if (pathname.startsWith("/api/auth/") && pathname !== "/api/auth/register") {
    return true;
  }
  return false;
}

function resolveApiRateLimitRule(
  pathname: string,
  method: string
): ApiRateLimitRule {
  if (method === "POST") {
    if (pathname === "/api/analyze") return RULE_ANALYZE;
    if (pathname === "/api/auth/register") return RULE_REGISTER;
    if (pathname === "/api/upload") return RULE_UPLOAD;
    if (
      pathname === "/api/stripe/checkout" ||
      pathname === "/api/stripe/portal"
    ) {
      return RULE_STRIPE;
    }
    return RULE_API_WRITE;
  }
  if (method === "GET" || method === "HEAD") return RULE_API_READ;
  return RULE_API_WRITE; // PUT, PATCH, DELETE…
}

/** Première IP de `x-forwarded-for`, sinon `x-real-ip`, sinon `localhost`. */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }
  return "localhost";
}

/** borne la longueur d'une partie de clé (ex. IP). */
function sanitizeKeyPart(value: string): string {
  return value.slice(0, 64);
}

async function handleApiRateLimit(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isRateLimitExempt(pathname)) {
    return NextResponse.next();
  }

  const method = request.method.toUpperCase();
  const rule = resolveApiRateLimitRule(pathname, method);

  // Clé uniquement basée sur l'IP : jamais dérivée d'un cookie/header client,
  // sinon un attaquant pourrait changer de seau à chaque requête (bypass).
  // Le contrôle d'authentification et de quota réel est fait côté route API.
  const scope = `ip:${sanitizeKeyPart(getClientIp(request))}`;

  const result = await rateLimit({
    key: `${rule.name}:${scope}`,
    limit: rule.limit,
    windowSec: rule.windowSec,
  });

  if (!result.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.resetAt - Date.now()) / 1000)
    );
    return NextResponse.json(
      { error: "Trop de requêtes", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000))
  );
  return response;
}

// --- Point d'entrée ----------------------------------------------------------

export async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1) Routes API : rate limiting (la redirection i18n ne s'applique pas).
  //    Détection exacte (évite les faux positifs du type `/apiary`, `/apidocs`).
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return handleApiRateLimit(request);
  }

  // 2) Assets et fichiers statiques : aucun traitement.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  // 3) Pages : redirection i18n (fr / en / ar).
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  const cookieLocale = getLocaleFromCookie(request);
  const acceptLocale = getLocaleFromAcceptLanguage(request);
  const locale = cookieLocale || acceptLocale || defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
