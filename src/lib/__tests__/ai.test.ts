/**
 * src/lib/__tests__/ai.test.ts — Validation de la réponse IA (parseAIResponse).
 *
 * C'est le test le plus précieux du projet : il protège contre les 500 en
 * production, en validant que toute réponse Gemini illisible ou invalide lève
 * un `AIParseError` typé (que les routes traduisent en 502/500 propre) au
 * lieu de laisser fuiter une donnée non validée.
 *
 * Le SDK `@google/generative-ai` est mocké (automock) : `parseAIResponse`
 * est une fonction pure, aucun appel réseau n'a lieu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@google/generative-ai");

import { AIParseError, isAIParseError, parseAIResponse } from "@/lib/ai";

/** Les 8 critères attendus par `analyseResultSchema` (source : types.ts). */
const CRITERIA_KEYS = [
  "rigueur_methode",
  "originalite",
  "revue_litterature",
  "clarte_redaction",
  "resultats_analyse",
  "discussion_implications",
  "conformite_normes",
  "impact_potentiel",
] as const;

/** Payload payant complet : 8 critères + 8 sections, tout dans [0, 100]. */
function buildPaidPayload(): Record<string, unknown> {
  const notes = Object.fromEntries(CRITERIA_KEYS.map((k) => [k, 80]));
  const sections = Object.fromEntries(
    CRITERIA_KEYS.map((k) => [k, { note: 75, commentaire: `Section ${k}` }])
  );
  return {
    noteGlobale: 78.5,
    notesParCritere: notes,
    rapport: {
      resume: "Résumé du rapport.",
      points_forts: ["Rigueur méthodologique"],
      points_a_ameliorer: ["Longueur de la discussion"],
      recommandations: ["Ajouter une analyse de sensibilité"],
      verdict: "Acceptable avec révisions mineures",
      sections,
    },
  };
}

/** Payload gratuit : mêmes champs requis, mais {} pour notes/sections. */
function buildFreePayload(): Record<string, unknown> {
  return {
    noteGlobale: 62,
    notesParCritere: {},
    rapport: {
      resume: "Résumé du plan gratuit.",
      points_forts: ["Clarté"],
      points_a_ameliorer: ["Profondeur"],
      recommandations: ["Détailler les résultats"],
      verdict: "Correct",
      sections: {},
    },
  };
}

describe("parseAIResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepte un payload gratuit valide ({ notesParCritere: {} }) avec freePlan: true", () => {
    const raw = JSON.stringify(buildFreePayload());

    const result = parseAIResponse(raw, { freePlan: true });

    expect(result.noteGlobale).toBe(62);
    expect(result.notesParCritere).toEqual({});
    expect(result.rapport.sections).toEqual({});
  });

  it("rejette le payload gratuit (critères vides) en mode payant strict", () => {
    const raw = JSON.stringify(buildFreePayload());

    try {
      parseAIResponse(raw);
      expect.unreachable("parseAIResponse aurait dû lever un AIParseError");
    } catch (error) {
      expect(isAIParseError(error)).toBe(true);
      expect(error).toBeInstanceOf(AIParseError);
      // Les 8 critères requis sont listés dans les issues agrégées.
      expect((error as AIParseError).issues.length).toBeGreaterThan(0);
    }
  });

  it("accepte un payload payant complet (schéma strict par défaut)", () => {
    const raw = JSON.stringify(buildPaidPayload());

    const result = parseAIResponse(raw);

    expect(result.noteGlobale).toBe(78.5);
    expect(result.notesParCritere.rigueur_methode).toBe(80);
    expect(result.rapport.sections.impact_potentiel).toEqual({
      note: 75,
      commentaire: "Section impact_potentiel",
    });
  });

  it("accepte un payload payant avec freePlan: false explicite", () => {
    const raw = JSON.stringify(buildPaidPayload());

    const result = parseAIResponse(raw, { freePlan: false });

    expect(result.noteGlobale).toBe(78.5);
  });

  it("rejette une note hors [0, 100] (noteGlobale: 150)", () => {
    const payload = buildPaidPayload();
    payload.noteGlobale = 150;
    const raw = JSON.stringify(payload);

    try {
      parseAIResponse(raw);
      expect.unreachable("une note hors bornes doit être rejetée");
    } catch (error) {
      expect(isAIParseError(error)).toBe(true);
      const issues = (error as AIParseError).issues;
      expect(issues.some((issue) => issue.startsWith("noteGlobale"))).toBe(true);
    }
  });

  it("rejette une note hors bornes même en plan gratuit (clé présente validée strictement)", () => {
    const payload = buildFreePayload();
    payload.notesParCritere = { rigueur_methode: 200 };
    const raw = JSON.stringify(payload);

    expect(() => parseAIResponse(raw, { freePlan: true })).toThrow(AIParseError);
  });

  it("lève un AIParseError typé sur du JSON malformé", () => {
    try {
      parseAIResponse("ceci n'est pas du json {");
      expect.unreachable("un JSON malformé doit lever un AIParseError");
    } catch (error) {
      expect(isAIParseError(error)).toBe(true);
      expect(error).toBeInstanceOf(AIParseError);
      expect((error as AIParseError).code).toBe("AI_PARSE_ERROR");
      expect((error as Error).message).toContain("JSON invalide");
    }
  });

  it("retire les blocs de code markdown avant la validation", () => {
    const raw = `\`\`\`json\n${JSON.stringify(buildFreePayload())}\n\`\`\``;

    const result = parseAIResponse(raw, { freePlan: true });

    expect(result.noteGlobale).toBe(62);
  });

  it("isAIParseError ne positives pas sur une erreur générique", () => {
    expect(isAIParseError(new Error("boom"))).toBe(false);
  });
});
