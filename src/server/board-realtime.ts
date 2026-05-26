export type BoardUpdateReason =
  | "event-status"
  | "event-updated"
  | "selection-run"
  | "seat-claimed"
  | "seat-released"
  | "track-created"
  | "track-updated";

export type BoardUpdateMessage = {
  eventId: string;
  reason: BoardUpdateReason;
  type: "board-updated";
};

export function buildBoardUpdateMessage({
  eventId,
  reason,
}: {
  eventId: string;
  reason: BoardUpdateReason;
}) {
  return JSON.stringify({
    eventId,
    reason,
    type: "board-updated",
  } satisfies BoardUpdateMessage);
}

export function parseBoardUpdateMessage(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<BoardUpdateMessage>;
    if (
      parsed.type !== "board-updated" ||
      typeof parsed.eventId !== "string" ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }

    return parsed as BoardUpdateMessage;
  } catch {
    return null;
  }
}
