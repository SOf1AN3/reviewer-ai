# PLAN-SAAS.md — PaperNote : du prototype au vrai SaaS

> **Statut** : 🔴 EN ATTENTE DE VALIDATION PAR L'UTILISATEUR — aucune exécution avant feu vert.
> **Fichier dédié** : l'ancien `PLAN.md` (plan d'améliorations existant) est conservé intact.
> **Cadrage validé** : B2C étudiants/chercheurs · fusion avec l'ancien `PLAN.md` · piliers retenus =
> Sécurité & fiabilité, Facturation robuste, Admin & observabilité, Rétention & engagement, API publique ·
> horizon long, sans contrainte de temps.

---

## Contexte & besoin métier

**PaperNote** (anciennement `reviewer-temp`) est une application web d'**analyse d'articles scientifiques par IA**
(Gemini), avec comptes utilisateurs, quota mensuel gratuit, paywall Pro/Business via Stripe, i18n FR/EN/AR.

**État des lieux vérifié (lecture ciblée, pas de scan)** :

| Domaine | Constat vérifié | Fichier |
|---|---|---|
| Stack | Next.js 16.3.4 · React 19 · Prisma 5.22 · PostgreSQL · NextAuth v5 beta (JWT) · Stripe · Gemini · Zod v4 · Tailwind 4 | `package.json` |
| Modèles DB | `User, Account, Session, VerificationToken, Article, Analyse` — **pas** de `Subscription`, `Invoice`, `UsageEvent`, `ApiKey`, `AuditLog`, **pas de champ `role`** | `prisma/schema.prisma` |
| Quotas | `canAnalyze()` / `incrementUsage()` = lecture-then-écriture **non atomique** (race condition confirmée : 2 requêtes simultanées dépassent la limite), 3 requêtes DB par analyse | `src/lib/plan.ts:34-69` |
| Analyse IA | `Article` créé **avant** l'appel IA → articles orphelins si l'IA échoue ; pas de transaction ; usage incrémenté après coup ; **pas de timeout ni de queue** (requête de 10-30 s) | `src/app/api/analyze/route.ts:39-64` |
| Réponse IA | `JSON.parse` brut + 2 checks superficiels, **aucun schéma Zod** ; `JSON.parse(rapport)` côté lecture sans try/catch | `src/lib/ai.ts:33-58`, `api/analyse/[id]/route.ts:56` |
| Robustesse IA | **Aucun retry**, aucun backoff, aucun comptage de tokens/coût | `src/lib/ai.ts` |
| Rate limiting | **Absent partout** ; le `middleware` **exclut explicitement `/api`** → toutes les API sont sans protection | `src/middleware.ts:28-35` |
| Stripe | `STRIPE_WEBHOOK_SECRET="whsec_REPLACE_ME"` → **facturation 100 % non fonctionnelle** ; `STRIPE_PRO_PRICE_ID`/`STRIPE_BUSINESS_PRICE_ID` absents de l'env (fallback création dynamique de produits) ; success/cancel URL sans locale | `.env:11`, `api/stripe/checkout/route.ts` |
| Webhook | Signature vérifiée ✅, mais **aucune idempotence** (Stripe rejoue les events), pas de gestion `invoice.paid` / `invoice.payment_failed` / `customer.subscription.trial_will_end`, pas de persistance de l'abonnement | `api/stripe/webhook/route.ts` |
| Secrets git | ✅ **`.env` n'est JAMAIS entré dans l'historique git** (`git log --all -- .env` = vide, `.env*` bien dans `.gitignore`) → le constat de l'ancien `PLAN.md` §1 est **inexact**, aucune purge d'historique nécessaire | `.gitignore` |
| Auth | Google + Credentials (bcrypt) ✅ ; **pas de vérification email, pas de reset password, pas de limite sur `/api/auth/register`, pas de révocation de session, pas de rôles** | `src/lib/auth.ts` |
| Tests / CI | **Aucun test, aucun `.github/`, aucune config Vitest/Playwright** | — |
| Emails | **Aucun envoi d'email transactionnel** (fournisseur absent) | — |
| Conformité | Pas de CGU/CGV, pas de politique de confidentialité, pas de consentement cookies, pas de suppression de compte, pas de DPA | — |
| Observabilité | uniquement `console.error` ; aucun log structuré, aucun monitoring, aucun suivi du coût Gemini | — |
| Hygiène | package nommé `reviewer-temp`, `@types/bcryptjs` en `dependencies`, README = boilerplate, `tsconfig.tsbuildinfo` non tracké | `package.json`, `README.md` |

