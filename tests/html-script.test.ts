import { describe, expect, it } from "vitest";

import { serializeJsonForHtmlScript } from "@/lib/html-script";

describe("serializeJsonForHtmlScript", () => {
  it("escapes script-breaking characters", () => {
    const serialized = serializeJsonForHtmlScript({
      title: "</script><script>alert(1)</script>",
      venue: "A & B",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u0026");
  });
});
