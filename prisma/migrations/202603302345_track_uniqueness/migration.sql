CREATE UNIQUE INDEX "Track_eventId_songId_state_key"
ON "Track"("eventId", "songId", "state");
