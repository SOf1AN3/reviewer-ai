# Plan d'Améliorations - PaperNote

## État Actuel du Projet

Application SaaS complète pour l'analyse d'articles scientifiques par IA (Google Gemini). Stack : Next.js 16 + Prisma + PostgreSQL + Stripe + NextAuth v5. Code bien structuré mais avec des lacunes critiques en sécurité, tests et robustesse.

---

## 🔴 Améliorations Critiques (Sécurité)

### 1. Rotation des secrets exposés dans git

**Problème** : Les fichiers `.env` et `.env.local` contiennent des clés API réelles (Gemini, DB, OAuth, Stripe) qui ont été commitées dans l'historique git.

**Action** :
- Tourner toutes les clés immédiatement (Gemini API key, DB password, AUTH_SECRET, Google OAuth, Stripe keys)
- Créer un `.env.example` avec des placeholders documentés
- Vérifier que `.env*` est bien dans `.gitignore`
- Utiliser `git filter-branch` ou BFG Repo-Cleaner pour purger l'historique

**Fichiers concernés** : `.env`, `.env.local`, `.gitignore`

---

### 2. Absence de rate limiting

**Problème** : Aucune protection contre le spam/abuse sur les API critiques.

**Routes exposées** :
- `POST /api/analyze` → appelle Gemini à chaque requête (coût réel par appel)
- `POST /api/auth/register` → brute-force possible sur les mots de passe
- `POST /api/upload` → upload de fichiers sans limite de fréquence
- `POST /api/stripe/checkout` → création de sessions Stripe sans limite

**Action** :
- Ajouter un middleware de rate limiting (ex: `@upstash/ratelimit` avec Redis, ou un store in-memory pour le MVP)
- Limites proposées :
  - `/api/analyze` : 5 requêtes/minute par user, 20/minute par IP
  - `/api/auth/register` : 3 requêtes/minute par IP
  - `/api/upload` : 10 requêtes/minute par user
  - `/api/stripe/checkout` : 5 requêtes/heure par user

**Fichiers concernés** : `src/middleware.ts`, nouveau `src/lib/rate-limit.ts`

---

### 3. Webhook Stripe non sécurisé

**Problème** : `STRIPE_WEBHOOK_SECRET` = `whsec_REPLACE_ME` — tout le système de facturation est non-fonctionnel.

**Problème secondaire** : `success_url` et `cancel_url` dans `src/app/api/stripe/checkout/route.ts:87-88` ne contiennent pas le locale, causant des redirections incorrectes après paiement.

**Action** :
- Configurer le vrai `STRIPE_WEBHOOK_SECRET` depuis le dashboard Stripe
- Corriger les URLs pour inclure le locale : `${BASE_URL}/${locale}/analyser?upgraded=true`

**Fichiers concernés** : `.env`, `src/app/api/stripe/checkout/route.ts`

---

### 4. Race condition dans `incrementUsage`

**Problème** : `src/lib/plan.ts:52-68` — Lecture puis écriture non atomique. Sous forte concurrence, deux requêtes peuvent passer la vérification `canAnalyze` simultanément et dépasser la limite du plan.

**Scénario** :
1. User A fait 2 requêtes quasi simultanées
2. Les deux lisent `analysesThisMonth = 2` (limite = 3)
3. Les deux passent la vérification `canAnalyze`
4. Les deux incrémentent → résultat = 4 (dépasse la limite)

**Action** :
- Utiliser une requête atomique Prisma : `update({ data: { analysesThisMonth: { increment: 1 } } })` avec une condition WHERE
- Ou utiliser une transaction avec verrou (`SELECT ... FOR UPDATE`)

**Fichiers concernés** : `src/lib/plan.ts`

---

## 🟠 Améliorations Importantes (Architecture)

### 5. Validation de la réponse IA avec Zod

**Problème** : `src/lib/ai.ts:33-57` — `parseAIResponse` utilise `JSON.parse` brut sans schéma Zod. Si Gemini renvoie un JSON mal formé ou des champs manquants, le parsing échoue silencieusement ou retourne des données incomplètes.

**Action** :
- Définir un `analyseResultSchema` avec Zod (reprenant la structure `AnalyseResult` de `src/lib/types.ts`)
- Valider chaque champ : `noteGlobale` (0-100), `notesParCritere` (8 critères requis), `rapport` (toutes les sections)
- Lever des erreurs explicites si la validation échoue

**Fichiers concernés** : `src/lib/ai.ts`, `src/lib/types.ts`

---

### 6. Pas de retry pour les appels Gemini

**Problème** : `src/lib/ai.ts:17-22` — Si Gemini timeout, retourne une erreur 500, ou rate-limit, l'analyse échoue définitivement sans tentative de récupération.

