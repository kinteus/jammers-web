"use server";

import crypto from "node:crypto";

import {
  EventStatus,
  SetlistSection,
  TrackInviteStatus,
  TrackSeatStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSession, deleteSession } from "@/lib/auth/session";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { ADMIN_LOCK_SCOPE } from "@/lib/constants";
import { db } from "@/lib/db";
import { seatLabelForSlot } from "@/lib/domain/lineup";
import {
  assertEventAllowsChanges,
  assertSeatClaimable,
  assertUserCanParticipate,
  assertWithinTrackLimit,
} from "@/lib/domain/rules";
import { buildSetlistRecommendation } from "@/lib/domain/setlist-algorithm";
import { env } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { requireAdmin, requireUser } from "@/server/auth-guards";
import { sendTelegramInviteMessage } from "@/server/telegram-bot";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

function pathBundle(eventSlug?: string) {
  const paths = ["/", "/admin", "/profile"];
  if (eventSlug) {
    paths.push(`/events/${eventSlug}`, `/admin/events/${eventSlug}`);
  }
  return paths;
}

function revalidateAll(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getInt(formData: FormData, key: string, fallback = 0) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function parseInstrumentIds(formData: FormData) {
  return formData
    .getAll("instrumentIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function parseSeatSelections(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function countUniqueJoinedTracks(userId: string, eventId: string) {
  const seats = await db.trackSeat.findMany({
    where: {
      userId,
      status: TrackSeatStatus.CLAIMED,
      track: {
        eventId,
        state: "ACTIVE",
      },
    },
    select: {
      trackId: true,
    },
  });

  return new Set(seats.map((seat) => seat.trackId)).size;
}

async function createDefaultTrackSeats(trackId: string, eventId: string) {
  const slots = await db.eventLineupSlot.findMany({
    where: { eventId },
    orderBy: { displayOrder: "asc" },
  });

  for (const slot of slots) {
    for (let index = 1; index <= slot.seatCount; index += 1) {
      await db.trackSeat.create({
        data: {
          trackId,
          lineupSlotId: slot.id,
          seatIndex: index,
          label: seatLabelForSlot(slot, index),
        },
      });
    }
  }
}

async function ensureSetlistItem(trackId: string, eventId: string, editedById?: string) {
  const count = await db.setlistItem.count({
    where: { eventId, section: SetlistSection.BACKLOG },
  });

  await db.setlistItem.upsert({
    where: {
      eventId_trackId: {
        eventId,
        trackId,
      },
    },
    update: {},
    create: {
      eventId,
      trackId,
      section: SetlistSection.BACKLOG,
      orderIndex: count + 1,
      editedById,
    },
  });
}

async function assertLockOwnership(eventId: string, userId: string) {
  const activeLock = await db.eventEditLock.findFirst({
    where: {
      eventId,
      scope: ADMIN_LOCK_SCOPE,
      expiresAt: { gt: new Date() },
    },
  });

  if (activeLock && activeLock.userId !== userId) {
    throw new Error("Another admin currently owns the curation lock.");
  }
}

export async function signOutAction() {
  await deleteSession();
  revalidateAll(["/", "/admin", "/profile"]);
}

export async function telegramSignInAction(payload: Record<string, string>) {
  const verified = verifyTelegramAuth(payload as never);
  const user = await upsertTelegramUser(verified);

  await createSession(user.id);
  revalidateAll(["/", "/admin", "/profile"]);
}

export async function devSignInAction(formData: FormData) {
  if (!env.ENABLE_DEV_AUTH || env.NODE_ENV === "production") {
    throw new Error("Development auth is disabled.");
  }

  const username = getString(formData, "telegramUsername");
  const role = getString(formData, "role") === "ADMIN" ? UserRole.ADMIN : UserRole.USER;
  const user = await db.user.upsert({
    where: { telegramUsername: username },
    update: { role },
    create: {
      telegramId: crypto.randomUUID(),
      telegramUsername: username,
      fullName: username,
      role,
    },
  });

  await createSession(user.id);
  revalidateAll(["/", "/admin", "/profile"]);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const instrumentIds = parseInstrumentIds(formData);
  const requestedTelegramUsername = getString(formData, "telegramUsername") || null;

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        fullName: getString(formData, "fullName") || null,
        phone: getString(formData, "phone") || null,
        email: getString(formData, "email") || null,
        bio: getString(formData, "bio") || null,
        telegramUsername: user.telegramId ? user.telegramUsername : requestedTelegramUsername,
      },
    }),
    db.userInstrument.deleteMany({
      where: { userId: user.id },
    }),
    ...(instrumentIds.length > 0
      ? [
          db.userInstrument.createMany({
            data: instrumentIds.map((instrumentId) => ({
              userId: user.id,
              instrumentId,
            })),
          }),
        ]
      : []),
  ]);

  revalidateAll(["/profile", "/"]);
}

