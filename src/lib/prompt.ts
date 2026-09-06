import { criteres } from "@/config/crits";
import type { ArticleInput } from "./types";

export function buildAnalysisPrompt(article: ArticleInput): string {
  const criteresDescriptions = criteres
    .map(
      (c) =>
        `- **${c.label}** (id: \`${c.id}\`) : ${c.description}`
    )
    .join("\n");

  return `Tu es un relecteur scientifique expert. Tu dois analyser l'article scientifique suivant et fournir une évaluation détaillée.

## Critères d'analyse

${criteresDescriptions}

## Article à analyser

**Titre** : ${article.titre}
${article.auteur ? `**Auteur(s)** : ${article.auteur}` : ""}
${article.revueCiblee ? `**Revue ciblée** : ${article.revueCiblee}` : ""}

**Contenu** :
${article.contenu}

## Consignes de réponse

Tu dois impérativement répondre en JSON valide avec la structure suivante (sans markdown, sans texte avant ou après le JSON) :

{
  "noteGlobale": <nombre entre 0 et 100>,
  "notesParCritere": {
    "rigueur_methode": <nombre 0-100>,
    "originalite": <nombre 0-100>,
    "revue_litterature": <nombre 0-100>,
    "clarte_redaction": <nombre 0-100>,
    "resultats_analyse": <nombre 0-100>,
    "discussion_implications": <nombre 0-100>,
    "conformite_normes": <nombre 0-100>,
    "impact_potentiel": <nombre 0-100>
  },
  "rapport": {
    "resume": "<résumé de 2-3 phrases de ton évaluation globale>",
    "points_forts": ["<point fort 1>", "<point fort 2>", "<point fort 3>"],
    "points_a_ameliorer": ["<amélioration 1>", "<amélioration 2>", "<amélioration 3>"],
    "sections": {
      "rigueur_methode": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "originalite": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "revue_litterature": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "clarte_redaction": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "resultats_analyse": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "discussion_implications": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "conformite_normes": { "note": <0-100>, "commentaire": "<commentaire détaillé>" },
      "impact_potentiel": { "note": <0-100>, "commentaire": "<commentaire détaillé>" }
    },
    "recommandations": ["<recommandation 1>", "<recommandation 2>", "<recommandation 3>"],
    "verdict": "<verdict court : 'Article accepté', 'Révisions mineures requises', 'Révisions majeures requises', ou 'Rejeté'>"
  }
}

## Note importante

Le texte de l'article peut contenir des artefacts de conversion issus de l'extraction automatique (symboles Unicode, espacements inhabituels). Ces artefacts proviennent du pipeline de traitement et ne sont pas des problèmes de l'article original. Évalue le contenu scientifique en te basant sur ce qui est intelligible.

Sois exigeant mais juste dans ton évaluation. Chaque commentaire doit être spécifique et constructif.`;
}
