# PLAN-REDESIGN.md — Refonte visuelle complète « Atmospheric Intelligence »

> Fichier dédié (le `PLAN.md` existant porte sur d'autres améliorations et n'est pas
> instruit par cette demande). Ce plan est écrasé à chaque nouvelle planification
> du sujet « redesign ».

## Contexte & besoin métier

L'utilisateur a refait **l'intégralité du design de la plateforme PaperNote avec Stitch AI**
et a déposé la maquette dans `/redesign/` :

- `redesign/DESIGN.md` — design system complet (palette, typo, espacements, shapes, composants).
- `redesign/code.html` — la landing page complète (791 lignes, Tailwind CDN, classes de référence).
- `redesign/screen.png` — capture globale incluant le **header** et le **footer** absents de `code.html`.

**Objectif** : remplacer l'intégralité du style néo-brutaliste actuel (bordures 3px, ombres
dures `4px 4px 0`, Space Grotesk, thème clair `#f5f0e8`) par le nouveau style
« Atmospheric Intelligence » : **dark glassmorphism**, surfaces translucides `rgba(38,61,63,.45)`,
bordures hairline 1px mentholées, glows radiaux (teal + ambre), crème `#F2F1EB`,
polices *Hanken Grotesk* / *Plus Jakarta Sans* / *JetBrains Mono*, rayons 8/16/24px.
La **landing page est intégralement refaite** (nouveaux textes, nouvelles sections).

Contraintes fortes du projet existant : Next.js 16 (App Router) + Tailwind v4, i18n **fr/en/ar**
(RTL pour `ar`), toggle clair/sombre existant, plans Stripe réels **0 / 19 / 49 €**,
21 fichiers `.tsx` utilisent les classes `brutal-*`, tests Vitest + E2E Playwright.

### Décisions validées par l'utilisateur (Phase 1)

1. **Thème clair conservé**, en variante dérivée de la nouvelle palette (pas de simple dark
   forcé) — le toggle clair/sombre reste.
2. **Vrais plans tarifaires** (0 / 19 / 49 €, free / pro / business) habillés au style redesign
   — les prix 0/29/149 € de la maquette sont purement illustratifs.
3. **Nouveau contenu de landing traduit dans les 3 langues** (fr/en/ar).
4. **Icônes : rester sur `lucide-react`** (pas de police Material Symbols).
5. **Portée : tout le site** (landing + header + footer + toutes les pages) avec **renommage
   propre des classes `brutal-*` → `pn-*`**.

### Références de design (extraites de DESIGN.md)

| Élément | Valeur sombre (canonical) | Rôle |
|---|---|---|
| Canvas | `#121414` | `--background` |
| Surfaces | `#1e2020` / `#282a2a` / `#333535` | cartes, élevations |
| Surface sage | `#1C2727` | panneaux mis en avant |
| Glass | `rgba(38,61,63,.45)` + `blur(20px)` | cartes flottantes |
| Glass border | `rgba(166,201,197,.18)` | bordures hairline |
| Cream text | `#F2F1EB` | titres / fill boutons primaires |
| Cream muted | `#A8ABA5` | texte secondaire |
| Teal | `#99d0d6` / `#A6C9C5` / `#4F858B` | accents, rings, glows |
| Copper/amber | `#D97742` / `#E87C3E` | badges risque, étoiles, CTA glow |
| Texte secondaire | `#bfc8c9` | `on-surface-variant` |
| Outline | `#8a9293` / `#404849` | placeholders, séparateurs |
| Error | `#ffb4ab` / `#93000a` | destructif |

Typo : **Hanken Grotesk** (titres, data), **Plus Jakarta Sans** (corps, UI), **JetBrains Mono**
(labels techniques, badges). Titres en tracking serré `-.02em à -.03em`.
Rayons : inputs `8px`, cartes internes `16px`, cartes/flottants `24px`, pills `9999px`.
Conteneur max `1240px`. Élévation par glows + hairlines, pas par ombres dures.

---

## Questions / décisions en attente

Aucune — les 5 arbitrages ci-dessus sont tranchés.

