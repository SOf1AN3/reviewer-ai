"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  FlaskConical,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Menu,
  X,
  Globe,
  CreditCard,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useI18n } from "./I18nProvider";
import { locales, type Locale, getDictionary } from "@/lib/i18n";

const localeLabels: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
};

/** Style « ghost » discret partagé par tous les liens de navigation (desktop). */
const GHOST_LINK =
  "rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:text-cream-text";

/** Bouton rond en verre (langue mobile, thème, hamburger). */
const GLASS_ICON_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full border border-glass-border bg-surface-glass text-on-surface-variant transition-colors hover:text-cream-text";

/** Sélecteur de langue en pilule (desktop). */
const LANG_TRIGGER =
  "flex h-9 items-center gap-1.5 rounded-full border border-glass-border bg-surface-glass px-3 text-xs font-medium text-on-surface-variant transition-colors hover:text-cream-text";

/** Panneau glass du déroulant de langue. */
const LANG_PANEL =
  "absolute end-0 top-full z-50 mt-1 rounded-xl border border-glass-border bg-surface-container-high p-1 shadow-2xl";

/** Variante du panneau ancrée au bouton de langue du menu mobile. */
const LANG_PANEL_MOBILE =
  "absolute end-12 top-14 z-50 rounded-xl border border-glass-border bg-surface-container-high p-1 shadow-2xl";

/** Une option du sélecteur de langue. */
const LANG_OPTION = "block w-full rounded-lg px-3 py-2 text-start text-sm transition-colors";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { locale, setLocale } = useI18n();
  const dict = getDictionary(locale);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const pathname = usePathname();

  /** Les ancres de la landing ne s'affichent que sur la page d'accueil. */
  const isHome = pathname === `/${locale}` || pathname === "/";

  useEffect(() => {
    if (session) {
      fetch("/api/user/plan")
        .then((res) => res.json())
        .then((data) => setUserPlan(data.plan))
        .catch(() => {});
    }
  }, [session]);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-glass-border bg-surface-glass backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sage">
            <FlaskConical className="h-5 w-5 text-teal-highlight" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-cream-text">
            PaperNote
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {!session && isHome && (
            <>
              <a href="#features" className={GHOST_LINK}>
                {dict.home.footer.nav.features}
              </a>
              <a href="#comparison" className={GHOST_LINK}>
                {dict.home.footer.nav.comparison}
              </a>
              <a href="#pricing" className={GHOST_LINK}>
                {dict.home.footer.nav.pricing}
              </a>
            </>
          )}

          {session ? (
            <>
              <Link href={`/${locale}/analyser`} className={GHOST_LINK}>
                {dict.header.analyze}
              </Link>
              <Link href={`/${locale}/historique`} className={GHOST_LINK}>
                {dict.header.history}
              </Link>
              <Link
                href={`/${locale}/pricing`}
                className={`${GHOST_LINK} flex items-center gap-1`}
              >
                <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                {userPlan && userPlan !== "free"
                  ? userPlan.toUpperCase()
                  : dict.header.upgrade}
              </Link>
              <Link href={`/${locale}/settings/profile`} className={GHOST_LINK}>
                {dict.header.profile}
              </Link>
              <Link href={`/${locale}/settings/billing`} className={GHOST_LINK}>
                {dict.header.billing}
              </Link>
              <div className="mx-2 h-6 w-px bg-glass-border" />
              <span className="max-w-[10rem] truncate text-xs text-cream-muted">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                className="pn-btn-destructive pn-btn px-3 py-2 text-xs"
                aria-label={dict.header.logout}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link href={`/${locale}/login`} className={GHOST_LINK}>
                {dict.header.login}
              </Link>
              <Link href={`/${locale}/register`} className="pn-btn px-4 py-2 text-sm">
                {dict.header.register}
              </Link>
            </>
          )}

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className={LANG_TRIGGER}
              aria-label={dict.header.changeLanguage}
              aria-expanded={langOpen}
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span>{localeLabels[locale]}</span>
            </button>
            {langOpen && (
              <div className={LANG_PANEL}>
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLocale(l);
                      setLangOpen(false);
                    }}
                    className={`${LANG_OPTION} ${
                      l === locale
                        ? "bg-surface-sage text-teal-highlight"
                        : "text-on-surface-variant hover:bg-surface-sage/40"
                    }`}
                  >
                    {localeLabels[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className={GLASS_ICON_BTN}
            aria-label={dict.header.toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </nav>

        {/* Mobile: language + theme + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className={GLASS_ICON_BTN}
            aria-label={dict.header.changeLanguage}
            aria-expanded={langOpen}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
          </button>
          {langOpen && (
            <div className={LANG_PANEL_MOBILE}>
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLocale(l);
                    setLangOpen(false);
                  }}
                  className={`${LANG_OPTION} ${
                    l === locale
                      ? "bg-surface-sage text-teal-highlight"
                      : "text-on-surface-variant hover:bg-surface-sage/40"
                  }`}
                >
                  {localeLabels[l]}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className={GLASS_ICON_BTN}
            aria-label={dict.header.toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={GLASS_ICON_BTN}
            aria-label={dict.header.menu}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="border-b border-glass-border bg-surface-glass backdrop-blur-xl md:hidden">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-4">
            {session ? (
              <>
                <span className="mb-2 truncate text-xs text-cream-muted">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href={`/${locale}/analyser`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  {dict.header.analyze}
                </Link>
                <Link
                  href={`/${locale}/historique`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  {dict.header.history}
                </Link>
                <Link
                  href={`/${locale}/pricing`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  {userPlan && userPlan !== "free"
                    ? userPlan.toUpperCase()
                    : dict.header.upgrade}
                </Link>
                <Link
                  href={`/${locale}/settings/profile`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  {dict.header.profile}
                </Link>
                <Link
                  href={`/${locale}/settings/billing`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  {dict.header.billing}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: `/${locale}/login` });
                  }}
                  className="pn-btn-destructive pn-btn w-full py-3 text-sm"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {dict.header.logout}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/${locale}/login`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn pn-btn-secondary w-full py-3 text-sm"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  {dict.header.login}
                </Link>
                <Link
                  href={`/${locale}/register`}
                  onClick={() => setMobileOpen(false)}
                  className="pn-btn w-full py-3 text-sm"
                >
                  {dict.header.register}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
