import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("track uniqueness schema", () => {
  it("allows repeated canceled tracks while keeping active event songs unique", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).not.toContain("@@unique([eventId, songId, state])");

    const migration = readFileSync(
      "prisma/migrations/20260529173000_track_active_song_uniqueness/migration.sql",
      "utf8",
    );

    expect(migration).toContain('DROP INDEX IF EXISTS "Track_eventId_songId_state_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "Track_active_event_song_unique_idx"');
    expect(migration).toContain('ON "Track"("eventId", "songId")');
    expect(migration).toContain("WHERE \"state\" = 'ACTIVE'");
  });
});
