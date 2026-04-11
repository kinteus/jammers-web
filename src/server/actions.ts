"use server";

import crypto from "node:crypto";

import {
  EventStatus,
  Prisma,
  SetlistSection,
  TrackInviteStatus,
  TrackSeatStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSession, deleteSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";
import { TelegramAuthPayload, verifyTelegramAuth } from "@/lib/auth/telegram";
import { ADMIN_LOCK_SCOPE } from "@/lib/constants";
import { db } from "@/lib/db";
import { seatLabelForSlot } from "@/lib/domain/lineup";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getRoleFamilyKey } from "@/lib/role-families";
import {
  assertEventAllowsChanges,
  canRequestClosedOptionalSeat,
  assertSeatClaimable,
  assertUserCanParticipate,
  assertWithinTrackLimit,
} from "@/lib/domain/rules";
import {
  parseClosedOptionalSeatRequestMeta,
  serializeClosedOptionalSeatRequestMeta,
} from "@/lib/track-invite-meta";
import { buildSetlistRecommendation } from "@/lib/domain/setlist-algorithm";
import { env } from "@/lib/env";
import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import {
  parseTrackInfoFieldsInput,
  serializeTrackInfoFields,
  serializeTrackInfoKeys,
} from "@/lib/track-info-flags";
import {
  DEFAULT_LINEUP_DETAILS_MARKDOWN,
  DEFAULT_PARTICIPATION_RULES_MARKDOWN,
  SITE_CONTENT_ID,
  parseVideoUrlsInput,
  serializeVideoUrls,
} from "@/lib/site-content";
import { slugify } from "@/lib/utils";
import { requireAdmin, requireSuperAdmin, requireUser } from "@/server/auth-guards";
import {
  sendTelegramFeedbackMessage,
  sendTelegramInviteMessage,
  sendTelegramSeatApprovalRequestMessage,
} from "@/server/telegram-bot";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

function pathBundle(eventSlug?: string) {
  const paths = ["/", "/admin", "/profile", "/faq"];
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

function buildEventRedirectUrl(
  eventSlug: string,
  params: Record<string, string>,
  hash = "track-board",
) {
  const search = new URLSearchParams(params);
  return `/events/${eventSlug}?${search.toString()}#${hash}`;
}

function redirectToEventError(eventSlug: string | undefined, error: string): never {
  if (eventSlug) {
    redirect(buildEventRedirectUrl(eventSlug, { error }));
  }

  throw new Error(error);
}

const eventStatusSchema = z.nativeEnum(EventStatus);
const setlistSectionSchema = z.nativeEnum(SetlistSection);
const lineupSlotSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  seatCount: z.number().int().min(1).max(24),
  allowOptional: z.boolean().optional(),
});

