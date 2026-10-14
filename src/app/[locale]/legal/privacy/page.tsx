import type { Metadata } from "next";
import Link from "next/link";

// TODO(i18n) : le contenu légal est rédigé en français et affiché tel quel
// dans les trois locales (FR, EN, AR). Une traduction complète des textes
// juridiques sera portée par une tâche dédiée ; en attendant, aucune chaîne
// n'est jamais `undefined`.

export const metadata: Metadata = {
  title: "Politique de confidentialité — PaperNote",
  description:
    "Comment PaperNote collecte, utilise, conserve et protège vos données personnelles.",
};

/**
 * Page « Politique de confidentialité » (/[locale]/legal/privacy).
 *
 * Contenu factuel aligné sur le code du projet :
 * - Données de compte : `User` (name, email, password hashé bcrypt coût 12,
 *   plan, stripeCustomerId) — prisma/schema.prisma + src/app/api/auth/register/route.ts ;
 * - Articles et analyses : modèles `Article` (titre, contenu, auteur,
 *   revueCiblee) et `Analyse` (rapport, notes) — src/app/api/analyze/route.ts ;
 * - Le contenu des articles est transmis au modèle Google Gemini dans le
 *   prompt d'analyse (src/lib/prompt.ts) — jamais à un autre tiers ;
 * - Journalisation applicative : `UsageEvent` (type + métadonnées techniques :
 *   articleId, modèle, tokens, durée) et journal JSON serveur (src/lib/logger.ts,
 *   sans contenu d'articles ni de rapports) ;
 * - Rétention : plan gratuit = 7 jours (`PLANS.free.features.historyRetention`),
 *   pro/business = illimité (src/lib/stripe.ts) ; purge automatique via le job
 *   de rétention (src/lib/jobs/retention.ts) ; `UsageEvent` jamais purgé par ce
 *   job, supprimé en cascade avec le compte ;
 * - Suppression de compte auto-service : /[locale]/settings/profile →
 *   POST /api/user/delete (cascade Prisma + nettoyage tokens + Stripe best-effort).
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold uppercase tracking-tight sm:text-5xl">
        Politique de confidentialité
      </h1>
      <p className="mb-10 text-sm text-muted-foreground">
        Dernière mise à jour : octobre 2026. Ce document décrit le traitement
        des données personnelles tel qu&apos;il est réellement mis en œuvre par
        PaperNote.
      </p>

      <div className="space-y-10 text-sm leading-relaxed sm:text-base">
        <section aria-labelledby="responsable">
          <h2 id="responsable" className="mb-3 text-xl font-bold uppercase tracking-wide">
            1. Responsable du traitement
          </h2>
          <p className="mb-2">
            Le responsable du traitement des données personnelles est{" "}
            <strong>PaperNote</strong> (éditeur de l&apos;application PaperNote).
          </p>
          <p className="mb-2">
            Contact : écrivez-nous à l&apos;adresse email{" "}
            <a
              href="mailto:privacy@papernote.example"
              className="font-bold underline underline-offset-4"
            >
              privacy@papernote.example
            </a>{" "}
            <em>(adresse à personnaliser avant la mise en production)</em>.
          </p>
        </section>

        <section aria-labelledby="donnees">
          <h2 id="donnees" className="mb-3 text-xl font-bold uppercase tracking-wide">
            2. Données collectées et finalités
          </h2>
          <ul className="mb-3 list-disc space-y-2 pl-6">
            <li>
              <strong>Données de compte</strong> : nom (facultatif), adresse
              email, mot de passe (stocké sous forme de empreinte irréversible
              bcrypt, jamais en clair). Finalité : création et gestion du
              compte, authentification, connexion sécurisée.
            </li>
            <li>
              <strong>Contenus d&apos;articles soumis</strong> : titre, texte
              intégral de l&apos;article, auteur(s) et revue ciblée
              (facultatifs). Finalité : produire l&apos;analyse demandée. Le
              texte de l&apos;article est transmis au modèle d&apos;intelligence
              artificielle Google Gemini dans le cadre de la génération du
              rapport d&apos;analyse.
            </li>
            <li>
              <strong>Résultats d&apos;analyses</strong> : note globale, notes
              par critère, rapport détaillé. Finalité : afficher votre
              historique et vous restituer les résultats.
            </li>
            <li>
              <strong>Données de facturation</strong> : identifiant client et
              d&apos;abonnement Stripe, statut d&apos;abonnement, montants et
              factures (lues depuis les webhooks Stripe). Finalité : gérer les
              abonnements payants et l&apos;émission des factures.
            </li>
            <li>
              <strong>Données d&apos;usage et de sécurité</strong> : événements
              d&apos;utilisation (<code>UsageEvent</code> : type d&apos;événement
              et métadonnées techniques telles que identifiants d&apos;article,
              modèle IA, nombre de tokens, durée) et journaux techniques
              d&apos;application. Finalité : quotas, facturation à
              l&apos;usage, prévention des abus et sécurité du service.
            </li>
            <li>
              <strong>Clés API</strong> : nom de la clé, préfixe et empreinte
              de la clé (la clé en clair n&apos;est affichée qu&apos;une fois).
              Finalité : accès programmatique à l&apos;API pour les utilisateurs
              qui en créent une.
            </li>
            <li>
              <strong>Emails transactionnels</strong> : votre adresse est
              utilisée pour l&apos;envoi de messages indispensables au service
              (vérification de compte, réinitialisation de mot de passe). Aucun
              email marketing n&apos;est envoyé actuellement ; si cette
              fonctionnalité est ajoutée, il reposera sur votre consentement
              préalable.
            </li>
          </ul>
        </section>

        <section aria-labelledby="sous-traitants">
          <h2 id="sous-traitants" className="mb-3 text-xl font-bold uppercase tracking-wide">
            3. Sous-traitants
          </h2>
          <p className="mb-3">
            PaperNote s&apos;appuie sur les services tiers suivants, choisis
            pour leur conformité RGPD :
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Google (Gemini API)</strong> : traitement de
              l&apos;intelligence artificielle. Le contenu des articles soumis à
              une analyse est transmis à l&apos;API Gemini pour générer le
              rapport.
            </li>
            <li>
              <strong>Stripe</strong> : paiement et gestion des abonnements.
              Stripe agit comme sous-traitant de paiement ; ses conditions et sa
              politique de confidentialité s&apos;appliquent aux données de
              paiement.
            </li>
            <li>
              <strong>Resend</strong> : envoi des emails transactionnels
              (vérification de compte, réinitialisation de mot de passe).
            </li>
            <li>
              <strong>Vercel</strong> : hébergement de l&apos;application et
              livraison du site.
            </li>
            <li>
              <strong>Neon</strong> : base de données PostgreSQL hébergeant les
              comptes, articles, analyses et données de facturation.
            </li>
          </ul>
          <p className="mt-3">
            Un service optionnel d&apos; Upstash (Redis) peut être utilisé pour
            la limitation de débit (anti-abus) ; à défaut de configuration,
            aucune donnée n&apos;y est envoyée.
          </p>
        </section>

        <section aria-labelledby="bases">
          <h2 id="bases" className="mb-3 text-xl font-bold uppercase tracking-wide">
            4. Bases légales
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Exécution du contrat</strong> (article 6.1.b RGPD) :
              création du compte, analyses demandées, gestion de
              l&apos;abonnement.
            </li>
            <li>
              <strong>Intérêt légitime</strong> (article 6.1.f RGPD) :
              sécurité du service, prévention des abus, journalisation
              technique, amélioration du produit.
            </li>
            <li>
              <strong>Obligation légale</strong> (article 6.1.c RGPD) :
              conservation des factures et données de facturation.
            </li>
            <li>
              <strong>Consentement</strong> (article 6.1.a RGPD) : connexion
              via un compte Google (facultative) ; emails marketing le cas
              échéant.
            </li>
          </ul>
        </section>

        <section aria-labelledby="conservation">
          <h2 id="conservation" className="mb-3 text-xl font-bold uppercase tracking-wide">
            5. Durées de conservation
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Articles et analyses — plan gratuit</strong> : conservés{" "}
              <strong>7 jours</strong> puis supprimés automatiquement par un
              travail de purge planifié.
            </li>
            <li>
              <strong>Articles et analyses — plans Pro et Business</strong> :
              conservés <strong>sans limitation de durée</strong>, jusqu&apos;à
              votre suppression de compte.
            </li>
            <li>
              <strong>Compte et données associées</strong> : conservées
              jusqu&apos;à la suppression du compte, que vous pouvez effectuer
              vous-même à tout moment depuis la page de paramètres du profil.
            </li>
            <li>
              <strong>Événements d&apos;usage</strong> : conservés pendant toute
              la durée de vie du compte et supprimés avec lui (suppression
              en cascade). Ils ne sont pas purgés par le travail de rétention de
              l&apos;historique.
            </li>
            <li>
              <strong>Données de facturation</strong> : conservées le temps
              exigé par les obligations comptables et fiscales applicables.
            </li>
            <li>
              <strong>Jetons de vérification email</strong> : durée de vie de 24
              heures.
            </li>
            <li>
              <strong>Journal technique d&apos;application</strong> : la durée
              de conservation des journaux d&apos;exploitation (serveur et
              hébergeur) est{" "}
              <strong>
                un engagement qui reste à formaliser
              </strong>{" "}
              au moment de la mise en production ; les journaux applicatifs
              gérés par PaperNote ne contiennent jamais le contenu des articles
              ni des rapports.
            </li>
          </ul>
        </section>

        <section aria-labelledby="transferts">
          <h2 id="transferts" className="mb-3 text-xl font-bold uppercase tracking-wide">
            6. Transferts hors Union européenne
          </h2>
          <p className="mb-2">
            Certaines données peuvent être traitées hors de
            l&apos;Union européenne : le modèle Google Gemini est opéré par
            Google LLC (États-Unis) et l&apos;infrastructure de Vercel et de
            Neon peut être située hors UE selon la région d&apos;hébergement
            retenue. Ces transferts sont encadrés par les mécanismes prévus par
            le RGPD (clauses contractuelles types et garanties contractuelles
            équivalentes) et par les politiques de confidentialité de ces
            fournisseurs.
          </p>
        </section>

        <section aria-labelledby="droits">
          <h2 id="droits" className="mb-3 text-xl font-bold uppercase tracking-wide">
            7. Vos droits
          </h2>
          <p className="mb-3">
            Conformément au RGPD, vous disposez des droits d&apos;accès, de
            rectification, d&apos;effacement, de limitation, de portabilité et
            d&apos;opposition sur vos données personnelles. Concrètement :
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Accès et portabilité</strong> : vos articles, analyses et
              informations de compte restent consultables dans votre espace
              (historique, facturation).
            </li>
            <li>
              <strong>Modification</strong> : votre nom est modifiable depuis
              les paramètres de votre profil.
            </li>
            <li>
              <strong>Effacement</strong> : la suppression de votre compte,
              disponible dans{" "}
              <Link
                href={`/${locale}/settings/profile`}
                className="font-bold underline underline-offset-4"
              >
                vos paramètres de profil
              </Link>
              , efface de manière irréversible votre compte ainsi que toutes les
              données associées (articles, analyses, historique, clés API,
              abonnement et factures locales) et déclenche la résiliation de
              votre abonnement.
            </li>
            <li>
              Pour toute autre demande (accès, rectification, opposition) :
              contactez-nous à{" "}
              <a
                href="mailto:privacy@papernote.example"
                className="font-bold underline underline-offset-4"
              >
                privacy@papernote.example
              </a>{" "}
              (à personnaliser). Nous répondons dans un délai d&apos;un mois.
            </li>
          </ul>
          <p className="mt-3">
            Vous pouvez également introduire une réclamation auprès de la
            Commission Nationale de l&apos;Informatique et des Libertés (CNIL).
          </p>
        </section>

        <section aria-labelledby="securite">
          <h2 id="securite" className="mb-3 text-xl font-bold uppercase tracking-wide">
            8. Sécurité
          </h2>
          <p>
            Les mots de passe sont stockés sous forme d&apos;empreintes bcrypt
            (jamais en clair), les sessions utilisent des jetons signés et les
            clés API sont stockées sous forme d&apos;empreintes
            irréversibles. Les communications sont chiffrées (HTTPS). Des
            mesures de limitation de débit protègent les endpoints contre les
            abus.
          </p>
        </section>

        <section aria-labelledby="contact-privacy">
          <h2 id="contact-privacy" className="mb-3 text-xl font-bold uppercase tracking-wide">
            9. Contact
          </h2>
          <p>
            Pour toute question relative à cette politique :{" "}
            <a
              href="mailto:privacy@papernote.example"
              className="font-bold underline underline-offset-4"
            >
              privacy@papernote.example
            </a>{" "}
            (à personnaliser avant la mise en production).
          </p>
        </section>
      </div>

      <nav aria-label="Documents légaux" className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link
          href={`/${locale}/legal/terms`}
          className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
        >
          Conditions générales
        </Link>
        <Link
          href={`/${locale}/legal/cookies`}
          className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
        >
          Politique cookies
        </Link>
      </nav>
    </div>
  );
}
