import { TrackSeatStatus } from "@prisma/client";

export type LineupSlotLite = {
  id: string;
  key: string;
  label: string;
  seatCount: number;
  allowOptional: boolean;
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