---

## 1. Base de données (DB)

**Aucun impact.** Refonte 100 % présentation : aucune migration, aucun schéma Prisma,
aucune route API ne change.

---

## 2. Design tokens & fondations CSS

### 2.1 Tâche T1 — Refonte de `src/app/globals.css` (fichier unique)

**Dépendances** : aucune (première tâche).

**Contenu** :

1. **Palette sombre (`.dark`)** — valeurs canoniques du tableau ci-dessus + tokens dédiés :
   `--background #121414`, `--foreground #e2e2e2`, `--card #1e2020`,
   `--card-foreground #f2f1eb`, `--primary #99d0d6`, `--primary-foreground #00363b`,
   `--secondary #364d4f`, `--secondary-foreground #a4bdbf`, `--muted #282a2a`,
   `--muted-foreground #a8aba5`, `--accent #d87742`, `--accent-foreground #4b1b00`,
   `--destructive #93000a`, `--destructive-foreground #ffdad6`,
   `--border rgba(166,201,197,.18)`, `--input rgba(166,201,197,.2)`, `--ring #4f858b`.
2. **Palette claire dérivée (`:root`)** — mêmes rôles, teintes respectueuses du design system
   (fond crème `#f4f2ec`, texte `#191b1b`, surfaces `#fbfaf6`/`#ffffff`,
   primaire teal foncé `#2f666c` (texte crème `#f7f6f1`, contraste AA), accent cuivre `#b85c2a`,
   bordures `rgba(25,27,27,.14)`, muted-foreground `#5c6465`, destructif `#b3261e`).
   ⚠️ Le clair est une **dérivation cohérente**, pas un copier-coller du sombre.
3. **Tokens sémantiques qui basculent selon le thème** (utilisés partout) :
   `--cream-text`, `--cream-muted`, `--teal-highlight`, `--amber-badge`, `--surface-sage`,
   `--surface-glass`, `--glass-border`, `--sage-glow`, `--amber-glow`, `--outline`.
   Ex. sombre : `--cream-text #f2f1eb` / clair : `--cream-text #191b1b` ;
   sombre `--teal-highlight #a6c9c5` / clair `#2f666c`.
4. **Tokens de bouton dédiés** : `--btn-fill` / `--btn-ink`
   (sombre : crème `#f2f1eb` + encre `#191b1b` ; clair : teal `#2f666c` + crème `#f7f6f1`).
5. **Couleurs de score** conservées mais retintées : `--score-great`, `--score-good`,
   `--score-ok`, `--score-bad` (teal → ambre → cuivre → rouge, lisibles dans les 2 thèmes).
6. **`@theme inline`** : mapping `--color-*` existants + **nouveaux tokens de couleur** pour
   rendre les classes de la maquette utilisables quasi 1:1 :
   `--color-surface-sage`, `--color-surface-glass`, `--color-glass-border`,
   `--color-cream-text`, `--color-cream-muted`, `--color-teal-highlight`,
   `--color-amber-badge`, `--color-sage-glow`, `--color-amber-glow`,
   `--color-surface-container-low(-est/-high/-est)` (variantes par thème),
   `--color-on-surface-variant`, `--color-outline`, `--color-error`, `--color-error-container`,
   `--color-primary-container`, `--color-secondary-container`, `--color-tertiary-container`.
   Fonts : `--font-display: var(--font-hanken)`, `--font-sans: var(--font-jakarta)`,
   `--font-mono: var(--font-jetbrains-mono)`.
