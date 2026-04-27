import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  isDatabaseUnavailableError,
  isUniqueConstraintErrorForFields,
} from "@/lib/prisma-errors";

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

describe("isUniqueConstraintErrorForFields", () => {
  it("matches Prisma P2002 errors for the requested fields", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "test",
      code: "P2002",
      meta: {
        target: ["eventId", "songId", "state"],
      },
    });

    expect(isUniqueConstraintErrorForFields(error, ["eventId", "songId", "state"])).toBe(
      true,
    );
    expect(isUniqueConstraintErrorForFields(error, ["eventId", "section", "orderIndex"])).toBe(
      false,
    );
  });
});