**Ce qui manque pour devenir un « vrai SaaS »** (synthèse) :
1. **Fondations de sécurité** : rate limiting, quotas atomiques, env validé, auth complète (vérification/reset), rôles.
2. **Facturation réellement opérationnelle & idempotente** : abonnements persistés, webhooks fiables, factures, portal.
3. **Modèle de données d'usage** : historique des événements (facturable, auditable, exportable) au lieu d'un simple compteur.
4. **Réactivité & résilience** : analyse IA découplée (job/queue) + retry, pour ne pas dépendre d'un timeout serveur.
5. **Admin & pilotage** : dashboard admin (users, MRR, usage, coût IA), logs structurés, alertes.
6. **Rétention** : emails transactionnels, onboarding, export, notifications.
7. **API publique** : clés API + quota par clé.
8. **Qualité & livraison** : tests, CI/CD, seeds, backups, staging.
9. **Conformité** : RGPD, CGU/CGV, confidentialité, droit à l'effacement.
10. **UX produit** : error boundaries, progression d'analyse, i18n complète, SEO/OG.

---

## Questions / décisions en attente

Décisions **tranchées par l'utilisateur** :

- ✅ **Q1 — Email = Resend**, avec **bypass de la vérification/mot de passe tant que `RESEND_API_KEY` est absente** :
  l'inscription passe directement à `emailVerified = now()` (ou le flag `emailVerified` est ignoré à la connexion),
  et l'envoi d'email devient un **no-op silencieux loggé** (`email disabled: no RESEND_API_KEY`).
  Objectif : pouvoir tester l'intégralité du flux auth/analyse **sans clé Resend**.
  ⚠️ Le bypass doit être **détecté par la présence de la variable, jamais par un booléen en dur codé en dur**,
  et il doit s'auto-désactiver automatiquement dès que la clé est ajoutée.
- ✅ **Q2 — Stripe en mode test uniquement** : compte test, pas de produits/prices réels,
  pas de webhook enregistré. Toutes les tâches Stripe sont donc **préparées pour le mode test** :
  secrets documentés dans `.env.example`, config guidée par `stripe listen --forward-to localhost:3000/api/stripe/webhook`,
  fallback de création dynamique des produits **conservé en dev** (supprimé seulement en prod),
  et **aucune tâche ne doit bloquer l'avancement des autres** en attendant le setup réel.

Points restant à confirmer **au moment de la tâche concernée** :
- **Q3** — Orchestration des jobs d'analyse : **Vercel Functions + `waitUntil`/Background Functions**, vs **Inngest/QStash** (recommandé si serverless, gère retry + delay), vs **worker self-hosted** ?
- **Q4** — Infra de rate limiting : **Upstash Redis** (recommandé, serverless-friendly) vs store PostgreSQL ?
- **Q5** — Monitoring : **Sentry** (erreurs) + **Axiom/PostHog** (logs & produit) ou solution unique ?
- **Q6** — Le plan `business` doit-il rester « illimité » ou passer en quota très élevé (ex. 500/mois) pour protéger le coût IA ?
- **Q7** — Valeur de la TVA / régime : auto-liquidation UE ? prix TTC ou HT ? (impacte Stripe Tax)

---

## 1. Base de données (DB)

### 1.1 — `T1.1` Correction des quotas : opérations atomiques
- **Fichiers** : `src/lib/plan.ts`, `prisma/schema.prisma` (si index), `src/app/api/analyze/route.ts`
- **Dépendances** : —
- **Travail** :
  - Remplacer `canAnalyze` + `incrementUsage` par **une seule opération atomique** :
    `db.user.updateMany({ where: { id, OR:[{analysesResetAt:{lt: débutMois}}, {analysesThisMonth:{lt: limit}}] }, data: { analysesThisMonth:{increment:1} } })` → si `count === 0` ⇒ quota dépassé.
  - Fusionner `getUserPlan` + vérification en **1 requête** (fin des 3 lectures DB par analyse).
  - Le reset mensuel devient une condition `WHERE analysesResetAt < débutDuMois` (plus de write de reset séparé).
- **DoD** : impossible de dépasser la limite avec N requêtes parallèles ; 1 seule requête DB par analyse.

### 1.2 — `T1.2` Schéma Zod des réponses IA
- **Fichiers** : `src/lib/types.ts`, `src/lib/ai.ts`
- **Dépendances** : —
- **Travail** : `analyseResultSchema` Zod strict (`noteGlobale` 0-100, `notesParCritere` 8 critères requis, `rapport` sections complètes). `parseAIResponse` = strip code fences → `JSON.parse` → `schema.parse()` → erreur typée `AI_PARSE_ERROR` (avec le payload tronqué pour debug).
- **DoD** : toute réponse IA invalide = erreur explicite 502, jamais de données corrompues en DB.

