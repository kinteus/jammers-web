ALTER TABLE "Event"
ADD COLUMN "trackInfoFieldsJson" TEXT;

ALTER TABLE "Track"
ADD COLUMN "trackInfoKeysJson" TEXT;
