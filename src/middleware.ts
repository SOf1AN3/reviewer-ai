import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
