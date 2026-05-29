import { describe, expect, it } from "vitest";

import { getFloatingToastAutoHideMs } from "@/components/floating-toast";

describe("getFloatingToastAutoHideMs", () => {
  it("holds validation/error toasts longer than success/update toasts", () => {
    expect(getFloatingToastAutoHideMs("error")).toBeGreaterThan(
      getFloatingToastAutoHideMs("success"),
    );
  });

  it("keeps error toasts on screen long enough to read a constraint message", () => {
    expect(getFloatingToastAutoHideMs("error")).toBeGreaterThanOrEqual(9000);
  });
});