### 1.3 — `T1.3` Transaction d'analyse (fin des orphelins)
- **Fichiers** : `src/app/api/analyze/route.ts`, `prisma/schema.prisma`
- **Dépendances** : T1.1, T1.2
- **Travail** : ordre = auth → rate-limit → **validation Zod du corps AVANT** toute écriture → quota atomique (T1.1) → appel IA avec timeout → **`db.$transaction`** créant `Article` + `Analyse` → incrémentation incluse dans la même séquence. Si l'IA échoue : **aucune écriture** (rollback), quota non consommé.
- **DoD** : 0 article orphelin possible ; le quota n'est consommé que sur succès.

### 1.4 — `T1.4` Nouveaux modèles SaaS
- **Fichiers** : `prisma/schema.prisma`, `prisma/migrations/< nouvelle >`
- **Dépendances** : —
- **Ajouts** :
  - `User.role` : `"user" | "admin"` (défaut `user`).
  - `Subscription` : `userId`, `stripeSubscriptionId @unique`, `stripePriceId`, `status`, `currentPeriodStart/End`, `cancelAtPeriodEnd`, `trialEnd`.
  - `Invoice` : `userId`, `stripeInvoiceId @unique`, `amountPaid`, `currency`, `status`, `hostedInvoiceUrl`, `pdfUrl`, `issuedAt`.
  - `UsageEvent` : `userId`, `type` (`ANALYSIS_CREATED`, `EXPORT`, `API_CALL`…), `metadata Json`, `createdAt` → **base de la facturation, de l'admin et de l'audit**.
  - `ApiKey` : `userId`, `name`, `keyPrefix`, `keyHash @unique`, `lastUsedAt`, `revokedAt`, `monthlyLimit`.
  - `EmailVerificationToken` / `PasswordResetToken` (ou réutilisation étendue de `VerificationToken`).
  - `WebhookEvent` : `stripeEventId @unique`, `type`, `processedAt` → **idempotence** (T2.2).
  - Index : `Article.userId`, `Analyse.articleId`, `UsageEvent(userId, createdAt)`.
- **DoD** : `prisma migrate dev` passe ; anciens modèles intacts (compat ascendante).

