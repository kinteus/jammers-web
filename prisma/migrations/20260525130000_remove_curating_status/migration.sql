UPDATE "Event"
SET "status" = 'CLOSED'
WHERE "status" = 'CURATING';

ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";

CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Event"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EventStatus" USING "status"::text::"EventStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "EventStatus_old";