function parseLineupJson(value: string) {
  if (!value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return z.array(lineupSlotSchema).parse(parsed);
}

async function assertServerActionRateLimit(key: string, limit: number, windowMs: number) {
  const headerStore = await headers();
  const result = consumeRateLimit({
    key: `${key}:${getClientIpFromHeaders(headerStore)}`,
    limit,
    windowMs,
  });

  if (!result.allowed) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
}

function assertEventAllowsChangesOrRedirect(
  event: Parameters<typeof assertEventAllowsChanges>[0],
  eventSlug?: string,
) {
  try {
    assertEventAllowsChanges(event);
  } catch (error) {
    if (eventSlug) {
      redirectToEventError(eventSlug, "event-locked");
    }

    throw error;
  }
}

async function createClosedOptionalSeatRequest({
  seat,
  eventSlug,
  requester,
  targetUser,
  mode,
}: {
  seat: Awaited<ReturnType<typeof db.trackSeat.findUniqueOrThrow>> & {
    lineupSlot: {
      key: string;
    };
    track: {
      event: {
        title: string;
        startsAt: Date;
        status: EventStatus;
        registrationOpensAt: Date | null;
        registrationClosesAt: Date | null;
      };
      song: {
        title: string;
        artist: {
          name: string;
        };
      };
      proposedById: string;
      proposedBy: {
        telegramId: string | null;
        telegramUsername: string | null;
        fullName: string | null;
      };
    };
  };
  eventSlug: string;
  requester: {
    id: string;
    telegramUsername: string | null;
    fullName: string | null;
  };
  targetUser: {
    id: string;
    telegramUsername: string | null;
    fullName: string | null;
  };
  mode: "self" | "friend";
}) {
  const requesterLabel = requester.telegramUsername ?? requester.fullName ?? "A bandmate";
  const targetLabel = targetUser.telegramUsername ?? targetUser.fullName ?? "A musician";
  const requesterMessageLabel = requester.telegramUsername
    ? `@${requester.telegramUsername}`
    : requester.fullName ?? "A bandmate";
  const targetMessageLabel = targetUser.telegramUsername
    ? `@${targetUser.telegramUsername}`
    : targetUser.fullName ?? "A musician";
  await assertCanClaimRoleFamilyForTrack({
    eventSlug,
    excludeSeatId: seat.id,
    seatLabel: seat.label,
    seatLineupKey: seat.lineupSlot.key,
    trackId: seat.trackId,
    userId: targetUser.id,
  });
  const pendingRequests = await db.trackInvite.findMany({
    where: {
      seatId: seat.id,
      recipientId: seat.track.proposedById,
      status: TrackInviteStatus.PENDING,
    },
    select: {
      id: true,
      deliveryNote: true,
    },
  });

  const duplicateRequest = pendingRequests.some((invite) => {
    const meta = parseClosedOptionalSeatRequestMeta(invite.deliveryNote);
    return meta?.targetUserId === targetUser.id;
  });

  if (duplicateRequest) {
    redirect(buildEventRedirectUrl(eventSlug, { error: "opt-request-exists" }));
  }

  const delivery = await sendTelegramSeatApprovalRequestMessage({
    recipientTelegramId: seat.track.proposedBy.telegramId,
    eventTitle: seat.track.event.title,
    songLabel: `${seat.track.song.artist.name} - ${seat.track.song.title}`,
    seatLabel: seat.label,
    requesterLabel: requesterMessageLabel,
    targetLabel: targetMessageLabel,
    mode,
  });

  await db.trackInvite.create({
    data: {
      trackId: seat.trackId,
      seatId: seat.id,
      senderId: requester.id,
      recipientId: seat.track.proposedById,
      status: TrackInviteStatus.PENDING,
      deliveryNote: serializeClosedOptionalSeatRequestMeta({
        kind: "closed-opt-request",
        requesterId: requester.id,
        requesterLabel,
        targetUserId: targetUser.id,
        targetLabel,
        mode,
      }),
    },
  });

  revalidateAll(pathBundle(eventSlug));
  redirect(
    buildEventRedirectUrl(eventSlug, {
      notice:
        delivery.status === "DELIVERY_FAILED"
          ? "opt-request-saved"
          : "opt-request-sent",
    }),
  );
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

function throwDuplicateRoleFamilyError(eventSlug?: string): never {
  if (eventSlug) {
    redirect(buildEventRedirectUrl(eventSlug, { error: "duplicate-role-family" }));
  }

  throw new Error(
    "You can join the same track multiple times only on different instrument types.",
  );
}

async function assertCanClaimRoleFamilyForTrack({
  eventSlug,
  excludeSeatId,
  seatLabel,
  seatLineupKey,
  trackId,
  userId,
}: {
  eventSlug?: string;
  excludeSeatId?: string;
  seatLabel: string;
  seatLineupKey: string;
  trackId: string;
  userId: string;
}) {
  const targetFamily = getRoleFamilyKey(seatLabel, seatLineupKey);
  const claimedSeats = await db.trackSeat.findMany({
    where: {
      trackId,
      userId,
      status: TrackSeatStatus.CLAIMED,
      ...(excludeSeatId ? { id: { not: excludeSeatId } } : {}),
    },
    select: {
      label: true,
      lineupSlot: {
        select: {
          key: true,
        },
      },
    },
  });

  const alreadyHasFamilySeat = claimedSeats.some(
    (claimedSeat) => getRoleFamilyKey(claimedSeat.label, claimedSeat.lineupSlot.key) === targetFamily,
  );

  if (alreadyHasFamilySeat) {
    throwDuplicateRoleFamilyError(eventSlug);
  }
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
          isOptional: false,
        },
      });
    }
  }
}

