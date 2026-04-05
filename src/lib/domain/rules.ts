import {
  EventStatus,
  TrackSeatStatus,
  type Event,
  type TrackSeat,
  type User,
} from "@prisma/client";

import {
  allowsClosedOptionalSeatRequests,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import { hasActiveBan } from "@/lib/permissions";

type UserWithBan = User & {
  bans?: Array<{
    endsAt: Date | null;
    isPermanent: boolean;
  }>;
};

export function assertUserCanParticipate(user: UserWithBan | null) {
  if (!user) {
    throw new Error("You must sign in first.");
  }

  if (hasActiveBan(user)) {
    throw new Error("Your account is banned from track participation.");
  }
}

export function assertEventOpen(status: EventStatus) {
  if (status !== EventStatus.OPEN) {
    throw new Error("This event is currently locked for participant changes.");
  }
}

export function assertEventAllowsChanges(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  if (getEffectiveEventStatus(event) !== EventStatus.OPEN) {
    throw new Error("This event is currently locked for participant changes.");
  }
}

export function assertSeatClaimable(seat: Pick<TrackSeat, "status" | "userId">) {
  if (seat.status === TrackSeatStatus.UNAVAILABLE) {
    throw new Error("This position has been marked as unavailable.");
  }

  if (seat.userId) {
    throw new Error("This position is already occupied.");
  }
}

export function canRequestClosedOptionalSeat(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt" | "startsAt">,
  seat: Pick<TrackSeat, "status" | "userId" | "isOptional">,
) {
  return (
    allowsClosedOptionalSeatRequests(event) &&
    seat.status === TrackSeatStatus.OPEN &&
    !seat.userId &&
    seat.isOptional
  );
}

export function assertWithinTrackLimit(
  uniqueJoinedTracksCount: number,
  maxTracksPerUser: number,
) {
  if (uniqueJoinedTracksCount >= maxTracksPerUser) {
    throw new Error(
      `You have already reached the event limit of ${maxTracksPerUser} tracks.`,
    );
  }
}
