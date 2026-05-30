import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const profileSource = readFileSync("src/app/profile/page.tsx", "utf8");
const profileArchiveStatsSource = readFileSync("src/components/profile-archive-stats.tsx", "utf8");

describe("profile navigation", () => {
  it("links the signed-in username to profile instead of submitting sign-out", () => {
    expect(headerSource).not.toContain("signOutAction");
    expect(headerSource).not.toContain("<form action={signOutAction}");
    expect(headerSource).toContain('href="/profile"');
    expect(headerSource).toContain("user.telegramUsername");
  });

  it("keeps sign-out as an explicit profile action", () => {
    expect(profileSource).toContain("signOutAction");
    expect(profileSource).toContain("Sign out");
    expect(profileSource).toContain("Выйти");
  });

  it("puts invitation proposals above archive stats when the profile has activity", () => {
    const invitationsIndex = profileSource.indexOf('id="invitations"');
    const archiveIndex = profileSource.indexOf("<ProfileArchiveStats");

    expect(invitationsIndex).toBeGreaterThan(-1);
    expect(archiveIndex).toBeGreaterThan(-1);
    expect(invitationsIndex).toBeLessThan(archiveIndex);
  });

  it("does not show the unreliable songs-originated count in profile stats", () => {
    expect(profileArchiveStatsSource).not.toContain("Songs originated");
    expect(profileArchiveStatsSource).not.toContain("Предложенных песен");
    expect(profileArchiveStatsSource).not.toContain("stats.songsOriginated");
  });
});