async function resolveSongId(formData: FormData) {
  const explicitSongId = getString(formData, "songId");
  if (explicitSongId) {
    return explicitSongId;
  }

  const artistName =
    getString(formData, "selectedArtistName") || getString(formData, "artistName");
  const trackTitle =
    getString(formData, "selectedTrackTitle") ||
    getString(formData, "songTitle") ||
    getString(formData, "trackTitle");
  const selectedDurationSeconds = getInt(formData, "selectedDurationSeconds", 0);
  const durationMs = getInt(formData, "durationMs", 0);
  const durationSeconds =
    selectedDurationSeconds > 0
      ? selectedDurationSeconds
      : durationMs > 0
        ? Math.round(durationMs / 1000)
        : 0;

  if (!artistName || !trackTitle) {
    throw new Error("Choose a song from search results before proposing it.");
  }

  const artist = await db.artist.upsert({
    where: { slug: slugify(artistName) },
    update: { name: artistName },
    create: {
      slug: slugify(artistName),
      name: artistName,
    },
  });

  const song = await db.song.upsert({
    where: { slug: slugify(`${artistName}-${trackTitle}`) },
    update: {
      title: trackTitle,
      durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
    },
    create: {
      artistId: artist.id,
      slug: slugify(`${artistName}-${trackTitle}`),
      title: trackTitle,
      durationSeconds: durationSeconds > 0 ? durationSeconds : null,
    },
  });

  return song.id;
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

export async function telegramSignInAction(
  payload: Record<string, TelegramAuthPayload[keyof TelegramAuthPayload]>,
) {
  const verified = verifyTelegramAuth(payload as never);
  const user = await upsertTelegramUser(verified);

  await createSession(user.id);
  revalidateAll(["/", "/admin", "/profile"]);
}

export async function devSignInAction(formData: FormData) {
  if (!env.ENABLE_DEV_AUTH || env.NODE_ENV === "production") {
    throw new Error("Development auth is disabled.");
  }

  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!username) {
    throw new Error("Telegram username is required.");
  }
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
  const requestedTelegramUsername = normalizeTelegramUsername(getString(formData, "telegramUsername"));

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

export async function grantAdminRoleAction(formData: FormData) {
  await requireSuperAdmin();

  const telegramUsername = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!telegramUsername) {
    throw new Error("Telegram username is required.");
  }

  await db.user.update({
    where: { telegramUsername },
    data: { role: UserRole.ADMIN },
  });

  revalidateAll(["/admin", "/profile"]);
}

export async function revokeAdminRoleAction(formData: FormData) {
  await requireSuperAdmin();

  const telegramUsername = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!telegramUsername) {
    throw new Error("Telegram username is required.");
  }

  if (telegramUsername === normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME)) {
    throw new Error("The primary admin cannot lose admin access.");
  }

  await db.user.update({
    where: { telegramUsername },
    data: { role: UserRole.USER },
  });

  revalidateAll(["/admin", "/profile"]);
}

export async function requestSongCatalogAction(formData: FormData) {
  const user = await requireUser();
  const eventSlug = getString(formData, "eventSlug");
  await db.songCatalogRequest.create({
    data: {
      requestedById: user.id,
      artistName: getString(formData, "artistName"),
      trackTitle: getString(formData, "trackTitle"),
      comment: getString(formData, "comment") || null,
    },
  });

  revalidateAll(["/admin", "/"]);
  if (eventSlug) {
    redirect(
      buildEventRedirectUrl(
        eventSlug,
        { notice: "song-requested" },
        "missing-song-request",
      ),
    );
  }
}

