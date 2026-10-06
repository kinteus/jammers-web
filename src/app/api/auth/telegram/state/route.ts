import { NextResponse } from "next/server";
import { createLoginState } from "@/lib/auth/login-state";
import { isCrossOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (isCrossOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ state: await createLoginState() }, { headers: { "Cache-Control": "no-store" } });
}
