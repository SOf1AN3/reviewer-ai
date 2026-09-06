import { getCriteres } from "@/config/crits";
import type { ArticleInput } from "./types";

const promptInstructions = {
  fr: {
    system: "Tu es un relecteur scientifique expert. Tu dois analyser l'article scientifique suivant et fournir une évaluation détaillée. IMPORTANT : Tu dois impérativement répondre en français. Toutes les valeurs textuelles du JSON (resume, points_forts, points_a_ameliorer, commentaires, recommandations, verdict) doivent être rédigées en français.",
    criteriaTitle: "Critères d'analyse",
    articleTitle: "Article à analyser",
    titleLabel: "Titre",
    authorLabel: "Auteur(s)",
    journalLabel: "Revue ciblée",
    contentLabel: "Contenu",
    responseTitle: "Consignes de réponse",
    responseInstructions: `Tu dois impérativement répondre en JSON valide avec la structure suivante (sans markdown, sans texte avant ou après le JSON) :`,
    noteLabel: "note entre 0 et 100",
    commentLabel: "commentaire détaillé",
    summaryPlaceholder: "résumé de 2-3 phrases de ton évaluation globale",
    strengthPlaceholder: "point fort",
    improvementPlaceholder: "amélioration",
    recommendationPlaceholder: "recommandation",
    verdictPlaceholder: "verdict court : 'Article accepté', 'Révisions mineures requises', 'Révisions majeures requises', ou 'Rejeté'",
    importantNote: "Note importante",
    importantNoteText: "Le texte de l'article peut contenir des artefacts de conversion issus de l'extraction automatique (symboles Unicode, espacements inhabituels). Ces artefacts proviennent du pipeline de traitement et ne sont pas des problèmes de l'article original. Évalue le contenu scientifique en te basant sur ce qui est intelligible.",
    closing: "Sois exigeant mais juste dans ton évaluation. Chaque commentaire doit être spécifique et constructif.",
  },
  en: {
    system: "You are an expert scientific peer reviewer. You must analyze the following scientific article and provide a detailed evaluation. IMPORTANT: You MUST respond entirely in English. All text values in the JSON (resume, points_forts, points_a_ameliorer, commentaires, recommandations, verdict) must be written in English.",
    criteriaTitle: "Analysis Criteria",
    articleTitle: "Article to Analyze",
    titleLabel: "Title",
    authorLabel: "Author(s)",
    journalLabel: "Target Journal",
    contentLabel: "Content",
    responseTitle: "Response Instructions",
    responseInstructions: `You must respond with valid JSON using the following structure (no markdown, no text before or after the JSON):`,
    noteLabel: "score between 0 and 100",
    commentLabel: "detailed comment",
    summaryPlaceholder: "2-3 sentence summary of your overall evaluation",
    strengthPlaceholder: "strength",
    improvementPlaceholder: "area for improvement",
    recommendationPlaceholder: "recommendation",
    verdictPlaceholder: "short verdict: 'Article accepted', 'Minor revisions required', 'Major revisions required', or 'Rejected'",
    importantNote: "Important Note",
    importantNoteText: "The article text may contain conversion artifacts from automatic extraction (Unicode symbols, unusual spacing). These artifacts come from the processing pipeline and are not issues with the original article. Evaluate the scientific content based on what is intelligible.",
    closing: "Be rigorous but fair in your evaluation. Each comment should be specific and constructive.",
  },
  ar: {
    system: "أنت خبير في مراجعة الأقران العلمية. يجب عليك تحليل المقال العلمي التالي وتقديم تقييم مفصل. مهم جداً: يجب عليك الرد بالكامل باللغة العربية. جميع القيم النصية في JSON (resume, points_forts, points_a_ameliorer, commentaires, recommandations, verdict) يجب أن تكون مكتوبة بالعربية.",
    criteriaTitle: "معايير التحليل",
    articleTitle: "المقال المطلوب تحليله",
    titleLabel: "العنوان",
    authorLabel: "المؤلف(ون)",
    journalLabel: "المجلة المستهدفة",
    contentLabel: "المحتوى",
    responseTitle: "تعليمات الرد",
    responseInstructions: `يجب عليك الرد بصيغة JSON صالحة باستخدام البنية التالية (بدون markdown، بدون نص قبل أو بعد JSON):`,
    noteLabel: "تقييم بين 0 و 100",
    commentLabel: "تعليق مفصل",
    summaryPlaceholder: "ملخص من 2-3 جمل لتقييمك العام",
    strengthPlaceholder: "نقطة قوة",
    improvementPlaceholder: "مجال للتحسين",
    recommendationPlaceholder: "توصية",
    verdictPlaceholder: "حكم مختصر: 'المقال مقبول'، 'تعديلات طفيفة مطلوبة'، 'تعديلات جوهرية مطلوبة'، أو 'مرفوض'",
    importantNote: "ملاحظة هامة",
    importantNoteText: "قد يحتوي نص المقال على نواتج تحويل من الاستخراج التلقائي (رموز Unicode، تباعد غير مألوف). هذه النواتج تأتي من خط المعالجة وليست مشاكل في المقال الأصلي. قم بتقييم المحتوى العلمي بناءً على ما هو مقروء.",
    closing: "كن صارماً لكن عادلاً في تقييمك. يجب أن يكون كل تعليق محدداً وبناءً.",
  },
};

