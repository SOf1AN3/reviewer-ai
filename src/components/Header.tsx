"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useI18n } from "./I18nProvider";
import { locales, type Locale } from "@/lib/i18n";

const localeLabels: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
};

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { locale, setLocale } = useI18n();

  return (
    <header className="border-b-[3px] border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold uppercase tracking-wider"
        >
          <div className="flex items-center justify-center bg-secondary px-2 sm:px-3 py-1 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
            <FlaskConical className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
          </div>
          <span>PaperNote</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-2">
          {session ? (
            <>
              <Link
                href={`/${locale}/analyser`}
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
              >
                {locale === "fr" ? "Analyser" : locale === "en" ? "Analyze" : "تحليل"}
              </Link>
              <Link
                href={`/${locale}/historique`}
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
              >
                {locale === "fr" ? "Historique" : locale === "en" ? "History" : "السجل"}
              </Link>
              <div className="mx-2 h-6 w-px bg-border" />
              <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                className="brutal-btn-destructive brutal-btn px-3 py-2 text-xs flex items-center gap-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/${locale}/login`}
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs flex items-center gap-1"
              >
                <LogIn className="h-4 w-4" />
                {locale === "fr" ? "Connexion" : locale === "en" ? "Login" : "دخول"}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="brutal-btn px-4 py-2 text-xs"
              >
                {locale === "fr" ? "Inscription" : locale === "en" ? "Sign Up" : "تسجيل"}
              </Link>
            </>
          )}

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="brutal-btn px-3 py-2 text-xs flex items-center gap-1"
              aria-label="Change language"
            >
              <Globe className="h-4 w-4" />
              <span>{localeLabels[locale]}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 border-2 border-border bg-card shadow-[4px_4px_0px_var(--border)]">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLocale(l);
                      setLangOpen(false);
                    }}
                    className={`block w-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-secondary transition-colors ${
                      locale === l ? "bg-secondary text-foreground" : "text-muted-foreground"
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
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Changer de thème"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </nav>

        {/* Mobile: theme toggle + language + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Change language"
          >
            <Globe className="h-4 w-4" />
          </button>
          {langOpen && (
            <div className="absolute right-12 top-14 z-50 border-2 border-border bg-card shadow-[4px_4px_0px_var(--border)]">
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLocale(l);
                    setLangOpen(false);
                  }}
                  className={`block w-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-secondary transition-colors ${
                    locale === l ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {localeLabels[l]}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Changer de thème"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t-[3px] border-border bg-card">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-4">
            {session ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href={`/${locale}/analyser`}
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm text-center"
                >
                  {locale === "fr" ? "Analyser" : locale === "en" ? "Analyze" : "تحليل"}
                </Link>
                <Link
                  href={`/${locale}/historique`}
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm text-center"
                >
                  {locale === "fr" ? "Historique" : locale === "en" ? "History" : "السجل"}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: `/${locale}/login` });
                  }}
                  className="brutal-btn-destructive brutal-btn px-4 py-3 text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {locale === "fr" ? "Déconnexion" : locale === "en" ? "Logout" : "خروج"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/${locale}/login`}
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  {locale === "fr" ? "Connexion" : locale === "en" ? "Login" : "دخول"}
                </Link>
                <Link
                  href={`/${locale}/register`}
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn px-4 py-3 text-sm text-center"
                >
                  {locale === "fr" ? "Inscription" : locale === "en" ? "Sign Up" : "تسجيل"}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
