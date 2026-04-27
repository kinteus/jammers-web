import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function getMigrationJobMemoryLimitMi() {
  const manifest = readFileSync("infra/k8s/base/migration-job.example.yaml", "utf8");
  const match = manifest.match(/limits:\s*\n\s+cpu:\s+\S+\s*\n\s+memory:\s+(\d+)Mi/);

  if (!match) {
    throw new Error("Migration job memory limit was not found.");
  }

  return Number(match[1]);
}

describe("kubernetes manifests", () => {
  it("gives the Prisma migration job enough memory to run the CLI", () => {
    expect(getMigrationJobMemoryLimitMi()).toBeGreaterThanOrEqual(512);
  });
});
