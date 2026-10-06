import { NextResponse } from "next/server";
import { hasActiveBan } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || hasActiveBan(user)) return NextResponse.json({ users: [] }, { status: 401 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().replace(/^@+/, "");
  if (query.length < 3 || query.length > 80) return NextResponse.json({ users: [] });
  const limit = consumeRateLimit({ key: `musician-search:${user.id}`, limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ users: [] }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { telegramUsername: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, telegramUsername: true },
    orderBy: [{ telegramUsername: "asc" }, { fullName: "asc" }, { id: "asc" }],
    take: 8,
  });
  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}
