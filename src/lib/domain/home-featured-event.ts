import { EventStatus } from "@prisma/client";

type HomeFeaturedEvent = {
  effectiveStatus: EventStatus;
  startsAt: Date | string;
};

function getNextLocalMidnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

export function isHomeFeaturedEventCandidate(event: HomeFeaturedEvent, nowMs = Date.now()) {
  const startsAt = new Date(event.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return false;
  }

  if (startsAt.getTime() >= nowMs) {
    return true;
  }

  return (
    event.effectiveStatus === EventStatus.PUBLISHED &&
    getNextLocalMidnight(startsAt).getTime() > nowMs
  );
}

export function getHomeFeaturedSortTime(event: HomeFeaturedEvent, nowMs = Date.now()) {
  const startsAtMs = new Date(event.startsAt).getTime();
  return startsAtMs >= nowMs ? startsAtMs : nowMs;
}
