/**
 * prisma/seed.ts — jeu de données de DÉMONSTRATION PaperNote.
 *
 * ─── CE QUE CRÉE CE SEED (100 % fictif) ─────────────────────────────────
 * 3 comptes (aucune donnée personnelle réelle, noms et emails inventés) :
 *   - admin@papernote.dev   role=admin, plan=free  (accès /api/admin/*)
 *   - demo.free@papernote.dev  role=user, plan=free
 *   - demo.pro@papernote.dev   role=user, plan=pro
 *   tous avec `emailVerified` posé (connexion possible sans email).
 *   Mot de passe COMMUN de démo : `PasswordDemo123!`
 *   (hash bcrypt coût 12 — identique à `src/app/api/auth/register/route.ts`).
 *   ⚠️ Ce mot de passe est lisible dans ce fichier : il ne sert QUE à la
 *   démonstration. Ne JAMAIS réutiliser un mot de passe réel ici.
 *
 * 4 articles fictifs (titres et contenus évidemment bidons) et 5 analyses
 * avec `noteGlobale` variées et `noteParCritere` couvrant les 8 critères de
 * `src/config/crits.ts`. Le `rapport` est validé par le schéma du projet
 * (`analyseResultSchema`, `src/lib/types.ts`) puis stocké en JSON.stringify,
 * exactement comme le fait `src/lib/jobs/analyze.ts`.
 * Note : la démo remplit les 8 critères pour TOUS les comptes, y compris le
 * plan free, uniquement pour illustrer l'UI (le prompt free réel renvoie un
 * objet de critères vide).
 *
 * ─── STRATÉGIE D'IDEMPOTENCE (choix justifié) ───────────────────────────
 * Relancer le seed deux fois ne crée AUCUN doublon : on retient l'« upsert
 * par clé naturelle » plutôt que la « suppression / recréation » car :
 *   1. rien n'est jamais supprimé → impossible de détruire des lignes qui ne
 *      appartiennent pas au seed (sécurité si lancé sur une base existante) ;
 *   2. l'état final est DÉTERMINISTE : toutes les dates démo sont fixes, une
 *      2ᵉ exécution produit exactement les mêmes lignes que la 1ʳᵉ ;
 *   3. les clés sont explicites et lisibles (pas d'id mémorisé entre runs).
 * Détail par modèle :
 *   - `User`   → `upsert` Prisma sur l'unique `email` (contrainte @unique) ;
 *   - `Article`→ clé naturelle (userId + titre) : findFirst → update/create ;
 *   - `Analyse`→ clé naturelle (articleId + dateAnalyse fixe) : findFirst →
 *                update/create (pas de contrainte d'unicité exploitable).
 * Le seed s'exécute dans UNE transaction : en cas d'erreur, aucun seed
 * partiel n'est laissé en base.
 *
 * ─── EXÉCUTION (JAMAIS AUTOMATIQUE) ─────────────────────────────────────
 * Volontairement absent de `postinstall` et de toute la CI/CD : un seed
 * lancé à l'aveugle sur une base de production y insérerait des comptes de
 * démo. Exécution manuelle uniquement :
 *     npm run db:seed        # équivalent : npx prisma db seed
 * Garde-fous : abort si `NODE_ENV=production` (sauf `SEED_FORCE_PRODUCTION=1`),
 * abort si `DATABASE_URL` absente, avertissement si la base contient déjà des
 * comptes qui ne sont pas des comptes démo. Voir `docs/OPERATIONS.md`.
 */

import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCriteres } from "@/config/crits";
import { logEvent } from "@/lib/logger";
import { analyseResultSchema } from "@/lib/types";

/** Client/prisma d'une transaction interactive (écritures groupées). */
type Tx = Prisma.TransactionClient;

/** Entrée attendue par le schéma du projet (avant transformations Zod). */
type AnalyseInput = z.input<typeof analyseResultSchema>;

/** Les 8 critères d'évaluation — doit rester aligné sur src/config/crits.ts. */
type CritereKey =
  | "rigueur_methode"
  | "originalite"
  | "revue_litterature"
  | "clarte_redaction"
  | "resultats_analyse"
  | "discussion_implications"
  | "conformite_normes"
  | "impact_potentiel";

/** Notes : les 8 clés sont requises (schéma strict `notesParCritereSchema`). */
type NotesParCritere = Record<CritereKey, number>;

