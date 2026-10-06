import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { hasActiveBan } from "@/lib/permissions";
import { isCrossOriginRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isCrossOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "auth-required" }, { status: 401 });
  }

  if (hasActiveBan(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const limit = consumeRateLimit({ key: `catalog-request:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  const formData = await request.formData();
  const eventId = formData.get("eventId");
  const artistName = formData.get("artistName");
  const trackTitle = formData.get("trackTitle");
  const comment = formData.get("comment");

  if (
    typeof eventId !== "string" ||
    typeof artistName !== "string" ||
    typeof trackTitle !== "string" ||
    eventId.length > 100 || artistName.length > 200 || trackTitle.length > 300 ||
    (typeof comment === "string" && comment.length > 2000) ||
    !artistName.trim() ||
    !trackTitle.trim()
  ) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  try {
    await db.songCatalogRequest.create({
      data: {
        requestedById: user.id,
        artistName: artistName.trim(),
        trackTitle: trackTitle.trim(),
        comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
      },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ error: "database-unavailable" }, { status: 503 });
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/events/${eventId}`);

  return NextResponse.json({ ok: true });
}
