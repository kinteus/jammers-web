import { readFileSync } from "node:fs";
import { SelectionStrategy } from "@prisma/client";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260827220000_add_history_weighted_selection_strategy/migration.sql",
  "utf8",
);

describe("selection strategy schema", () => {
  it("exposes history-weighted runs as a distinct persisted strategy", () => {
    expect(SelectionStrategy.HISTORY_WEIGHTED).toBe("HISTORY_WEIGHTED");
    expect(SelectionStrategy.COVERAGE_FIRST).toBe("COVERAGE_FIRST");
  });

  it("preserves the legacy strategy and deploys the new enum value", () => {
    expect(schema).toMatch(
      /enum SelectionStrategy\s*{[^}]*COVERAGE_FIRST[^}]*HISTORY_WEIGHTED[^}]*}/s,
    );
    expect(migration).toContain(
      "ALTER TYPE \"SelectionStrategy\" ADD VALUE 'HISTORY_WEIGHTED';",
    );
  });
});
