import { TrackSeatStatus } from "@prisma/client";

import { getTrackCompletionSummary } from "@/lib/domain/track-completion";

export type LineupSlotLite = {
  id: string;
  key: string;
  label: string;
  seatCount: number;
  allowOptional: boolean;
  defaultOptionalSeats?: readonly number[];
  displayOrder: number;
};

export type SeatColumn = {
  slotId: string;
  lineupKey: string;
  label: string;
  shortLabel: string;
  seatIndex: number;
  seatKey: string;
};

export function expandSeatColumns(lineupSlots: LineupSlotLite[]) {
  return lineupSlots.flatMap((slot) =>
    Array.from({ length: slot.seatCount }).map((_, index) => {
      const seatIndex = index + 1;
      const label = slot.seatCount === 1 ? slot.label : `${slot.label} ${seatIndex}`;
      const shortLabel =
        slot.seatCount === 1
          ? slot.label
          : `${slot.label.replace("Vocals", "Vox").replace("Guitar", "Gtr")} ${seatIndex}`;
      return {
        slotId: slot.id,
        lineupKey: slot.key,
        label,
        shortLabel,
        seatIndex,
        seatKey: `${label}:${seatIndex}`,
      };
    }),
  );
}

export function getTrackReadinessState(
  seats: Array<{
    status: TrackSeatStatus;
    isOptional: boolean;
  }>,
) {
  const requiredSeats = seats.filter((seat) => !seat.isOptional);
  const requiredOpen = requiredSeats.filter(
    (seat) => seat.status === TrackSeatStatus.OPEN,
  ).length;
  const optionalOpen = seats.filter(
    (seat) => seat.isOptional && seat.status === TrackSeatStatus.OPEN,
  ).length;

  return {
    isReady: requiredSeats.length > 0 && requiredOpen === 0,
    optionalOpen,
  };
}

type ParticipantCountSeat = {
  status: TrackSeatStatus;
  isOptional: boolean;
  userId: string | null;
};

type ParticipantCountTrack = {
  seats: ParticipantCountSeat[];
};

export function countLineupParticipants(tracks: ParticipantCountTrack[]) {
  const total = new Set<string>();
  const inReadyTracks = new Set<string>();

  for (const track of tracks) {
    const isReady = getTrackCompletionSummary(track.seats).isComplete;

    for (const seat of track.seats) {
      if (!seat.userId) {
        continue;
      }

      total.add(seat.userId);
      if (isReady) {
        inReadyTracks.add(seat.userId);
      }
    }
  }

  return {
    total: total.size,
    inReadyTracks: inReadyTracks.size,
  };
}

type RoleFilterSeat = {
  status: TrackSeatStatus;
  isOptional: boolean;
  label: string;
  lineupSlot?: { key: string } | null;
};

/**
 * Role filter for the board. Under "Need players" only *required* open seats count, so
 * "Need players + Bass" lists songs that are actually waiting for a bassist, not songs
 * that miss a drummer but happen to have an optional bass seat.
 */
export function matchesRoleFilters<Role extends string>({
  getRoleKey,
  onlyRequiredSeats,
  roles,
  seats,
}: {
  getRoleKey: (seat: RoleFilterSeat) => Role;
  onlyRequiredSeats: boolean;
  roles: Role[];
  seats: RoleFilterSeat[];
}) {
  return (
    roles.length === 0 ||
    roles.every((role) =>
      seats.some(
        (seat) =>
          seat.status === TrackSeatStatus.OPEN &&
          (!onlyRequiredSeats || !seat.isOptional) &&
          getRoleKey(seat) === role,
      ),
    )
  );
}