export async function requestSongCatalogAction(formData: FormData) {
  const user = await requireUser();
  await db.songCatalogRequest.create({
    data: {
      requestedById: user.id,
      artistName: getString(formData, "artistName"),
      trackTitle: getString(formData, "trackTitle"),
      comment: getString(formData, "comment") || null,
    },
  });

  revalidateAll(["/admin", "/"]);
}

export async function createTrackAction(formData: FormData) {
  const user = await requireUser();
  assertUserCanParticipate(user);

  const eventId = getString(formData, "eventId");
  const songId = getString(formData, "songId");
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
  });
  assertEventAllowsChanges(event);

  const existingTrack = await db.track.findFirst({
    where: {
      eventId,
      songId,
      state: "ACTIVE",
    },
  });

  if (existingTrack) {
    throw new Error("This song is already on the current event board.");
  }

  const claimSeatIds = parseSeatSelections(formData, "claimSeatKeys");
  if (claimSeatIds.length > 0) {
    const joinedCount = await countUniqueJoinedTracks(user.id, event.id);
    assertWithinTrackLimit(joinedCount, event.maxTracksPerUser);
  }

  const track = await db.track.create({
    data: {
      eventId,
      songId,
      proposedById: user.id,
      comment: getString(formData, "comment") || null,
      tuning: getString(formData, "tuning") || null,
      playbackRequired: getBoolean(formData, "playbackRequired"),
    },
  });

  await createDefaultTrackSeats(track.id, eventId);
  await ensureSetlistItem(track.id, eventId, user.id);

  const seats = await db.trackSeat.findMany({
    where: { trackId: track.id },
  });
  const unavailableKeys = parseSeatSelections(formData, "unavailableSeatKeys");

  for (const seat of seats) {
    const seatKey = `${seat.label}:${seat.seatIndex}`;
    const status = unavailableKeys.includes(seatKey)
      ? TrackSeatStatus.UNAVAILABLE
      : TrackSeatStatus.OPEN;
    const claimed = claimSeatIds.includes(seatKey);

    await db.trackSeat.update({
      where: { id: seat.id },
      data: {
        status: claimed ? TrackSeatStatus.CLAIMED : status,
        userId: claimed ? user.id : null,
        claimedAt: claimed ? new Date() : null,
      },
    });
  }

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function claimSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: { event: true },
      },
    },
  });

  assertEventAllowsChanges(seat.track.event);
  assertSeatClaimable(seat);

  const alreadyOnTrack = await db.trackSeat.count({
    where: {
      userId: user.id,
      trackId: seat.trackId,
      status: TrackSeatStatus.CLAIMED,
    },
  });

  if (!alreadyOnTrack) {
    const joinedCount = await countUniqueJoinedTracks(user.id, seat.track.eventId);
    assertWithinTrackLimit(joinedCount, seat.track.event.maxTracksPerUser);
  }

  await db.trackSeat.update({
    where: { id: seat.id },
    data: {
      userId: user.id,
      status: TrackSeatStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function releaseSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: { event: true },
      },
    },
  });

  assertEventAllowsChanges(seat.track.event);
  if (seat.userId !== user.id && seat.track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("You cannot remove this participant.");
  }

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      userId: null,
      status: TrackSeatStatus.OPEN,
      claimedAt: null,
    },
  });

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function markSeatUnavailableAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: {
          event: true,
        },
      },
    },
  });

  assertEventAllowsChanges(seat.track.event);
  if (seat.track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can mark seats unavailable.");
  }

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      status: TrackSeatStatus.UNAVAILABLE,
      userId: null,
      claimedAt: null,
    },
  });

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function inviteToSeatAction(formData: FormData) {
  const user = await requireUser();
  const eventSlug = getString(formData, "eventSlug");
  const username = getString(formData, "recipientUsername").replace(/^@/, "");
  const seatId = getString(formData, "seatId");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: {
          event: true,
          song: {
            include: { artist: true },
          },
        },
      },
    },
  });

  if (seat.track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can invite people to this track.");
  }

  assertEventAllowsChanges(seat.track.event);

  const recipient = await db.user.findUnique({
    where: { telegramUsername: username },
  });

  if (!recipient) {
    throw new Error("Recipient not found. Ask them to register first.");
  }

  const delivery = await sendTelegramInviteMessage({
    recipientTelegramId: recipient.telegramId,
    eventTitle: seat.track.event.title,
    songLabel: `${seat.track.song.artist.name} - ${seat.track.song.title}`,
    seatLabel: seat.label,
    inviterLabel: user.telegramUsername ?? user.fullName ?? "A bandmate",
  });

  await db.trackInvite.create({
    data: {
      trackId: seat.trackId,
      seatId,
      senderId: user.id,
      recipientId: recipient.id,
      status:
        delivery.status === "DELIVERY_FAILED"
          ? TrackInviteStatus.DELIVERY_FAILED
          : TrackInviteStatus.PENDING,
      deliveryNote: delivery.note,
    },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function respondToInviteAction(formData: FormData) {
  const user = await requireUser();
  const inviteId = getString(formData, "inviteId");
  const decision = getString(formData, "decision");
  const invite = await db.trackInvite.findUniqueOrThrow({
    where: { id: inviteId },
    include: {
      seat: {
        include: {
          track: {
            include: {
              event: true,
            },
          },
        },
      },
      track: true,
    },
  });

  if (invite.recipientId !== user.id) {
    throw new Error("This invite is not yours.");
  }

  if (decision === "accept") {
    assertEventAllowsChanges(invite.seat.track.event);
    assertSeatClaimable(invite.seat);

    const joinedCount = await countUniqueJoinedTracks(user.id, invite.track.eventId);
    const alreadyOnTrack = await db.trackSeat.count({
      where: { userId: user.id, trackId: invite.trackId, status: TrackSeatStatus.CLAIMED },
    });
    if (!alreadyOnTrack) {
      assertWithinTrackLimit(joinedCount, invite.seat.track.event.maxTracksPerUser);
    }

    await db.$transaction([
      db.trackSeat.update({
        where: { id: invite.seatId },
        data: {
          userId: user.id,
          status: TrackSeatStatus.CLAIMED,
          claimedAt: new Date(),
        },
      }),
      db.trackInvite.update({
        where: { id: inviteId },
        data: {
          status: TrackInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      }),
    ]);
  } else {
    await db.trackInvite.update({
      where: { id: inviteId },
      data: {
        status: TrackInviteStatus.DECLINED,
        respondedAt: new Date(),
      },
    });
  }

  revalidateAll(["/profile", `/events/${getString(formData, "eventSlug")}`]);
}

export async function createEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = getString(formData, "title");
  const slugBase = slugify(title);
  const slug = `${slugBase}-${Math.random().toString(16).slice(2, 6)}`;
  const startsAt = new Date(getString(formData, "startsAt"));
  const closesAt = new Date(getString(formData, "registrationClosesAt"));
  const event = await db.event.create({
    data: {
      slug,
      title,
      description: getString(formData, "description") || null,
      venueName: getString(formData, "venueName") || null,
      venueMapUrl: getString(formData, "venueMapUrl") || null,
      startsAt,
      registrationOpensAt: new Date(),
      registrationClosesAt: closesAt,
      status: EventStatus.DRAFT,
      maxSetDurationMinutes: getInt(formData, "maxSetDurationMinutes", 120),
      maxTracksPerUser: getInt(formData, "maxTracksPerUser", 3),
      allowPlayback: getBoolean(formData, "allowPlayback"),
      stageNotes: getString(formData, "stageNotes") || null,
    },
  });

  const lineupPayload = getString(formData, "lineupJson");
  const lineup =
    lineupPayload.length > 0
      ? (JSON.parse(lineupPayload) as Array<{ key: string; label: string; seatCount: number }>)
      : [];

  for (const [index, slot] of lineup.entries()) {
    await db.eventLineupSlot.create({
      data: {
        eventId: event.id,
        key: slot.key,
        label: slot.label,
        seatCount: slot.seatCount,
        displayOrder: index + 1,
      },
    });
  }

  await db.eventEditLock.create({
    data: {
      eventId: event.id,
      userId: admin.id,
      scope: ADMIN_LOCK_SCOPE,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  revalidateAll(["/", "/admin"]);
}

export async function updateEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);

  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { tracks: true },
  });

  await db.event.update({
    where: { id: eventId },
    data: {
      title: getString(formData, "title"),
      description: getString(formData, "description") || null,
      venueName: getString(formData, "venueName") || null,
      venueMapUrl: getString(formData, "venueMapUrl") || null,
      startsAt: new Date(getString(formData, "startsAt")),
      registrationClosesAt: new Date(getString(formData, "registrationClosesAt")),
      maxSetDurationMinutes: getInt(formData, "maxSetDurationMinutes", event.maxSetDurationMinutes),
      maxTracksPerUser: getInt(formData, "maxTracksPerUser", event.maxTracksPerUser),
      allowPlayback: getBoolean(formData, "allowPlayback"),
      stageNotes: getString(formData, "stageNotes") || null,
    },
  });

  const lineupPayload = getString(formData, "lineupJson");
  if (lineupPayload && event.tracks.length === 0) {
    const lineup = JSON.parse(lineupPayload) as Array<{
      key: string;
      label: string;
      seatCount: number;
    }>;

    await db.eventLineupSlot.deleteMany({ where: { eventId } });
    for (const [index, slot] of lineup.entries()) {
      await db.eventLineupSlot.create({
        data: {
          eventId,
          key: slot.key,
          label: slot.label,
          seatCount: slot.seatCount,
          displayOrder: index + 1,
        },
      });
    }
  }

  revalidateAll(pathBundle(eventSlug));
}

export async function updateEventStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const status = getString(formData, "status") as EventStatus;
  const eventSlug = getString(formData, "eventSlug");
  if (status === EventStatus.CURATING || status === EventStatus.PUBLISHED) {
    await assertLockOwnership(eventId, admin.id);
  }

  await db.event.update({
    where: { id: eventId },
    data: { status },
  });
  revalidateAll(pathBundle(eventSlug));
}

