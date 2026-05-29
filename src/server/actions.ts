"use server";

import crypto from "node:crypto";

import {
  EventStatus,
  Prisma,
  SetlistSection,
  TrackInviteStatus,
  TrackSeatStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FAQ_PAGE_DATA_TAG, HOME_PAGE_DATA_TAG } from "@/lib/cache-tags";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isSuperAdminUser } from "@/lib/auth/admin-access";
import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "@/lib/auth/telegram-username";
import { TelegramAuthPayload, verifyTelegramAuth } from "@/lib/auth/telegram";
import { ADMIN_LOCK_SCOPE } from "@/lib/constants";
import { db } from "@/lib/db";
import { seatLabelForSlot } from "@/lib/domain/lineup";
import { assertEventRegistrationWindow } from "@/lib/domain/event-registration";
import { getNextSetlistOrderIndex } from "@/lib/domain/setlist-order";
import { DEFAULT_MAX_SET_TRACK_COUNT, getEffectiveMaxSetTrackCount } from "@/lib/domain/setlist-limit";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getAllowedNextEventStatuses, getEffectiveEventStatus } from "@/lib/domain/event-status";
import { parseAdminLocalDateTimeInput } from "@/lib/domain/local-datetime";
import { getRoleFamilyKey } from "@/lib/role-families";
import {
  assertEventAllowsChanges,
  canRequestClosedOptionalSeat,
  assertSeatClaimable,
  assertUserCanParticipate,
  assertWithinTrackLimit,
  userNeedsTelegramUsername,
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
  DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
  DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
  DEFAULT_LINEUP_DETAILS_MARKDOWN,
  DEFAULT_PARTICIPATION_RULES_MARKDOWN,
  SITE_CONTENT_ID,
  parseVideoUrlsInput,
  serializeFaqContent,
  serializeVideoUrls,
} from "@/lib/site-content";
import { slugify } from "@/lib/utils";
import { normalizeVenueMapUrl } from "@/lib/url-security";
import { getSafeReturnTo } from "@/lib/return-to";
import { isUniqueConstraintErrorForFields } from "@/lib/prisma-errors";
import { buildSongUpsertArgs } from "@/lib/song-identity";
import { slugifyRouteSegment } from "@/lib/event-slugs";
import { requireAdmin, requireSuperAdmin, requireUser } from "@/server/auth-guards";
import {
  sendTelegramFeedbackMessage,
  sendTelegramBoardClosedChannelMessage,
  sendTelegramBoardClosedParticipantMessage,
  sendTelegramAdminSeatAssignedMessage,
  sendTelegramInviteMessage,
  sendTelegramPublishedSetMessage,
  sendTelegramSeatApprovalRequestMessage,
  sendTelegramSeatTakenMessage,
  sendTelegramTrackCompleteMessage,
} from "@/server/telegram-bot";
import { buildPublishedSetNotifications } from "@/server/published-set-notifications";
import { publishBoardUpdate } from "@/server/board-event-bus";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

function pathBundle(...eventKeys: Array<string | undefined>) {
  const paths = ["/", "/admin", "/profile", "/faq"];

  for (const eventKey of eventKeys) {
    if (!eventKey) {
      continue;
    }

    paths.push(`/events/${eventKey}`, `/admin/events/${eventKey}`);
  }

  return paths;
}

function isSafeRevalidationPath(path: string) {
  return path.startsWith("/") && /^[\x20-\x7E]+$/.test(path);
}

function revalidateAll(paths: string[]) {
  const uniquePaths = [...new Set(paths)];

  if (uniquePaths.some((path) => path === "/" || path.startsWith("/events/"))) {
    revalidateTag(HOME_PAGE_DATA_TAG);
  }
  if (uniquePaths.some((path) => path === "/faq" || path === "/admin")) {
    revalidateTag(FAQ_PAGE_DATA_TAG);
  }

  for (const path of uniquePaths) {
    if (isSafeRevalidationPath(path)) {
      revalidatePath(path);
    }
  }
}

function encodeRouteSegment(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function buildEventRedirectUrl(
  eventSlug: string,
  params: Record<string, string>,
  hash = "track-board",
) {
  const search = new URLSearchParams(params);
  const searchString = search.toString();
  const hashString = hash ? `#${hash}` : "";

  return searchString
    ? `/events/${encodeRouteSegment(eventSlug)}?${searchString}${hashString}`
    : `/events/${encodeRouteSegment(eventSlug)}${hashString}`;
}

function redirectToEventError(eventSlug: string | undefined, error: string): never {
  if (eventSlug) {
    redirect(buildEventRedirectUrl(eventSlug, { error }));
  }

  throw new Error(error);
}

function redirectClaimFailure(eventSlug: string | undefined, error: string): never {
  redirectToEventError(eventSlug, error);
}

function redirectToEventNotice(eventSlug: string | undefined, notice: string): never {
  if (eventSlug) {
    redirect(buildEventRedirectUrl(eventSlug, { notice }));
  }

  throw new Error(notice);
}

function buildProfileInviteRedirectUrl(
  params: Record<string, string>,
  hash = "invitations",
) {
  const search = new URLSearchParams(params);
  const searchString = search.toString();
  const hashString = hash ? `#${hash}` : "";

  return searchString ? `/profile?${searchString}${hashString}` : `/profile${hashString}`;
}

function redirectToProfileInviteError(error: string): never {
  redirect(buildProfileInviteRedirectUrl({ inviteError: error }));
}

function redirectToProfileInviteNotice(notice: string): never {
  redirect(buildProfileInviteRedirectUrl({ inviteNotice: notice }));
}

const eventStatusSchema = z.nativeEnum(EventStatus);
const setlistSectionSchema = z.nativeEnum(SetlistSection);
const lineupSlotSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  seatCount: z.number().int().min(1).max(24),
  allowOptional: z.boolean().optional(),
  defaultOptionalSeats: z.array(z.number().int().min(1).max(24)).optional(),
});

