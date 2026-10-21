"use client";

import Link from "next/link";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { getDictionary } from "@/lib/i18n";

/** Style « ghost » partagé par tous les liens du pied de page. */
const FOOTER_LINK =
  "text-sm text-on-surface-variant transition-colors hover:text-cream-text";

/** Titre de colonne, façon label mono du design system. */
const FOOTER_TITLE =
  "font-mono text-[11px] uppercase tracking-[0.04em] text-cream-muted";

export function Footer() {
  const { locale } = useI18n();
  const dict = getDictionary(locale);

  return (
    <footer className="border-t border-glass-border bg-surface-container-lowest">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Colonne 1 : marque */}
          <div className="flex flex-col gap-3">
            <Link href={`/${locale}`} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sage">
                <FlaskConical className="h-5 w-5 text-teal-highlight" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-cream-text">
                PaperNote
              </span>
            </Link>
            <p className="max-w-xs text-sm text-cream-muted">
              {dict.home.footer.tagline}
            </p>
          </div>

          {/* Colonne 2 : navigation */}
          <nav aria-label={dict.home.footer.navTitle} className="flex flex-col gap-3">
            <h2 className={FOOTER_TITLE}>{dict.home.footer.navTitle}</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href={`/${locale}#features`} className={FOOTER_LINK}>
                  {dict.home.footer.nav.features}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#comparison`} className={FOOTER_LINK}>
                  {dict.home.footer.nav.comparison}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#pricing`} className={FOOTER_LINK}>
                  {dict.home.footer.nav.pricing}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/login`} className={FOOTER_LINK}>
                  {dict.home.footer.nav.login}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/register`} className={FOOTER_LINK}>
                  {dict.home.footer.nav.register}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Colonne 3 : légal */}
          <nav aria-label={dict.home.footer.legalTitle} className="flex flex-col gap-3">
            <h2 className={FOOTER_TITLE}>{dict.home.footer.legalTitle}</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href={`/${locale}/legal/terms`} className={FOOTER_LINK}>
                  {dict.legal.nav.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal/privacy`} className={FOOTER_LINK}>
                  {dict.legal.nav.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal/cookies`} className={FOOTER_LINK}>
                  {dict.legal.nav.cookies}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Ligne basse */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-glass-border pt-6 text-xs text-cream-muted md:flex-row">
          <p className="md:text-start">{dict.home.footer.rights}</p>
          <p className="flex items-center gap-1.5 text-center md:text-end">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-highlight" aria-hidden="true" />
            {dict.home.footer.aiDisclaimer}
          </p>
        </div>
      </div>
    </footer>
  );
}
