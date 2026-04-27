import { NextResponse } from "next/server";

import { recordAppError } from "@/server/error-log";

function getStringField(body: unknown, key: string) {
  if (!body || typeof body !== "object" || !(key in body)) {
    return null;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const errorId = getStringField(body, "errorId");
  if (!errorId) {
    return NextResponse.json({ ok: false, error: "error-id-required" }, { status: 400 });
  }

  await recordAppError({
    errorId,
    source: "client-error-boundary",
    digest: getStringField(body, "digest"),
    message: getStringField(body, "message"),
    name: getStringField(body, "name"),
    path: getStringField(body, "path"),
    stack: getStringField(body, "stack"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    { ok: true, errorId },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
