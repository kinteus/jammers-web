import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "auth-required" }, { status: 401 });
  }

  const formData = await request.formData();
  const eventId = formData.get("eventId");
  const artistName = formData.get("artistName");
  const trackTitle = formData.get("trackTitle");
  const comment = formData.get("comment");

  if (
    typeof eventId !== "string" ||
    typeof artistName !== "string" ||
    typeof trackTitle !== "string" ||
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