/** Mot de passe de DÉMONSTRATION — public, jamais à réutiliser ailleurs. */
const MOT_DE_PASSE_DEMO = "PasswordDemo123!";

/** Coût bcrypt identique à celui de l'inscription (register/route.ts : 12). */
const BCRYPT_COST = 12;

/** Date fixe → état final identique à chaque exécution (idempotence). */
const EMAIL_VERIFIE = new Date("2026-01-01T00:00:00.000Z");

interface CompteDemo {
  email: string;
  name: string;
  role: "admin" | "user";
  plan: "free" | "pro";
}

const COMPTES: readonly CompteDemo[] = [
  {
    email: "admin@papernote.dev",
    name: "Admin PaperNote (démo)",
    role: "admin",
    plan: "free",
  },
  {
    email: "demo.free@papernote.dev",
    name: "Compte démo — gratuit",
    role: "user",
    plan: "free",
  },
  {
    email: "demo.pro@papernote.dev",
    name: "Compte démo — pro",
    role: "user",
    plan: "pro",
  },
];

interface AnalyseDemo {
  /** Horodatage FIXE : sert de clé naturelle d'idempotence pour l'analyse. */
  dateAnalyse: Date;
  noteGlobale: number;
  notes: NotesParCritere;
  verdict: string;
  resume: string;
  pointsForts: string[];
  pointsAAmeliorer: string[];
  recommandations: string[];
}

interface ArticleDemo {
  /** Email du compte démo propriétaire (clé de rattachement). */
  proprietaire: string;
  titre: string;
  contenu: string;
  auteur: string;
  revueCiblee: string;
  /** Date FIXE → idempotence (sinon `@default(now())` changerait à chaque run). */
  dateCreation: Date;
  analyses: AnalyseDemo[];
}

const IDS_SEED: readonly CritereKey[] = [
  "rigueur_methode",
  "originalite",
  "revue_litterature",
  "clarte_redaction",
  "resultats_analyse",
  "discussion_implications",
  "conformite_normes",
  "impact_potentiel",
];

/** Libellés FR des critères, lus dans le projet (source de vérité unique). */
const LIBELLES_CRITERES: ReadonlyMap<string, string> = new Map(
  getCriteres("fr").map((critere) => [critere.id, critere.label])
);

/**
 * Garde-fou anti-dérive : échoue explicitement si les 8 ids du seed ne sont
 * plus ceux de `src/config/crits.ts` (critère ajouté/renommé non repris).
 */
function assertCriteresAlignes(): void {
  const attendus = [...IDS_SEED].sort();
  const actuels = [...LIBELLES_CRITERES.keys()].sort();
  const identiques =
    attendus.length === actuels.length &&
    attendus.every((id, index) => id === actuels[index]);
  if (!identiques) {
    throw new Error(
      `Critères désynchronisés : seed=[${attendus.join(", ")}] ` +
        `projet=[${actuels.join(", ")}] — mettre à jour prisma/seed.ts.`
    );
  }
}

/** Applique `fn` à chacune des 8 notes en conservant les 8 clés (typé strict). */
function mapCritere<T>(
  notes: NotesParCritere,
  fn: (id: CritereKey, note: number) => T
): Record<CritereKey, T> {
  return {
    rigueur_methode: fn("rigueur_methode", notes.rigueur_methode),
    originalite: fn("originalite", notes.originalite),
    revue_litterature: fn("revue_litterature", notes.revue_litterature),
    clarte_redaction: fn("clarte_redaction", notes.clarte_redaction),
    resultats_analyse: fn("resultats_analyse", notes.resultats_analyse),
    discussion_implications: fn(
      "discussion_implications",
      notes.discussion_implications
    ),
    conformite_normes: fn("conformite_normes", notes.conformite_normes),
    impact_potentiel: fn("impact_potentiel", notes.impact_potentiel),
  };
}

/** Commentaire de section : factice et clairement identifié comme tel. */
function commentaireSection(id: CritereKey, note: number): string {
  const libelle = LIBELLES_CRITERES.get(id) ?? id;
  const niveau =
    note >= 80
      ? "très solide"
      : note >= 60
        ? "correct"
        : note >= 40
          ? "à renforcer"
          : "insuffisant";
  return (
    `[Démonstration] ${libelle} : ${niveau} (${note}/100). ` +
    "Commentaire 100 % fictif généré par prisma/seed.ts — aucune évaluation " +
    "réelle d'un travail."
  );
}