export async function updateFaqContentAction(formData: FormData) {
  await requireAdmin();

  await db.sitePageContent.upsert({
    where: { id: SITE_CONTENT_ID },
    update: {
      participationRulesMarkdown:
        getString(formData, "participationRulesMarkdown") || DEFAULT_PARTICIPATION_RULES_MARKDOWN,
      lineupDetailsMarkdown:
        getString(formData, "lineupDetailsMarkdown") || DEFAULT_LINEUP_DETAILS_MARKDOWN,
      lineupVideoUrlsJson: serializeVideoUrls(
        parseVideoUrlsInput(getString(formData, "lineupVideoUrlsInput")),
      ),
    },
    create: {
      id: SITE_CONTENT_ID,
      participationRulesMarkdown:
        getString(formData, "participationRulesMarkdown") || DEFAULT_PARTICIPATION_RULES_MARKDOWN,
      lineupDetailsMarkdown:
        getString(formData, "lineupDetailsMarkdown") || DEFAULT_LINEUP_DETAILS_MARKDOWN,
      lineupVideoUrlsJson: serializeVideoUrls(
        parseVideoUrlsInput(getString(formData, "lineupVideoUrlsInput")),
      ),
    },
  });

  revalidateAll(["/faq", "/admin"]);
  redirect("/admin?notice=faq-saved#faq-content");
}

export async function sendFaqFeedbackAction(formData: FormData) {
  await assertServerActionRateLimit("faq-feedback", 5, 10 * 60 * 1000);

  const currentUser = await getCurrentUser();
  const name = getString(formData, "name");
  const contact = getString(formData, "contact");
  const message = getString(formData, "message");

  if (!name || !message) {
    redirect(`/faq?error=feedback-invalid#feedback`);
  }

  const fromLabel =
    currentUser?.telegramUsername
      ? `@${currentUser.telegramUsername} (${name})`
      : currentUser?.fullName
        ? `${currentUser.fullName} (${name})`
        : name;

  const delivery = await sendTelegramFeedbackMessage({
    fromLabel,
    contactLabel:
      contact ||
      (currentUser?.telegramUsername ? `@${currentUser.telegramUsername}` : null) ||
      currentUser?.email ||
      null,
    message,
  });

  if (delivery.status === "DELIVERY_FAILED") {
    redirect(`/faq?error=feedback-failed#feedback`);
  }

  redirect(`/faq?notice=feedback-sent#feedback`);
}

export async function createTrackAction(formData: FormData) {
  const user = await requireUser();
  assertUserCanParticipate(user);

  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  const songId = await resolveSongId(formData);
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
    if (eventSlug) {
      redirect(buildEventRedirectUrl(eventSlug, { error: "track-exists" }));
    }
    throw new Error("This song is already on the current event board.");
  }

  const claimSeatIds = parseSeatSelections(formData, "claimSeatKeys");
  const optionalSeatIds = parseSeatSelections(formData, "optionalSeatKeys");
  if (claimSeatIds.length > 0) {
    const joinedCount = await countUniqueJoinedTracks(user.id, event.id);
    assertWithinTrackLimit(joinedCount, event.maxTracksPerUser);
  }

  let track;
  const selectedTrackInfoKeys = formData
    .getAll("trackInfoFlagKeys")
    .map((value) => String(value))
    .filter(Boolean);
  try {
    track = await db.track.create({
      data: {
        eventId,
        songId,
        proposedById: user.id,
        comment: getString(formData, "comment") || null,
        playbackRequired: selectedTrackInfoKeys.includes("playback"),
        trackInfoKeysJson: serializeTrackInfoKeys(selectedTrackInfoKeys),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      if (eventSlug) {
        redirect(buildEventRedirectUrl(eventSlug, { error: "track-exists" }));
      }
      throw new Error("This song is already on the current event board.");
    }

    throw error;
  }

  await createDefaultTrackSeats(track.id, eventId);
  await ensureSetlistItem(track.id, eventId, user.id);

  const seats = await db.trackSeat.findMany({
    where: { trackId: track.id },
    include: { lineupSlot: true },
  });
  const unavailableKeys = parseSeatSelections(formData, "unavailableSeatKeys");
  const claimedRoleFamilies = new Set<string>();

  for (const seat of seats) {
    const seatKey = `${seat.label}:${seat.seatIndex}`;
    const claimed = claimSeatIds.includes(seatKey);

    if (!claimed) {
      continue;
    }

    const roleFamily = getRoleFamilyKey(seat.label, seat.lineupSlot.key);
    if (claimedRoleFamilies.has(roleFamily)) {
      throwDuplicateRoleFamilyError(eventSlug);
    }
    claimedRoleFamilies.add(roleFamily);
  }

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
        isOptional:
          seat.lineupSlot.allowOptional &&
          optionalSeatIds.includes(seatKey) &&
          !unavailableKeys.includes(seatKey),
        userId: claimed ? user.id : null,
        claimedAt: claimed ? new Date() : null,
      },
    });
  }

  revalidateAll(pathBundle(eventSlug));
  if (eventSlug) {
    redirect(buildEventRedirectUrl(eventSlug, { notice: "track-created" }));
  }
}

