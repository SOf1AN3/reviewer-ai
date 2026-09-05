import { criteres } from "@/config/crits";
import type { ArticleInput } from "./types";

export function buildAnalysisPrompt(article: ArticleInput): string {
  const criteresDescriptions = criteres
    .map(
      (c) =>
        `- **${c.label}** (id: \`${c.id}\`) : ${c.description}`
    )
    .join("\n");

  const artefactInstructions = `
## Instructions critiques sur le texte fourni

Le texte de l'article ci-dessus peut contenir des **artefacts de conversion** issus du processus d'extraction automatique. Ces artefacts proviennent du pipeline de traitement et **NE SONT PAS des problèmes de l'article original**.

Tu dois impérativement ignorer les éléments suivants dans ton évaluation :
- Symboles mathématiques convertis en Unicode (ex: symboles de sommation, intégration, lettres grecques, etc.)
- Equations presentees en texte brut avec des carets et underscores
- Artefacts de tableaux (separateurs pipe, cellules mal formatees)
- Espacements ou sauts de ligne inhabituels
- Caracteres manquants ou degrades dus a l'extraction

**Concentre-toi UNIQUEMENT sur le fond scientifique** : rigueur methodologique, originalite, qualite de l'argumentation, solidite des resultats, pertinence des references, et clarte de la redaction.

Ne signale jamais les artefacts de conversion comme des faiblesses de l'article. Si le texte paraît corrompu à certains endroits, considère-le comme une limitation de l'extraction et évalue le contenu tel qu'il est intelligible.

Sois exigeant mais juste dans ton évaluation. Chaque commentaire doit être spécifique et constructif.`;

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
  "noteGlobale": NOMBRE,
  "notesParCritere": {
    "rigueur_methode": NOMBRE,
    "originalite": NOMBRE,
    "revue_litterature": NOMBRE,
    "clarte_redaction": NOMBRE,
    "resultats_analyse": NOMBRE,
    "discussion_implications": NOMBRE,
    "conformite_normes": NOMBRE,
    "impact_potentiel": NOMBRE
  },
  "rapport": {
    "resume": "RESUME_DE_2_3_phrases",
    "points_forts": ["POINT_FORT_1", "POINT_FORT_2", "POINT_FORT_3"],
    "points_a_ameliorer": ["AMELIORATION_1", "AMELIORATION_2", "AMELIORATION_3"],
    "sections": {
      "rigueur_methode": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "originalite": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "revue_litterature": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "clarte_redaction": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "resultats_analyse": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "discussion_implications": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "conformite_normes": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" },
      "impact_potentiel": { "note": NOMBRE, "commentaire": "COMMENTAIRE_DETAILLE" }
    },
    "recommandations": ["RECOMMANDATION_1", "RECOMMANDATION_2", "RECOMMANDATION_3"],
    "verdict": "VERDICT"
  }
}
${artefactInstructions}`;
}
