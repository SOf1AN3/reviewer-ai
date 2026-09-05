export interface Critere {
  id: string;
  label: string;
  description: string;
}

export const criteres: Critere[] = [
  {
    id: "rigueur_methode",
    label: "Rigueur méthodologique",
    description:
      "La méthodologie est-elle robuste, reproductible et appropriée au type d'étude ?",
  },
  {
    id: "originalite",
    label: "Originalité et novelty",
    description:
      "L'article apporte-t-il une contribution nouvelle par rapport à l'état de l'art ?",
  },
  {
    id: "revue_litterature",
    label: "Qualité de la revue de littérature",
    description:
      "La contextualisation et les références sont-elles complètes et pertinentes ?",
  },
  {
    id: "clarte_redaction",
    label: "Clarté de rédaction",
    description:
      "Le texte est-il clair, bien structuré et compréhensible pour la cible ?",
  },
  {
    id: "resultats_analyse",
    label: "Qualité des résultats et analyses",
    description:
      "Les résultats sont-ils présentés rigoureusement avec les analyses statistiques appropriées ?",
  },
  {
    id: "discussion_implications",
    label: "Discussion et implications",
    description:
      "La discussion est-elle approfondie avec des implications claires pour le domaine ?",
  },
  {
    id: "conformite_normes",
    label: "Conformité aux normes",
    description:
      "L'article respecte-t-il les standards de publication (structure IMRAD, format, citations) ?",
  },
  {
    id: "impact_potentiel",
    label: "Impact potentiel",
    description:
      "L'article a-t-il un potentiel d'impact significatif pour le domaine ?",
  },
];