**Action** :
- Ajouter un retry avec backoff exponentiel (2-3 tentatives)
- Gérer les erreurs spécifiques : 429 (rate limit), 500 (serveur), timeout
- Logger les tentatives pour le monitoring

**Fichiers concernés** : `src/lib/ai.ts`

---

### 7. Appels DB redondants dans `plan.ts`

**Problème** : `canAnalyze()` appelle `getUserPlan()` qui fait un `db.user.findUnique()`. Puis `incrementUsage()` fait un second `db.user.findUnique()`. Résultat : 3 requêtes DB pour une seule analyse au lieu d'1.

**Action** :
- Fusionner la logique : charger l'utilisateur une seule fois, vérifier et incrémenter dans la même opération
- Ou passer le user déjà chargé en paramètre

**Fichiers concernés** : `src/lib/plan.ts`, `src/app/api/analyze/route.ts`

---

### 8. Environnement non validé au démarrage

**Problème** : Les variables d'env sont lues directement avec `!` (ex: `process.env.GEMINI_API_KEY!`). Si une variable manque, le crash survient à l'exécution, pas au build.

**Action** :
- Créer `src/lib/env.ts` avec un schéma Zod pour valider toutes les variables d'environnement requises
- Valider au démarrage de l'app et lever des erreurs claires
- Exclure les variables optionnelles (ex: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)

**Fichiers concernés** : nouveau `src/lib/env.ts`, tous les fichiers utilisant `process.env`

---

## 🟡 Améliorations Modérées (Code Quality)

### 9. Traductions hardcodées dans le Header

**Problème** : `src/components/Header.tsx:65-104` — Les labels "Analyser", "Historique", "Login", "Inscription", "Déconnexion" sont écrits en dur (`locale === "fr" ? "Analyser" : ...`) au lieu d'utiliser le système i18n existant.

**Action** :
- Ajouter ces clés dans `src/messages/fr.json`, `en.json`, `ar.json`
- Utiliser `dict.header.analyze`, `dict.header.history`, etc.
- Supprimer les ternaires hardcodées

**Fichiers concernés** : `src/components/Header.tsx`, `src/messages/*.json`

---

### 10. Dépendances mal placées et package name

**Problème** :
- `@types/bcryptjs` est dans `dependencies` au lieu de `devDependencies` (`package.json:17`)
- Le nom du package est `reviewer-temp` au lieu de `papernote`

**Action** :
- Déplacer `@types/bcryptjs` dans `devDependencies`
- Renommer le package en `papernote`

**Fichiers concernés** : `package.json`

---

### 11. Fichiers inutiles à la racine

**Fichiers à supprimer** :
- `Nouveau Document texte.txt` — fichier vide accidentel
- `tsconfig.tsbuildinfo` — fichier cache TypeScript (devrait être dans `.gitignore`)

**Fichiers à mettre à jour** :
- `README.md` — remplacer le boilerplate create-next-app par une vraie documentation du projet

**Fichiers concernés** : `Nouveau Document texte.txt`, `tsconfig.tsbuildinfo`, `README.md`, `.gitignore`

---

### 12. Composants React non optimisés

**Problème** : `src/components/AnalyseResult.tsx` — Les sous-composants (`NoteGauge`, `CritereBar`, `PointsFortsCard`, etc.) sont recréés à chaque render sans `memo`.

**Action** :
- Marquer les composants purs avec `React.memo`
- Extraire les fonctions utilitaires (`getColorClass`, `getBarColor`) en dehors du composant

**Fichiers concernés** : `src/components/AnalyseResult.tsx`

---

### 13. Upload de fichiers sans streaming

**Problème** : `src/app/api/upload/route.ts:49` — Le fichier est lu entièrement en mémoire (`Buffer.from(await file.arrayBuffer())`). Pour un fichier de 10 Mo, c'est un pic mémoire important.

