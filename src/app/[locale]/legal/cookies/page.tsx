import type { Metadata } from "next";
import Link from "next/link";

// TODO(i18n) : le contenu légal est rédigé en français et affiché tel quel
// dans les trois locales (FR, EN, AR). Une traduction complète des textes
// juridiques sera portée par une tâche dédiée ; en attendant, aucune chaîne
// n'est jamais `undefined`.

export const metadata: Metadata = {
  title: "Politique cookies — PaperNote",
  description:
    "PaperNote n'utilise que des cookies techniques. Aucun traceur ni cookie de mesure d'audience tiers.",
};

/**
 * Page « Politique cookies » (/[locale]/legal/cookies).
 *
 * Vérifié dans le code :
 * - AUCUN cookie tiers / traceur : pas de gtag, analytics, posthog, plausible,
 *   matomo, sentry, pixel publicitaire… (recherche dans src/) ;
 * - Cookies techniques réellement posés :
 *   1. Cookie de session NextAuth (stratégie JWT — src/lib/auth.ts) : maintient la
 *      session connectée, httpOnly ;
 *   2. `NEXT_LOCALE` (src/components/I18nProvider.tsx, lu par
 *      src/middleware.ts) : mémorise la langue choisie, durée 1 an ;
 * - La préférence de thème (clair/sombre) est stockée en `localStorage`
 *   (`papernote-theme`, src/components/ThemeProvider.tsx), PAS en cookie ;
 * - Le choix de fermeture du bandeau d'information est lui aussi stocké en
 *   `localStorage` (src/components/CookieBanner.tsx), sans cookie.
 *
 * Conclusion juridique : aucun consentement n'est requis (exemption des
 * cookies strictement nécessaires au service — art. 82 de la loi Informatique
 * et Libertés / délibération CNIL 2020).
 */
export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <header className="relative isolate mb-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-16 -z-10 h-56 w-72 rounded-full bg-sage-glow blur-3xl"
        />
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.04em] text-teal-highlight">
          Document légal
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream-text sm:text-4xl">
          Politique cookies
        </h1>
        <p className="mt-3 text-sm text-cream-muted">
          Dernière mise à jour : octobre 2026.
        </p>
      </header>

      <div className="max-w-[70ch] space-y-10 text-[15px] leading-relaxed text-on-surface-variant sm:text-base">
        <section aria-labelledby="pas-de-traceurs">
          <h2 id="pas-de-traceurs" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            1. Pas de cookies de mesure d&apos;audience ni de traceurs
          </h2>
          <p>
            PaperNote n&apos;utilise <strong>aucun cookie tiers</strong>, aucun
            outil de mesure d&apos;audience (Google Analytics, Matomo,
            Plausible…), aucune régie publicitaire et aucun pixel de suivi. La
            liste des cookies présents sur le site est donc strictement
            limitée aux cookies techniques ci-dessous.
          </p>
        </section>

        <section aria-labelledby="cookies-techniques">
          <h2 id="cookies-techniques" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            2. Cookies techniques utilisés
          </h2>
          <p className="mb-3">
            Ces cookies sont indispensables au fonctionnement du service ; ils
            sont exemptés de consentement au titre de l&apos;article 82 de la
            loi Informatique et Libertés.
          </p>
          <div className="overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-glass-border bg-surface-container-low">
                  <th
                    scope="col"
                    className="p-3 font-mono text-[11px] uppercase tracking-[0.04em] text-teal-highlight"
                  >
                    Nom
                  </th>
                  <th
                    scope="col"
                    className="p-3 font-mono text-[11px] uppercase tracking-[0.04em] text-teal-highlight"
                  >
                    Finalité
                  </th>
                  <th
                    scope="col"
                    className="p-3 font-mono text-[11px] uppercase tracking-[0.04em] text-teal-highlight"
                  >
                    Durée
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-glass-border">
                  <td className="p-3 font-mono text-xs">
                    authjs.session-token
                  </td>
                  <td className="p-3">
                    Maintenir votre session de connexion (jeton de session
                    signé). Cookie strictement nécessaire, inaccessible au
                    JavaScript.
                  </td>
                  <td className="p-3">Session (expiration du jeton)</td>
                </tr>
                <tr className="border-t border-glass-border">
                  <td className="p-3 font-mono text-xs">NEXT_LOCALE</td>
                  <td className="p-3">
                    Mémoriser la langue choisie (français, anglais, arabe) afin
                    de vous la proposer à votre prochaine visite.
                  </td>
                  <td className="p-3">1 an</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="stockage-local">
          <h2 id="stockage-local" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            3. Préférences stockées localement (pas des cookies)
          </h2>
          <p className="mb-2">
            Certaines préférences sont enregistrées dans le{" "}
            <code className="font-mono text-[13px]">localStorage</code> de votre navigateur, qui ne transmet
            aucune donnée au serveur et ne constitue pas un cookie :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-on-surface-variant">
            <li>
              <strong>Thème d&apos;affichage</strong> (clair / sombre) :
              clé <code className="font-mono text-[13px]">papernote-theme</code>.
            </li>
            <li>
              <strong>Choix de fermeture du bandeau d&apos;information
              cookies</strong> : clé{" "}
              <code className="font-mono text-[13px]">
                papernote-cookie-notice-dismissed
              </code>{" "}
              (mémorise uniquement que vous avez refermé le bandeau).
            </li>
          </ul>
        </section>

        <section aria-labelledby="gestion-cookies">
          <h2 id="gestion-cookies" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            4. Comment gérer les cookies
          </h2>
          <p>
            Vous pouvez à tout moment supprimer les cookies depuis les réglages
            de votre navigateur (Chrome, Firefox, Safari, Edge…). La suppression
            du cookie de session vous déconnectera ; la suppression de{" "}
            <code className="font-mono text-[13px]">NEXT_LOCALE</code> fera revenir le site à la langue
            déterminée par votre navigateur.
          </p>
        </section>

        <section aria-labelledby="contact-cookies">
          <h2 id="contact-cookies" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            5. Contact
          </h2>
          <p>
            Pour toute question sur cette politique :{" "}
            <a
              href="mailto:privacy@papernote.example"
              className="font-medium text-teal-highlight underline underline-offset-4 hover:text-cream-text"
            >
              privacy@papernote.example
            </a>{" "}
            (à personnaliser avant la mise en production).
          </p>
        </section>
      </div>

      <nav
        aria-label="Documents légaux"
        className="mt-12 flex flex-wrap gap-4 border-t border-glass-border pt-8 text-sm"
      >
        <Link
          href={`/${locale}/legal/privacy`}
          className="pn-btn-secondary pn-btn px-4 py-2 text-xs"
        >
          Politique de confidentialité
        </Link>
        <Link
          href={`/${locale}/legal/terms`}
          className="pn-btn-secondary pn-btn px-4 py-2 text-xs"
        >
          Conditions générales
        </Link>
      </nav>
    </div>
  );
}
