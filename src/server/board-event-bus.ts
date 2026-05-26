import { db } from "@/lib/db";
import {
  buildBoardUpdateMessage,
  type BoardUpdateReason,
} from "@/server/board-realtime";

export const BOARD_EVENTS_CHANNEL = "jammers_board_events";

export async function publishBoardUpdate({
  eventId,
  reason,
}: {
  eventId: string;
  reason: BoardUpdateReason;
}) {
  const message = buildBoardUpdateMessage({ eventId, reason });
  await db.$executeRaw`SELECT pg_notify('jammers_board_events', ${message})`;
}
