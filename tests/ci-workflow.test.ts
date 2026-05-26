import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("runs unit coverage and end-to-end smoke tests", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run test:coverage");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm run test:smoke");
  });
});
