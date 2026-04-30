import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildTunnelDatabaseUrl,
  getProdDatabaseUrl,
  parseEnvFile,
  startTunnelHealthMonitor,
  waitForPortToClose,
} from "../scripts/run-local-prod.mjs";

describe("run-local-prod script helpers", () => {
  it("rewrites the database host and port to the local tunnel", () => {
    expect(
      buildTunnelDatabaseUrl(
        "postgresql://jammers:secret@prod-postgres.example.com:5432/prod",
        55433,
      ),
    ).toBe("postgresql://jammers:secret@127.0.0.1:55433/prod");
  });

  it("parses simple dotenv-style files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jammers-local-prod-"));
    const envPath = join(dir, ".env.local");
    await writeFile(
      envPath,
      "DATABASE_URL='postgresql://user:pass@example.com:5432/prod'\n# comment\nENABLE_DEV_AUTH=true\n",
    );

    const values = parseEnvFile(envPath);

    expect(values).toEqual({
      DATABASE_URL: "postgresql://user:pass@example.com:5432/prod",
      ENABLE_DEV_AUTH: "true",
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("prefers a production tunnel URL over a local development DATABASE_URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jammers-local-prod-"));
    const envLocalPath = join(dir, ".env.local");
    const envPath = join(dir, ".env");
    await writeFile(envLocalPath, "DATABASE_URL='postgresql://jammers:secret@127.0.0.1:55432/prod'\n");
    await writeFile(envPath, "DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jammers'\n");

    const value = getProdDatabaseUrl({
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/jammers",
      },
      envLocalPath,
      envPath,
    });

    expect(value).toBe("postgresql://jammers:secret@127.0.0.1:55432/prod");

    await rm(dir, { recursive: true, force: true });
  });

  it("restarts the tunnel when a health check fails", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error("tunnel dropped"));
    const restartTunnel = vi.fn();
    const timer = { id: "timer" };
    const setTimer = vi.fn(() => timer);
    const clearTimer = vi.fn();

    const monitor = startTunnelHealthMonitor({
      checkDatabase,
      clearTimer,
      intervalMs: 1000,
      onStatus: vi.fn(),
      restartTunnel,
      setTimer,
    });

    await monitor.checkOnce();
    monitor.stop();

    expect(checkDatabase).toHaveBeenCalledTimes(1);
    expect(restartTunnel).toHaveBeenCalledWith(expect.any(Error));
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(clearTimer).toHaveBeenCalledWith(timer);
  });

  it("waits until a local tunnel port is free before restarting", async () => {
    let attempts = 0;

    await waitForPortToClose(
      55432,
      "127.0.0.1",
      1000,
      async () => {
        attempts += 1;
        return attempts >= 3;
      },
      async () => {},
    );

    expect(attempts).toBe(3);
  });
});
