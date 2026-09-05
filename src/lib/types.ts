export interface NoteParCritere {
  [critereId: string]: number;
}

export interface SectionRapport {
  note: number;
  commentaire: string;
}

export interface Rapport {
  resume: string;
  points_forts: string[];
  points_a_ameliorer: string[];
  sections: {
    [critereId: string]: SectionRapport;
  };
  recommandations: string[];
  verdict: string;
}

export interface AnalyseResult {
  noteGlobale: number;
  notesParCritere: NoteParCritere;
  rapport: Rapport;
}

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
