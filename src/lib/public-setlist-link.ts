type EventLinkCandidate = {
  id: string;
  startsAt: Date;
};

export function resolveLatestSetlistHref({
  publishedEvents,
  currentEvents,
}: {
  publishedEvents: EventLinkCandidate[];
  currentEvents: EventLinkCandidate[];
}) {
  const latestPublished = publishedEvents
    .slice()
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];

  if (latestPublished) {
    return `/events/${latestPublished.id}`;
  }

  const nearestCurrent = currentEvents
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  return nearestCurrent ? `/events/${nearestCurrent.id}` : "/#published";
}
