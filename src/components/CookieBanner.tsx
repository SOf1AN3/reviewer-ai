"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { getDictionary } from "@/lib/i18n";

/**
 * Clé `localStorage` mémorisant la fermeture du bandeau. Elle ne stocke
 * qu'un booléen (« l'utilisateur a refermé l'information »), aucune donnée
 * personnelle, et n'est PAS un cookie.
 */
const DISMISSED_STORAGE_KEY = "papernote-cookie-notice-dismissed";

/** Abonnement vide : la visibilité n'est pilotée par aucun système externe. */
function subscribeNoop(): () => void {
  return () => {};
}

/**
 * Lecture du `localStorage` (client uniquement). Retourne `true` si le
 * bandeau a déjà été refermé. Valeur stabilisée par `useSyncExternalStore`
 * (primitif `string | null` → rendu stable tant que la valeur ne change pas).
 */
function getDismissedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY) === "1";
  } catch {
    // `localStorage` indisponible (mode privé restrictif) : jamais fermé.
    return false;
  }
}

/** Snapshot serveur : le bandeau n'est jamais rendu côté serveur. */
function getDismissedServerSnapshot(): boolean {
  return false;
}

/**
 * Bandeau d'information cookies (T6.3).
 *
 * Décision assumée : le site n'utilise AUCUN cookie tiers ni traceur
 * (uniquement des cookies techniques exemptés, cf. /[locale]/legal/cookies).
 * Aucun consentement n'est donc requis (art. 82 loi Informatique et Libertés).
 * Ce bandeau est donc purement INFORMATIF :
 * - aucun bouton « J'accepte » (il n'y a rien à accepter) ;
 * - fermeture simple (bouton « Fermer »), mémorisée en `localStorage` pour
 *   ne plus réafficher le bandeau par la suite ;
 * - rendu différé via `useSyncExternalStore` (snapshot serveur `false`,
 *   puis snapshot client après hydratation) : aucun mismatch serveur/client,
 *   aucun flash, et conforme à la règle lint `react-hooks/set-state-in-effect`
 *   (même pattern que ThemeProvider).
 *
 * Accessibilité : zone `role="status"` avec lien focusable au clavier,
 * bouton de fermeture libellé via `aria-label`.
 */
export function CookieBanner() {
  const { locale } = useI18n();
  const dict = getDictionary(locale);
  const dismissedExternally = useSyncExternalStore(
    subscribeNoop,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );
  // État local pour la fermeture courante : `localStorage` est mis à jour en
  // best-effort, l'état local garantit la fermeture immédiate à l'écran.
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const dismiss = () => {
    setDismissedLocally(true);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // Mémorisation best-effort : la fermeture reste effective à l'écran.
    }
  };

  if (dismissedExternally || dismissedLocally) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-border bg-card"
    >
      <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm">
          <Cookie
            className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">
            {dict.legal.cookies.message}{" "}
            <Link
              href={`/${locale}/legal/cookies`}
              className="font-bold text-foreground underline underline-offset-4"
            >
              {dict.legal.cookies.learnMore}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="pn-btn-secondary pn-btn shrink-0 self-start px-3 py-2 text-xs sm:self-auto"
          aria-label={dict.legal.cookies.dismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          {dict.legal.cookies.dismiss}
        </button>
      </div>
    </div>
  );
}
