CREATE TABLE "SitePageContent" (
    "id" TEXT NOT NULL,
    "participationRulesMarkdown" TEXT NOT NULL,
    "lineupDetailsMarkdown" TEXT NOT NULL,
    "lineupVideoUrlsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePageContent_pkey" PRIMARY KEY ("id")
);