/** Construit le rapport au format exact du projet (schéma `analyseResultSchema`). */
function construireRapport(analyse: AnalyseDemo): AnalyseInput["rapport"] {
  return {
    resume: analyse.resume,
    points_forts: analyse.pointsForts,
    points_a_ameliorer: analyse.pointsAAmeliorer,
    recommandations: analyse.recommandations,
    verdict: analyse.verdict,
    sections: mapCritere(analyse.notes, (id, note) => ({
      note,
      commentaire: commentaireSection(id, note),
    })),
  };
}

const ARTICLES: readonly ArticleDemo[] = [
  {
    proprietaire: "demo.free@papernote.dev",
    titre:
      "Influence de la photopériode sur la croissance de la mousse de papier : une étude simulée",
    contenu:
      "Article de démonstration intégralement fictif, généré par prisma/seed.ts : " +
      "il ne décrit aucune recherche réelle. À titre d'exemple, nous supposons une " +
      "« expérience » mesurant l'effet de durées d'éclairage imaginaires sur la " +
      "croissance de mousse de papier en laboratoire. Chiffres, méthode et références " +
      "sont inventés et ne doivent jamais être cités. Ce contenu sert uniquement à " +
      "illustrer l'interface PaperNote : historique, détail d'analyse et notation " +
      "par critère.",
    auteur: "C. Exemple (auteur fictif)",
    revueCiblee: "Revue fictive de démonstration",
    dateCreation: new Date("2026-01-05T09:00:00.000Z"),
    analyses: [
      {
        dateAnalyse: new Date("2026-01-05T18:30:00.000Z"),
        noteGlobale: 63.4,
        notes: {
          rigueur_methode: 62,
          originalite: 55,
          revue_litterature: 71,
          clarte_redaction: 74,
          resultats_analyse: 48,
          discussion_implications: 66,
          conformite_normes: 80,
          impact_potentiel: 51,
        },
        verdict:
          "Démonstration : structure complète mais données expérimentales fictives.",
        resume:
          "Rapport 100 % fictif généré par prisma/seed.ts pour présenter l'écran " +
          "de résultat de PaperNote. Les chiffres décrits n'ont jamais été produits " +
          "et ne peuvent être cités.",
        pointsForts: [
          "Structure IMRAD respectée (exemple fictif).",
          "Notation détaillée des 8 critères, utile pour la démonstration.",
        ],
        pointsAAmeliorer: [
          "Aucune donnée réelle : tout est simulé pour la démo.",
          "Bibliographie entièrement inventée.",
        ],
        recommandations: [
          "Ne jamais citer ce contenu : il est fictif.",
          "Charger un article réel pour produire un vrai rapport.",
        ],
      },
    ],
  },
  {
    proprietaire: "demo.free@papernote.dev",
    titre:
      "Trois algorithmes inventés pour trier des données commentées : une comparaison numérique",
    contenu:
      "Contenu de démonstration, strictement fictif (prisma/seed.ts). Nous comparons " +
      "ici trois « algorithmes » imaginaires — le tri à bulles paradoxal, le tri " +
      "harmonique et le tri récursif inventé — sur des jeux de données qui n'existent " +
      "pas. Les complexités annoncées et les temps de mesure sont fabriqués pour " +
      "l'exemple. Ce texte ne constitue ni une référence technique ni un résultat " +
      "scientifique : il sert uniquement à peupler l'historique de l'application.",
    auteur: "B. Factice (auteur fictif)",
    revueCiblee: "Workshop imaginaire sur le tri de données",
    dateCreation: new Date("2026-01-08T10:15:00.000Z"),
    analyses: [
      {
        dateAnalyse: new Date("2026-01-08T20:00:00.000Z"),
        noteGlobale: 47,
        notes: {
          rigueur_methode: 44,
          originalite: 61,
          revue_litterature: 39,
          clarte_redaction: 58,
          resultats_analyse: 35,
          discussion_implications: 47,
          conformite_normes: 52,
          impact_potentiel: 40,
        },
        verdict:
          "Démonstration : notes faibles volontaires pour illustrer une analyse critique.",
        resume:
          "Rapport fictif volontairement moins flatteur : il montre comment PaperNote " +
          "affiche des notes faibles et des axes d'amélioration. Aucune des " +
          "observations ci-dessous ne porte sur un travail réel.",
        pointsForts: [
          "Présentation claire des trois variantes imaginaires.",
          "Objectifs annoncés dès l'introduction (exemple fictif).",
        ],
        pointsAAmeliorer: [
          "Mesures expérimentales entièrement fabriquées (démo).",
          "Discussion trop courte pour étayer les conclusions.",
        ],
        recommandations: [
          "Ne pas utiliser ce texte comme référence de méthodologie.",
          "Reprendre sur un jeu de données réel pour un usage sérieux.",
        ],
      },
    ],
  },
  {
    proprietaire: "demo.pro@papernote.dev",
    titre:
      "Corrélations improbables entre le café et la productivité : essai contrôlé imaginaire",
    contenu:
      "Article de démonstration fictif (prisma/seed.ts). Nous décrivons un « essai " +
      "randomisé » imaginaire portant sur 40 participants inventés et mesurant " +
      "l'effet supposé de tasses de café fictives sur une productivité inventée. " +
      "Ni protocole, ni statistiques, ni participants n'existent : tout est écrit " +
      "pour illustrer l'application. Toute reprise de ce contenu serait sans objet.",
    auteur: "D. Exemple (auteur fictif)",
    revueCiblee: "Revue fictive de psychologie du travail",
    dateCreation: new Date("2026-01-12T08:45:00.000Z"),
    analyses: [
      {
        dateAnalyse: new Date("2026-01-12T19:00:00.000Z"),
        noteGlobale: 71.1,
        notes: {
          rigueur_methode: 70,
          originalite: 66,
          revue_litterature: 72,
          clarte_redaction: 75,
          resultats_analyse: 63,
          discussion_implications: 68,
          conformite_normes: 77,
          impact_potentiel: 78,
        },
        verdict: "Démonstration : première version d'un article fictif, correcte.",
        resume:
          "Rapport de démonstration sur la première version de l'article fictif. " +
          "Il illustre l'historique des analyses d'un même article (une version " +
          "révisée suit). Données sans valeur scientifique.",
        pointsForts: [
          "Plan de l'article lisible (exemple fictif).",
          "Conclusion alignée sur les résultats simulés.",
        ],
        pointsAAmeliorer: [
          "Statistiques inventées, à remplacer par de vraies mesures (démo).",
          "Limites de l'étude à peine évoquées.",
        ],
        recommandations: [
          "Détailler le protocole réel avant soumission.",
          "Ajouter une section matériel et méthodes complète.",
        ],
      },
      {
        dateAnalyse: new Date("2026-01-16T14:30:00.000Z"),
        noteGlobale: 84.5,
        notes: {
          rigueur_methode: 82,
          originalite: 88,
          revue_litterature: 79,
          clarte_redaction: 91,
          resultats_analyse: 74,
          discussion_implications: 85,
          conformite_normes: 87,
          impact_potentiel: 90,
        },
        verdict: "Démonstration : version révisée du même article fictif.",
        resume:
          "Second rapport fictif du même article : il montre comment l'historique " +
          "affiche la note la plus récente. Les améliorations décrites sont " +
          "elles aussi imaginaires.",
        pointsForts: [
          "Rédaction resserrée après révision simulée.",
          "Implications discutées plus explicitement (exemple fictif).",
        ],
        pointsAAmeliorer: [
          "Analyse statistique toujours absente (données fictives).",
          "Références encore inventées.",
        ],
        recommandations: [
          "Conserver cette structure pour la version finale réelle.",
          "Compléter par des chiffres réels une fois l'étude menée.",
        ],
      },
    ],
  },
  {
    proprietaire: "demo.pro@papernote.dev",
    titre:
      "Méta-analyse de 42 études qui n'existent pas : méthodologie de démonstration",
    contenu:
      "Texte de démonstration 100 % fictif (prisma/seed.ts). Nous présentons une " +
      "« méta-analyse » de 42 études inventées, avec une forêt de forest plots " +
      "impossible et des hétérogénéités fabriquées. Aucune de ces études n'existe " +
      "et aucune donnée n'a été agrégée : ce contenu sert uniquement à montrer la " +
      "restauration d'une analyse dans l'interface.",
    auteur: "M. Imaginaire (auteur fictif)",
    revueCiblee: "Revue fictive de synthèse",
    dateCreation: new Date("2026-01-15T11:20:00.000Z"),
    analyses: [
      {
        dateAnalyse: new Date("2026-01-15T22:00:00.000Z"),
        noteGlobale: 53.9,
        notes: {
          rigueur_methode: 55,
          originalite: 49,
          revue_litterature: 60,
          clarte_redaction: 63,
          resultats_analyse: 41,
          discussion_implications: 52,
          conformite_normes: 66,
          impact_potentiel: 45,
        },
        verdict: "Démonstration : méta-analyse fictive au potentiel moyen.",
        resume:
          "Rapport fictif destiné à illustrer une note intermédiaire et des " +
          "sections par critère. Les 42 études citées sont imaginaires : ce texte " +
          "n'a aucune valeur bibliographique.",
        pointsForts: [
          "Recherche systématique décrite (exemple fictif).",
          "Critères d'inclusion explicités.",
        ],
        pointsAAmeliorer: [
          "Aucune étude réelle incluse (démo).",
          "Méta-analyse non reproductible : données inventées.",
        ],
        recommandations: [
          "Vérifier chaque référence avant toute reprise.",
          "Refaire l'agrégation sur des études réelles.",
        ],
      },
    ],
  },
];

