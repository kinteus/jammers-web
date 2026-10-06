import { NextRequest, NextResponse } from "next/server";

// Authorization stays in server pages/actions. This middleware only sets browser policy.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV === "development";
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url);
  const websocket = `${origin.protocol === "https:" ? "wss:" : "ws:"}//${origin.host}`;
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' ${development ? "'unsafe-eval' " : ""}https://telegram.org`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${websocket}`,
    "frame-src https://oauth.telegram.org https://telegram.org",
    ...(origin.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  // Never trust a client-supplied nonce or CSP (including RSC navigations).
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/livez|api/healthz).*)"],
};
