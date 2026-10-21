import type { Metadata } from "next";
import Link from "next/link";

// TODO(i18n) : le contenu légal est rédigé en français et affiché tel quel
// dans les trois locales (FR, EN, AR). Une traduction complète des textes
// juridiques sera portée par une tâche dédiée ; en attendant, aucune chaîne
// n'est jamais `undefined`.

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — PaperNote",
  description:
    "Règles d'utilisation du service PaperNote : compte, facturation, propriété intellectuelle et responsabilité.",
};

/**
 * Page « Conditions générales d'utilisation » (/[locale]/legal/terms).
 *
 * Contenu aligné sur le code du projet :
 * - Plan gratuit : 3 analyses/mois, rapport partiel, historique 7 jours
 *   (`PLANS.free` — src/lib/stripe.ts) ;
 * - Plans Pro (19 €/mois, 50 analyses) et Business (49 €/mois, illimité)
 *   payés par Stripe, résiliables à tout moment via le portail de
 *   facturation (/[locale]/settings/billing) ;
 * - Service d'analyse AUTOMATIQUE via Google Gemini : aucun être humain ne
 *   relit l'article (décharge de responsabilité).
 * - Âge minimum 16 ans (art. 45 de la loi Informatique et Libertés, qui
 *   aligne l'âge de consentement RGPD à 16 ans en France).
 */
