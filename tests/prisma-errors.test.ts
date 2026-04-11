import { describe, expect, it } from "vitest";

import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

describe("isDatabaseUnavailableError", () => {
  it("recognizes database connectivity messages", () => {
    expect(
      isDatabaseUnavailableError(
        new Error("Can't reach database server at `127.0.0.1:55432`."),
      ),
    ).toBe(true);
  });

  it("does not flag unrelated errors", () => {
    expect(isDatabaseUnavailableError(new Error("Something else broke"))).toBe(false);
  });
});
