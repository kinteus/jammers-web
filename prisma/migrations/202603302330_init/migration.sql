-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CURATING', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrackState" AS ENUM ('ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TrackSeatStatus" AS ENUM ('OPEN', 'CLAIMED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TrackInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'DELIVERY_FAILED');

-- CreateEnum
CREATE TYPE "SelectionStrategy" AS ENUM ('COVERAGE_FIRST');

-- CreateEnum
CREATE TYPE "SetlistSection" AS ENUM ('MAIN', 'BACKLOG');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstrument" (
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "proficiency" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstrument_pkey" PRIMARY KEY ("userId","instrumentId")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "defaultTuning" TEXT,
    "durationSeconds" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongCatalogRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "trackTitle" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongCatalogRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venueName" TEXT,
    "venueMapUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "maxSetDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxTracksPerUser" INTEGER NOT NULL DEFAULT 3,
    "allowPlayback" BOOLEAN NOT NULL DEFAULT true,
    "stageNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLineupSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "linkedGroupId" TEXT,
    "comment" TEXT,
    "tuning" TEXT,
    "playbackRequired" BOOLEAN NOT NULL DEFAULT false,
    "state" "TrackState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackSeat" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "lineupSlotId" TEXT NOT NULL,
    "userId" TEXT,
    "seatIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TrackSeatStatus" NOT NULL DEFAULT 'OPEN',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackInvite" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "TrackInviteStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TrackInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnsembleGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isKnownBand" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnsembleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnsembleGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnsembleGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "AdminUserRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUserRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionRun" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "strategy" "SelectionStrategy" NOT NULL DEFAULT 'COVERAGE_FIRST',
    "resultSummaryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetlistItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "section" "SetlistSection" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEditLock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventEditLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramUsername_key" ON "User"("telegramUsername");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_telegramUsername_idx" ON "User"("telegramUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_slug_key" ON "Instrument"("slug");

-- CreateIndex
CREATE INDEX "Ban_userId_endsAt_idx" ON "Ban"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "Artist"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Song_artistId_title_key" ON "Song"("artistId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "EventLineupSlot_eventId_displayOrder_idx" ON "EventLineupSlot"("eventId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EventLineupSlot_eventId_key_key" ON "EventLineupSlot"("eventId", "key");

-- CreateIndex
CREATE INDEX "Track_eventId_createdAt_idx" ON "Track"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Track_songId_eventId_idx" ON "Track"("songId", "eventId");

-- CreateIndex
CREATE INDEX "TrackSeat_userId_trackId_idx" ON "TrackSeat"("userId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackSeat_trackId_lineupSlotId_seatIndex_key" ON "TrackSeat"("trackId", "lineupSlotId", "seatIndex");

-- CreateIndex
CREATE INDEX "TrackInvite_recipientId_status_idx" ON "TrackInvite"("recipientId", "status");

-- CreateIndex
CREATE INDEX "TrackInvite_trackId_status_idx" ON "TrackInvite"("trackId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EnsembleGroup_slug_key" ON "EnsembleGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EnsembleGroup_name_key" ON "EnsembleGroup"("name");

-- CreateIndex
CREATE INDEX "AdminUserRating_userId_score_idx" ON "AdminUserRating"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRating_userId_createdById_key" ON "AdminUserRating"("userId", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItem_eventId_trackId_key" ON "SetlistItem"("eventId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItem_eventId_section_orderIndex_key" ON "SetlistItem"("eventId", "section", "orderIndex");

-- CreateIndex
CREATE INDEX "EventEditLock_eventId_scope_expiresAt_idx" ON "EventEditLock"("eventId", "scope", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserInstrument" ADD CONSTRAINT "UserInstrument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstrument" ADD CONSTRAINT "UserInstrument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCatalogRequest" ADD CONSTRAINT "SongCatalogRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLineupSlot" ADD CONSTRAINT "EventLineupSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLineupSlot" ADD CONSTRAINT "EventLineupSlot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_linkedGroupId_fkey" FOREIGN KEY ("linkedGroupId") REFERENCES "EnsembleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackSeat" ADD CONSTRAINT "TrackSeat_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackSeat" ADD CONSTRAINT "TrackSeat_lineupSlotId_fkey" FOREIGN KEY ("lineupSlotId") REFERENCES "EventLineupSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackSeat" ADD CONSTRAINT "TrackSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackInvite" ADD CONSTRAINT "TrackInvite_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackInvite" ADD CONSTRAINT "TrackInvite_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "TrackSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackInvite" ADD CONSTRAINT "TrackInvite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackInvite" ADD CONSTRAINT "TrackInvite_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnsembleGroupMember" ADD CONSTRAINT "EnsembleGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EnsembleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnsembleGroupMember" ADD CONSTRAINT "EnsembleGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRating" ADD CONSTRAINT "AdminUserRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRating" ADD CONSTRAINT "AdminUserRating_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionRun" ADD CONSTRAINT "SelectionRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionRun" ADD CONSTRAINT "SelectionRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEditLock" ADD CONSTRAINT "EventEditLock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEditLock" ADD CONSTRAINT "EventEditLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

