# PaperNote

PaperNote est une application SaaS d'analyse d'articles scientifiques par IA (Google Gemini) : comptes utilisateurs, quotas mensuels d'analyse, plans free / pro / business (Stripe) et interface multilingue FR / EN / AR.

## Stack technique

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Prisma** + **PostgreSQL**
- **NextAuth v5** (authentification, login Google optionnel)
- **Stripe** (abonnements, webhooks)
- **Google Gemini** (analyse IA)
- **Zod** (validation)

## Prérequis

- Node.js 20+
- Une base de données PostgreSQL
- Une clé API Google Gemini (`GEMINI_API_KEY`)

## Installation

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env.local
# puis éditer .env.local (voir ci-dessous)

# 3. Migration de la base de données
npx prisma migrate dev

# 4. Lancer le serveur de développement
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

Toutes les variables sont listées et documentées dans [`.env.example`](./.env.example) — le fichier est le source de vérité. Points importants :

- **`RESEND_API_KEY` absente** → la vérification email est **bypassée** en dev : l'inscription passe directement et les emails sont simplement loggés, pas envoyés. La clé est **requise en production**.
- **Stripe en mode test** : utiliser des clés `sk_test_` / `pk_test_`. Pour les webhooks en local :
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  ```
  puis copier le `whsec_...` affiché dans `STRIPE_WEBHOOK_SECRET`. Si `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` sont absents en dev, l'app crée les produits/prix dynamiquement (fallback).

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Serveur de développement             |
| `npm run build` | Build de production (`prisma generate` + `next build`) |
| `npm run start` | Serveur de production                |
| `npm run lint`  | Lint ESLint                          |

## Structure du projet

```
src/
  app/         # Pages et routes API (App Router)
  components/  # Composants React
  lib/         # Logique métier (auth, DB, IA, Stripe…)
  messages/    # Traductions i18n (FR / EN / AR)
prisma/        # Schéma Prisma et migrations
```