/** Adresse cible résumée SANS identifiants (jamais d'URL complète en log). */
function decrireCible(url: string): { dbHost: string; dbName: string } {
  try {
    const parsed = new URL(url);
    return {
      dbHost: parsed.hostname,
      dbName: parsed.pathname.replace(/^\//, "") || "inconnue",
    };
  } catch {
    return { dbHost: "inconnue", dbName: "inconnue" };
  }
}

interface Compteurs {
  comptes: number;
  articlesCrees: number;
  articlesMaj: number;
  analysesCreees: number;
  analysesMaj: number;
  comptesHorsDemo: number;
}

/**
 * Applique le jeu de démo dans UNE transaction (tout ou rien).
 * Retourne les compteurs journalisés en fin d'exécution.
 */
async function appliquerSeed(
  tx: Tx,
  motDePasseHash: string
): Promise<Compteurs> {
  const identifiants = COMPTES.map((compte) => compte.email);

  // 1) Comptes : upsert sur l'email unique (aucun doublon possible).
  const comptes = new Map<string, string>();
  for (const compte of COMPTES) {
    const util = await tx.user.upsert({
      where: { email: compte.email },
      update: {
        name: compte.name,
        role: compte.role,
        plan: compte.plan,
        emailVerified: EMAIL_VERIFIE,
        password: motDePasseHash,
        // Compteur remis à zéro : la rejeu du seed doit repartir d'un état
        // déterministe (l'usage des comptes démo n'a aucune valeur).
        analysesThisMonth: 0,
        analysesResetAt: null,
      },
      create: {
        email: compte.email,
        name: compte.name,
        role: compte.role,
        plan: compte.plan,
        emailVerified: EMAIL_VERIFIE,
        password: motDePasseHash,
      },
    });
    comptes.set(compte.email, util.id);
  }

  // 2) Avertissement honnête si la base contient d'autres comptes : le seed
  //    ne touche QUE ses propres lignes, mais il faut le signaler.
  const comptesHorsDemo = await tx.user.count({
    where: { email: { notIn: identifiants } },
  });
  if (comptesHorsDemo > 0) {
    logEvent(
      "seed",
      {
        step: "existing_data_warning",
        comptesHorsDemo,
        detail: "le seed ne modifie que les comptes/lignes de démonstration",
      },
      "warn"
    );
  }

  const compteurs: Compteurs = {
    comptes: COMPTES.length,
    articlesCrees: 0,
    articlesMaj: 0,
    analysesCreees: 0,
    analysesMaj: 0,
    comptesHorsDemo,
  };

  // 3) Articles + analyses : clés naturelles (userId+titre / articleId+date).
  for (const article of ARTICLES) {
    const userId = comptes.get(article.proprietaire);
    if (userId === undefined) {
      throw new Error(`Compte démo introuvable : ${article.proprietaire}`);
    }

    const donneesArticle = {
      titre: article.titre,
      contenu: article.contenu,
      auteur: article.auteur,
      revueCiblee: article.revueCiblee,
      dateCreation: article.dateCreation,
    };

    const articleExistant = await tx.article.findFirst({
      where: { userId, titre: article.titre },
      select: { id: true },
    });

    let articleId: string;
    if (articleExistant) {
      await tx.article.update({
        where: { id: articleExistant.id },
        data: donneesArticle,
      });
      articleId = articleExistant.id;
      compteurs.articlesMaj += 1;
    } else {
      const cree = await tx.article.create({
        data: { userId, ...donneesArticle },
      });
      articleId = cree.id;
      compteurs.articlesCrees += 1;
    }

    for (const analyse of article.analyses) {
      // Validation Zod par le schéma du projet : aucune donnée invalide (note
      // hors [0,100], critère manquant, rapport incomplet) n'est persistée.
      const resultat = analyseResultSchema.parse({
        noteGlobale: analyse.noteGlobale,
        notesParCritere: analyse.notes,
        rapport: construireRapport(analyse),
      });

      const donneesAnalyse = {
        rapport: JSON.stringify(resultat.rapport),
        noteGlobale: resultat.noteGlobale,
        noteParCritere: resultat.notesParCritere,
      };

      const analyseExistante = await tx.analyse.findFirst({
        where: { articleId, dateAnalyse: analyse.dateAnalyse },
        select: { id: true },
      });

      if (analyseExistante) {
        await tx.analyse.update({
          where: { id: analyseExistante.id },
          data: donneesAnalyse,
        });
        compteurs.analysesMaj += 1;
      } else {
        await tx.analyse.create({
          data: {
            articleId,
            dateAnalyse: analyse.dateAnalyse,
            ...donneesAnalyse,
          },
        });
        compteurs.analysesCreees += 1;
      }
    }
  }

  return compteurs;
}

/** Journalisation des erreurs de chargement des fichiers .env (aucun secret). */
const JOURNAL_ENV = {
  info: () => undefined,
  error: (...args: unknown[]): void => {
    logEvent(
      "seed",
      { step: "env_load_error", detail: args.map((arg) => String(arg)) },
      "warn"
    );
  },
};

async function main(): Promise<void> {
  // Même ordre de priorité que Next : shell > .env.local > .env.
  // `dev=false` → mode « production » pour la lecture des fichiers (ici seuls
  // `.env.local` et `.env` existent, comme pour `next dev`). `NODE_ENV` n'est
  // PAS modifié par loadEnvConfig.
  loadEnvConfig(process.cwd(), false, JOURNAL_ENV);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logEvent(
      "seed",
      { step: "aborted", reason: "database_url_absente" },
      "error"
    );
    process.exitCode = 1;
    return;
  }

  const cible = decrireCible(databaseUrl);

  // Garde-fou : jamais de comptes de démo en production sans action explicite.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_FORCE_PRODUCTION !== "1"
  ) {
    logEvent(
      "seed",
      {
        step: "aborted",
        reason: "node_env_production",
        ...cible,
        hint: "SEED_FORCE_PRODUCTION=1 pour forcer (voir docs/OPERATIONS.md)",
      },
      "error"
    );
    process.exitCode = 1;
    return;
  }

  assertCriteresAlignes();

  const totalAnalyses = ARTICLES.reduce(
    (total, article) => total + article.analyses.length,
    0
  );
  logEvent("seed", {
    step: "start",
    ...cible,
    comptes: COMPTES.length,
    articles: ARTICLES.length,
    analyses: totalAnalyses,
  });

  // Hors transaction : bcrypt coût 12 coûte ~100-250 ms par hash.
  const motDePasseHash = await bcrypt.hash(MOT_DE_PASSE_DEMO, BCRYPT_COST);

  // Import différé : l'environnement (.env*) doit être chargé AVANT
  // l'instanciation de PrismaClient dans `src/lib/db`.
  const { db } = await import("@/lib/db");
  try {
    const compteurs = await db.$transaction(
      (tx) => appliquerSeed(tx, motDePasseHash),
      { maxWait: 10_000, timeout: 60_000 }
    );
    logEvent("seed", { step: "completed", ...cible, ...compteurs });
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  logEvent(
    "seed",
    {
      step: "failed",
      error: error instanceof Error ? error.message : "erreur_inconnue",
    },
    "error"
  );
  process.exitCode = 1;
});
