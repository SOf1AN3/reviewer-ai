export interface Critere {
  id: string;
  label: string;
  description: string;
}

const criteresBase: { id: string; descriptions: Record<string, string> }[] = [
  {
    id: "rigueur_methode",
    descriptions: {
      fr: "La méthodologie est-elle robuste, reproductible et appropriée au type d'étude ?",
      en: "Is the methodology robust, reproducible, and appropriate for the study type?",
      ar: "هل المنهجية متينة وقابلة للتكرار ومناسبة لنوع الدراسة؟",
    },
  },
  {
    id: "originalite",
    descriptions: {
      fr: "L'article apporte-t-il une contribution nouvelle par rapport à l'état de l'art ?",
      en: "Does the article bring a novel contribution compared to the state of the art?",
      ar: "هل يقدم المقال مساهمة جديدة مقارنة بالحالة المعرفية؟",
    },
  },
  {
    id: "revue_litterature",
    descriptions: {
      fr: "La contextualisation et les références sont-elles complètes et pertinentes ?",
      en: "Are the contextualization and references complete and relevant?",
      ar: "هل السياق والمراجع كاملة وذات صلة؟",
    },
  },
  {
    id: "clarte_redaction",
    descriptions: {
      fr: "Le texte est-il clair, bien structuré et compréhensible pour la cible ?",
      en: "Is the text clear, well-structured, and understandable for the target audience?",
      ar: "هل النص واضح ومنظم جيداً ومفهوم للجمهور المستهدف؟",
    },
  },
  {
    id: "resultats_analyse",
    descriptions: {
      fr: "Les résultats sont-ils présentés rigoureusement avec les analyses statistiques appropriées ?",
      en: "Are the results presented rigorously with appropriate statistical analyses?",
      ar: "هل النتائج مقدمة بدقة مع التحليلات الإحصائية المناسبة؟",
    },
  },
  {
    id: "discussion_implications",
    descriptions: {
      fr: "La discussion est-elle approfondie avec des implications claires pour le domaine ?",
      en: "Is the discussion thorough with clear implications for the field?",
      ar: "هل النقاش شامل مع آثار واضحة للمجال؟",
    },
  },
  {
    id: "conformite_normes",
    descriptions: {
      fr: "L'article respecte-t-il les standards de publication (structure IMRAD, format, citations) ?",
      en: "Does the article comply with publication standards (IMRAD structure, format, citations)?",
      ar: "هل يتوافق المقال مع معايير النشر (هيكل IMRAD، التنسيق، المراجع)؟",
    },
  },
  {
    id: "impact_potentiel",
    descriptions: {
      fr: "L'article a-t-il un potentiel d'impact significatif pour le domaine ?",
      en: "Does the article have significant potential impact for the field?",
      ar: "هل للمقال تأثير محتمل كبير على المجال؟",
    },
  },
];

export function getCriteres(locale: string = "fr"): Critere[] {
  const labelKey = `criteria.${""}`;
  return criteresBase.map((c) => ({
    id: c.id,
    label: locale === "fr"
      ? criteresLabelsFr[c.id]
      : locale === "en"
      ? criteresLabelsEn[c.id]
      : criteresLabelsAr[c.id],
    description: c.descriptions[locale] ?? c.descriptions.fr,
  }));
}

const criteresLabelsFr: Record<string, string> = {
  rigueur_methode: "Rigueur méthodologique",
  originalite: "Originalité et novelty",
  revue_litterature: "Qualité de la revue de littérature",
  clarte_redaction: "Clarté de rédaction",
  resultats_analyse: "Qualité des résultats et analyses",
  discussion_implications: "Discussion et implications",
  conformite_normes: "Conformité aux normes",
  impact_potentiel: "Impact potentiel",
};

const criteresLabelsEn: Record<string, string> = {
  rigueur_methode: "Methodological Rigor",
  originalite: "Originality & Novelty",
  revue_litterature: "Literature Review Quality",
  clarte_redaction: "Writing Clarity",
  resultats_analyse: "Results & Analysis Quality",
  discussion_implications: "Discussion & Implications",
  conformite_normes: "Standards Compliance",
  impact_potentiel: "Potential Impact",
};

const criteresLabelsAr: Record<string, string> = {
  rigueur_methode: "الصرامة المنهجية",
  originalite: "الأصالة والجدة",
  revue_litterature: "جودة مراجعة الأدبيات",
  clarte_redaction: "وضوح الكتابة",
  resultats_analyse: "جودة النتائج والتحليلات",
  discussion_implications: "النقاش والآثار",
  conformite_normes: "الامتثال للمعايير",
  impact_potentiel: "التأثير المحتمل",
};

export const criteres: Critere[] = criteresBase.map((c) => ({
  id: c.id,
  label: c.descriptions.fr,
  description: c.descriptions.fr,
}));