export async function claimSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      lineupSlot: {
        select: {
          key: true,
        },
      },
      track: {
        include: {
          event: true,
          song: {
            include: { artist: true },
          },
          proposedBy: true,
        },
      },
    },
  });

  if (canRequestClosedOptionalSeat(seat.track.event, seat)) {
    if (user.id === seat.track.proposedById || user.role === UserRole.ADMIN) {
      assertSeatClaimable(seat);
    } else {
      await createClosedOptionalSeatRequest({
        seat,
        eventSlug,
        requester: user,
        targetUser: user,
        mode: "self",
      });
      return;
    }
  } else {
    assertEventAllowsChangesOrRedirect(seat.track.event, eventSlug);
  }

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
  await assertCanClaimRoleFamilyForTrack({
    eventSlug,
    excludeSeatId: seat.id,
    seatLabel: seat.label,
    seatLineupKey: seat.lineupSlot.key,
    trackId: seat.trackId,
    userId: user.id,
  });

  await db.trackSeat.update({
    where: { id: seat.id },
    data: {
      userId: user.id,
      status: TrackSeatStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function releaseSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: {
        include: { event: true },
      },
    },
  });

  assertEventAllowsChangesOrRedirect(seat.track.event, eventSlug);
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

  revalidateAll(pathBundle(eventSlug));
}

export async function markSeatUnavailableAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      lineupSlot: {
        select: {
          key: true,
        },
      },
      track: {
        include: {
          event: true,
        },
      },
    },
  });

  assertEventAllowsChangesOrRedirect(seat.track.event, eventSlug);
  if (seat.track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can mark seats unavailable.");
  }

  if (seat.userId && user.role !== UserRole.ADMIN) {
    throw new Error("Claimed seats cannot be marked as unavailable.");
  }

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      status: TrackSeatStatus.UNAVAILABLE,
      userId: null,
      claimedAt: null,
    },
  });

  revalidateAll(pathBundle(eventSlug));
}