7. **Renommage + restylage des utilitaires** (`brutal-*` → `pn-*`, style nouveau) :
   - `.pn-card` — glass : `background: var(--surface-glass)`, `backdrop-filter: blur(20px)`,
     `border: 1px solid var(--glass-border)`, `border-radius: 1rem`, padding fluid.
   - `.pn-card-hover` — idem + `transition` subtile, hover : surface légèrement plus claire
     (`--surface-container-high`) + hairline plus lumineuse (pas de lift brutal).
   - `.pn-input` — fond `rgba(25,27,27,.7)` (clair : blanc), `1px solid var(--glass-border)`,
     `radius .5rem`, focus : ring teal `box-shadow: 0 0 12px rgba(79,133,139,.3)`.
   - `.pn-btn` — **primaire crème** : `background: var(--btn-fill)`, `color: var(--btn-ink)`,
     `radius .75rem`, `1px` bordure assortie, glow `0 0 24px rgba(153,208,214,.35)` au hover
     + `translateY(-1px)` ; disabled : opacity + no transform.
   - `.pn-btn-secondary` — ghost glass : `rgba(79,133,139,.15)` + bordure `rgba(166,201,197,.3)`
     + texte `--cream-text`.
   - `.pn-btn-accent` — cuivre ambre, `.pn-btn-destructive` — fond `--destructive`.
   - `.pn-badge`, `.pn-tag` — pills (`border-radius: 9999px`), bordure hairline, typo label.
   - Animations : `animate-brutal-shake/bounce` → `animate-pn-shake/pn-bounce` (conservées).
   - **Suppression** de toutes les classes `brutal-*` et des `--brutal-*`.
8. **Scrollbar** sombre discrète (hairline teal), `body` en `font-sans` (Plus Jakarta Sans),
   `border-color` global sur `*` conservé (mappe sur le nouvel `--border` translucide).

**Fait quand** : `globals.css` ne contient plus aucune occurrence de `brutal`,
les deux thèmes sont définis, et les classes `pn-*` + tokens `--color-*` du point 6 existent.

---

### 2.2 Tâche T2 — Renommage mécanique dans les fichiers TSX (sauf landing)

**Dépendances** : T1.

**Fichiers (20)** — remplace `brutal-*` → `pn-*` (+ variante `*-secondary/accent/destructive`),
en préservant la logique et l'accessibilité (aria, focus-visible) :

- Composants : `src/components/Header.tsx`, `PricingCard.tsx`, `ErrorState.tsx`,
  `CookieBanner.tsx`, `ArticleForm.tsx`, `AnalyseResult.tsx`
- Pages : `src/app/[locale]/` → `login/`, `register/`, `reset-password/`, `verify/`,
  `analyser/`, `analyse/[id]/`, `historique/`, `pricing/`, `admin/`,
  `settings/profile/`, `settings/settings/api` *(chemin réel : `settings/api/`)*,
  `settings/billing/`, `legal/terms/`, `legal/privacy/`, `legal/cookies/`
  (les `page.tsx` de chacun, soit 16 pages)
- ❌ **Exclure** `src/app/[locale]/page.tsx` (landing) → réécrite en T5.

**Fait quand** : `grep -r "brutal-" src` ne retourne plus rien (hors éventuels commentaires
obsolètes à purger), et que le build type-checke.

---

### 2.3 Tâche T3 — Polices + fondations du layout

**Dépendances** : T1 (tokens `--font-*`).

**Fichiers (3)** :
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/opengraph-image.tsx`
- `src/app/globals.css` (ajout mineur si nécessaire)

**Contenu** :
1. Remplacer `Space_Grotesk` par `Hanken_Grotesk` (`--font-hanken`, weights 300..700)
   et `JetBrains_Mono` restant, **ajouter `Plus_Jakarta_Sans`** (`--font-jakarta`).
   Lire `node_modules/next/dist/docs/` si la syntaxe `next/font` diffère de la version
   connue (règle AGENTS.md du projet).
2. Classe `<html>` : `${hanken.variable} ${jakarta.variable} ${jetbrainsMono.variable}`.
3. **Thème par défaut = sombre, sans flash** : `getServerSnapshot()` de `ThemeProvider`
   passe à `"dark"` et le rendu serveur inclut la classe `dark` par défaut ; conserver la
   persistance localStorage et le toggle. (`src/components/ThemeProvider.tsx` si nécessaire —
   4e fichier, à limiter au strict nécessaire.)
4. Recolorer `opengraph-image.tsx` avec la palette nouvelle (fond `#121414`, titre crème,
   accent teal/cuivre).
