ALTER TABLE "Song" ADD COLUMN "itunesTrackId" TEXT;

CREATE UNIQUE INDEX "Song_itunesTrackId_key" ON "Song"("itunesTrackId");