export function buildAnalysisPrompt(article: ArticleInput, locale: string = "fr"): string {
  const lang = locale in promptInstructions ? (locale as keyof typeof promptInstructions) : "fr";
  const t = promptInstructions[lang];
  const criteresList = getCriteres(locale);

  const criteresDescriptions = criteresList
    .map(
      (c) =>
        `- **${c.label}** (id: \`${c.id}\`) : ${c.description}`
    )
    .join("\n");

  return `${t.system}

## ${t.criteriaTitle}

${criteresDescriptions}

## ${t.articleTitle}

**${t.titleLabel}** : ${article.titre}
${article.auteur ? `**${t.authorLabel}** : ${article.auteur}` : ""}
${article.revueCiblee ? `**${t.journalLabel}** : ${article.revueCiblee}` : ""}

**${t.contentLabel}** :
${article.contenu}

## ${t.responseTitle}

${t.responseInstructions}

{
  "noteGlobale": <${t.noteLabel}>,
  "notesParCritere": {
    "rigueur_methode": <0-100>,
    "originalite": <0-100>,
    "revue_litterature": <0-100>,
    "clarte_redaction": <0-100>,
    "resultats_analyse": <0-100>,
    "discussion_implications": <0-100>,
    "conformite_normes": <0-100>,
    "impact_potentiel": <0-100>
  },
  "rapport": {
    "resume": "<${t.summaryPlaceholder}>",
    "points_forts": ["<${t.strengthPlaceholder} 1>", "<${t.strengthPlaceholder} 2>", "<${t.strengthPlaceholder} 3>"],
    "points_a_ameliorer": ["<${t.improvementPlaceholder} 1>", "<${t.improvementPlaceholder} 2>", "<${t.improvementPlaceholder} 3>"],
    "sections": {
      "rigueur_methode": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "originalite": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "revue_litterature": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "clarte_redaction": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "resultats_analyse": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "discussion_implications": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "conformite_normes": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" },
      "impact_potentiel": { "note": <0-100>, "commentaire": "<${t.commentLabel}>" }
    },
    "recommandations": ["<${t.recommendationPlaceholder} 1>", "<${t.recommendationPlaceholder} 2>", "<${t.recommendationPlaceholder} 3>"],
    "verdict": "<${t.verdictPlaceholder}>"
  }
}

## ${t.importantNote}

${t.importantNoteText}

${t.closing}`;
}
