import { db } from "@/lib/db";

// Match effective OPEN status, including scheduled registration windows.
export async function getPostLoginPath() {
  const now = new Date();
  const event = await db.event.findFirst({
    where: {
      startsAt: { gte: now },
      AND: [
        { OR: [{ status: "OPEN" }, { status: "DRAFT", registrationOpensAt: { lte: now } }] },
        { OR: [{ registrationClosesAt: null }, { registrationClosesAt: { gt: now } }] },
      ],
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return event ? `/events/${event.id}` : "/";
}
