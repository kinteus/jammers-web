ALTER TABLE "SitePageContent"
RENAME COLUMN "communityQuotesDisplayLimit" TO "communityQuotesDesktopDisplayLimit";

ALTER TABLE "SitePageContent"
ADD COLUMN "communityQuotesMobileDisplayLimit" INTEGER NOT NULL DEFAULT 8;
