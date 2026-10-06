import { afterEach, expect, it, vi } from "vitest";
import { isCrossOriginRequest, readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-security";
afterEach(() => vi.unstubAllEnvs());
it("rejects cross-origin writes, including sibling domains", () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://thejammers.org");
  for (const origin of ["https://evil.example", "https://other.thejammers.org", "null"]) {
    expect(isCrossOriginRequest(new Request("https://thejammers.org/api/test", { headers: { origin } }))).toBe(true);
  }
  expect(isCrossOriginRequest(new Request("https://thejammers.org/api/test", { headers: { origin: "https://thejammers.org" } }))).toBe(false);
});
it("limits actual body bytes even without Content-Length", async () => {
  const req = new Request("https://thejammers.org", { method: "POST", body: JSON.stringify({ value: "x".repeat(100) }) });
  await expect(readLimitedJson(req, 50)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
});
it("parses bounded JSON", async () => {
  await expect(readLimitedJson(new Request("https://thejammers.org", { method: "POST", body: '{"ok":true}' }))).resolves.toEqual({ ok: true });
});
