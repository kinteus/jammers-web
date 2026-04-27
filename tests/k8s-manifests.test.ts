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

function getMigrationJobShellCommand() {
  const manifest = readFileSync("infra/k8s/base/migration-job.example.yaml", "utf8");
  const match = manifest.match(/command:\s*\["sh",\s*"-c",\s*"([^"]+)"\]/);

  if (!match) {
    throw new Error("Migration job shell command was not found.");
  }

  return match[1];
}

function getDockerRunnerStage() {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const match = dockerfile.match(/FROM node:22-alpine AS runner\n(?<stage>[\s\S]+)$/);

  if (!match?.groups?.stage) {
    throw new Error("Docker runner stage was not found.");
  }

  return match.groups.stage;
}

describe("kubernetes manifests", () => {
  it("gives the Prisma migration job enough memory to run the CLI", () => {
    expect(getMigrationJobMemoryLimitMi()).toBeGreaterThanOrEqual(512);
  });

  it("runs Prisma migrations from the image without resolving npx at deploy time", () => {
    const command = getMigrationJobShellCommand();

    expect(command).not.toMatch(/\bnpx\b/);
    expect(command).toContain("./node_modules/.bin/prisma migrate deploy");
    expect(command).toContain("--schema=prisma/schema.prisma");
  });

  it("keeps the Prisma CLI available in the production image for migration jobs", () => {
    expect(getDockerRunnerStage()).toContain("COPY --from=deps /app/node_modules ./node_modules");
  });
});
