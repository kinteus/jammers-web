import { EventStatus, type Event } from "@prisma/client";

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
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  const effectiveStatus = getEffectiveEventStatus(event);
  return effectiveStatus === event.status ? null : effectiveStatus;
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

  return (
    effectiveStatus === EventStatus.CLOSED ||
    effectiveStatus === EventStatus.CURATING ||
    effectiveStatus === EventStatus.PUBLISHED
  );
}
