import { EventStatus, type Event } from "@prisma/client";

export function getEffectiveEventStatus(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  if (
    event.status === EventStatus.OPEN &&
    event.registrationClosesAt &&
    event.registrationClosesAt <= new Date()
  ) {
    return EventStatus.CLOSED;
  }

  if (
    event.status === EventStatus.DRAFT &&
    event.registrationOpensAt &&
    event.registrationOpensAt <= new Date()
  ) {
    return EventStatus.OPEN;
  }

  return event.status;
}

export function isEventOpen(
  event: Pick<Event, "status" | "registrationOpensAt" | "registrationClosesAt">,
) {
  return getEffectiveEventStatus(event) === EventStatus.OPEN;
}
