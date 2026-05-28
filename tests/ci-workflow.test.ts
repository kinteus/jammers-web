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

  it("deploys to Kubernetes only after CI completes successfully", () => {
    const workflow = readFileSync(".github/workflows/deploy-k8s.yml", "utf8");

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["CI"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).not.toContain("\n  push:");
    expect(workflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain(
      "DEPLOY_SHA: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}",
    );
    expect(workflow).not.toContain("IMAGE_REF=\"${IMAGE_NAME}:sha-${GITHUB_SHA}\"");
    expect(workflow).not.toContain("jammers-web-migrate-${GITHUB_SHA::7}");
  });
});
