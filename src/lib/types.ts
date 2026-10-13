import { z } from "zod";

/**
 * Schéma Zod de la réponse IA : source de vérité unique pour la validation
 * stricte de la réponse Gemini ET pour les types déduits (`AnalyseResult`
 * et ses sous-types). Toute donnée non validée est rejetée avant écriture
 * en base.
 *
 * Deux variantes dérivées d'un socle commun :
 * - `analyseResultSchema` (plan payant) : 8 critères requis partout ;
 * - `freeAnalyseResultSchema` (plan gratuit) : `notesParCritere` et
 *   `rapport.sections` peuvent être vides (prompt gratuit), mais TOUTE clé
 *   présente reste validée strictement (note dans [0, 100], section complète).
 */

/** Note normalisée bornée entre 0 et 100 (globale, par critère, par section). */
const noteSchema = z.number().min(0).max(100);

/** Section détaillée d'un critère : note + commentaire non vide. */
const sectionRapportSchema = z.object({
  note: noteSchema,
  commentaire: z.string().min(1),
});

/**
 * `notesParCritere` : les 8 critères de `src/config/crits.ts`, tous requis.
 * Une note manquante, de type invalide ou hors [0, 100] fait échouer la
 * validation → aucune écriture en base.
 *
 * Le `.transform()` n'altère pas la donnée : il élargit uniquement le type
 * inféré vers l'index-signature historique (`Record<string, number>`) pour
 * ne pas casser les consommateurs existants (ex. `page.tsx` qui assigne un
 * `Record<string, number>` issu de l'API).
 */
const notesParCritereSchema = z
  .object({
    rigueur_methode: noteSchema,
    originalite: noteSchema,
    revue_litterature: noteSchema,
    clarte_redaction: noteSchema,
    resultats_analyse: noteSchema,
    discussion_implications: noteSchema,
    conformite_normes: noteSchema,
    impact_potentiel: noteSchema,
  })
  .transform((notes): Record<string, number> => notes);

/**
 * Variante plan gratuit : objet potentiellement vide (le prompt gratuit
 * renvoie `"notesParCritere": {}`), mais chaque clé fournie est validée
 * strictement contre `noteSchema` (note dans [0, 100]).
 * Zod v4 : `z.record(cle, valeur)` valide toutes les entrées présentes.
 */
const freeNotesParCritereSchema = z
  .record(z.string(), noteSchema)
  .transform((notes): Record<string, number> => notes);

/** `rapport.sections` : une section requise par critère, mêmes 8 clés. */
const rapportSectionsSchema = z
  .object({
    rigueur_methode: sectionRapportSchema,
    originalite: sectionRapportSchema,
    revue_litterature: sectionRapportSchema,
    clarte_redaction: sectionRapportSchema,
    resultats_analyse: sectionRapportSchema,
    discussion_implications: sectionRapportSchema,
    conformite_normes: sectionRapportSchema,
    impact_potentiel: sectionRapportSchema,
  })
  .transform((sections): Record<string, SectionRapport> => sections);

/**
 * Variante plan gratuit : `sections` peut être vide (`{}`), mais toute
 * section présente doit rester une section valide (note + commentaire).
 */
const freeRapportSectionsSchema = z
  .record(z.string(), sectionRapportSchema)
  .transform((sections): Record<string, SectionRapport> => sections);

/** Champs du rapport communs aux deux plans (hors `sections`). */
const rapportBaseShape = {
  resume: z.string().min(1),
  points_forts: z.array(z.string().min(1)),
  points_a_ameliorer: z.array(z.string().min(1)),
  recommandations: z.array(z.string().min(1)),
  verdict: z.string().min(1),
};

/** Tous les champs du rapport sont requis ; les chaînes ne sont jamais vides. */
const rapportSchema = z.object({
  ...rapportBaseShape,
  sections: rapportSectionsSchema,
});

/** Rapport du plan gratuit : mêmes champs requis, `sections` peut être vide. */
const freeRapportSchema = z.object({
  ...rapportBaseShape,
  sections: freeRapportSectionsSchema,
});

/** Racine de la réponse IA attendue (plan payant, strict). */
export const analyseResultSchema = z.object({
  noteGlobale: noteSchema,
  notesParCritere: notesParCritereSchema,
  rapport: rapportSchema,
});

/**
 * Racine de la réponse IA attendue (plan gratuit) : `noteGlobale` et tous les
 * champs du rapport restent requis, seuls `notesParCritere` et
 * `rapport.sections` acceptent un objet vide.
 */
export const freeAnalyseResultSchema = z.object({
  noteGlobale: noteSchema,
  notesParCritere: freeNotesParCritereSchema,
  rapport: freeRapportSchema,
});

export type NoteParCritere = z.infer<typeof notesParCritereSchema>;
export type SectionRapport = z.infer<typeof sectionRapportSchema>;
export type Rapport = z.infer<typeof rapportSchema>;
export type AnalyseResult = z.infer<typeof analyseResultSchema>;

export interface ArticleInput {
  titre: string;
  contenu: string;
  auteur?: string;
  revueCiblee?: string;
}

export interface ArticleWithAnalyse {
  id: string;
  titre: string;
  contenu: string;
  auteur: string | null;
  revueCiblee: string | null;
  dateCreation: Date;
  analyses: {
    id: string;
    rapport: string;
    noteGlobale: number;
    noteParCritere: unknown;
    dateAnalyse: Date;
  }[];
}
