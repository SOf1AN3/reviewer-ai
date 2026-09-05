# Plan MVP — PaperLens

> Analyse automatisée d'articles scientifiques par IA

## Nom : **PaperLens**

Regarder un article scientifique "à travers un oeil IA" — comme un relecteur scientifique augmenté. Court, mémorable, professionnel.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14+ (App Router) |
| Backend | Next.js API Routes |
| IA | Google Gemini (via `@google/generative-ai`) — abstrait pour changement futur |
| Base de données | PostgreSQL Neon + Prisma ORM |
| UI | Tailwind CSS + shadcn/ui |
| Validation | Zod (pour typer les réponses IA) |
| Langage | TypeScript |

---

## Structure du projet

```
reviewer/
├── prisma/
│   └── schema.prisma              # Schéma DB (Article, Analyse)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Page d'accueil / upload
│   │   ├── globals.css
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts       # POST /api/analyze
│   ├── components/
│   │   ├── ArticleForm.tsx        # Formulaire upload/colle texte
│   │   ├── AnalyseResult.tsx      # Affichage rapport + note
│   │   └── Header.tsx
│   ├── lib/
│   │   ├── db.ts                  # Instance Prisma
│   │   ├── ai.ts                  # Service IA (abstraction Gemini)
│   │   ├── prompt.ts              # Construction du prompt
│   │   └── types.ts               # Types TypeScript partagés
│   └── config/
│       └── crits.ts               # ← Fichier des critères d'analyse
├── .env.local                     # GEMINI_API_KEY, DATABASE_URL
├── next.config.js
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## Fichier `crits.ts` — Critères par défaut (scientifiques)

```ts
export const criteres = [
  {
    id: "rigueur_methode",
    label: "Rigueur méthodologique",
    description: "La méthodologie est-elle robuste, reproductible et appropriée au type d'étude ?"
  },
  {
    id: "originalite",
    label: "Originalité et novelty",
    description: "L'article apporte-t-il une contribution nouvelle par rapport à l'état de l'art ?"
  },
  {
    id: "revue_litterature",
    label: "Qualité de la revue de littérature",
    description: "La contextualisation et les références sont-elles complètes et pertinentes ?"
  },
  {
    id: "clarte_redaction",
    label: "Clarté de rédaction",
    description: "Le texte est-il clair, bien structuré et compréhensible pour la cible ?"
  },
  {
    id: "resultats_analyse",
    label: "Qualité des résultats et analyses",
    description: "Les résultats sont-ils présentés rigoureusement avec les analyses statistiques appropriées ?"
  },
  {
    id: "discussion_implications",
    label: "Discussion et implications",
    description: "La discussion est-elle approfondie avec des implications claires pour le domaine ?"
  },
  {
    id: "conformite_normes",
    label: "Conformité aux normes",
    description: "L'article respecte-t-il les standards de publication (structure IMRAD, format, citations) ?"
  },
  {
    id: "impact_potentiel",
    label: "Impact potentiel",
    description: "L'article a-t-il un potentiel d'impact significatif pour le domaine ?"
  }
];
```

---

## Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Article {
  id            String   @id @default(cuid())
  titre         String
  contenu       String   @db.Text
  auteur        String?
  revueCiblee   String?
  dateCreation  DateTime @default(now())

  analyses      Analyse[]
}

model Analyse {
  id            String   @id @default(cuid())
  articleId     String
  article       Article  @relation(fields: [articleId], references: [id])

  rapport       String   @db.Text     // Rapport complet généré par l'IA
  noteGlobale   Float                  // Note /100
  noteParCritere Json                  // { "rigueur_methode": 85, "originalite": 72, ... }
  dateAnalyse   DateTime @default(now())
}
```

---

## Service IA — Architecture abstraite

Interface commune pour changer de fournisseur facilement :

```ts
// src/lib/ai.ts
export interface AIProvider {
  generate(prompt: string): Promise<string>;
}

// Fournisseur Gemini (dev)
class GeminiProvider implements AIProvider { ... }

// Factory : on crée le bon provider selon la config
export function getAIProvider(): AIProvider { ... }
```

---

## Flux de l'application

```
┌──────────────────────────────────────────────────────┐
│  1. UTILISATEUR                                      │
│     Colle ou upload son article scientifique         │
│     (+ titre optionnel, auteur, revue ciblée)        │
└───────────────────────┬──────────────────────────────┘
                        │ POST /api/analyze
                        ▼
┌──────────────────────────────────────────────────────┐
│  2. BACKEND (API Route)                              │
│     a. Valide les données (Zod)                      │
│     b. Charge les critères depuis crits.ts           │
│     c. Construit le prompt avec :                    │
│        - L'article complet                           │
│        - Les critères + descriptions                 │
│        - Consignes de sortie JSON structuré          │
│     d. Envoie à Gemini                               │
│     e. Parse la réponse JSON                         │
│     f. Sauvegarde Article + Analyse en DB            │
│     g. Retourne le rapport + la note                 │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  3. FRONTEND                                         │
│     Affiche :                                        │
│     - Note globale /100 (visuelle, avec gauge)       │
│     - Note par critère (barres)                      │
│     - Rapport détaillé (sections par critère)        │
│     - Recommandations de l'IA                        │
│     - Possibilité de re-analyser                     │
└──────────────────────────────────────────────────────┘
```

---

## Structure de la réponse IA (JSON attendu)

```json
{
  "noteGlobale": 76,
  "notesParCritere": {
    "rigueur_methode": 82,
    "originalite": 68,
    "revue_litterature": 75,
    "clarte_redaction": 80,
    "resultats_analyse": 70,
    "discussion_implications": 65,
    "conformite_normes": 85,
    "impact_potentiel": 72
  },
  "rapport": {
    "resume": "Résumé global de l'analyse...",
    "points_forts": ["Point fort 1", "Point fort 2"],
    "points_a_ameliorer": ["Amélioration 1", "Amélioration 2"],
    "sections": {
      "rigueur_methode": { "note": 82, "commentaire": "..." },
      "originalite": { "note": 68, "commentaire": "..." }
    },
    "recommandations": ["Recommandation 1", "Recommandation 2"],
    "verdict": "Article acceptable avec révisions mineures"
  }
}
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Page principale : formulaire d'upload/colle du texte |
| `/analyse/[id]` | Page de résultat : rapport + note détaillée |
| `/historique` | Liste des articles analysés |

---

## Étapes d'implémentation

| # | Tâche | Détail |
|---|---|---|
| 1 | Init projet | `npx create-next-app@latest` + Prisma + shadcn + dépendances |
| 2 | Config DB | Schema Prisma + migration |
| 3 | Fichier crits.ts | Critères par défaut (modifiable) |
| 4 | Service IA | `ai.ts` + `prompt.ts` avec abstraction provider |
| 5 | API Route | `POST /api/analyze` — logique complète |
| 6 | Frontend — Formulaire | `ArticleForm.tsx` — upload/colle texte |
| 7 | Frontend — Résultat | `AnalyseResult.tsx` — affichage rapport + notes |
| 8 | Page d'accueil | Assemblage des composants |
| 9 | Page détail analyse | `/analyse/[id]` avec données DB |
| 10 | Tests & polish | Vérification end-to-end |

---

## Dépendances principales

```json
{
  "next": "14+",
  "react": "18+",
  "@google/generative-ai": "^0.x",
  "@prisma/client": "^5.x",
  "prisma": "^5.x",
  "zod": "^3.x",
  "tailwindcss": "^3.x"
}
```

---

## .env.local

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"
GEMINI_API_KEY="AIza..."
```