export default async function TermsPage({
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
          Conditions générales d&apos;utilisation
        </h1>
        <p className="mt-3 text-sm text-cream-muted">
          Dernière mise à jour : octobre 2026.
        </p>
      </header>

      <div className="max-w-[70ch] space-y-10 text-[15px] leading-relaxed text-on-surface-variant sm:text-base">
        <section aria-labelledby="objet">
          <h2 id="objet" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            1. Objet
          </h2>
          <p>
            Les présentes conditions régissent l&apos;utilisation de
            l&apos;application PaperNote, un service en ligne d&apos;analyse
            d&apos;articles scientifiques assistée par intelligence
            artificielle. Toute création de compte vaut acceptation pleine et
            entière des présentes conditions.
          </p>
        </section>

        <section aria-labelledby="compte">
          <h2 id="compte" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            2. Compte utilisateur
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-on-surface-variant">
            <li>
              Le service est réservé aux personnes physiques âgées
              d&apos;au moins <strong>16 ans</strong>.
            </li>
            <li>
              Vous devez fournir une adresse email exacte et à jour ; vous êtes
              responsable de la confidentialité de vos identifiants.
            </li>
            <li>
              Une connexion optionnelle via un compte Google est proposée. Les
              mots de passe sont chiffrés et ne sont jamais accessibles en
              clair.
            </li>
            <li>
              Toute utilisation frauduleuse, usurpatrice ou contraire aux
              présentes conditions peut entraîner la suspension du compte.
            </li>
          </ul>
        </section>

        <section aria-labelledby="usage">
          <h2 id="usage" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            3. Usage acceptable
          </h2>
          <p className="mb-2">Il est interdit de soumettre au service :</p>
          <ul className="list-disc space-y-2 pl-6 text-on-surface-variant">
            <li>
              des contenus illicites, diffamatoires, haineux ou portant
              atteinte aux droits de tiers ;{" "}
            </li>
            <li>
              des contenus ne vous appartenant pas ou pour lesquels vous
              détenez les droits nécessaires à leur traitement ;{" "}
            </li>
            <li>
              des contenus visant à tester, sonder ou attaquer
              l&apos;infrastructure du service (ex. soumissions automatisées
              destinées à contourner les quotas).
            </li>
          </ul>
          <p className="mt-2">
            Vous demeurez seul responsable du contenu que vous soumettez à
            l&apos;analyse.
          </p>
        </section>

        <section aria-labelledby="nature">
          <h2 id="nature" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            4. Nature du service et absence de garantie
          </h2>
          <p className="mb-2">
            PaperNote fournit une analyse <strong>entièrement automatique</strong>{" "}
            produite par un modèle d&apos;intelligence artificielle (Google
            Gemini). Aucune relecture humaine n&apos;est effectuée.
          </p>
          <p className="mb-2">
            <strong>
              Les résultats sont indicatifs et ne constituent en aucun cas un
              avis scientifique, éditorial ou professionnel.
            </strong>{" "}
            PaperNote ne garantit pas l&apos;exactitude, la complétude ou
            l&apos;adéquation des notes et rapports produits, ni leur
            acceptation par une revue ou un comité de lecture. Vous restez
            seul juge de l&apos;usage fait de ces résultats.
          </p>
          <p>
            Le service peut être interrompu temporairement (maintenance,
            incidents) ; des garanties de disponibilité continue ne sont pas
            fournies.
          </p>
        </section>

        <section aria-labelledby="facturation">
          <h2 id="facturation" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            5. Plans et facturation
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-on-surface-variant">
            <li>
              <strong>Plan gratuit</strong> : 3 analyses par mois, rapport
              partiel, historique conservé 7 jours.
            </li>
            <li>
              <strong>Plan Pro</strong> (19 €/mois) : 50 analyses par mois,
              rapport complet, historique conservé sans limitation de durée.
            </li>
            <li>
              <strong>Plan Business</strong> (49 €/mois) : analyses
              illimitées, rapport complet, historique sans limitation.
            </li>
            <li>
              Les plans payants sont gérés par Stripe ; le renouvellement est
              automatique et mensuel.
            </li>
            <li>
              Vous pouvez résilier à tout moment depuis la{" "}
              <Link
                href={`/${locale}/settings/billing`}
                className="font-medium text-teal-highlight underline underline-offset-4 hover:text-cream-text"
              >
                page de facturation
              </Link>{" "}
              : l&apos;abonnement reste actif jusqu&apos;à la fin de la période
              en cours, sans remboursement au prorata.
            </li>
            <li>
              Les prix peuvent évoluer ; tout changement vous sera notifié avec
              un préavis raisonnable et s&apos;appliquera à la période de
              renouvellement suivante.
            </li>
          </ul>
        </section>

        <section aria-labelledby="pi">
          <h2 id="pi" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            6. Propriété intellectuelle
          </h2>
          <p className="mb-2">
            PaperNote, son code, sa marque et son interface sont la propriété de
            son éditeur.
          </p>
          <p>
            Vous restez plein propriétaire des contenus que vous soumettez ainsi
            que des analyses générées à partir de ceux-ci. Vous accordez au
            service une licence limitée d&apos;utilisation de ces contenus
            strictement nécessaire à la fourniture de l&apos;analyse demandée.
          </p>
        </section>

        <section aria-labelledby="responsabilite">
          <h2 id="responsabilite" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            7. Limitation de responsabilité
          </h2>
          <p className="mb-2">
            Dans les limites permises par la loi, PaperNote ne saurait être tenu
            responsable :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-on-surface-variant">
            <li>
              des décisions prises sur la base des analyses automatisées
              produites (relecture, soumission à une revue, évaluation
              académique…) ;{" "}
            </li>
            <li>
              de l&apos;inadéquation des résultats à votre attente scientifique
              ou éditoriale ;{" "}
            </li>
            <li>
              des interruptions de service temporaires ni des pertes de données
              résultant d&apos;un cas de force majeure.
            </li>
          </ul>
          <p className="mt-2">
            La responsabilité totale de PaperNote, pour toute réclamation, est
            limitée au montant des sommes effectivement payées par vous au
            cours des douze derniers mois.
          </p>
        </section>

        <section aria-labelledby="resiliation">
          <h2 id="resiliation" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            8. Résiliation et suppression de compte
          </h2>
          <p>
            Vous pouvez supprimer votre compte à tout moment depuis vos{" "}
            <Link
              href={`/${locale}/settings/profile`}
              className="font-medium text-teal-highlight underline underline-offset-4 hover:text-cream-text"
            >
              paramètres de profil
            </Link>
            . La suppression efface définitivement vos données (articles,
            analyses, historique) et résilie votre abonnement en cours.
          </p>
        </section>

        <section aria-labelledby="droit">
          <h2 id="droit" className="mb-3 border-t border-glass-border pt-6 font-display text-xl font-semibold tracking-tight text-cream-text sm:text-2xl">
            9. Droit applicable
          </h2>
          <p>
            Les présentes conditions sont soumises au droit français. En cas de
            litige, une résolution amiable sera recherchée avant toute
            action judiciaire.
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
          href={`/${locale}/legal/cookies`}
          className="pn-btn-secondary pn-btn px-4 py-2 text-xs"
        >
          Politique cookies
        </Link>
      </nav>
    </div>
  );
}