**Action** :
- Ajouter un streaming pour les gros fichiers
- Ou réduire la limite à 5 Mo côté client et serveur
- Ajouter une validation du type MIME côté serveur (pas seulement l'extension)

**Fichiers concernés** : `src/app/api/upload/route.ts`, `src/components/ArticleForm.tsx`

---

## 🔵 Améliorations Mineures (UX & Polish)

### 14. Menu mobile pas persistant

**Problème** : Le state `mobileOpen` du Header reset à chaque navigation. L'utilisateur doit rouvrir le menu après chaque clic.

**Action** :
- Ajouter un `useEffect` pour fermer le menu au changement de route (`usePathname()`)

**Fichiers concernés** : `src/components/Header.tsx`

---

### 15. Pas de feedback de progression pendant l'analyse

**Problème** : L'analyse peut prendre 10-30 secondes. L'utilisateur voit juste un spinner sans indication de durée.

**Action** :
- Ajouter un message du type "Analyse en cours... Cela peut prendre 30 secondes"
- Ou une barre de progression indéterminée avec des étapes ("Envoi du document...", "Analyse par l'IA...", "Sauvegarde des résultats...")

**Fichiers concernés** : `src/components/ArticleForm.tsx`

---

### 16. Pas de meta tags Open Graph

**Problème** : Pas de partage social optimisé (Twitter, LinkedIn, etc.).

**Action** :
- Ajouter des meta OG dans `generateMetadata()` du layout
- Inclure une image par défaut pour les partages

**Fichiers concernés** : `src/app/[locale]/layout.tsx`

---

### 17. Pas de Error Boundaries

**Problème** : Si un composant crash (ex: JSON malformé d'une analyse), toute la page plante sans feedback.

**Action** :
- Ajouter des `error.tsx` dans les routes critiques (`/analyse/[id]`, `/analyser`, `/historique`)

**Fichiers concernés** : nouveau `src/app/[locale]/analyse/[id]/error.tsx`, etc.

---

## ⬜ Améliorations Futures (Features)

| Feature | Priorité | Estimation |
|---------|----------|------------|
| **Tests unitaires** (Vitest) | Haute | 2-3 jours |
| **Tests E2E** (Playwright) | Haute | 2-3 jours |
| **CI/CD** (GitHub Actions) | Haute | 1 jour |
| **Admin dashboard** (gestion users/analytics) | Moyenne | 1 semaine |
| **Email notifications** (résultat d'analyse prêt) | Moyenne | 2-3 jours |
| **Export PDF** des résultats | Moyenne | 2 jours |
| **API publique** (pour intégrations tierces) | Basse | 1 semaine |
| **Historique des analyses avec filtres** | Basse | 2 jours |

---

## Plan d'Action par Phase

### Phase 1 — Sécurité Immédiate (1-2 jours)
1. Tourner tous les secrets exposés
2. Créer `.env.example` avec placeholders
3. Ajouter rate limiting sur les API routes
4. Corriger la race condition dans `incrementUsage`
5. Configurer le vrai `STRIPE_WEBHOOK_SECRET`

### Phase 2 — Robustesse (2-3 jours)
1. Ajouter Zod pour valider les réponses IA
2. Ajouter le retry pour les appels Gemini
3. Créer `src/lib/env.ts` pour valider les env vars
4. Optimiser les appels DB dans `plan.ts`

### Phase 3 — Nettoyage (1 jour)
1. Supprimer les fichiers inutiles
2. Corriger les dépendances (`@types/bcryptjs` → devDeps)
3. Unifier les traductions du Header
4. Mettre à jour `README.md`

### Phase 4 — Tests (3-5 jours)
1. Configurer Vitest
2. Écrire les tests unitaires (lib/, components/)
3. Configurer Playwright
4. Écrire les tests E2E (flux critiques)

### Phase 5 — Déploiement (1-2 jours)
1. Configurer CI/CD (GitHub Actions)
2. Configurer Stripe pour de vrai
3. Déployer sur Vercel
4. Vérifier les logs et monitoring

---

## Fichiers Concernés (Résumé)

| Fichier | Amélioration |
|---------|-------------|
| `.env`, `.env.local` | Rotation des secrets |
| `.env.example` | **Nouveau** — placeholders documentés |
| `src/lib/rate-limit.ts` | **Nouveau** — middleware rate limiting |
| `src/lib/env.ts` | **Nouveau** — validation des env vars |
| `src/lib/ai.ts` | Zod validation + retry Gemini |
| `src/lib/plan.ts` | Race condition + optimisation DB |
| `src/lib/types.ts` | Schéma Zod pour AnalyseResult |
| `src/middleware.ts` | Rate limiting |
| `src/components/Header.tsx` | Traductions i18n + menu mobile |
| `src/components/AnalyseResult.tsx` | React.memo |
| `src/components/ArticleForm.tsx` | Progression upload |
| `src/app/api/analyze/route.ts` | Utiliser plan optimisé |
| `src/app/api/upload/route.ts` | Streaming + validation MIME |
| `src/app/api/stripe/checkout/route.ts` | URLs avec locale |
| `src/app/[locale]/layout.tsx` | Meta OG |
| `src/app/[locale]/analyse/[id]/error.tsx` | **Nouveau** — Error boundary |
| `src/messages/*.json` | Clés header à ajouter |
| `package.json` | Nom + devDeps |
| `README.md` | Documentation projet |
