import { TrackSeatStatus } from "@prisma/client";

type SeatForCompletion = {
  status: TrackSeatStatus;
  isOptional: boolean;
};

export function getTrackCompletionSummary(seats: SeatForCompletion[]) {
  const requiredOpen = seats.filter(
    (seat) => seat.status === TrackSeatStatus.OPEN && !seat.isOptional,
  ).length;
  const optionalOpen = seats.filter(
    (seat) => seat.status === TrackSeatStatus.OPEN && seat.isOptional,
  ).length;
  const claimed = seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).length;
  const unavailable = seats.filter((seat) => seat.status === TrackSeatStatus.UNAVAILABLE).length;

  return {
    requiredOpen,
    optionalOpen,
    claimed,
    unavailable,
    isComplete: requiredOpen === 0,
  };
}