export async function createCatalogSongAction(formData: FormData) {
  await requireAdmin();
  const artistName = getString(formData, "artistName");
  const trackTitle = getString(formData, "trackTitle");
  const artist = await db.artist.upsert({
    where: { slug: slugify(artistName) },
    update: { name: artistName },
    create: {
      slug: slugify(artistName),
      name: artistName,
    },
  });

  await db.song.upsert({
    where: { slug: slugify(`${artistName}-${trackTitle}`) },
    update: {
      title: trackTitle,
      durationSeconds: getInt(formData, "durationSeconds", 240),
      defaultTuning: getString(formData, "defaultTuning") || null,
      notes: getString(formData, "notes") || null,
    },
    create: {
      artistId: artist.id,
      slug: slugify(`${artistName}-${trackTitle}`),
      title: trackTitle,
      durationSeconds: getInt(formData, "durationSeconds", 240),
      defaultTuning: getString(formData, "defaultTuning") || null,
      notes: getString(formData, "notes") || null,
    },
  });

  revalidateAll(["/", "/admin"]);
}

export async function createKnownGroupAction(formData: FormData) {
  await requireAdmin();
  const usernames = getString(formData, "memberUsernames")
    .split(",")
    .map((value) => value.trim().replace(/^@/, ""))
    .filter(Boolean);
  const users = await db.user.findMany({
    where: {
      telegramUsername: {
        in: usernames,
      },
    },
  });

  await db.ensembleGroup.create({
    data: {
      slug: slugify(getString(formData, "name")),
      name: getString(formData, "name"),
      description: getString(formData, "description") || null,
      members: {
        create: users.map((member) => ({
          userId: member.id,
        })),
      },
    },
  });

  revalidateAll(["/admin", "/"]);
}

