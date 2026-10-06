import { NextResponse } from "next/server";

import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { isCrossOriginRequest, readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-security";

import { recordAppError } from "@/server/error-log";

function getStringField(body: unknown, key: string) {
  if (!body || typeof body !== "object" || !(key in body)) {
    return null;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  if (isCrossOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const limit = consumeRateLimit({ key: `client-error:${getClientIpFromHeaders(request.headers)}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ ok: false }, { status: 413 });
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const errorId = getStringField(body, "errorId");
  if (!errorId || !/^err_[a-zA-Z0-9_-]{1,100}$/.test(errorId)) {
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
