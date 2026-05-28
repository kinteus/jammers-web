import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plannerSource = readFileSync("src/components/seat-planner-field.tsx", "utf8");
const composerSource = readFileSync("src/components/track-proposal-composer.tsx", "utf8");
const formSource = readFileSync("src/components/track-proposal-form.tsx", "utf8");
const launcherSource = readFileSync("src/components/track-proposal-launcher.tsx", "utf8");
const dialogSource = readFileSync("src/components/track-proposal-dialog.tsx", "utf8");

describe("track proposal flow", () => {
  it("uses a flat seat stack with action icons and invite selects", () => {
    expect(plannerSource).toContain("inviteSeatRequests");
    expect(plannerSource).toContain("inviteableUsers");
    expect(plannerSource).toContain("UserCheck");
    expect(plannerSource).toContain("CircleDot");
    expect(plannerSource).toContain("CircleDashed");
    expect(plannerSource).toContain("Ban");
    expect(plannerSource).not.toContain("arrangementSummary");
    expect(plannerSource).not.toContain("presets");
  });

  it("passes inviteable users from the launcher to the seat planner", () => {
    expect(launcherSource).toContain("inviteableUsers");
    expect(formSource).toContain("inviteableUsers");
    expect(composerSource).toContain("inviteableUsers");
  });

  it("keeps the proposal dialog readable over the board", () => {
    expect(dialogSource).toContain("bg-stage");
    expect(dialogSource).not.toContain("brand-shell fixed");
  });
});