5. Vérifier `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` : remplacer les restes
   néo-brutalistes (bordures `border-[3px]`, ombres `shadow-[Npx_Npx_0_var(--border)]`,
   `uppercase` abusif) par le vocabulaire `pn-*`.

**Fait quand** : le site s'affiche dans les 3 polices, le dark est le défaut, aucun flash,
les pages d'erreur sont au nouveau style.

---

## 3. Contenu i18n (nouvelle landing + pricing)

### 3.1 Tâche T4 — Dictionnaires fr/en/ar

**Dépendances** : aucune (peut démarrer après T1, parallèle intellectuel avec T2/T3).

**Fichiers (3)** : `src/messages/fr.json`, `en.json`, `ar.json`.

**Contenu** :

1. **Remplacer intégralement la clé `home`** (l'ancien `home.*` n'est utilisé que par la
   landing) par la structure suivante, traduite dans les 3 langues :
   - `home.hero` : `badge`, `badgeTag`, `titleLead`, `titleHighlight`, `titleTail`,
     `subtitle`, `cta`, `tabFile`, `tabUrl`, `formatsLabel`, `dropTitle`, `dropHint`,
     `arxivLabel`, `arxivPlaceholder`, `engineNote`, `assurance1..3`
   - `home.compare` : `eyebrow`, `title`, `beforeTag`, `beforeBadge`,
     `beforeItems[3]{title,desc}`, `beforeVerdictLabel`, `beforeVerdict`,
     `afterTag`, `afterBadge`, `afterItems[3]{title,desc}`, `afterVerdictLabel`, `afterVerdict`
   - `home.pillars` : `eyebrow`, `title`, `subtitle`, `items[3]{tag,title,desc,check}`
   - `home.report` : `eyebrow`, `title`, `subtitle`, `fileName`, `tabVerdict`,
     `tabCriteria`, `tabChecklist`, `scoreLabel`, `scoreTag`, `simulationTag`,
     `simulationText`, `synthTitle`, `synthMeta`, `synthText`,
     `priorities[3]{label,title,desc}`, `exportNote`, `downloadLink`,
     `checklist[3]{title,desc}`
   - `home.audience` : `eyebrow`, `title`, `subtitle`, `items[3]{title,desc,benefitLabel,benefit}`
   - `home.stats` : `items[3]{value,label}` → « 14,200+ / 98.4% / 90s » de la maquette
   - `home.testimonials[3]` : `{quote,name,role,initials}`
   - `home.pricingSection` : `eyebrow`, `title`, `subtitle`
   - `home.finalCta` : `eyebrow`, `title`, `subtitle`, `button`, `trust[3]`
   - `home.footer` : `tagline`, `navTitle`, `nav{features,comparison,pricing,login,register}`,
     `legalTitle`, `legal{terms,privacy,cookies}`, `rights`, `aiDisclaimer`
2. **`pricing`** : conserver `title/subtitle/free/pro/business/guarantee` et **ajouter
   `price`** (0/19/49 + « /mois ») et **`features[4..5]`** par plan (listes réelles,
   extraites de `src/app/[locale]/pricing/page.tsx`), **plus `tierTag[3]`**
   (« Offert » / « Individuel » / « Équipe ») et `popularBadge` (« Le plus plébiscité »)
   pour les cartes de la landing et de `/pricing`.
3. **Ne pas toucher** à `criteria` (utilisé par `AnalyseResult`) ni aux autres sections
   (`header`, `login`, `register`, `analyze`, `articleForm`, `historique`,
   `analyseDetail`, `result`, `settings`, `legal`, `admin`, `metadata`).

**Critères de qualité** : le FR reprend **mot pour mot** le contenu de `redesign/code.html` ;
l'EN et l'AR sont des traductions naturelles (l'AR reste RTL-safe : pas d'émoticônes inversées) ;
JSON valide, même arborescence dans les 3 fichiers.

**Fait quand** : les 3 JSON sont valides, `home` nouveau, `pricing` enrichi, `criteria` intact.

---

## 4. UI Components

### 4.1 Tâche T5 — Landing page refaite

**Dépendances** : T4 (dictionnaires), T1 (tokens).

