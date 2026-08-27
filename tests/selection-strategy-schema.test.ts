import { SelectionStrategy } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("selection strategy schema", () => {
  it("exposes history-weighted runs as a distinct persisted strategy", () => {
    expect(SelectionStrategy.HISTORY_WEIGHTED).toBe("HISTORY_WEIGHTED");
    expect(SelectionStrategy.COVERAGE_FIRST).toBe("COVERAGE_FIRST");
  });
});