export async function setBanAction(formData: FormData) {
  const admin = await requireAdmin();
  const username = getString(formData, "telegramUsername").replace(/^@/, "");
  const user = await db.user.findUniqueOrThrow({
    where: { telegramUsername: username },
  });
  const isPermanent = getBoolean(formData, "isPermanent");
  const durationDays = getInt(formData, "durationDays", 7);

  await db.ban.create({
    data: {
      userId: user.id,
      createdById: admin.id,
      reason: getString(formData, "reason") || null,
      startsAt: new Date(),
      endsAt: isPermanent ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      isPermanent,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { role: user.role, status: "BANNED" },
  });

  revalidateAll(["/admin", "/"]);
}

export async function setRatingAction(formData: FormData) {
  const admin = await requireAdmin();
  const username = getString(formData, "telegramUsername").replace(/^@/, "");
  const user = await db.user.findUniqueOrThrow({
    where: { telegramUsername: username },
  });

  await db.adminUserRating.upsert({
    where: {
      userId_createdById: {
        userId: user.id,
        createdById: admin.id,
      },
    },
    update: {
      score: getInt(formData, "score", 3),
      note: getString(formData, "note") || null,
    },
    create: {
      userId: user.id,
      createdById: admin.id,
      score: getInt(formData, "score", 3),
      note: getString(formData, "note") || null,
    },
  });

  revalidateAll(["/admin"]);
}

export async function cancelTrackAction(formData: FormData) {
  const user = await requireUser();
  const trackId = getString(formData, "trackId");
  const eventSlug = getString(formData, "eventSlug");
  const track = await db.track.findUniqueOrThrow({
    where: { id: trackId },
    include: { event: true },
  });

  if (track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can cancel this track.");
  }

  if (user.role !== UserRole.ADMIN) {
    assertEventAllowsChanges(track.event);
  }

  await db.track.update({
    where: { id: trackId },
    data: {
      state: "CANCELED",
    },
  });
  await db.setlistItem.deleteMany({
    where: { trackId },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function adminAssignSeatAction(formData: FormData) {
  const admin = await requireAdmin();
  const seatId = getString(formData, "seatId");
  const username = getString(formData, "telegramUsername").replace(/^@/, "");
  const eventSlug = getString(formData, "eventSlug");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: { event: true },
      },
    },
  });
  await assertLockOwnership(seat.track.eventId, admin.id);

  const user = await db.user.findUniqueOrThrow({
    where: { telegramUsername: username },
  });

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      userId: user.id,
      status: TrackSeatStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function adminClearSeatAction(formData: FormData) {
  const admin = await requireAdmin();
  const seatId = getString(formData, "seatId");
  const eventId = getString(formData, "eventId");
  await assertLockOwnership(eventId, admin.id);

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      userId: null,
      claimedAt: null,
      status: TrackSeatStatus.OPEN,
    },
  });

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function acquireCurationLockAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const existing = await db.eventEditLock.findFirst({
    where: {
      eventId,
      scope: ADMIN_LOCK_SCOPE,
      expiresAt: { gt: new Date() },
    },
  });

  if (existing && existing.userId !== admin.id) {
    throw new Error("Another admin already owns the curation lock.");
  }

  if (existing) {
    await db.eventEditLock.update({
      where: { id: existing.id },
      data: {
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  } else {
    await db.eventEditLock.create({
      data: {
        eventId,
        userId: admin.id,
        scope: ADMIN_LOCK_SCOPE,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  }

  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function runSelectionAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);

  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      tracks: {
        where: { state: "ACTIVE" },
        include: {
          song: {
            include: { artist: true },
          },
          seats: {
            include: { user: true },
          },
        },
      },
    },
  });

  const previousEvent = await db.event.findFirst({
    where: {
      startsAt: { lt: event.startsAt },
      status: EventStatus.PUBLISHED,
    },
    include: {
      setlistItems: {
        where: { section: SetlistSection.MAIN },
        include: { track: true },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  const groups = await db.ensembleGroup.findMany({
    include: {
      members: true,
    },
  });

  const candidates = event.tracks.map((track) => {
    const participantIds = track.seats
      .filter((seat) => seat.status === TrackSeatStatus.CLAIMED && seat.userId)
      .map((seat) => seat.userId!) as string[];
    const participantSet = new Set(participantIds);
    const matchedGroup =
      groups.find((group) => {
        const memberSet = new Set(group.members.map((member) => member.userId));
        return (
          group.members.length > 0 &&
          group.members.length === participantSet.size &&
          [...memberSet].every((id) => participantSet.has(id))
        );
      }) ?? null;

    const filledSeats = track.seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).length;
    return {
      id: track.id,
      songId: track.songId,
      songTitle: track.song.title,
      artistName: track.song.artist.name,
      durationSeconds: track.song.durationSeconds,
      participantIds,
      filledSeatRatio: track.seats.length > 0 ? filledSeats / track.seats.length : 0,
      createdAt: track.createdAt,
      matchedKnownGroupName: matchedGroup?.name ?? null,
    };
  });

  const recommendation = buildSetlistRecommendation({
    maxSetDurationMinutes: event.maxSetDurationMinutes,
    previousConcertSongIds: new Set(
      previousEvent?.setlistItems.map((item) => item.track.songId) ?? [],
    ),
    candidates,
  });

  await db.selectionRun.create({
    data: {
      eventId,
      startedById: admin.id,
      resultSummaryJson: recommendation,
    },
  });

  await db.setlistItem.deleteMany({
    where: { eventId },
  });

  for (const item of recommendation.selected) {
    await db.setlistItem.create({
      data: {
        eventId,
        trackId: item.trackId,
        section: item.section,
        orderIndex: item.orderIndex,
        editedById: admin.id,
      },
    });
  }

  for (const [index, item] of recommendation.backlog.entries()) {
    await db.setlistItem.create({
      data: {
        eventId,
        trackId: item.trackId,
        section: item.section,
        orderIndex: index + 1,
        editedById: admin.id,
      },
    });
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.CURATING,
    },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function moveSetlistItemAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);
  const itemId = getString(formData, "itemId");
  const section = getString(formData, "section") as SetlistSection;
  const orderIndex = getInt(formData, "orderIndex", 1);
  const items = await db.setlistItem.findMany({
    where: { eventId },
    orderBy: [{ section: "asc" }, { orderIndex: "asc" }],
  });
  const currentItem = items.find((item) => item.id === itemId);

  if (!currentItem) {
    throw new Error("Setlist item not found.");
  }

  const sourceSection = currentItem.section;
  const targetSectionItems = items
    .filter((item) => item.section === section && item.id !== itemId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
  const sourceSectionItems = items
    .filter((item) => item.section === sourceSection && item.id !== itemId)
    .sort((left, right) => left.orderIndex - right.orderIndex);

  const sanitizedOrder = Math.min(Math.max(orderIndex, 1), targetSectionItems.length + 1);
  targetSectionItems.splice(sanitizedOrder - 1, 0, currentItem);

  await db.$transaction(async (tx) => {
    await tx.setlistItem.update({
      where: { id: itemId },
      data: {
        section,
        editedById: admin.id,
      },
    });

    for (const [index, item] of sourceSectionItems.entries()) {
      await tx.setlistItem.update({
        where: { id: item.id },
        data: { orderIndex: 1000 + index + 1 },
      });
    }

    for (const [index, item] of targetSectionItems.entries()) {
      await tx.setlistItem.update({
        where: { id: item.id },
        data: { orderIndex: 2000 + index + 1 },
      });
    }

    if (sourceSection !== section) {
      for (const [index, item] of sourceSectionItems.entries()) {
        await tx.setlistItem.update({
          where: { id: item.id },
          data: { orderIndex: index + 1 },
        });
      }
    }

    for (const [index, item] of targetSectionItems.entries()) {
      await tx.setlistItem.update({
        where: { id: item.id },
        data: {
          section,
          orderIndex: index + 1,
          editedById: item.id === itemId ? admin.id : item.editedById,
        },
      });
    }
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function publishSetlistAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  await assertLockOwnership(eventId, admin.id);

  await db.event.update({
    where: { id: eventId },
    data: { status: EventStatus.PUBLISHED },
  });
  revalidateAll(pathBundle(getString(formData, "eventSlug")));
}

export async function sortSetlistByDrummerAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);

  const items = await db.setlistItem.findMany({
    where: {
      eventId,
      section: SetlistSection.MAIN,
    },
    include: {
      track: {
        include: {
          seats: {
            include: {
              user: true,
              lineupSlot: true,
            },
          },
        },
      },
    },
    orderBy: { orderIndex: "asc" },
  });

  const sorted = [...items].sort((left, right) => {
    const leftDrummer =
      left.track.seats.find(
        (seat) =>
          seat.user &&
          (seat.lineupSlot.key === "drums" || seat.lineupSlot.label.toLowerCase() === "drums"),
      )?.user?.telegramUsername ?? "zzzz";
    const rightDrummer =
      right.track.seats.find(
        (seat) =>
          seat.user &&
          (seat.lineupSlot.key === "drums" || seat.lineupSlot.label.toLowerCase() === "drums"),
      )?.user?.telegramUsername ?? "zzzz";

    if (leftDrummer !== rightDrummer) {
      return leftDrummer.localeCompare(rightDrummer);
    }

    return left.orderIndex - right.orderIndex;
  });

  for (const [index, item] of sorted.entries()) {
    await db.setlistItem.update({
      where: { id: item.id },
      data: {
        orderIndex: index + 1,
        editedById: admin.id,
      },
    });
  }

  revalidateAll(pathBundle(eventSlug));
}
