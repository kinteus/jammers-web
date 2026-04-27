import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("error logging", () => {
  it("writes structured error logs and prunes files outside retention", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "jammers-error-logs-"));
    await writeFile(join(logDir, "errors-2026-04-10.log"), "{}\n");
    await writeFile(join(logDir, "errors-2026-04-25.log"), "{}\n");

    vi.stubEnv("ERROR_LOG_DIR", logDir);
    vi.stubEnv("ERROR_LOG_RETENTION_DAYS", "14");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { recordAppError } = await import("@/server/error-log");

    await recordAppError({
      errorId: "err_test_123",
      message: "Boom",
      name: "Error",
      path: "/events/spring-jam-night",
      source: "client-error-boundary",
    });

    const files = await readdir(logDir);
    expect(files).not.toContain("errors-2026-04-10.log");
    expect(files).toContain("errors-2026-04-25.log");
    expect(files).toContain("errors-2026-04-27.log");

    const logLine = await readFile(join(logDir, "errors-2026-04-27.log"), "utf8");
    expect(JSON.parse(logLine)).toMatchObject({
      errorId: "err_test_123",
      message: "Boom",
      path: "/events/spring-jam-night",
      source: "client-error-boundary",
    });
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('"errorId":"err_test_123"'),
    );
  });
});