function resolveDefaultOptionalSeats(slot: z.infer<typeof lineupSlotSchema>) {
  if (slot.allowOptional === false) {
    return [];
  }
  const unique = new Set(
    (slot.defaultOptionalSeats ?? []).filter(
      (index) => Number.isInteger(index) && index >= 1 && index <= slot.seatCount,
    ),
  );
  return [...unique].sort((a, b) => a - b);
}

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
  redirectOnComplete = true,
  seat,
  eventSlug,
  requester,
  targetUser,
  mode,
}: {
  redirectOnComplete?: boolean;
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
  try {
    await assertCanClaimRoleFamilyForTrack({
      eventSlug,
      excludeSeatId: seat.id,
      redirectOnError: redirectOnComplete,
      seatLabel: seat.label,
      seatLineupKey: seat.lineupSlot.key,
      trackId: seat.trackId,
      userId: targetUser.id,
    });
  } catch (error) {
    if (!redirectOnComplete && error instanceof Error && error.message === "duplicate-role-family") {
      return { ok: false as const, error: "duplicate-role-family" as const };
    }

    throw error;
  }
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
    if (redirectOnComplete) {
      redirect(buildEventRedirectUrl(eventSlug, { error: "opt-request-exists" }));
    }

    return { ok: false as const, error: "opt-request-exists" as const };
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
  const notice: "opt-request-saved" | "opt-request-sent" =
    delivery.status === "DELIVERY_FAILED"
      ? "opt-request-saved"
      : "opt-request-sent";

  if (redirectOnComplete) {
    redirect(
      buildEventRedirectUrl(eventSlug, {
        notice,
      }),
    );
  }

  return { ok: true as const, notice };
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

function getConfiguredMaxSetTrackCount(formData: FormData, fallback: number) {
  const rawValue =
    getInt(formData, "maxSetTrackCount", 0) || getInt(formData, "maxSetDurationMinutes", 0);

  if (rawValue <= 0) {
    return getEffectiveMaxSetTrackCount(fallback);
  }

  return Math.max(1, Math.round(rawValue));
}

function getConfiguredMinParticipantsPerTrack(formData: FormData, fallback: number) {
  return Math.max(1, Math.round(getInt(formData, "minParticipantsPerTrack", fallback)));
}

function getCommunityQuotesDesktopDisplayLimit(formData: FormData) {
  return Math.min(
    60,
    Math.max(
      1,
      getInt(
        formData,
        "communityQuotesDesktopDisplayLimit",
        DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
      ),
    ),
  );
}

function getCommunityQuotesMobileDisplayLimit(formData: FormData) {
  return Math.min(
    24,
    Math.max(
      1,
      getInt(
        formData,
        "communityQuotesMobileDisplayLimit",
        DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
      ),
    ),
  );
}

function getDate(formData: FormData, key: string, label: string) {
  return parseAdminLocalDateTimeInput(
    getString(formData, key),
    label,
    getString(formData, "adminTimezoneOffsetMinutes"),
  );
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

function parseSeatInviteRequests(formData: FormData) {
  const unique = new Map<string, { recipientId: string; seatKey: string }>();
  for (const value of formData.getAll("inviteSeatRequests")) {
    if (typeof value !== "string" || !value.includes("|")) {
      continue;
    }
    const [seatKey, recipientId] = value.split("|");
    if (!seatKey || !recipientId) {
      continue;
    }
    unique.set(seatKey, { recipientId, seatKey });
  }
  return [...unique.values()];
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

function formatSongLabel(song: {
  title: string;
  artist: { name: string } | null;
}) {
  return song.artist?.name ? `${song.artist.name} — ${song.title}` : song.title;
}

// When a seat is filled, cancel any other pending invites for that exact seat
// and let those invitees know the spot is no longer available. Best-effort.
async function cancelOtherSeatInvitesAndNotify(
  seatId: string,
  { excludeRecipientId }: { excludeRecipientId?: string } = {},
) {
  const others = await db.trackInvite.findMany({
    where: {
      seatId,
      status: TrackInviteStatus.PENDING,
      ...(excludeRecipientId ? { recipientId: { not: excludeRecipientId } } : {}),
    },
    include: {
      recipient: { select: { telegramId: true } },
      seat: {
        select: {
          label: true,
          track: {
            select: {
              event: { select: { title: true } },
              song: {
                select: { title: true, artist: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (others.length === 0) {
    return;
  }

  await db.trackInvite.updateMany({
    where: { id: { in: others.map((invite) => invite.id) } },
    data: { status: TrackInviteStatus.CANCELED, respondedAt: new Date() },
  });

  await Promise.allSettled(
    others.map((invite) =>
      sendTelegramSeatTakenMessage({
        recipientTelegramId: invite.recipient.telegramId,
        eventTitle: invite.seat.track.event.title,
        seatLabel: invite.seat.label,
        songLabel: formatSongLabel(invite.seat.track.song),
      }),
    ),
  );
}

// Notify the track proposer once a freshly-claimed required seat completes the
// track. Completion is unaffected by optional seats, so only required claims can
// trigger the transition — which keeps this from firing more than once.
async function maybeNotifyTrackComplete(trackId: string) {
  const track = await db.track.findUnique({
    where: { id: trackId },
    include: {
      seats: true,
      event: { select: { title: true } },
      song: { select: { title: true, artist: { select: { name: true } } } },
      proposedBy: { select: { telegramId: true } },
    },
  });

  if (!track?.proposedBy?.telegramId) {
    return;
  }

  if (!getTrackCompletionSummary(track.seats).isComplete) {
    return;
  }

  await sendTelegramTrackCompleteMessage({
    recipientTelegramId: track.proposedBy.telegramId,
    eventTitle: track.event.title,
    songLabel: formatSongLabel(track.song),
  }).catch(() => {});
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
  redirectOnError = true,
  seatLabel,
  seatLineupKey,
  trackId,
  userId,
}: {
  eventSlug?: string;
  excludeSeatId?: string;
  redirectOnError?: boolean;
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
    if (redirectOnError) {
      throwDuplicateRoleFamilyError(eventSlug);
    }

    throw new Error("duplicate-role-family");
  }
}

type ClaimSeatResult =
  | { ok: true; notice: "seat-claimed" | "opt-request-sent" | "opt-request-saved"; seatId: string }
  | { ok: false; error: string };

type ReleaseSeatResult =
  | { ok: true; notice: "seat-released"; seatId: string }
  | { ok: false; error: string };

type InviteToSeatResult =
  | {
      ok: true;
      notice:
        | "invite-sent"
        | "invite-saved-without-telegram"
        | "seat-claimed"
        | "opt-request-sent"
        | "opt-request-saved";
    }
  | { ok: false; error: string };

async function assertNoPendingSeatInvite({
  eventSlug,
  recipientId,
  redirectOnError = true,
  seatId,
}: {
  eventSlug: string;
  recipientId: string;
  redirectOnError?: boolean;
  seatId: string;
}) {
  const existingInvite = await db.trackInvite.findFirst({
    where: {
      seatId,
      recipientId,
      status: TrackInviteStatus.PENDING,
    },
  });

  if (existingInvite) {
    if (!redirectOnError) {
      throw new Error("invite-already-pending");
    }

    redirectToEventError(eventSlug, "invite-already-pending");
  }
}

async function createPendingSeatInvite({
  recipient,
  seat,
  sender,
}: {
  recipient: {
    id: string;
    telegramId: string | null;
  };
  seat: {
    id: string;
    label: string;
    trackId: string;
    track: {
      event: {
        title: string;
      };
      song: {
        title: string;
        artist: {
          name: string;
        };
      };
    };
  };
  sender: {
    id: string;
    telegramUsername: string | null;
    fullName: string | null;
  };
}) {
  const delivery = await sendTelegramInviteMessage({
    recipientTelegramId: recipient.telegramId,
    eventTitle: seat.track.event.title,
    songLabel: `${seat.track.song.artist.name} - ${seat.track.song.title}`,
    seatLabel: seat.label,
    inviterLabel: sender.telegramUsername ?? sender.fullName ?? "A bandmate",
  });

  await db.trackInvite.create({
    data: {
      trackId: seat.trackId,
      seatId: seat.id,
      senderId: sender.id,
      recipientId: recipient.id,
      status: TrackInviteStatus.PENDING,
      deliveryNote: delivery.note,
    },
  });

  return delivery;
}

async function createInitialTrackInvites({
  requests,
  sender,
  trackId,
}: {
  requests: Array<{ recipientId: string; seatKey: string }>;
  sender: Awaited<ReturnType<typeof requireUser>>;
  trackId: string;
}) {
  const filteredRequests = requests.filter((request) => request.recipientId !== sender.id);
  if (filteredRequests.length === 0) {
    return;
  }

  const requestedRecipientIds = [...new Set(filteredRequests.map((request) => request.recipientId))];
  const recipients = await db.user.findMany({
    where: {
      id: { in: requestedRecipientIds },
      status: UserStatus.ACTIVE,
    },
  });
  const recipientsById = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const requestedSeatKeys = new Set(filteredRequests.map((request) => request.seatKey));
  const seats = await db.trackSeat.findMany({
    where: {
      trackId,
      status: TrackSeatStatus.OPEN,
    },
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
  const seatsByKey = new Map(
    seats.map((seat) => [`${seat.label}:${seat.seatIndex}`, seat]),
  );

  for (const request of filteredRequests) {
    if (!requestedSeatKeys.has(request.seatKey)) {
      continue;
    }
    const recipient = recipientsById.get(request.recipientId);
    const seat = seatsByKey.get(request.seatKey);
    if (!recipient || !seat) {
      continue;
    }

    await createPendingSeatInvite({
      recipient,
      seat,
      sender,
    });
  }
}

async function runClaimSeat({
  eventSlug,
  seatId,
  user,
}: {
  eventSlug: string;
  seatId: string;
  user: Awaited<ReturnType<typeof requireUser>>;
}): Promise<ClaimSeatResult> {
  if (userNeedsTelegramUsername(user)) {
    return { ok: false, error: "username-required" };
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

  if (canRequestClosedOptionalSeat(seat.track.event, seat)) {
    if (user.id !== seat.track.proposedById && user.role !== UserRole.ADMIN) {
      const requestResult = await createClosedOptionalSeatRequest({
        redirectOnComplete: false,
        seat,
        eventSlug,
        requester: user,
        targetUser: user,
        mode: "self",
      });

      if (!requestResult.ok) {
        return { ok: false, error: requestResult.error };
      }

      return {
        ok: true,
        notice: requestResult.notice,
        seatId: seat.id,
      };
    }
  } else if (getEffectiveEventStatus(seat.track.event) !== EventStatus.OPEN) {
    return { ok: false, error: "event-locked" };
  }

  if (seat.status === TrackSeatStatus.UNAVAILABLE) {
    return { ok: false, error: "seat-unavailable" };
  }
  if (seat.userId) {
    return { ok: false, error: "seat-occupied" };
  }

  const alreadyOnTrack = await db.trackSeat.count({
    where: {
      userId: user.id,
      trackId: seat.trackId,
      status: TrackSeatStatus.CLAIMED,
    },
  });

  if (!alreadyOnTrack) {
    const joinedCount = await countUniqueJoinedTracks(user.id, seat.track.eventId);
    if (joinedCount >= seat.track.event.maxTracksPerUser) {
      return { ok: false, error: "track-limit" };
    }
  }

  try {
    await assertCanClaimRoleFamilyForTrack({
      eventSlug,
      excludeSeatId: seat.id,
      redirectOnError: false,
      seatLabel: seat.label,
      seatLineupKey: seat.lineupSlot.key,
      trackId: seat.trackId,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "duplicate-role-family") {
      return { ok: false, error: "duplicate-role-family" };
    }

    throw error;
  }

  const claimResult = await db.trackSeat.updateMany({
    where: {
      id: seat.id,
      userId: null,
      status: TrackSeatStatus.OPEN,
    },
    data: {
      userId: user.id,
      status: TrackSeatStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });

  if (claimResult.count === 0) {
    return { ok: false, error: "seat-occupied" };
  }

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId: seat.track.eventId,
    reason: "seat-claimed",
  }).catch(() => {});

  await cancelOtherSeatInvitesAndNotify(seat.id, {
    excludeRecipientId: user.id,
  }).catch(() => {});
  if (!seat.isOptional) {
    await maybeNotifyTrackComplete(seat.trackId).catch(() => {});
  }

  return {
    ok: true,
    notice: "seat-claimed",
    seatId: seat.id,
  };
}

type TrackSeatLineupSlot = {
  allowOptional: boolean;
  id: string;
  key: string;
  label: string;
  seatCount: number;
};

function buildTrackSeatCreateData({
  claimSeatIds,
  optionalSeatIds,
  slots,
  trackId,
  unavailableKeys,
  userId,
}: {
  claimSeatIds: string[];
  optionalSeatIds: string[];
  slots: TrackSeatLineupSlot[];
  trackId: string;
  unavailableKeys: string[];
  userId: string;
}): Prisma.TrackSeatCreateManyInput[] {
  const claimedAt = new Date();

  return slots.flatMap((slot) =>
    Array.from({ length: slot.seatCount }, (_, offset) => {
      const seatIndex = offset + 1;
      const label = seatLabelForSlot(slot, seatIndex);
      const seatKey = `${label}:${seatIndex}`;
      const claimed = claimSeatIds.includes(seatKey);
      const unavailable = unavailableKeys.includes(seatKey);

      return {
        trackId,
        lineupSlotId: slot.id,
        seatIndex,
        label,
        status: claimed
          ? TrackSeatStatus.CLAIMED
          : unavailable
            ? TrackSeatStatus.UNAVAILABLE
            : TrackSeatStatus.OPEN,
        isOptional: slot.allowOptional && optionalSeatIds.includes(seatKey) && !unavailable,
        userId: claimed ? userId : null,
        claimedAt: claimed ? claimedAt : null,
      };
    }),
  );
}

function countRequiredProposalSeats({
  optionalSeatIds,
  slots,
  unavailableKeys,
}: {
  optionalSeatIds: string[];
  slots: TrackSeatLineupSlot[];
  unavailableKeys: string[];
}) {
  return slots.reduce((count, slot) => {
    for (let offset = 0; offset < slot.seatCount; offset += 1) {
      const seatIndex = offset + 1;
      const label = seatLabelForSlot(slot, seatIndex);
      const seatKey = `${label}:${seatIndex}`;
      const unavailable = unavailableKeys.includes(seatKey);
      const optional = slot.allowOptional && optionalSeatIds.includes(seatKey);

      if (!unavailable && !optional) {
        count += 1;
      }
    }

    return count;
  }, 0);
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
  const selectedExternalId = getString(formData, "selectedExternalId");
  const durationMs = getInt(formData, "durationMs", 0);
  const durationSeconds =
    selectedDurationSeconds > 0
      ? selectedDurationSeconds
      : durationMs > 0
        ? Math.round(durationMs / 1000)
        : 0;

  if (!artistName || !trackTitle) {
    return null;
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
    ...buildSongUpsertArgs({
      artistId: artist.id,
      artistName,
      trackTitle,
      durationSeconds,
      externalId: selectedExternalId,
    }),
  });

  return song.id;
}

async function ensureSetlistItem(
  trackId: string,
  eventId: string,
  editedById?: string,
  executor: Prisma.TransactionClient | typeof db = db,
) {
  const backlogItems = await executor.setlistItem.findMany({
    where: { eventId, section: SetlistSection.BACKLOG },
    select: { orderIndex: true },
  });
  const orderIndex = getNextSetlistOrderIndex(backlogItems);

  await executor.setlistItem.upsert({
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
      orderIndex,
      editedById,
    },
  });
}

async function assertLockOwnership(eventId: string, userId: string) {
  const activeLocks = await db.eventEditLock.findMany({
    where: {
      eventId,
      scope: ADMIN_LOCK_SCOPE,
      expiresAt: { gt: new Date() },
    },
  });

  if (activeLocks.length > 1) {
    throw new Error("Multiple active curation locks detected. Refresh and try again.");
  }

  const activeLock = activeLocks[0] ?? null;
  if (activeLock && activeLock.userId !== userId) {
    throw new Error("Another admin currently owns the curation lock.");
  }
}

async function sendBoardClosedNotifications(eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      startsAt: true,
      title: true,
      venueName: true,
      tracks: {
        where: { state: "ACTIVE" },
        select: {
          seats: {
            where: {
              status: TrackSeatStatus.CLAIMED,
              userId: { not: null },
            },
            select: {
              user: {
                select: {
                  id: true,
                  telegramId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const recipients = new Map<string, string | null>();
  for (const track of event.tracks) {
    for (const seat of track.seats) {
      if (seat.user) {
        recipients.set(seat.user.id, seat.user.telegramId);
      }
    }
  }

  const deliveryResults = await Promise.allSettled([
    sendTelegramBoardClosedChannelMessage({
      channelChatId: env.TELEGRAM_CHANNEL_CHAT_ID,
      city: env.DEFAULT_EVENT_CITY,
      eventStartsAt: event.startsAt,
      venueName: event.venueName,
    }),
    ...[...recipients.values()].map((recipientTelegramId) =>
      sendTelegramBoardClosedParticipantMessage({
        eventStartsAt: event.startsAt,
        eventTitle: event.title,
        recipientTelegramId,
      }),
    ),
  ]);

  return deliveryResults.filter(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" && result.value.status === "DELIVERY_FAILED"),
  ).length;
}

async function sendPublishedSetNotifications(eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      setlistItems: {
        where: {
          section: SetlistSection.MAIN,
        },
        orderBy: {
          orderIndex: "asc",
        },
        include: {
          track: {
            include: {
              song: {
                include: {
                  artist: true,
                },
              },
              seats: {
                where: {
                  status: TrackSeatStatus.CLAIMED,
                  userId: {
                    not: null,
                  },
                },
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const notifications = buildPublishedSetNotifications({
    eventStartsAt: event.startsAt,
    eventTitle: event.title,
    setlistItems: event.setlistItems,
  });

  const deliveryResults = await Promise.allSettled(
    notifications.map((notification) =>
      sendTelegramPublishedSetMessage({
        recipientTelegramId: notification.recipientTelegramId,
        eventStartsAt: notification.eventStartsAt,
        eventTitle: notification.eventTitle,
        songs: notification.songs,
      }),
    ),
  );

  return deliveryResults.filter(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" && result.value.status === "DELIVERY_FAILED"),
  ).length;
}

async function transitionEventStatus({
  eventId,
  eventSlug,
  status,
}: {
  eventId: string;
  eventSlug: string;
  status: EventStatus;
}) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { id: true, status: true },
  });

  if (event.status === status) {
    return { failedDeliveries: 0 };
  }

  if (!getAllowedNextEventStatuses(event.status).includes(status)) {
    throw new Error("This status transition is not allowed.");
  }

  await db.event.update({
    where: { id: eventId },
    data:
      event.status === EventStatus.CLOSED && status === EventStatus.OPEN
        ? { status, registrationClosesAt: null }
        : { status },
  });

  let failedDeliveries = 0;
  if (status === EventStatus.CLOSED) {
    failedDeliveries = await sendBoardClosedNotifications(eventId);
  }
  if (status === EventStatus.PUBLISHED) {
    failedDeliveries = await sendPublishedSetNotifications(eventId);
  }

  await publishBoardUpdate({
    eventId,
    reason: "event-status",
  }).catch(() => {});
  revalidateAll(pathBundle(eventSlug));

  return { failedDeliveries };
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
  if (!env.ENABLE_DEV_AUTH) {
    throw new Error("Development auth is disabled.");
  }

  const returnTo = getSafeReturnTo(getString(formData, "returnTo"));
  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  if (!username) {
    throw new Error("Telegram username is required.");
  }
  const user = env.LIVE_PRODUCTION_TUNNEL
    ? await db.user.findUnique({
        where: { telegramUsername: username },
      })
    : await db.user.upsert({
        where: { telegramUsername: username },
        update: { role: getString(formData, "role") === "ADMIN" ? UserRole.ADMIN : UserRole.USER },
        create: {
          telegramId: crypto.randomUUID(),
          telegramUsername: username,
          fullName: username,
          role: getString(formData, "role") === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
        },
      });

  if (!user) {
    const params = new URLSearchParams({
      authError: "dev-user-not-found",
      returnTo,
    });
    redirect(`/profile?${params.toString()}`);
  }

  await createSession(user.id);
  revalidateAll(["/", "/admin", "/profile"]);
  redirect(returnTo);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const instrumentIds = parseInstrumentIds(formData);

  // The Telegram username can be set only once, while it is still empty. After
  // that it is read-only (same as users who arrived with a username already).
  let telegramUsername = user.telegramUsername;
  if (!telegramUsername) {
    const requested = normalizeTelegramUsername(getString(formData, "telegramUsername"));
    if (requested) {
      if (!isValidTelegramUsername(requested)) {
        redirect("/profile?error=invalid-username");
      }
      const taken = await db.user.findFirst({
        where: {
          id: { not: user.id },
          telegramUsername: { equals: requested, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (taken) {
        redirect("/profile?error=username-taken");
      }
      telegramUsername = requested;
    }
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        fullName: getString(formData, "fullName") || null,
        phone: getString(formData, "phone") || null,
        email: getString(formData, "email") || null,
        bio: getString(formData, "bio") || null,
        telegramUsername,
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
  redirect("/profile?notice=profile-saved");
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

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("User id is required.");
  }

  const targetUser = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      telegramUsername: true,
    },
  });

  if (isSuperAdminUser(targetUser)) {
    throw new Error("The primary admin cannot lose admin access.");
  }

  await db.user.update({
    where: { id: targetUser.id },
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

  const faqContent = {
    en: {
      participationRules: getString(formData, "participationRulesMarkdownEn"),
      lineupDetails: getString(formData, "lineupDetailsMarkdownEn"),
    },
    ru: {
      participationRules: getString(formData, "participationRulesMarkdownRu"),
      lineupDetails: getString(formData, "lineupDetailsMarkdownRu"),
    },
  };
  const faqContentJson = serializeFaqContent(faqContent);
  // Keep the legacy single-blob columns populated for any older reader; the JSON blob is the
  // source of truth going forward.
  const legacyParticipation =
    faqContent.en.participationRules ||
    faqContent.ru.participationRules ||
    DEFAULT_PARTICIPATION_RULES_MARKDOWN;
  const legacyLineup =
    faqContent.en.lineupDetails || faqContent.ru.lineupDetails || DEFAULT_LINEUP_DETAILS_MARKDOWN;
  const lineupVideoUrlsJson = serializeVideoUrls(
    parseVideoUrlsInput(getString(formData, "lineupVideoUrlsInput")),
  );

  await db.sitePageContent.upsert({
    where: { id: SITE_CONTENT_ID },
    update: {
      participationRulesMarkdown: legacyParticipation,
      lineupDetailsMarkdown: legacyLineup,
      faqContentJson,
      lineupVideoUrlsJson,
    },
    create: {
      id: SITE_CONTENT_ID,
      participationRulesMarkdown: legacyParticipation,
      lineupDetailsMarkdown: legacyLineup,
      faqContentJson,
      lineupVideoUrlsJson,
    },
  });

  revalidateAll(["/faq", "/admin"]);
  redirect("/admin?notice=faq-saved#faq-content");
}

export async function updateCommunityQuoteSettingsAction(formData: FormData) {
  await requireAdmin();

  await db.sitePageContent.upsert({
    where: { id: SITE_CONTENT_ID },
    update: {
      communityQuotesDesktopDisplayLimit: getCommunityQuotesDesktopDisplayLimit(formData),
      communityQuotesMobileDisplayLimit: getCommunityQuotesMobileDisplayLimit(formData),
    },
    create: {
      id: SITE_CONTENT_ID,
      participationRulesMarkdown: DEFAULT_PARTICIPATION_RULES_MARKDOWN,
      lineupDetailsMarkdown: DEFAULT_LINEUP_DETAILS_MARKDOWN,
      communityQuotesDesktopDisplayLimit: getCommunityQuotesDesktopDisplayLimit(formData),
      communityQuotesMobileDisplayLimit: getCommunityQuotesMobileDisplayLimit(formData),
    },
  });

  revalidateAll(["/", "/admin"]);
  redirect("/admin?notice=community-quotes-saved#community-quotes");
}

export async function createCommunityQuoteAction(formData: FormData) {
  const admin = await requireAdmin();
  const text = getString(formData, "text");

  if (!text) {
    throw new Error("Quote text is required.");
  }

  await db.communityQuote.create({
    data: {
      textEn: text,
      textRu: text,
      sourceLabel: getString(formData, "sourceLabel") || null,
      displayOrder: getInt(formData, "displayOrder", 0),
      isActive: getBoolean(formData, "isActive"),
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  revalidateAll(["/", "/admin"]);
  redirect("/admin?notice=community-quotes-saved#community-quotes");
}

export async function updateCommunityQuoteAction(formData: FormData) {
  const admin = await requireAdmin();
  const quoteId = getString(formData, "quoteId");
  const text = getString(formData, "text");

  if (!quoteId || !text) {
    throw new Error("Quote id and quote text are required.");
  }

  await db.communityQuote.update({
    where: { id: quoteId },
    data: {
      textEn: text,
      textRu: text,
      sourceLabel: getString(formData, "sourceLabel") || null,
      displayOrder: getInt(formData, "displayOrder", 0),
      isActive: getBoolean(formData, "isActive"),
      updatedById: admin.id,
    },
  });

  revalidateAll(["/", "/admin"]);
  redirect("/admin?notice=community-quotes-saved#community-quotes");
}

export async function deleteCommunityQuoteAction(formData: FormData) {
  await requireAdmin();
  const quoteId = getString(formData, "quoteId");

  if (!quoteId) {
    throw new Error("Quote id is required.");
  }

  await db.communityQuote.delete({
    where: { id: quoteId },
  });

  revalidateAll(["/", "/admin"]);
  redirect("/admin?notice=community-quotes-saved#community-quotes");
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
  const eventKey = getString(formData, "eventSlug");
  if (userNeedsTelegramUsername(user)) {
    if (eventKey) {
      redirect(buildEventRedirectUrl(eventKey, { error: "username-required" }));
    }
    throw new Error("Set your Telegram username before proposing tracks.");
  }
  const songId = await resolveSongId(formData);
  if (!songId) {
    if (eventKey) {
      redirect(buildEventRedirectUrl(eventKey, { error: "no-song-selected" }));
    }
    throw new Error("Choose a song from search results before proposing it.");
  }
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
    if (eventKey) {
      redirect(buildEventRedirectUrl(eventKey, { error: "track-exists" }));
    }
    throw new Error("This song is already on the current event board.");
  }

  const claimSeatIds = parseSeatSelections(formData, "claimSeatKeys");
  const optionalSeatIds = parseSeatSelections(formData, "optionalSeatKeys");
  const inviteSeatRequests = parseSeatInviteRequests(formData);
  if (claimSeatIds.length === 0 && user.role !== UserRole.ADMIN) {
    if (eventKey) {
      redirect(buildEventRedirectUrl(eventKey, { error: "no-self-seat" }));
    }
    throw new Error("Add yourself to at least one position before proposing a track.");
  }
  if (claimSeatIds.length > 0) {
    const joinedCount = await countUniqueJoinedTracks(user.id, event.id);
    if (joinedCount >= event.maxTracksPerUser) {
      if (eventKey) {
        redirect(
          buildEventRedirectUrl(eventKey, {
            error: "track-limit",
            maxTracks: String(event.maxTracksPerUser),
          }),
        );
      }
      assertWithinTrackLimit(joinedCount, event.maxTracksPerUser);
    }
  }

  const selectedTrackInfoKeys = formData
    .getAll("trackInfoFlagKeys")
    .map((value) => String(value))
    .filter(Boolean);
  const unavailableKeys = parseSeatSelections(formData, "unavailableSeatKeys");
  const slots = await db.eventLineupSlot.findMany({
    where: { eventId },
    orderBy: { displayOrder: "asc" },
  });
  const minimumRequiredPositions = Math.max(1, event.minParticipantsPerTrack ?? 1);
  if (
    slots.length > 0 &&
    countRequiredProposalSeats({ optionalSeatIds, slots, unavailableKeys }) <
      minimumRequiredPositions
  ) {
    if (eventKey) {
      redirect(
        buildEventRedirectUrl(eventKey, {
          error: "min-required-seats",
          minRequired: String(minimumRequiredPositions),
        }),
      );
    }
    throw new Error("Track has fewer required positions than the event minimum.");
  }
  const claimedRoleFamilies = new Set<string>();
  for (const slot of slots) {
    for (let index = 1; index <= slot.seatCount; index += 1) {
      const label = seatLabelForSlot(slot, index);
      const seatKey = `${label}:${index}`;
      if (!claimSeatIds.includes(seatKey)) {
        continue;
      }

      const roleFamily = getRoleFamilyKey(label, slot.key);
      if (claimedRoleFamilies.has(roleFamily)) {
        throwDuplicateRoleFamilyError(eventKey);
      }
      claimedRoleFamilies.add(roleFamily);
    }
  }

  let createdTrackId: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      const track = await tx.track.create({
        data: {
          eventId,
          songId,
          proposedById: user.id,
          comment: getString(formData, "comment") || null,
          playbackRequired: selectedTrackInfoKeys.includes("playback"),
          trackInfoKeysJson: serializeTrackInfoKeys(selectedTrackInfoKeys),
        },
      });
      createdTrackId = track.id;

      const seatCreateData = buildTrackSeatCreateData({
        claimSeatIds,
        optionalSeatIds,
        slots,
        trackId: track.id,
        unavailableKeys,
        userId: user.id,
      });

      if (seatCreateData.length > 0) {
        await tx.trackSeat.createMany({
          data: seatCreateData,
        });
      }

      await ensureSetlistItem(track.id, eventId, user.id, tx);
    });
  } catch (error) {
    if (isUniqueConstraintErrorForFields(error, ["eventId", "songId", "state"])) {
      if (eventKey) {
        redirect(buildEventRedirectUrl(eventKey, { error: "track-exists" }));
      }
      throw new Error("This song is already on the current event board.");
    }

    throw error;
  }

  if (createdTrackId) {
    await createInitialTrackInvites({
      requests: inviteSeatRequests,
      sender: user,
      trackId: createdTrackId,
    });
  }
  revalidateAll(pathBundle(event.id, event.slug, eventKey));
  await publishBoardUpdate({
    eventId: event.id,
    reason: "track-created",
  }).catch(() => {});
  const redirectParams: Record<string, string> = {
    notice: "track-created",
  };
  if (createdTrackId) {
    redirectParams.highlightTrack = createdTrackId;
  }

  redirect(
    buildEventRedirectUrl(event.id, redirectParams),
  );
}

export async function claimSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");
  const result = await runClaimSeat({
    eventSlug,
    seatId,
    user,
  });

  if (!result.ok) {
    redirectClaimFailure(eventSlug, result.error);
  }

  redirect(buildEventRedirectUrl(eventSlug, { notice: result.notice }));
}

export async function claimSeatInlineAction(formData: FormData): Promise<ClaimSeatResult> {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");

  return runClaimSeat({
    eventSlug,
    seatId,
    user,
  });
}

export async function releaseSeatAction(formData: FormData) {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");
  const result = await runReleaseSeat({
    eventSlug,
    seatId,
    user,
  });

  if (!result.ok) {
    redirectToEventError(eventSlug, result.error);
  }

  redirect(buildEventRedirectUrl(eventSlug, { notice: result.notice }));
}

async function runReleaseSeat({
  eventSlug,
  seatId,
  user,
}: {
  eventSlug: string;
  seatId: string;
  user: Awaited<ReturnType<typeof requireUser>>;
}): Promise<ReleaseSeatResult> {
  const seat = await db.trackSeat.findUniqueOrThrow({
    where: { id: seatId },
    include: {
      lineupSlot: {
        select: {
          key: true,
        },
      },
      track: {
        include: { event: true },
      },
    },
  });

  if (getEffectiveEventStatus(seat.track.event) !== EventStatus.OPEN) {
    return { ok: false, error: "event-locked" };
  }
  if (seat.userId !== user.id && user.role !== UserRole.ADMIN) {
    return { ok: false, error: "release-not-allowed" };
  }

  const releaseResult = await db.trackSeat.updateMany({
    where: {
      id: seatId,
      status: TrackSeatStatus.CLAIMED,
    },
    data: {
      userId: null,
      status: TrackSeatStatus.OPEN,
      claimedAt: null,
    },
  });

  if (releaseResult.count === 0) {
    return { ok: false, error: "seat-open" };
  }

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId: seat.track.eventId,
    reason: "seat-released",
  }).catch(() => {});
  return { ok: true, notice: "seat-released", seatId };
}

export async function releaseSeatInlineAction(formData: FormData): Promise<ReleaseSeatResult> {
  const user = await requireUser();
  const seatId = getString(formData, "seatId");
  const eventSlug = getString(formData, "eventSlug");

  return runReleaseSeat({
    eventSlug,
    seatId,
    user,
  });
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
  await publishBoardUpdate({
    eventId: seat.track.eventId,
    reason: "track-updated",
  }).catch(() => {});
}

async function runInviteToSeat(
  formData: FormData,
  {
    redirectOnComplete,
  }: {
    redirectOnComplete: boolean;
  },
): Promise<InviteToSeatResult> {
  const user = await requireUser();
  const eventSlug = getString(formData, "eventSlug");
  const recipientUserId = getString(formData, "recipientUserId");
  const username = normalizeTelegramUsername(getString(formData, "recipientUsername"));
  const seatId = getString(formData, "seatId");
  const fail = (error: string): InviteToSeatResult => {
    if (redirectOnComplete) {
      redirectToEventError(eventSlug, error);
    }

    return { ok: false, error };
  };
  const finishNotice = (
    notice: Extract<InviteToSeatResult, { ok: true }>["notice"],
  ): InviteToSeatResult => {
    if (redirectOnComplete) {
      redirectToEventNotice(eventSlug, notice);
    }

    return { ok: true, notice };
  };

  if (userNeedsTelegramUsername(user)) {
    return fail("username-required");
  }
  if (!recipientUserId && !username) {
    return fail("invite-recipient-required");
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

  const recipient = recipientUserId
    ? await db.user.findUnique({
        where: { id: recipientUserId },
      })
    : await db.user.findUnique({
        where: { telegramUsername: username ?? "" },
      });

  if (!recipient) {
    return fail("invite-recipient-not-found");
  }

  if (canRequestClosedOptionalSeat(seat.track.event, seat)) {
    if (user.id === seat.track.proposedById || user.role === UserRole.ADMIN) {
      if (recipient.id === user.id) {
        const result = await runClaimSeat({
          eventSlug,
          seatId,
          user,
        });

        if (!result.ok) {
          return fail(result.error);
        }

        return finishNotice(result.notice);
      }

      try {
        await assertNoPendingSeatInvite({
          eventSlug,
          recipientId: recipient.id,
          redirectOnError: redirectOnComplete,
          seatId,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "invite-already-pending") {
          return fail("invite-already-pending");
        }

        throw error;
      }

      const delivery = await createPendingSeatInvite({
        recipient,
        seat,
        sender: user,
      });

      revalidateAll(pathBundle(eventSlug));

      if (delivery.status === "DELIVERY_FAILED") {
        return finishNotice("invite-saved-without-telegram");
      }

      return finishNotice("invite-sent");
    }

    const requestResult = await createClosedOptionalSeatRequest({
      redirectOnComplete,
      seat,
      eventSlug,
      requester: user,
      targetUser: recipient,
      mode: recipient.id === user.id ? "self" : "friend",
    });
    if (!requestResult.ok) {
      return fail(requestResult.error);
    }

    return finishNotice(requestResult.notice);
  }

  // Any signed-in user can invite someone to an OPEN seat while the board is open.
  try {
    assertEventAllowsChanges(seat.track.event);
  } catch {
    return fail("event-locked");
  }
  if (seat.status === TrackSeatStatus.UNAVAILABLE) {
    return fail("seat-unavailable");
  }
  if (seat.userId) {
    return fail("seat-occupied");
  }

  if (recipient.id === user.id) {
    const result = await runClaimSeat({
      eventSlug,
      seatId,
      user,
    });

    if (!result.ok) {
      return fail(result.error);
    }

    return finishNotice(result.notice);
  }

  try {
    await assertNoPendingSeatInvite({
      eventSlug,
      recipientId: recipient.id,
      redirectOnError: redirectOnComplete,
      seatId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invite-already-pending") {
      return fail("invite-already-pending");
    }

    throw error;
  }

  const delivery = await createPendingSeatInvite({
    recipient,
    seat,
    sender: user,
  });

  revalidateAll(pathBundle(eventSlug));

  if (delivery.status === "DELIVERY_FAILED") {
    return finishNotice("invite-saved-without-telegram");
  }

  return finishNotice("invite-sent");
}

export async function inviteToSeatAction(formData: FormData) {
  await runInviteToSeat(formData, { redirectOnComplete: true });
}

export async function inviteToSeatInlineAction(formData: FormData): Promise<InviteToSeatResult> {
  return runInviteToSeat(formData, { redirectOnComplete: false });
}

type RespondToInviteResult =
  | { ok: true; notice: "invite-accepted" | "invite-declined" }
  | {
      ok: false;
      error:
        | "duplicate-role-family"
        | "event-locked"
        | "invite-stale"
        | "seat-occupied"
        | "seat-unavailable"
        | "track-limit"
        | "username-required";
    };
type RespondToInviteError = Extract<RespondToInviteResult, { ok: false }>["error"];
type RespondToInviteNotice = Extract<RespondToInviteResult, { ok: true }>["notice"];

async function runRespondToInvite(
  formData: FormData,
  { redirectOnComplete }: { redirectOnComplete: boolean },
): Promise<RespondToInviteResult> {
  const user = await requireUser();
  const inviteId = getString(formData, "inviteId");
  const decision = getString(formData, "decision");
  const eventSlug = getString(formData, "eventSlug");
  const fail = (error: RespondToInviteError) => {
    if (redirectOnComplete) {
      redirectToProfileInviteError(error);
    }

    return { ok: false, error } as const;
  };
  const finish = (notice: RespondToInviteNotice) => {
    revalidateAll(["/profile", `/events/${eventSlug}`]);
    if (redirectOnComplete) {
      redirectToProfileInviteNotice(notice);
    }

    return { ok: true, notice } as const;
  };
  if (userNeedsTelegramUsername(user)) {
    return fail("username-required");
  }
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

    if (requestMeta || canRequestClosedOptionalSeat(invite.seat.track.event, invite.seat)) {
      if (!canRequestClosedOptionalSeat(invite.seat.track.event, invite.seat)) {
        return fail("event-locked");
      }
    } else {
      try {
        assertEventAllowsChanges(invite.seat.track.event);
      } catch {
        return fail("event-locked");
      }
    }

    try {
      assertSeatClaimable(invite.seat);
    } catch {
      return fail(invite.seat.status === TrackSeatStatus.UNAVAILABLE ? "seat-unavailable" : "seat-occupied");
    }

    const joinedCount = await countUniqueJoinedTracks(targetUserId, invite.track.eventId);
    const alreadyOnTrack = await db.trackSeat.count({
      where: { userId: targetUserId, trackId: invite.trackId, status: TrackSeatStatus.CLAIMED },
    });
    if (!alreadyOnTrack && joinedCount >= invite.seat.track.event.maxTracksPerUser) {
      return fail("track-limit");
    }
    try {
      await assertCanClaimRoleFamilyForTrack({
        eventSlug,
        excludeSeatId: invite.seat.id,
        redirectOnError: false,
        seatLabel: invite.seat.label,
        seatLineupKey: invite.seat.lineupSlot.key,
        trackId: invite.trackId,
        userId: targetUserId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "duplicate-role-family") {
        return fail("duplicate-role-family");
      }

      throw error;
    }
    try {
      await db.$transaction(async (tx) => {
        const freshInvite = await tx.trackInvite.findUniqueOrThrow({
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
          },
        });

        if (
          freshInvite.recipientId !== user.id ||
          freshInvite.status !== TrackInviteStatus.PENDING
        ) {
          throw new Error("invite-stale");
        }

        const claimResult = await tx.trackSeat.updateMany({
          where: {
            id: freshInvite.seatId,
            userId: null,
            status: TrackSeatStatus.OPEN,
          },
          data: {
            userId: targetUserId,
            status: TrackSeatStatus.CLAIMED,
            claimedAt: new Date(),
          },
        });

        if (claimResult.count === 0) {
          throw new Error("seat-occupied");
        }

        await tx.trackInvite.update({
          where: { id: inviteId },
          data: {
            status: TrackInviteStatus.ACCEPTED,
            respondedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "seat-occupied") {
        return fail("seat-occupied");
      }
      if (error instanceof Error && error.message === "invite-stale") {
        return fail("invite-stale");
      }
      throw error;
    }

    await cancelOtherSeatInvitesAndNotify(invite.seat.id, {
      excludeRecipientId: targetUserId,
    }).catch(() => {});
    if (!invite.seat.isOptional) {
      await maybeNotifyTrackComplete(invite.trackId).catch(() => {});
    }
  } else {
    await db.trackInvite.update({
      where: { id: inviteId },
      data: {
        status: TrackInviteStatus.DECLINED,
        respondedAt: new Date(),
      },
    });
  }

  return finish(decision === "accept" ? "invite-accepted" : "invite-declined");
}

export async function respondToInviteAction(formData: FormData) {
  await runRespondToInvite(formData, { redirectOnComplete: true });
}

export async function respondToInviteInlineAction(formData: FormData): Promise<RespondToInviteResult> {
  return runRespondToInvite(formData, { redirectOnComplete: false });
}

export async function createEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = getString(formData, "title");
  const slugBase = slugifyRouteSegment(title);
  const slug = `${slugBase}-${Math.random().toString(16).slice(2, 6)}`;
  const startsAt = getDate(formData, "startsAt", "Starts at");
  const opensAt = getDate(formData, "registrationOpensAt", "Registration opens at");
  const closesAt = getDate(formData, "registrationClosesAt", "Registration closes at");
  assertEventRegistrationWindow({
    registrationClosesAt: closesAt,
    registrationOpensAt: opensAt,
    startsAt,
  });
  const event = await db.event.create({
    data: {
      slug,
      title,
      description: getString(formData, "description") || null,
      venueName: getString(formData, "venueName") || null,
      venueMapUrl: normalizeVenueMapUrl(getString(formData, "venueMapUrl")),
      startsAt,
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      status: EventStatus.DRAFT,
      maxSetDurationMinutes: getConfiguredMaxSetTrackCount(
        formData,
        DEFAULT_MAX_SET_TRACK_COUNT,
      ),
      maxTracksPerUser: getInt(formData, "maxTracksPerUser", 3),
      minParticipantsPerTrack: getConfiguredMinParticipantsPerTrack(formData, 1),
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
        defaultOptionalSeats: resolveDefaultOptionalSeats(slot),
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

  revalidateAll(["/", "/admin", `/events/${event.id}`, `/admin/events/${event.id}`]);
  redirect(`/admin/events/${event.id}`);
}

export async function updateEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);
  const startsAt = getDate(formData, "startsAt", "Starts at");
  const opensAt = getDate(formData, "registrationOpensAt", "Registration opens at");
  const closesAt = getDate(formData, "registrationClosesAt", "Registration closes at");
  assertEventRegistrationWindow({
    registrationClosesAt: closesAt,
    registrationOpensAt: opensAt,
    startsAt,
  });

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
      venueMapUrl: normalizeVenueMapUrl(getString(formData, "venueMapUrl")),
      startsAt,
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      maxSetDurationMinutes: getConfiguredMaxSetTrackCount(
        formData,
        event.maxSetDurationMinutes,
      ),
      maxTracksPerUser: getInt(formData, "maxTracksPerUser", event.maxTracksPerUser),
      minParticipantsPerTrack: getConfiguredMinParticipantsPerTrack(
        formData,
        event.minParticipantsPerTrack,
      ),
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
          defaultOptionalSeats: resolveDefaultOptionalSeats(slot),
          displayOrder: index + 1,
        },
      });
    }
  }

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId,
    reason: "event-updated",
  }).catch(() => {});
  redirect(`/admin/events/${encodeRouteSegment(eventSlug)}?notice=event-saved`);
}

export async function updateEventStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const status = eventStatusSchema.parse(getString(formData, "status"));
  const eventSlug = getString(formData, "eventSlug");
  if (status === EventStatus.PUBLISHED) {
    await assertLockOwnership(eventId, admin.id);
  }

  const result = await transitionEventStatus({ eventId, eventSlug, status });
  if (result.failedDeliveries > 0) {
    redirect(`/admin/events/${encodeRouteSegment(eventSlug)}?notice=status-partial-notify`);
  }
}

export async function deleteEventAction(formData: FormData) {
  await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");

  await db.trackSeat.deleteMany({
    where: {
      track: {
        eventId,
      },
    },
  });
  await db.event.delete({
    where: { id: eventId },
  });

  revalidateAll(["/", "/admin", `/events/${eventSlug}`, `/admin/events/${eventSlug}`]);
  redirect("/admin?notice=event-deleted");
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
    if (userNeedsTelegramUsername(user)) {
      redirect(buildEventRedirectUrl(eventSlug, { error: "username-required" }));
    }
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
  await publishBoardUpdate({
    eventId: track.eventId,
    reason: "track-updated",
  }).catch(() => {});
}

export async function updateTrackSettingsAction(formData: FormData) {
  const user = await requireUser();
  const trackId = getString(formData, "trackId");
  const eventSlug = getString(formData, "eventSlug");
  const track = await db.track.findUniqueOrThrow({
    where: { id: trackId },
    include: {
      event: true,
      seats: true,
    },
  });

  if (track.proposedById !== user.id && user.role !== UserRole.ADMIN) {
    throw new Error("Only the proposer or an admin can update this track.");
  }

  const selectedTrackInfoKeys = formData
    .getAll("trackInfoFlagKeys")
    .map((value) => String(value))
    .filter(Boolean);
  const optionalSeatIds = new Set(parseSeatSelections(formData, "optionalSeatIds"));

  await db.$transaction(async (tx) => {
    await tx.track.update({
      where: { id: trackId },
      data: {
        comment: getString(formData, "comment") || null,
        playbackRequired: selectedTrackInfoKeys.includes("playback"),
        trackInfoKeysJson: serializeTrackInfoKeys(selectedTrackInfoKeys),
      },
    });

    for (const seat of track.seats) {
      if (seat.status !== TrackSeatStatus.OPEN) {
        continue;
      }

      await tx.trackSeat.update({
        where: { id: seat.id },
        data: {
          isOptional: optionalSeatIds.has(seat.id),
        },
      });
    }
  });

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId: track.eventId,
    reason: "track-updated",
  }).catch(() => {});
}

export async function adminReplaceTrackSongAction(formData: FormData) {
  const admin = await requireAdmin();
  const trackId = getString(formData, "trackId");
  const songId = getString(formData, "songId");
  const eventSlug = getString(formData, "eventSlug");
  if (!songId) {
    throw new Error("Song is required.");
  }

  const track = await db.track.findUniqueOrThrow({
    where: { id: trackId },
    include: { event: true },
  });
  await assertLockOwnership(track.eventId, admin.id);

  const duplicateTrack = await db.track.findFirst({
    where: {
      eventId: track.eventId,
      id: { not: trackId },
      songId,
      state: "ACTIVE",
    },
  });
  if (duplicateTrack) {
    throw new Error("This song is already on the current event board.");
  }

  await db.track.update({
    where: { id: trackId },
    data: { songId },
  });

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId: track.eventId,
    reason: "track-updated",
  }).catch(() => {});
}

export async function adminAssignSeatAction(formData: FormData) {
  const admin = await requireAdmin();
  const seatId = getString(formData, "seatId");
  const userId = getString(formData, "userId");
  const username = normalizeTelegramUsername(getString(formData, "telegramUsername"));
  const eventSlug = getString(formData, "eventSlug");
  if (!userId && !username) {
    throw new Error("User is required.");
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
        },
      },
    },
  });
  await assertLockOwnership(seat.track.eventId, admin.id);

  const user = userId
    ? await db.user.findUniqueOrThrow({
        where: { id: userId },
      })
    : await db.user.findUniqueOrThrow({
        where: { telegramUsername: username! },
      });
  await assertCanClaimRoleFamilyForTrack({
    eventSlug,
    excludeSeatId: seat.id,
    seatLabel: seat.label,
    seatLineupKey: seat.lineupSlot.key,
    trackId: seat.trackId,
    userId: user.id,
  });

  await db.trackSeat.update({
    where: { id: seatId },
    data: {
      userId: user.id,
      status: TrackSeatStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });
  await sendTelegramAdminSeatAssignedMessage({
    eventTitle: seat.track.event.title,
    recipientTelegramId: user.telegramId,
    seatLabel: seat.label,
    songLabel: `${seat.track.song.artist.name} - ${seat.track.song.title}`,
  }).catch(() => {});

  revalidateAll(pathBundle(eventSlug));
  await publishBoardUpdate({
    eventId: seat.track.eventId,
    reason: "seat-claimed",
  }).catch(() => {});

  await cancelOtherSeatInvitesAndNotify(seat.id, {
    excludeRecipientId: user.id,
  }).catch(() => {});
  if (!seat.isOptional) {
    await maybeNotifyTrackComplete(seat.trackId).catch(() => {});
  }
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
  await publishBoardUpdate({
    eventId: seat.track.eventId,
    reason: "seat-released",
  }).catch(() => {});
}

export async function acquireCurationLockAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  await db.$transaction(
    async (tx) => {
      const existingLocks = await tx.eventEditLock.findMany({
        where: {
          eventId,
          scope: ADMIN_LOCK_SCOPE,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      if (existingLocks.length > 1) {
        throw new Error("Multiple active curation locks detected. Refresh and try again.");
      }

      const existing = existingLocks[0] ?? null;
      if (existing && existing.userId !== admin.id) {
        throw new Error("Another admin already owns the curation lock.");
      }

      if (existing) {
        await tx.eventEditLock.update({
          where: { id: existing.id },
          data: {
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      } else {
        await tx.eventEditLock.create({
          data: {
            eventId,
            userId: admin.id,
            scope: ADMIN_LOCK_SCOPE,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

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
      hasUnfilledRequiredSeats: completion.requiredOpen > 0,
      participantIds,
      filledSeatRatio: requiredSeatCount > 0 ? requiredClaimed / requiredSeatCount : 1,
      createdAt: track.createdAt,
      matchedKnownGroupName: matchedGroup?.name ?? null,
    };
  });

  const recommendation = buildSetlistRecommendation({
    maxSetTrackCount: getEffectiveMaxSetTrackCount(event.maxSetDurationMinutes),
    minParticipantsPerTrack: event.minParticipantsPerTrack,
    previousConcertSongIds: new Set(
      previousEvent?.setlistItems.map((item) => item.track.songId) ?? [],
    ),
    candidates,
  });

  await db.$transaction(async (tx) => {
    await tx.selectionRun.create({
      data: {
        eventId,
        startedById: admin.id,
        resultSummaryJson: recommendation,
      },
    });

    await tx.setlistItem.deleteMany({
      where: { eventId },
    });

    for (const item of recommendation.selected) {
      await tx.setlistItem.create({
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
      await tx.setlistItem.create({
        data: {
          eventId,
          trackId: item.trackId,
          section: item.section,
          orderIndex: index + 1,
          editedById: admin.id,
        },
      });
    }

    await tx.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.CLOSED,
      },
    });
  });

  if (event.status !== EventStatus.CLOSED) {
    await sendBoardClosedNotifications(eventId);
  }
  await publishBoardUpdate({
    eventId,
    reason: "selection-run",
  }).catch(() => {});
  revalidateAll(pathBundle(eventSlug));
  redirect(`/admin/events/${encodeRouteSegment(eventSlug)}?notice=selection-run`);
}

export async function moveSetlistItemAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);
  const itemId = getString(formData, "itemId");
  const section = setlistSectionSchema.parse(getString(formData, "section"));
  const orderIndex = getInt(formData, "orderIndex", 1);
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { minParticipantsPerTrack: true },
  });
  const items = await db.setlistItem.findMany({
    where: { eventId },
    include: {
      track: {
        include: {
          seats: true,
        },
      },
    },
    orderBy: [{ section: "asc" }, { orderIndex: "asc" }],
  });
  const currentItem = items.find((item) => item.id === itemId);

  if (!currentItem) {
    throw new Error("Setlist item not found.");
  }

  if (section === SetlistSection.MAIN) {
    const completion = getTrackCompletionSummary(currentItem.track.seats);
    const participantCount = new Set(
      currentItem.track.seats
        .filter((seat) => seat.status === TrackSeatStatus.CLAIMED && seat.userId)
        .map((seat) => seat.userId),
    ).size;

    if (
      completion.requiredOpen > 0 ||
      participantCount < Math.max(1, event.minParticipantsPerTrack)
    ) {
      throw new Error("Only fully assembled tracks can be moved into the main set.");
    }
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

export async function reorderSetlistSectionAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  const section = setlistSectionSchema.parse(getString(formData, "section"));
  const itemIds = JSON.parse(getString(formData, "itemIds")) as string[];

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error("Setlist order payload is required.");
  }

  await assertLockOwnership(eventId, admin.id);

  const sectionItems = await db.setlistItem.findMany({
    where: {
      eventId,
      section,
    },
    select: {
      id: true,
    },
    orderBy: {
      orderIndex: "asc",
    },
  });

  if (sectionItems.length !== itemIds.length) {
    throw new Error("Setlist order is out of date. Refresh and try again.");
  }

  const knownIds = new Set(sectionItems.map((item) => item.id));
  if (itemIds.some((id) => !knownIds.has(id))) {
    throw new Error("Setlist order contains unknown items.");
  }

  await db.$transaction(
    itemIds.map((itemId, index) =>
      db.setlistItem.update({
        where: { id: itemId },
        data: {
          orderIndex: index + 1,
          editedById: admin.id,
        },
      }),
    ),
  );

  revalidateAll(pathBundle(eventSlug));
}

export async function publishSetlistAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = getString(formData, "eventId");
  const eventSlug = getString(formData, "eventSlug");
  await assertLockOwnership(eventId, admin.id);

  const { failedDeliveries } = await transitionEventStatus({
    eventId,
    eventSlug,
    status: EventStatus.PUBLISHED,
  });

  if (failedDeliveries > 0) {
    redirect(`/admin/events/${encodeRouteSegment(eventSlug)}?notice=publish-partial-notify`);
  }
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
