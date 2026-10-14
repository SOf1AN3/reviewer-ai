# Opérations PaperNote

Procédures d'exploitation : sauvegardes, migrations, seed de démonstration,
restauration, surveillance.

> **Honnêteté d'abord** — état réel au moment de la rédaction (tâche T6.4) :
>
> | Sujet | Automatisé aujourd'hui ? |
> |---|---|
> | Sauvegardes (dump régulier) | **NON** — aucun cron, aucune étape CI/CD ne produit de dump |
> | Point-in-time restore (Neon) | **À CONFIGURER** dans le dashboard Neon (dépend du plan du projet, non vérifiable depuis ce dépôt) |
> | Migrations en production | **NON** — appliquées **manuellement** (`prisma migrate deploy`) |
> | Seed de démonstration | Manuel uniquement, **volontairement** (`npm run db:seed`) |
> | Surveillance | Endpoint `GET /api/health` **existant** ; aucun moniteur externe câblé ici |
>
> Rien dans ce dépôt ne s'exécute tout seul contre la base de production :
> la CI (`.github/workflows/ci.yml`) fait lint + typecheck + tests + build, et
> le déploiement (`.github/workflows/deploy.yml`) ne fait que
> `vercel pull` / `vercel build` / `vercel deploy`. Aucune de ces étapes ne
> touche à la base.

---

## 1. Sauvegardes

### 1.1 Variables et accès — règles permanentes