export async function inviteToSeatAction(formData: FormData) {
  const user = await requireUser();
  const eventSlug = getString(formData, "eventSlug");
  const username = normalizeTelegramUsername(getString(formData, "recipientUsername"));
  const seatId = getString(formData, "seatId");
  if (!username) {
    throw new Error("Recipient username is required.");
  }
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      lineupSlot: {
        select: {
          key: true,
        },
      },
      track: {
        include: {
          event: true,
          song: {
            include: { artist: true },
          },
          proposedBy: true,
        },
      },
    },
  });

  const recipient = await db.user.findUnique({
    where: { telegramUsername: username },
  });

  if (!recipient) {
    throw new Error("Recipient not found. Ask them to register first.");
  }

  if (canRequestClosedOptionalSeat(seat.track.event, seat)) {
    if (user.id === seat.track.proposedById || user.role === UserRole.ADMIN) {
      assertSeatClaimable(seat);

      const alreadyOnTrack = await db.trackSeat.count({
        where: {
          userId: recipient.id,
          trackId: seat.trackId,
          status: TrackSeatStatus.CLAIMED,
        },
      });

      if (!alreadyOnTrack) {
        const joinedCount = await countUniqueJoinedTracks(recipient.id, seat.track.eventId);
        assertWithinTrackLimit(joinedCount, seat.track.event.maxTracksPerUser);
      }
      await assertCanClaimRoleFamilyForTrack({
        eventSlug,
        excludeSeatId: seat.id,
        seatLabel: seat.label,
        seatLineupKey: seat.lineupSlot.key,
        trackId: seat.trackId,
        userId: recipient.id,
      });

      await db.trackSeat.update({
        where: { id: seat.id },
        data: {
          userId: recipient.id,
          status: TrackSeatStatus.CLAIMED,
          claimedAt: new Date(),
        },
      });

      await db.trackInvite.updateMany({
        where: {
          seatId,
          status: TrackInviteStatus.PENDING,
        },
        data: {
          status: TrackInviteStatus.CANCELED,
          respondedAt: new Date(),
        },
      });

      revalidateAll(pathBundle(eventSlug));
      if (eventSlug) {
        redirect(buildEventRedirectUrl(eventSlug, { notice: "seat-claimed" }));
      }
      return;
    }

    await createClosedOptionalSeatRequest({
      seat,
      eventSlug,
      requester: user,
      targetUser: recipient,
      mode: recipient.id === user.id ? "self" : "friend",
    });
    return;
  }

  if (seat.track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can invite people to this track.");
  }

  assertEventAllowsChangesOrRedirect(seat.track.event, eventSlug);
  assertSeatClaimable(seat);

  if (recipient.id === user.id) {
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
    await assertCanClaimRoleFamilyForTrack({
      eventSlug,
      excludeSeatId: seat.id,
      seatLabel: seat.label,
      seatLineupKey: seat.lineupSlot.key,
      trackId: seat.trackId,
      userId: user.id,
    });

    await db.trackSeat.update({
      where: { id: seat.id },
      data: {
        userId: user.id,
        status: TrackSeatStatus.CLAIMED,
        claimedAt: new Date(),
      },
    });

    revalidateAll(pathBundle(eventSlug));
    if (eventSlug) {
      redirect(buildEventRedirectUrl(eventSlug, { notice: "seat-claimed" }));
    }
    return;
  }

  const existingInvite = await db.trackInvite.findFirst({
    where: {
      seatId,
      recipientId: recipient.id,
      status: TrackInviteStatus.PENDING,
    },
  });

  if (existingInvite) {
    throw new Error("This user already has a pending invite for the selected seat.");
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
  const eventSlug = getString(formData, "eventSlug");
  const invite = await db.trackInvite.findUniqueOrThrow({
    where: { id: inviteId },
    include: {
      seat: {
        include: {
          lineupSlot: {
            select: {
              key: true,
            },
          },
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
  const requestMeta = parseClosedOptionalSeatRequestMeta(invite.deliveryNote);

  if (invite.recipientId !== user.id) {
    throw new Error("This invite is not yours.");
  }

  if (decision === "accept") {
    const targetUserId = requestMeta?.targetUserId ?? user.id;

    if (requestMeta) {
      if (!canRequestClosedOptionalSeat(invite.seat.track.event, invite.seat)) {
        redirectToEventError(eventSlug, "event-locked");
      }
    } else {
      assertEventAllowsChanges(invite.seat.track.event);
    }

    assertSeatClaimable(invite.seat);

    const joinedCount = await countUniqueJoinedTracks(targetUserId, invite.track.eventId);
    const alreadyOnTrack = await db.trackSeat.count({
      where: { userId: targetUserId, trackId: invite.trackId, status: TrackSeatStatus.CLAIMED },
    });
    if (!alreadyOnTrack) {
      assertWithinTrackLimit(joinedCount, invite.seat.track.event.maxTracksPerUser);
    }
    await assertCanClaimRoleFamilyForTrack({
      eventSlug,
      excludeSeatId: invite.seat.id,
      seatLabel: invite.seat.label,
      seatLineupKey: invite.seat.lineupSlot.key,
      trackId: invite.trackId,
      userId: targetUserId,
    });

    await db.$transaction([
      db.trackSeat.update({
        where: { id: invite.seatId },
        data: {
          userId: targetUserId,
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
      db.trackInvite.updateMany({
        where: {
          seatId: invite.seatId,
          status: TrackInviteStatus.PENDING,
          id: { not: inviteId },
        },
        data: {
          status: TrackInviteStatus.CANCELED,
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

  revalidateAll(["/profile", `/events/${eventSlug}`]);
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
      trackInfoFieldsJson: serializeTrackInfoFields(
        parseTrackInfoFieldsInput(getString(formData, "trackInfoFieldsInput")),
      ),
      stageNotes: getString(formData, "stageNotes") || null,
    },
  });

  const lineup = parseLineupJson(getString(formData, "lineupJson"));

  for (const [index, slot] of lineup.entries()) {
    await db.eventLineupSlot.create({
      data: {
        eventId: event.id,
        key: slot.key,
        label: slot.label,
        seatCount: slot.seatCount,
        allowOptional: slot.allowOptional ?? true,
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
      trackInfoFieldsJson: serializeTrackInfoFields(
        parseTrackInfoFieldsInput(getString(formData, "trackInfoFieldsInput")),
      ),
      stageNotes: getString(formData, "stageNotes") || null,
    },
  });

  const lineupPayload = getString(formData, "lineupJson");
  if (lineupPayload && event.tracks.length === 0) {
    const lineup = parseLineupJson(lineupPayload);

    await db.eventLineupSlot.deleteMany({ where: { eventId } });
    for (const [index, slot] of lineup.entries()) {
      await db.eventLineupSlot.create({
        data: {
          eventId,
          key: slot.key,
          label: slot.label,
          seatCount: slot.seatCount,
          allowOptional: slot.allowOptional ?? true,
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
  const status = eventStatusSchema.parse(getString(formData, "status"));
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
      notes: getString(formData, "notes") || null,
    },
    create: {
      artistId: artist.id,
      slug: slugify(`${artistName}-${trackTitle}`),
      title: trackTitle,
      durationSeconds: getInt(formData, "durationSeconds", 240),
      notes: getString(formData, "notes") || null,
    },
  });

  revalidateAll(["/", "/admin"]);
}

export async function createKnownGroupAction(formData: FormData) {
  await requireAdmin();
  const usernames = getString(formData, "memberUsernames")
    .split(",")
    .map((value) => normalizeTelegramUsername(value))
    .filter((value): value is string => Boolean(value));
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
  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!username) {
    throw new Error("Telegram username is required.");
  }
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
  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!username) {
    throw new Error("Telegram username is required.");
  }
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
    assertEventAllowsChangesOrRedirect(track.event, eventSlug);
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
  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  const eventSlug = getString(formData, "eventSlug");
  if (!username) {
    throw new Error("Telegram username is required.");
  }
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
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      track: true,
    },
  });
  await assertLockOwnership(seat.track.eventId, admin.id);

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

    const completion = getTrackCompletionSummary(track.seats);
    const requiredSeatCount = track.seats.filter(
      (seat) => seat.status !== TrackSeatStatus.UNAVAILABLE && !seat.isOptional,
    ).length;
    const requiredClaimed = requiredSeatCount - completion.requiredOpen;
    return {
      id: track.id,
      songId: track.songId,
      songTitle: track.song.title,
      artistName: track.song.artist.name,
      durationSeconds: track.song.durationSeconds,
      participantIds,
      filledSeatRatio: requiredSeatCount > 0 ? requiredClaimed / requiredSeatCount : 1,
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
  const section = setlistSectionSchema.parse(getString(formData, "section"));
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
        orderIndex: 3000 + items.length + 1,
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

  await db.$transaction(async (tx) => {
    for (const [index, item] of sorted.entries()) {
      await tx.setlistItem.update({
        where: { id: item.id },
        data: {
          orderIndex: 1000 + index + 1,
          editedById: admin.id,
        },
      });
    }

    for (const [index, item] of sorted.entries()) {
      await tx.setlistItem.update({
        where: { id: item.id },
        data: {
          orderIndex: index + 1,
          editedById: admin.id,
        },
      });
    }
  });

  revalidateAll(pathBundle(eventSlug));
}
