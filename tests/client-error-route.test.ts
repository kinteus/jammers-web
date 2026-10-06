import { beforeEach, expect, it, vi } from "vitest";
const record = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => vi.fn());
vi.mock("@/server/error-log", () => ({ recordAppError: record }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: limit, getClientIpFromHeaders: () => "127.0.0.1" }));
import { POST } from "@/app/api/client-error/route";
beforeEach(() => { vi.clearAllMocks(); limit.mockReturnValue({ allowed: true }); });
function request(body: unknown, headers?: HeadersInit) {
  return new Request("https://thejammers.org/api/client-error", { method: "POST", body: JSON.stringify(body), headers });
}
it("bounds actual report bytes before writing logs", async () => {
  expect((await POST(request({ errorId: "err_test", stack: "x".repeat(17000) }))).status).toBe(413);
  expect(record).not.toHaveBeenCalled();
});
it("rejects cross-origin log injection", async () => {
  expect((await POST(request({ errorId: "err_test" }, { origin: "https://evil.example" }))).status).toBe(403);
  expect(record).not.toHaveBeenCalled();
});
it("throttles reports before writing", async () => {
  limit.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });
  expect((await POST(request({ errorId: "err_test" }))).status).toBe(429);
  expect(record).not.toHaveBeenCalled();
});
it("accepts a bounded valid report", async () => {
  expect((await POST(request({ errorId: "err_test", message: "failed" }))).status).toBe(200);
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ errorId: "err_test", message: "failed" }));
});
it("rejects malformed IDs", async () => {
  expect((await POST(request({ errorId: "injected\nline" }))).status).toBe(400);
  expect(record).not.toHaveBeenCalled();
});
