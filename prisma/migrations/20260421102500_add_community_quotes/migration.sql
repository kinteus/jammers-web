-- CreateTable
CREATE TABLE "CommunityQuote" (
    "id" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "textRu" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityQuote_isActive_displayOrder_createdAt_idx"
ON "CommunityQuote"("isActive", "displayOrder", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityQuote"
ADD CONSTRAINT "CommunityQuote_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityQuote"
ADD CONSTRAINT "CommunityQuote_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