**Fichiers (2)** :
- `src/app/[locale]/page.tsx` — **réécriture complète**
- `src/components/landing/ReportConsole.tsx` — **nouveau** (la console interactive à onglets)

**Structure à porter depuis `redesign/code.html`** (sections dans l'ordre) :

1. **Hero** — badge live (point ambre pulsé + pill « Taux d'acceptation +42% »), `h1`
   crème avec span teal, sous-titre, **boîte CTA interactive** : onglets
   « Fichier PDF / LaTeX » ↔ « Lien arXiv / DOI », dropzone (icône `Upload`/`CloudUpload`
   lucide), champ URL arXiv/DOI, barre d'action (point teal + « Moteur v4.8 » +
   bouton crème glow « Auditer mon manuscrit gratuitement »), ligne de réassurance ×3.
   → **Interactions** : état d'onglet React ; clic sur la dropzone/CTA = navigation vers
   `/${locale}/analyser` (le vrai upload reste sur `/analyser`, ArticleForm).
   Backdrop : deux blobs radiaux absolus (`--sage-glow`, `--amber-glow`, `blur(120-140px)`).
2. **Comparatif avant/après** — 2 colonnes : carte « Parcours classique sans audit »
   (point rouge, items `error`, verdict « Rejet catégorique ») / carte « Parcours avec
   PaperNote » (`bg-surface-sage`, items teal/ambre, pill « Score d'acceptabilité : 89/100 »).
3. **3 piliers** — icônes lucide (`Target`/`Gavel`/`Zap` ou équivalents), tags « Pilier 01-03 »
   ambre, titre `headline-md`, check en pied de carte.
4. **Console de rapport** (`ReportConsole.tsx`) — cadre `surface-container-lowest` :
   barre de fenêtre (3 points + nom de fichier), **3 onglets React** :
   - *Verdict Exécutif* : jauge radiale SVG (score 89/100, stroke `teal-highlight`,
     track `rgba(255,255,255,.08)`, `data-display` 48px) + bloc « Simulation du comité » ;
     colonne droite : synthèse + 3 priorités (labels 1/2/3 ambre/teal/muted) + lien export.
   - *8 Critères Détaillés* : **utiliser les libellés de `dict.criteria`** (les 8 existants)
     + barres de progression et pourcentages figés de la maquette (94/82/74/88/96/91/98/85).
   - *Checklist de Révision* : 3 items avec cases à cocher (UI, `readOnly`/`disabled` ou
     état local, aucune persistance).
5. **Audience** — 3 cartes (Chercheurs/Laboratoires/Auteurs non-anglophones) avec encart
   « Bénéfice immédiat ».
6. **Stats + témoignages** — bandeau 3 chiffres (`data-display`) + 3 cartes témoignages
   (5 étoiles ambre `Star` lucide, avatar initiales, nom/rôle).
7. **Section tarifs** — 3 cartes au **vrais plans** : `dict.pricing.free/pro/business`
   (0 / 19 / 49 € + features traduites), tier centrale mise en avant
   (badge « Le plus plébiscité » ambre, fill crème), CTAs → `/${locale}/pricing`
   (ou checkout selon l'état session — reproduire la logique actuelle de `/pricing`
   uniquement si simple, sinon lien vers `/pricing`).
8. **CTA final** — panneau `surface-sage` avec blobs glow, titre `headline-xl`, bouton crème,
   3 mentions de confiance (lucide `ShieldCheck`, `Trash2`, `BadgeCheck`).

**Accessibilité/qualité** : `section` avec ancrages `id` (`#features`, `#comparison`,
`#pricing`) pour le nav du header, hiérarchie `h1→h2→h3`, contrastes AA sur fond sombre,
RTL safe (pas de `left-`/`right-` critiques → utiliser `ms/me` ou centrage), responsive
(grid 1 colonne < 768px, collapse dashboard < 1024px), `next/link` pour les navigations.

**Fait quand** : la landing reproduit `code.html` section par section, est traduite en 3
langues, et les onglets de la console + du hero fonctionnent.

---

### 4.2 Tâche T6 — Header + Footer + layout

**Dépendances** : T1, T3.

**Fichiers (3)** :
- `src/components/Header.tsx` (refonte, logique conservée)
- `src/components/Footer.tsx` (**nouveau**)
- `src/app/[locale]/layout.tsx` (insertion du `<Footer />` après `<main>`)

**Header** (d'après `screen.png`) : barre translucide `backdrop-blur` + bordure basse
hairline, logo **icône lucide dans un carré sage arrondi + « PaperNote » en Hanken 600** ;
nav centrale (liens existants conservés et repliés en `pn-btn-ghost` discrets ;
quand non connecté, ajouter les ancres landing `#features`/`#comparison`/`#pricing`
**uniquement sur la page d'accueil** via `usePathname`) ; à droite : sélecteur de langue
(design actuel en panneau glass), toggle thème (bouton rond glass), « Connexion » ghost +
**CTA primaire crème « Commencer un audit »** (`${locale}/analyser`).
Menu mobile : panneau glass full-width, mêmes items empilés, coins arrondis.
Conserver : `useSession`, `signOut`, `fetch("/api/user/plan")`, labels i18n `dict.header.*`,
`aria-label`, états `mobileOpen`/`langOpen`.

**Footer** (d'après `screen.png`) : bandeau `surface-container-lowest`, colonnes
logo+tagline / `home.footer.navTitle`+liens / `legalTitle`+liens (terms/privacy/cookies),
ligne basse : mentions `home.footer.rights` + `aiDisclaimer`, liens login/register.
`pn-*` partout, responsive 1→3 colonnes.

**Fait quand** : header/footer identiques à la capture dans les 3 langues, logique session
inchangée, footer présent sur toutes les pages.

---

### 4.3 Tâche T7 — PricingCard + page `/pricing`

**Dépendances** : T2 (classes renommées), T4 (`pricing.*` enrichi).

**Fichiers (2)** : `src/components/PricingCard.tsx`, `src/app/[locale]/pricing/page.tsx`.

**Contenu** :
- `PricingCard` : carte `pn-card` (centrale featured : `bg-surface-container-high`,
  halo ambre `0 0 16px rgba(217,119,66,.35)`, badge pill « Le plus plébiscité »
  `-top-3 left-1/2 -translate-x-1/2`), prix en `font-display` 48px (`data-display`),
  tags de plan pill (`Offert`/`Individuel`/`Équipe`), features avec `Check` teal / `X` muted,
  CTA : featured = bouton crème glow, sinon ghost. État `currentPlan` conservé (opacity +
  libellé). Prop **inchangés** (`plan, price, features, cta, highlighted, currentPlan, onSelect`).
- Page `/pricing` : reprendre le titre/sous-titre du dictionnaire, **les features list
  migrées vers `dict.pricing.*.features`** (suppression du hardcodage FR), prix 0/19/49
  intacts, logique checkout Stripe (`/api/stripe/checkout`) **intacte**.

**Fait quand** : la page est au nouveau style, le contenu est i18n, le checkout n'a pas bougé.

---

### 4.4 Tâche T8 — Composants transverses (chrome)

**Dépendances** : T2.

**Fichiers (2)** : `src/components/ErrorState.tsx`, `src/components/CookieBanner.tsx`.

Contenu : `pn-card`/`pn-badge`/`pn-btn*`, bandeau cookies en panneau glass collant
(bottom, `surface-glass` + blur + hairline, coins 16px), focus-visible conservés,
z-index inchangés.

---

### 4.5 Tâche T9 — Flux d'analyse (formulaire + résultats)

**Dépendances** : T2.

**Fichiers (2)** : `src/components/ArticleForm.tsx`, `src/components/AnalyseResult.tsx`.

Contenu : `pn-input` (dropzone : fond `surface-container-low`, hover `surface-sage`,
icône teal), `pn-btn`, cartes `pn-card` en `rounded-xl`, jauges de score avec couleurs
`--score-*` retintées, badges pills. **Aucune modification de logique/props/états.**

---

### 4.6 Tâche T10 — Pages d'authentification

**Dépendances** : T2, T3.

**Fichiers (4)** : `src/app/[locale]/login/page.tsx`, `register/page.tsx`,
`reset-password/page.tsx`, `verify/page.tsx`.

Contenu : cartes `pn-card` centrées `max-w-md` sur fond canvas avec blob glow discret,
inputs `pn-input`, boutons `pn-btn`/`pn-btn-secondary` (OAuth = ghost), messages d'erreur
en pill `destructive`. Logique (server actions, NextAuth, tokens) **inchangée**.

---

### 4.7 Tâche T11 — Pages application

**Dépendances** : T2.

**Fichiers (3)** : `src/app/[locale]/analyser/page.tsx`,
`src/app/[locale]/analyse/[id]/page.tsx`, `src/app/[locale]/historique/page.tsx`.

Contenu : `pn-card`, `pn-tag` (auteur/revue en pills), `pn-btn`, listes en cartes glass
`rounded-xl`, états vides/chargement au style (déjà gérés → seulement le habillage).

---

### 4.8 Tâche T12 — Pages settings + admin

**Dépendances** : T2.

**Fichiers (4)** : `src/app/[locale]/settings/profile/page.tsx`,
`settings/billing/page.tsx`, `settings/api/page.tsx`, `src/app/[locale]/admin/page.tsx`.

Contenu : cartes `pn-card`, inputs `pn-btn`/`pn-input`, tags role/plan en pills,
zone destructive en `pn-btn-destructive`, tableaux/listes en surfaces glass.
Logique (Stripe, API keys, rôles) **inchangée**.

---

### 4.9 Tâche T13 — Pages légales

**Dépendances** : T2.

**Fichiers (3)** : `src/app/[locale]/legal/terms/page.tsx`, `legal/privacy/page.tsx`,
`legal/cookies/page.tsx`.

Contenu : typo `font-sans` confortable (17/16px, mesure ~70ch), titres `font-display`,
séparateurs hairline, boutons du bandeau cookies déjà traités en T8 → ici, simple harmonisation.

---

## 5. Tests & validation

### 5.1 Tâche T14 — Tests unitaires + build

**Dépendances** : toutes les tâches UI.

- `npx vitest run` (les tests existants ne testent pas le style → doivent passer à l'identique).
- `npx tsc --noEmit` (via `npm run build` ou lint du projet) + `npm run lint`.
- Vérification finale : `grep -ri "brutal" src` → **0 résultat**.

### 5.2 Tâche T15 — E2E (invoquer `Tester` en fin de module)

**Dépendances** : T14.

- `e2e/navigation.spec.ts`, `legal.spec.ts`, `auth.spec.ts`, `analyse.spec.ts`
  via MCP Playwright → corriger les sélecteurs/textes si la refonte les impacte
  (les specs ne référencent aucune classe `brutal-*` — impact attendu : libellés de la
  landing si les textes ont changé).

---

## Sécurité & edge cases à couvrir

- **Aucune surface d'attaque new** : pas d'API, pas de DB, pas d'input nouveau. La dropzone
  de la landing **ne téléverse rien** (navigation vers `/analyser`) → pas d'upload improvisé.
- **i18n / RTL (`ar`)** : vérifier `dir="rtl"` sur la nouvelle landing (éviter `left-`/
  `right-` absolus non miroir ; préférer `start`/`end` ou centrage), et que les traductions
  AR ne cassent pas les grilles (textes plus longs en FR/EN → test de débordement).
- **Contraste (WCAG AA)** : crème `#F2F1EB` sur `#121414` ✓ ; bouton crème + encre `#191B1B` ✓ ;
  teal `#A6C9C5` sur `#1C2727` ✓ ; **vérifier le thème clair dérivé** (teal `#2f666c` sur
  crème, ambre `#b85c2a` sur crème) — le Reviewer doit contrôler les couples texte/fond.
- **Flash de thème (FOUC)** : dark par défaut côté serveur (snapshot `"dark"`) +
  `suppressHydrationWarning` déjà présent ; ne pas réintroduire un toggle `light` par défaut.
- **Hydratation** : le landing utilise `usePathname`/état d'onglets → garder un rendu
  serveur déterministe (onglets initialisés côté serveur, pas de `Date.now()`/`Math.random()`).
- **Scores/couleurs** : `--score-*` doivent rester lisibles dans les **deux** thèmes
  (usage dans `AnalyseResult`, `settings/profile`).
- **i18n sémantique** : `dict.criteria` **intouché** (partagé avec `AnalyseResult`) ;
  l'ancien `home.*` supprimé uniquement s'il n'est plus référencé (vérifier après T5).
- **Régression fonctionnelle** : `ArticleForm`, `AnalyseResult`, `PricingCard`,
  `Header`, checkout Stripe, menu mobile, switch langue/thème → comportements identiques,
  seule la peau change.
- **Responsive** : 360px (mobile), 768px, 1024px, 1240px (conteneur max) — le dashboard
  de la landing se replie en colonne unique < 1024px.
- **Performance** : 3 familles Google via `next/font` (self-hosted, `display=swap`),
  pas de police Material Symbols ajoutée, `backdrop-filter` limité aux panneaux clés.

---

## Ordre d'exécution (séquentiel, une tâche = un verdict Reviewer = un commit)

| # | Tâche | Type | Fichiers | Dépend de |
|---|---|---|---|---|
| 1 | **T1** Tokens + classes `pn-*` | Frontend | `src/app/globals.css` | — |
| 2 | **T2** Renommage mécanique (20 fichiers) | Frontend | 20 `.tsx` (hors landing) | T1 |
| 3 | **T3** Polices + layout + OG + pages d'erreur | Frontend | `layout.tsx`, `opengraph-image.tsx`, `not-found/error/global-error`, `ThemeProvider.tsx` | T1 |
| 4 | **T4** Dictionnaires fr/en/ar | Frontend | `messages/fr.json`, `en.json`, `ar.json` | — |
| 5 | **T5** Landing + console | Frontend | `[locale]/page.tsx`, `components/landing/ReportConsole.tsx` | T4, T1 |
| 6 | **T6** Header + Footer | Frontend | `Header.tsx`, `Footer.tsx`, `layout.tsx` | T3 |
| 7 | **T7** PricingCard + `/pricing` | Frontend | `PricingCard.tsx`, `pricing/page.tsx` | T2, T4 |
| 8 | **T8** ErrorState + CookieBanner | Frontend | 2 composants | T2 |
| 9 | **T9** ArticleForm + AnalyseResult | Frontend | 2 composants | T2 |
| 10 | **T10** Pages auth (4) | Frontend | login/register/reset-password/verify | T2, T3 |
| 11 | **T11** Pages app (3) | Frontend | analyser/analyse/[id]/historique | T2 |
| 12 | **T12** Settings + admin (4) | Frontend | settings/* + admin | T2 |
| 13 | **T13** Pages légales (3) | Frontend | legal/* | T2 |
| 14 | **T14** Unit tests + lint + build + grep final | Lead | — | T1-T13 |
| 15 | **T15** E2E (Tester) | Tester | — | T14 |

*Règle : après chaque tâche Frontend → `Reviewer` sur le `git diff` ; feu vert →
micro-commit Conventional Commits (`feat(ui): …`, `refactor(ui): …`, `docs(i18n): …`).*
*Ne jamais committer le dossier `redesign/` sans demande explicite (il reste une référence).*

---

## Validation finale (Reviewer → Tester)

1. **Reviewer** : revue globale finale (diff complet) — typage strict, aucune régression
   fonctionnelle, contrastes AA dans les 2 thèmes, RTL, cohérence `pn-*`, zéro `brutal-*`.
2. **Tester** : parcours E2E Playwright (navigation, auth, analyse, légal) + vérification
   visuelle des 4 points de rupture (landing, login, pricing, settings) en **dark + light**,
   desktop + mobile, et en locale **ar**.
3. **Synthèse utilisateur** : liste des fichiers touchés, statut des revues/tests,
   éventuels écarts par rapport à `redesign/code.html`.