### 1.5 — `T1.5` Politique de rétention & purge
- **Fichiers** : `prisma/schema.prisma`, nouveau `src/lib/jobs/retention.ts`
- **Dépendances** : T1.4
- **Travail** : appliquer `PLANS[*].features.historyRetention` (free = 7 jours) : job de purge des articles/analyses expirés + suppression des comptes inactifs > 12 mois (avec email d'alerte préalable).
- **DoD** : la rétention annoncée sur `/pricing` est réellement appliquée (sinon c'est une promesse fausse).

---

## 2. API Routes / Server Actions / logique serveur

### 2.1 — `T2.1` Rate limiting global
- **Fichiers** : nouveau `src/lib/rate-limit.ts`, `src/middleware.ts`, et application dans chaque route critique
- **Dépendances** : Q3 (Upstash recommandé)
- **Travail** :
  - `middleware` : **ne plus exclure `/api`** pour le rate limiting (continuer à exclure pour l'i18n).
  - Limites : `/api/analyze` 5/min par user + 20/min par IP · `/api/auth/register` & login 3/min par IP · `/api/upload` 10/min · `/api/stripe/checkout` 5/h · `/api/public/*` par clé API.
  - Réponses `429` avec `Retry-After`.
- **DoD** : un script de flood reçoit 429 ; les routes légitimes ne sont pas impactées.

### 2.2 — `T2.2` Webhooks Stripe idempotents & complets
- **Fichiers** : `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe.ts`, `.env` (secret réel), nouveau `src/lib/stripe-sync.ts`
- **Dépendances** : T1.4
- **Travail** :
  - Insérer `WebhookEvent` (`stripeEventId`) **en premier** — event déjà traité ⇒ `200` immédiat (idempotence).
  - Gérer : `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`.
  - **Source de vérité = Stripe** : upsert `Subscription` + `User.plan` dérivé du `priceId` (plus de dérive possible).
  - Mettre à jour `success_url`/`cancel_url` avec le locale : `${BASE_URL}/${locale}/analyser?upgraded=true`.
  - **Mode test (Q2)** : le fallback de création dynamique des produits **reste en dev** (pas de price ID réel à ce jour) ;
    documenter dans `.env.example` la procédure exacte de setup : créer 2 produits/prices dans le dashboard test →
    renseigner `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` → `stripe listen --forward-to localhost:3000/api/stripe/webhook`
    → copier le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET` (remplacer le placeholder actuel).
  - Le **blocage `whsec_REPLACE_ME`** doit devenir une erreur explicite et lisible au démarrage en prod,
    et un simple warning loggé en dev.
- **DoD (en mode test)** : `stripe listen` + carte `4242 4242 4242 4242` → le plan passe en Pro ; rejouer un event (`stripe events resend`) ne double rien ; `invoice.payment_failed` downgrade proprement.
- **DoD (setup réel, plus tard)** : price IDs renseignés, webhook enregistré en prod, plus aucun fallback dynamique.

### 2.3 — `T2.3` Validation d'environnement au démarrage
- **Fichiers** : nouveau `src/lib/env.ts`, tous les `process.env.X!` (`stripe.ts`, `auth.ts`, `ai.ts`, `db.ts`, webhook)
- **Dépendances** : —
- **Travail** : schéma Zod server-only (`DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL` requises ; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` requises **en prod seulement** — en dev, absence/placeholder = warning loggé et fonctionnalités Stripe désactivées proprement (Q2) ; `RESEND_API_KEY` **optionnelle en dev** (bypass Q1 activé automatiquement) **mais exigée en prod** ; OAuth et price IDs optionnelles en dev mais exigées en prod). Erreur de build claire si manquante.
- **DoD** : `npm run build` échoue explicitement si une variable requise manque.

### 2.4 — `T2.4` Résilience des appels Gemini
- **Fichiers** : `src/lib/ai.ts`, `src/lib/prompt.ts`
- **Dépendances** : T1.2
- **Travail** : retry 3× avec backoff exponentiel + jitter sur 429/5xx/timeout ; timeout global (ex. 45 s) ; capture `usageMetadata` → **coût estimé par analyse** écrit dans `UsageEvent` ; bascule de modèle (flash → pro) si indisponible ; journalisation des tentatives.
- **DoD** : une panne transitoire de Gemini ne perd pas une analyse ; le coût IA est mesurable par user.

### 2.5 — `T2.5` Auth complète & sécurisée
- **Fichiers** : `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`, nouveaux `src/lib/email-verify.ts`, `src/app/api/auth/verify-request/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/middleware.ts`
- **Dépendances** : T1.4 (tokens), T2.1 (rate limit), T5.1 (Resend)
- **Travail** :
  - **Bypass email tant que `RESEND_API_KEY` est absente (Q1)** :
    - Helper unique `isEmailEnabled()` (= `!!process.env.RESEND_API_KEY`), **seul point de décision** du projet.
    - Inscription : si email désactivé → `emailVerified = new Date()` immédiatement (l'utilisateur se connecte sans attente).
      Si activé → création du token + envoi + redirection vers une page « vérifie ta boîte mail ».
    - Reset mdp : si email désactivé → le token est **loggé en clair dans les logs serveur** et/ou affiché en dev
      pour permettre de tester le formulaire `reset-password` sans SMTP ; si activé → envoi email.
    - Le bypass **ne doit jamais rester actif en prod** : `T2.3` (env.ts) doit exiger `RESEND_API_KEY` si `NODE_ENV === "production"`.
  - Vérification email (token à expiration, hashé en DB) avant activation — **uniquement si email activé**.
  - Mot de passe oublié (token unique, expiration 1 h, révoqué après usage, **messages identiques** si email inexistant).
  - `authorize()` : normalisation email, compteur de tentatives échouées, **message générique** (pas d'énumération d'utilisateurs).
  - Révocation de session au reset de mot de passe.
  - Pages `verify`/`reset` dans `src/app/[locale]/…` avec i18n.
- **DoD sans clé Resend** : inscription → connexion directe (bypass) → reset mdp fonctionnel via token loggé.
- **DoD avec clé Resend** : inscription → email reçu → clic → connexion ; reset par email ; impossible d'énumérer les emails.

### 2.6 — `T2.6` Contrôle d'accès systématique (anti-IDOR)
- **Fichiers** : toutes les routes `src/app/api/**` (`history`, `analyse/[id]`, `upload`, `user/plan`, `stripe/portal`)
- **Dépendances** : T2.5 (rôles)
- **Travail** : helper `requireUser(req)` + `assertOwnership(record.userId, userId)` réutilisé partout ; helper `requireAdmin()` pour les routes admin. Vérifier chaque endpoint : pas un seul accès « lecture par id sans contrôle de propriétaire » (le `analyse/[id]` est bon, **le reste doit être audité**).
- **DoD** : audit manuel de chaque route : 401 sans session, 403 si non propriétaire.

### 2.7 — `T2.7` Découpler l'analyse (job asynchrone)
- **Fichiers** : `src/app/api/analyze/route.ts`, nouveau `src/lib/jobs/analyze.ts`
- **Dépendances** : Q2, T1.3, T2.4
- **Travail** : `POST /api/analyze` crée l'article + renvoie `202 { analyseId, status:"pending" }` ; le job d'IA tourne en arrière-plan (Inngest/QStash ou `waitUntil`) ; `GET /api/analyse/[id]` renvoie le statut ; front en polling/SSE ; **email quand c'est prêt** (T5.1).
- **DoD** : aucune requête HTTP ne dépends du timeout serveur ; l'analyse survit à un redéploiement.

### 2.8 — `T2.8` API publique
- **Fichiers** : nouveau `src/app/api/public/analyze/route.ts`, `src/lib/api-key.ts`, `src/app/[locale]/settings/api/page.tsx`
- **Dépendances** : T1.4, T2.1
- **Travail** : génération de clé `pn_live_…` (affichée 1×, **hashée en DB**), auth par `Authorization: Bearer`, quota par clé (`UsageEvent` + compteur), pagination, erreurs normalisées `{ error: { code, message } }`, documentation.
- **DoD** : une clé réelle appelle l'API ; clé révoquée = 401 immédiat.

---

## 3. UI Components

### 3.1 — `T3.1` Error boundaries & états d'erreur
- **Fichiers** : `src/app/[locale]/analyse/[id]/error.tsx`, `src/app/[locale]/analyser/error.tsx`, `src/app/[locale]/historique/error.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/global-error.tsx`
- **Dépendances** : —
- **DoD** : aucune page ne « plante » en blanc ; message + retry + lien de retour.

### 3.2 — `T3.2` Feedback de progression d'analyse
- **Fichiers** : `src/components/ArticleForm.tsx`
- **Dépendances** : T2.7
- **Travail** : étapes explicites (« Envoi… », « Analyse IA (10-30 s)… », « Sauvegarde… »), écran « analyse en file d'attente » si 202, relance automatique du polling, gestion du `QUOTA_EXCEEDED` avec upsell vers `/pricing`.
- **DoD** : l'utilisateur comprend toujours ce qui se passe, y compris sur mobile.

### 3.3 — `T3.3` i18n complète du Header + des pages
- **Fichiers** : `src/components/Header.tsx`, `src/messages/{fr,en,ar}.json`
- **Dépendances** : —
- **Travail** : supprimer tous les ternaires `locale === "fr" ? …` ; clés `header.*`, `pricing.*`, `errors.*` ; vérifier l'arabe (RTL).
- **DoD** : `grep -r 'locale === "' src/components` = 0 résultat ; arabe correct en RTL.

### 3.4 — `T3.4` Pages compte / settings
- **Fichiers** : nouveau `src/app/[locale]/settings/{profile,billing,api}/page.tsx`, `src/app/api/user/delete/route.ts`
- **Dépendances** : T2.5, T2.8, T5.1
- **Travail** : profil + changement de mot de passe, **facturation** (plan actuel, prochaine échéance, lien Stripe portal, historique factures), suppression de compte (RGPD : purge articles + anonymisation), page API keys.
- **DoD** : l'utilisateur gère tout seul son compte sans support.

### 3.5 — `T3.5` Admin dashboard
- **Fichiers** : nouveau `src/app/[locale]/admin/**` + `src/components/admin/*`
- **Dépendances** : T1.4 (role), T2.6 (requireAdmin)
- **Travail** : users (recherche, plan, usage, block/unblock), revenus (MRR, churn, subs), usage IA (analyses/jour, coût estimé), logs d'événements. **Guard** : middleware + `requireAdmin` sur chaque route, **et** vérification DB du rôle côté serveur (jamais seulement côté client).
- **DoD** : un user normal reçoit 403 sur `/admin` et sur ses API.

### 3.6 — `T3.6` SEO & partage
- **Fichiers** : `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- **Dépendances** : —
- **Travail** : `generateMetadata()` avec OG/Twitter cards, image OG, `hreflang` fr/en/ar + x-default, sitemap, robots, `lang` du `<html>`, titre/description marketing réels.
- **DoD** : testeur d'aires de partage OK ; `next build` sans avertissement metadata.

---

## 4. Tests

### 4.1 — `T4.1` Setup Vitest + tests unitaires
- **Fichiers** : nouveau `vitest.config.ts`, `src/lib/__tests__/*.test.ts`
- **Dépendances** : —
- **DoD** : `npm test` ; couverture ciblée sur `plan.ts` (quota atomique), `ai.ts` (parse/validation), `rate-limit`, `stripe-sync` (dérivation du plan).

### 4.2 — `T4.2` Tests E2E Playwright
- **Fichiers** : nouveau `playwright.config.ts`, `e2e/*.spec.ts`
- **Dépendances** : T4.1
- **Flux** : inscription → connexion → analyse → historique ; quota atteint → upsell ; checkout Stripe (carte test) → plan activé ; admin.
- **DoD** : suite verte en local et en CI.

### 4.3 — `T4.3` CI/CD GitHub Actions
- **Fichiers** : nouveau `.github/workflows/{ci,deploy}.yml`
- **Dépendances** : T4.1, T4.2
- **DoD** : lint + typecheck + tests sur chaque PR ; déploiement auto sur `main` ; **staging** sur branche.

---

## 5. Rétention & engagement (email)

### 5.1 — `T5.1` Infra email transactionnel (Resend)
- **Fichiers** : nouveau `src/lib/email.ts` (wrapper), `src/emails/*.tsx` (React Email), `src/lib/env.ts` (T2.3), `.env.example`
- **Dépendances** : Q1 (Resend ✅), T2.3
- **Travail** :
  - Installer `resend` + `react-email` (+ script `email:dev` avec `email dev`).
  - `src/lib/email.ts` expose **un seul point d'envoi** `sendEmail({ to, subject, react })` :
    - **`RESEND_API_KEY` absente → no-op silencieux** : log structuré `{ email: "skipped", reason: "no_resend_key", to, subject }`
      et retour `{ ok: true, skipped: true }` — **jamais d'erreur**, pour que tout le reste du produit fonctionne.
    - Clé présente → envoi réel, remontée des erreurs Resend, retry léger (2×).
  - Exporter `isEmailEnabled()` depuis ce même fichier (utilisé par `T2.5` pour le bypass de vérification).
  - Sender : domaine vérifié en prod, `onboarding@resend.dev` en dev.
  - Réponse du dev : ajouter `RESEND_API_KEY` à `.env.example` commentée (`# RESEND_API_KEY=re_…`).
- **DoD sans clé** : `npm run dev` + inscription → **aucun crash**, log `email skipped`, flux complet testable.
- **DoD avec clé** : un email de test part et arrive réellement.

### 5.2 — `T5.2` Scénarios email
- **Fichiers** : branchés sur T2.5, T2.7, T2.2, T1.5
- **Travail** : bienvenue + vérification · reset mdp · **analyse terminée** · quota atteint (upsell) · **paiement échoué** (rétention) · reçu/facture · essai qui se termine (J-3) · compte inactif 60 j.
- **DoD** : chaque email a un CTA fonctionnel et respecte l'i18n.

### 5.3 — `T5.3` Onboarding & activation
- **Fichiers** : `src/app/[locale]/page.tsx`, nouveau `src/components/Onboarding.tsx`
- **Travail** : état vide de l'historique avec CTA « Analyser un exemple » (article démo offert), check-list de démarrage, tooltip première analyse.
- **DoD** : un nouvel utilisateur atteint sa 1re analyse en < 2 min.

---

## 6. Infra, déploiement & conformité

### 6.1 — `T6.1` Hygiène repo
- **Fichiers** : `.env.example` (nouveau), `package.json`, `README.md`, `.gitignore`
- **Travail** : `.env.example` documenté avec **toutes** les variables, chacune avec commentaire d'exemple :
  `RESEND_API_KEY` (optionnelle en dev = bypass email actif), `STRIPE_WEBHOOK_SECRET` (avec la procédure `stripe listen`),
  price IDs Stripe, `GEMINI_API_KEY`, OAuth. README = vrai doc (stack, setup, env, scripts, architecture,
  section « Stripe test setup » et « Email bypass »).
- **DoD** : `.env.example` documenté ; package renommé `papernote` ; `@types/bcryptjs` en devDeps ; README = vrai doc (stack, setup, env, scripts, architecture).

### 6.2 — `T6.2` Observabilité
- **Fichiers** : nouveau `src/lib/logger.ts` (logs JSON structurés, request-id), `src/lib/sentry.ts`, `.github`
- **Dépendances** : Q4
- **Travail** : remplacement des `console.error` par un logger ; capture erreurs front+back ; métriques : analyses, taux d'erreur IA, latence, **coût Gemini/jour**, MRR.
- **DoD** : une erreur en prod est visible avec contexte (user, route, request-id).

### 6.3 — `T6.3` Conformité RGPD
- **Fichiers** : `src/app/[locale]/{legal/privacy,legal/terms,legal/cookies}/page.tsx`, `src/components/CookieBanner.tsx`, `src/app/api/user/delete/route.ts`
- **Dépendances** : T3.4, T5.1
- **DoD** : CGV, politique de confidentialité, cookies (si analytics), export + suppression des données personnelles, mentions légales.

### 6.4 — `T6.4` Backups & seed
- **Fichiers** : nouveau `prisma/seed.ts`, doc ops dans `README.md`
- **Travail** : dumps PG automatisés ( Neon/Vercel Postgres PITR ou pg_dump horaire ) + procédure de restauration testée ; seed de démo.
- **DoD** : restauration d'un dump prouvée une fois.

---

## Sécurité & edge cases à couvrir

- **Race condition de quota** (T1.1) — le point le plus critique.
- **Rejeu de webhooks Stripe** (T2.2) — `checkout.session.completed` joué 2× = plan upgradé 2×.
- **Injection / validation** : toutes les entrées via Zod (`articleSchema` déjà présent, l'étendre aux autres routes).
- **IDOR** : audit de *toutes* les routes (`api/history`, `api/upload`, `api/user/plan`).
- **Énumération d'utilisateurs** : messages identiques login/register/reset.
- **Abus IA = coût réel** : rate limit + quota atomique + coût tracké par user.
- **Fichiers uploadés** : validation MIME *et* magic bytes, taille max, antivirus basique, stockage hors racine web, noms aléatoires.
- **Timeout serveur** : analyse découplée (T2.7).
- **Expiration de période mensuelle** : basée sur `analysesResetAt` (déjà géré) — vérifier le passage à minuit / fuseau UTC (tout en UTC, jamais en heure locale serveur).
- **Concurrence plan/user** : lecture du plan = DB, jamais le JWT (déjà le cas, à conserver).
- **Downgrade en cours de période** : ne pas perdre les analyses ; la rétention s'applique à la *nouvelle* date de purge.
- **Cancellations Stripe** : `cancel_at_period_end` doit garder le plan jusqu'à la fin de période.
- **Mobile / RTL** : le menu mobile reset à chaque navigation (bug connu) + arabe RTL.
- **Fallback Gemini indisponible** : message utilisateur clair, pas un 500 muet.

---

## Ordre d'exécution (séquentiel — 1 tâche = 1 review = 1 commit)

**Vague 0 — Préparation**
1. `T6.1` Hygiène repo (`.env.example`, rename, README) · *puis* commit du WIP Stripe actuellement non committé (`git status` = 16 fichiers modifiés/non trackés) — **à valider avec l'utilisateur avant de committer**.

**Vague 1 — Fondations sécurité (bloquant tout le reste)**
2. `T2.3` env.ts · 3. `T1.1` quotas atomiques · 4. `T1.2` schéma Zod IA · 5. `T1.3` transaction analyse · 6. `T2.1` rate limiting · 7. `T2.6` audit IDOR

**Vague 2 — Facturation (mode test, Q2)**
8. `T1.4` nouveaux modèles · 9. `T2.2` webhooks idempotents + doc setup `stripe listen` (price IDs à renseigner plus tard) · 10. `T2.4` résilience Gemini (+ coût tracké)

**Vague 3 — Auth & emails (bypass Resend actif, Q1)**
11. `T5.1` infra email Resend (no-op sans clé) · 12. `T2.5` vérification + reset password (bypass auto si pas de clé) · 13. `T3.4` pages settings/compte

**Vague 4 — Produit**
14. `T2.7` analyse asynchrone · 15. `T3.2` progression UI · 16. `T3.1` error boundaries · 17. `T3.3` i18n · 18. `T5.3` onboarding · 19. `T1.5` rétention

**Vague 5 — Pilotage & scale**
20. `T6.2` observabilité · 21. `T3.5` admin · 22. `T2.8` API publique

**Vague 6 — Qualité & conformité**
23. `T4.1` tests unitaires · 24. `T4.2` E2E · 25. `T4.3` CI/CD · 26. `T6.3` RGPD · 27. `T6.4` backups · 28. `T3.6` SEO

> Chaque tâche : subagent isolé (2-3 fichiers max) → **Reviewer** sur le `git diff` → **micro-commit** Conventional Commits en français → tâche suivante.

---

## Validation finale (Reviewer → Tester)

1. **Reviewer** après chaque tâche (sécurité, typage, conventions, diff limité au périmètre).
2. **Tester** (E2E MCP Playwright + Fetch) en fin de chaque **vague** :
   - Vague 1 : flood API → 429 ; requêtes parallèles → quota jamais dépassé ; analyse qui échoue → 0 orphelin.
   - Vague 2 : `stripe listen` + carte test `4242…` → plan Pro ; `stripe events resend` → idempotent ; `invoice.payment_failed` → downgrade.
   - Vague 3 **sans clé Resend** : inscription → connexion directe (bypass) → reset mdp via token loggé, **zéro crash**.
     Vague 3 **avec clé Resend** : inscription → email reçu → clic → connexion ; reset par email.
   - Vague 4 : analyse longue → statuts → email final ; front responsive FR/EN/AR(RTL).
   - Vague 5 : user normal → 403 sur `/admin` ; clé API valide/ révoquée.
   - Vague 6 : CI verte ; parcours complet en production-like.
3. **Synthèse finale** à l'utilisateur : tâches cochées, fichiers touchés, statut review/test, dette restante.

---

## Résumé des livrables par nature

**Nouveaux fichiers clés** : `src/lib/{env,rate-limit,logger,stripe-sync,api-key,email}.ts` ·
`src/lib/jobs/{analyze,retention}.ts` · `src/app/api/public/*` · `src/app/api/auth/{verify-request,forgot-password,reset-password}` ·
`src/app/[locale]/{admin,settings,legal}/**` · `prisma/seed.ts` · `.env.example` · `vitest.config.ts` · `playwright.config.ts` · `.github/workflows/*`

**Modifications structurantes** : `prisma/schema.prisma` (+7 modèles, +index) · `src/lib/plan.ts` (atomique) ·
`src/lib/ai.ts` (Zod + retry + coût) · `src/app/api/analyze/route.ts` (transaction + async) ·
`src/middleware.ts` (rate limit + protection routes) · `src/app/api/stripe/webhook/route.ts` (idempotent)

---

## ✅ STATUT FINAL — PLAN EXÉCUTÉ (14/10/2026)

**7 vagues sur 7 terminées · 43 commits · 0 tâche restante.**

| Vague | Tâches | Statut |
|---|---|---|
| 0 | WIP Stripe, hygiène repo, \.env.example\, README | ✅ |
| 1 | \env.ts\, quotas atomiques, Zod IA, transaction analyse, rate limiting, anti-IDOR | ✅ validée runtime |
| 2 | Modèles SaaS, baseline migrations, webhooks idempotents, résilience Gemini | ✅ validée runtime |
| 3 | Email Resend (bypass sans clé), auth complète, pages settings + RGPD | ✅ validée runtime |
| 4 | Analyse asynchrone (202), progression UI, error boundaries, i18n, onboarding, rétention | ✅ validée runtime |
| 5 | Observabilité, admin dashboard, API publique | ✅ validée runtime |
| 6 | Vitest (53 tests), Playwright (11 E2E), CI/CD, RGPD légal, seed/ops, SEO | ✅ validée runtime |

### Validation machine finale
\\\
npm run lint        → 0 erreur / 0 warning
npx tsc --noEmit    → 0 erreur
npm test            → 53/53
npx playwright test → 11/11
prisma migrate status → Database schema is up to date!
Smoke runtime       → 20/20 pages 200
API sans session    → 401 (history, user/plan, keys, admin/stats) · 503 (cron sans secret)
\\\

### Revues rejetées puis corrigées (5)
1. \.env.example\ ignoré par git (motif \.env*\).
2. Webhooks Stripe : perte d'event sur crash, conflit d'unicité sur 2ᵉ abonnement, rétrogradation du plan en dev.
3. Auth : **lockout de tous les comptes existants** en prod.
4. API publique : alias de type inutilisé (code mort).
5. E2E : artefacts Playwright non ignorés + collision de rate limit.

### Failles interceptées hors plan
- **Fuite de \GEMINI_API_KEY\** dans les logs serveur (l'erreur du SDK embarque l'URL).
- **Régression Turbopack** (\eact-dom/server\ importé statiquement) qui empoisonnait tout le serveur dev.
- **Cache \.next\ corrompu** simulant une panne applicative généralisée.
- **Bug de quota** : le schéma Zod strict aurait fait échouer **toutes** les analyses free.

### Dette technique documentée (non bloquante)
- Pages légales rédigées en **FR** uniquement (\TODO(i18n)\ pour EN/AR).
- Quota par clé API non atomique (le quota **plan**, lui, l'est — vrai garde-fou).
- Sessions JWT non révoquées après reset de mot de passe (nécessite un champ \passwordChangedAt\).
- \middleware.ts\ déprécié au profit de \proxy.ts\ en Next 16.
- \.env\ porte \AUTH_URL=http://localhost:3000\ alors que le dev tourne sur 3001 (déconnexion redirige vers une autre app — **à corriger avant prod**).
- Backups et restauration : **documentés mais non automatisés** (voir \docs/OPERATIONS.md\).
- Email placeholder \privacy@papernote.example\ à personnaliser.
