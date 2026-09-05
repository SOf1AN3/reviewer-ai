-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "auteur" TEXT,
    "revueCiblee" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analyse" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "rapport" TEXT NOT NULL,
    "noteGlobale" DOUBLE PRECISION NOT NULL,
    "noteParCritere" JSONB NOT NULL,
    "dateAnalyse" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analyse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
