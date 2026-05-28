import { EventStatus, type Event } from "@prisma/client";

export type EventAudienceState = "DRAFT" | "OPEN" | "CLOSED" | "PUBLISHED" | "LIVE" | "ARCHIVED";

function getNextLocalMidnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

export function getEffectiveEventStatus(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  let status = event.status;

  if (
    status === EventStatus.DRAFT &&
    event.registrationOpensAt &&
    event.registrationOpensAt <= new Date()
  ) {
    status = EventStatus.OPEN;
  }

  if (
    status === EventStatus.OPEN &&
    event.registrationClosesAt &&
    event.registrationClosesAt <= new Date()
  ) {
    status = EventStatus.CLOSED;
  }

  return status;
}

export function getAutoSyncedEventStatus(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt"> & {
    startsAt?: Date;
  },
) {
  const archiveBoundary = event.startsAt ? getNextLocalMidnight(event.startsAt) : null;
  if (event.status === EventStatus.PUBLISHED && archiveBoundary && archiveBoundary <= new Date()) {
    return EventStatus.ARCHIVED;
  }

  const effectiveStatus = getEffectiveEventStatus(event);
  return effectiveStatus === event.status ? null : effectiveStatus;
}

export function getAllowedNextEventStatuses(status: EventStatus): EventStatus[] {
  if (status === EventStatus.DRAFT) {
    return [EventStatus.OPEN];
  }
  if (status === EventStatus.OPEN) {
    return [EventStatus.CLOSED];
  }
  if (status === EventStatus.CLOSED) {
    return [EventStatus.OPEN, EventStatus.PUBLISHED];
  }
  if (status === EventStatus.PUBLISHED) {
    return [EventStatus.ARCHIVED];
  }

  return [];
}

export function getEventAudienceState({
  now = new Date(),
  startsAt,
  status,
}: {
  now?: Date;
  startsAt: Date;
  status: EventStatus;
}): EventAudienceState {
  if (status === EventStatus.ARCHIVED) {
    return "ARCHIVED";
  }

  if (status === EventStatus.PUBLISHED && now >= getNextLocalMidnight(startsAt)) {
    return "ARCHIVED";
  }

  if (status === EventStatus.PUBLISHED && now >= startsAt) {
    return "LIVE";
  }

  return status;
}

export function isEventOpen(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  return getEffectiveEventStatus(event) === EventStatus.OPEN;
}

export function allowsClosedOptionalSeatRequests(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt" | "startsAt">,
) {
  const effectiveStatus = getEffectiveEventStatus(event);

  if (event.startsAt <= new Date()) {
    return false;
  }

  return effectiveStatus === EventStatus.PUBLISHED;
}