- `DATABASE_URL` contient le **mot de passe de la base**. Elle ne doit
  **jamais** être :
  - commitée (`.env*` est bien ignoré par git, seule `.env.example` l'est) ;
  - affichée (`echo`, `Write-Host`, logs de CI) ni collée dans un ticket ;
  - passée en argument de commande sur une ligne clonée dans un script
    partagé (historique de shell, output de job CI).
- Neon fournit **deux** formes d'URL pour le même projet :
  - l'URL **pooled** (hôte contenant `-pooler`) : celle de l'application,
    c'est la valeur de `DATABASE_URL` dans `.env` / Vercel ;
  - l'URL **directe** (même hôte **sans** `-pooler`) : obligatoire pour
    `pg_dump`, `pg_restore` et `prisma migrate` — les connexions poolées
    cassent ces outils. On la récupère dans le dashboard Neon
    (bouton **Connect** → décocher *Connection pooling*).
- Priorité de résolution des variables (application **et** seed) :
  variable déjà présente dans le shell/process > `.env.local` > `.env`.
  En production, tout passe par les variables définies dans Vercel
  (Project → Settings → Environment Variables).

### 1.2 Neon « instant restore » (point-in-time recovery)

Neon conserve un historique des modifications (WAL) permettant de restaurer la
base à une seconde près — c'est le point-in-time recovery du projet.

**Étapes réelles (dashboard Neon)** :

1. Ouvrir `https://console.neon.tech`, sélectionner le projet PaperNote.
2. Aller dans **Settings → Postgres**.
3. Section **History window** : régler le curseur sur la durée de rétention
   voulue (elle s'applique à toutes les branches du projet).
4. Cliquer **Save**.

**Limites par plan et coût** (documentation Neon) :

| Plan | Par défaut | Maximum |
|---|---|---|
| Free | 6 heures | 6 heures (plafonné à 1 Go d'historique) |
| Launch | 1 jour | 7 jours |
| Scale | 1 jour | 30 jours |

L'historique est facturé **0,20 $/Go-mois**. Régler `history_retention_seconds`
à 0 **désactive** instant restore.

Même réglage via l'API Neon :

```bash
curl -X PATCH 'https://console.neon.tech/api/v2/projects/{project_id}' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{ "project": { "history_retention_seconds": 604800 } }'   # 604800 = 7 jours
```

**Recommandation** : ≥ **7 jours** en production (recommandation Neon
« getting ready for production »), ce qui suppose un plan Launch ou Scale.
La restauration s'effectue depuis le dashboard (instant restore), en quelques
secondes.

> ⚠️ **À faire, pas encore fait** : vérifier dans le dashboard Neon quel plan
> est actif et quelle fenêtre d'historique est en place, puis passer à ≥ 7 jours
> si le projet est en production. Ce dépôt ne peut pas le faire à votre place.

### 1.3 Secours manuel : `pg_dump`

Procédure manuelle, indépendante de Neon (c'est le filet de sécurité si le
projet Neon lui-même est perdu).

Prérequis : `pg_dump` / `pg_restore` installés en local et de version
proche du serveur (`pg_dump -V`) — **absents sur la machine de dev actuelle**.

```bash
# $DATABASE_URL_DIRECT : URL DIRECTE de Neon (hôte sans "-pooler"), lue dans
# le dashboard (Connect → décocher "Connection pooling"). Jamais de mot de
# passe en clair dans l'historique de commande ni dans un fichier versionné.
# Stocker les dumps HORS du dépôt (ou ajouter "/backups/" au .gitignore).
pg_dump --format=custom --no-owner --no-privileges \
  --file="papernote-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  --dbname="$DATABASE_URL_DIRECT"
```

- `-Fc` / `--format=custom` : format compressé, restaurable **en partie**.
- `--no-owner --no-privileges` : la restauration ne dépend pas des rôles
  source (utile pour restaurer ailleurs).
- Vérifier le dump aussitôt : `pg_restore --list <fichier>.dump | head` doit
  afficher le contenu de l'archive.

### 1.4 Fréquence et rétention recommandées

- **Instant restore Neon** : fenêtre ≥ 7 jours (voir 1.2).
- **Export `pg_dump`** : **quotidien**, rétention **30 jours** en ligne +
  un dump mensuel archivé plus longtemps si besoin de conformité.
- ⚠️ **Aucune automatisation n'est en place aujourd'hui.** Aucun cron, aucune
  GitHub Action, aucun job de dump n'existe dans ce dépôt : c'est à
  configurer. Pistes concrètes (aucune n'est encore mise en œuvre) :
  - GitHub Action nocturne déposant les dumps dans un bucket S3 (guide Neon :
    « Automate pg_dump backups », parties S3 puis GitHub Action) ;
  - cron local/serveur lançant la commande 1.3 ;
  - API Neon (`projects/{id}/branches` + exports) depuis un job planifié.
- Vérification recommandée : un dump par semaine doit être **restauré** dans
  une base jetable pour prouver qu'il est bon (cf. 1.6).

### 1.5 Restauration

> ⚠️ **Procédure NON TESTÉE.** Elle n'a pas pu être exécutée dans le cadre de
> la tâche T6.4 : `pg_dump`/`pg_restore` ne sont pas installés sur la machine
> de dev, et aucune restauration n'a été tentée sur la base de production
> (contient des données réelles). Considérer ces commandes comme « à valider »
> jusqu'à exécution effective du paragraphe 1.6.

**Option A — instant restore Neon (la plus rapide)** :
dashboard → projet → **Instant restore** → choisir la date/heure cible →
confirmer. S'applique à la branche racine du projet.

**Option B — restauration d'un dump `pg_restore`** :

```bash
# 1. Recréer une base vierge cible (en local ou une nouvelle base Neon).
# 2. Restaurer le dump dedans :
pg_restore --dbname="$DATABASE_URL_DIRECT_CIBLE" \
  --no-owner --no-privileges --verbose \
  "papernote-20261014T120000Z.dump"
```

Préférer **toujours** restaurer dans une **nouvelle base** (ou une nouvelle
branche Neon) puis basculer l'application sur cette base (mise à jour de
`DATABASE_URL` + redéploiement) plutôt que d'écraser la base vivante avec
`--clean --if-exists`.

Après toute restauration :

1. `npx prisma migrate status` (les migrations doivent être « appliquées ») ;
2. `GET /api/health` doit renvoyer `"status": "ok"`, `"db": "up"` ;
3. contrôler les compteurs (`SELECT COUNT(*) FROM "User";` etc.).

### 1.6 Preuve de restauration — à faire

- [ ] `pg_dump` installé (`pg_dump -V`).
- [ ] Dump de la base de prod.
- [ ] Restauration dans une **base scratch** (base ou schéma jetable — jamais
      la base de prod).
- [ ] Comparaison des compteurs principaux (`User`, `Article`, `Analyse`).
- [ ] Noter ici la date du test et son résultat : **`_non encore réalisé_`**.

---

## 2. Migrations de base

### 2.1 Commande unique en production

```bash
npx prisma migrate deploy
```

- `migrate deploy` applique **uniquement** les migrations déjà versionnées dans
  `prisma/migrations/`, sans recalculer ni réécrire de fichier.
- **Jamais** `npx prisma migrate dev` en production : elle compare le schéma à
  la base, peut générer de nouvelles migrations, et propose/supprime des
  données en cas d'écart (`--reset`).
- **Jamais** `npx prisma db push` en production : il contourne l'historique
  des migrations (pas de traçabilité, pas de rejouabilité).

État des lieux : **aucune migration n'est appliquée automatiquement**. Ni la CI
(voir le TODO « migrate deploy on staging » dans
`.github/workflows/ci.yml`), ni le déploiement Vercel
(`vercel build` n'exécute pas `migrate deploy`). Déployer une migration est
donc une **étape manuelle, à planifier avant** la mise en ligne du code qui
l'utilise. Les 3 migrations existantes ont été appliquées (historique cohérent
et rejouable).

### 2.2 Procédure pas à pas

1. **Avant** : `npx prisma migrate status` → doit indiquer la liste des
   migrations en attente et l'absence d'état corrompu.
2. Si la migration est destructive ou à risque (colonne supprimée, contrainte
   ajoutée sur une table peuplée, …) : produire d'abord un dump (§1.3).
3. `npx prisma migrate deploy`
4. `npx prisma migrate status` → 0 migration en attente.
5. `GET /api/health` → `"status": "ok"` (la base répond) ; déployer puis
   contrôler le site.

### 2.3 En cas d'échec

- Un échec laisse la migration marquée « failed » dans la table
  `_prisma_migrations` (colonnes `finished_at`, `logs`) ; **les déploiements
  suivants restent bloqués** tant qu'elle n'est pas résolue.
- Prise en main :
  1. Lire l'erreur dans `logs` (`SELECT logs FROM "_prisma_migrations" WHERE migration_name = '<nom>';`).
  2. **La migration échouée est déjà annulée** : Prisma exécute chaque
     migration dans une transaction (sauf si elle contient explicitement des
     commandes non transactionnables) — dans le doute, vérifier l'état réel de
     la table concernée.
  3. Après correction du fichier SQL **non encore appliqué ailleurs** :
     ```bash
     npx prisma migrate resolve --rolled-back "<nom_dossier_migration>"
     npx prisma migrate deploy
     ```
  4. Si l'effet de la migration est déjà correct en base mais que le suivi
     Prisma est désaligné, la doc Prisma décrit aussi
     `migrate resolve --applied` — solution de dernier recours, à documenter
     dans le ticket.
- Prisma **ne fournit pas de down migration** : une migration destructive mal
  passée en production ne se « dé-passe » pas avec un fichier SQL inverse —
  seul un rejeu depuis une **sauvegarde** (§1.5) débloque.
- **Ne jamais** modifier, renommer ou supprimer une migration **déjà appliquée**
  : le hash enregistré dans `_prisma_migrations` divergerait (drift) et
  bloquerait le déploiement suivant. Un changement de schéma après une
  migration publiée = nouvelle migration.

---

## 3. Seed de démonstration (`prisma/seed.ts`)

### 3.1 Ce que ça crée

- 3 comptes **100 % fictifs** (aucune donnée personnelle réelle) :
  | Email | Rôle | Plan |
  |---|---|---|
  | `admin@papernote.dev` | `admin` | free |
  | `demo.free@papernote.dev` | user | free |
  | `demo.pro@papernote.dev` | user | pro |
  Mot de passe **commun de démonstration : `PasswordDemo123!`** — il est
  écrit en clair dans `prisma/seed.ts` : c'est un mot de passe **public**,
  à n'utiliser que pour des comptes de démo, **jamais** pour un compte réel.
  Les trois comptes ont leur email déjà vérifié.
- 4 articles et 5 analyses fictifs (titres et contenus évidemment bidons,
  `noteParCritere` avec les 8 critères du projet). Le `rapport` est validé par
  `analyseResultSchema` (`src/lib/types.ts`) avant écriture : le seed échoue
  plutôt que d'écrire une donnée invalide.

### 3.2 Quand l'exécuter

- Base **neuve**, **locale**, ou **staging/démo**.
- **Jamais** sur une base contenant des données réelles : le seed ne supprime
  rien et ne touche que ses propres lignes (voir idempotence), mais il crée et
  **modifie** (reset du plan/mot de passe de démo) 3 comptes.
- Garde-fous intégrés au seed :
  - abort (code 1) si `DATABASE_URL` absente ;
  - abort si `NODE_ENV=production`, sauf override explicite
    `SEED_FORCE_PRODUCTION=1` ;
  - avertissement journalisé si la base contient des comptes qui ne sont pas
    des comptes démo (`comptesHorsDemo`).

### 3.3 Comment l'exécuter

```bash
npm run db:seed        # variante officielle Prisma : npx prisma db seed
```

L'URL cible est résolue comme l'application : shell > `.env.local` > `.env`.
Pour cibler une autre base sans toucher aux fichiers :
`DATABASE_URL="postgresql://..." npm run db:seed` (bash) ou
`$env:DATABASE_URL = "..."; npm run db:seed` (PowerShell).
Exemple de base scratch : créer une base vide chez Neon (ou en local),
appliquer les migrations (`DATABASE_URL=<scratch> npx prisma migrate deploy`)
puis lancer le seed dessus.

Le seed n'est **volontairement** absent de `postinstall` et de toute la CI/CD
: une installation (`npm ci`) ou un build ne doit jamais écrire en base.

### 3.4 Idempotence

Relancer le seed N fois ne crée aucun doublon :

- `User` : `upsert` Prisma sur l'unique `email` ;
- `Article` : clé naturelle `(userId, titre)` → `findFirst` puis
  update/create ;
- `Analyse` : clé naturelle `(articleId, dateAnalyse fixe)` → `findFirst` puis
  update/create ;
- toutes les dates démo sont fixes → l'état final est identique à chaque
  exécution ;
- le seed complet est exécuté dans **une transaction** : en cas d'erreur,
  aucun seed partiel.

Vérification : le log `seed / step=completed` affiche
`articlesCrees`/`analysesCreees` = 0 et `articlesMaj`/`analysesMaj` = 4/5 lors
d'une deuxième exécution.

---

## 4. Surveillance

### 4.1 `GET /api/health` (existant)

Route publique `src/app/api/health/route.ts`. Contrat :

- Réponse **200** `{ "status": "ok", "db": "up", "uptimeSec": …, "version": "0.1.0", "timestamp": "…" }`
  quand la base répond ;
- Réponse **503** avec le même corps et `"status": "degraded"`, `"db": "down"`
  quand la base est injoignable (sonde `SELECT 1` réelle, bornée à 2 s) ;
- en-tête `Cache-Control: no-store` ;
- aucune donnée interne exposée (pas d'erreur DB brute, pas de variable
  d'environnement) ;
- non authentifiée mais soumise au rate limiting générique `api-read`
  (60 req/min/IP).

```bash
curl -i https://votre-domaine/api/health
# {"status":"ok","uptimeSec":12,"version":"0.1.0","db":"up","timestamp":"2026-10-14T02:00:00.000Z"}
```

Usages : sonde d'un moniteur d'uptime (UptimeRobot, Better Stack, …),
vérification immédiate après un déploiement ou une migration
(`"db": "up"` après `migrate deploy`).

> ⚠️ `GET /api/cron/retention` n'est **pas** une surveillance ni une
> sauvegarde : c'est une purge de données anciennes, protégée par
> `CRON_SECRET`.

### 4.2 Logs applicatifs

La sortie est du JSON structuré (`logEvent`, `src/lib/logger.ts`), à lire dans
la console de la plateforme (Vercel → Logs). Les événements de cette
documentation portent `event: "seed"`, `event: "health_check"`, etc.

---

## 5. Checklists

**Avant déploiement (production)**
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` verts (déjà en CI).
- [ ] Migrations en attente listées (`npx prisma migrate status`) et leur
      contenu relu.
- [ ] Dump récent disponible (§1.3) si la migration est à risque.
- [ ] Fenêtre d'historique Neon ≥ 7 jours (§1.2).

**Après déploiement**
- [ ] `npx prisma migrate status` → 0 en attente.
- [ ] `GET /api/health` → 200, `"db": "up"`.
- [ ] Parcours de fumée : inscription/connexion, analyse, historique.

**Après une restauration**
- [ ] Compteurs cohérents (`User`, `Article`, `Analyse`).
- [ ] Migration status + `/api/health` (§1.5).
- [ ] Date et résultat notés en §1.6.
