DROP INDEX IF EXISTS "Track_eventId_songId_state_key";

CREATE UNIQUE INDEX "Track_active_event_song_unique_idx"
ON "Track"("eventId", "songId")
WHERE "state" = 'ACTIVE';
