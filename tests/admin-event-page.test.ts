import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/admin/events/[slug]/page.tsx", "utf8");

describe("admin event page", () => {
  it("acknowledges successful event settings saves", () => {
    expect(source).toContain('notice === "event-saved"');
    expect(source).toContain("Event settings saved");
    expect(source).toContain("Настройки гига сохранены");
  });

  it("shows participant counts for the mutable main set and completed board tracks", () => {
    expect(source).toContain("mainSetParticipantCount");
    expect(source).toContain("readyBoardParticipantCount");
    expect(source).toContain("People in main set");
    expect(source).toContain("Участников в мейн-сете");
    expect(source).toContain("People in assembled board songs");
    expect(source).toContain("Участников в собранных песнях таблицы");
  });

  it("does not use dark ink text on the dark admin event panel", () => {
    expect(source).not.toContain("text-ink/70");
    expect(source).not.toContain("text-ink/55");
    expect(source).not.toContain("text-ink\">");
  });

  it("describes selection as independent from closing the board", () => {
    expect(source).toContain("without changing the board status");
    expect(source).not.toContain("This will close the board");
    expect(source).not.toContain("Это закроет таблицу");
  });
});
