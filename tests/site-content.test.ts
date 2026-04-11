import { describe, expect, it } from "vitest";

import {
  getDefaultLineupDetailsMarkdown,
  getDefaultParticipationRulesMarkdown,
  resolveFaqMarkdown,
} from "@/lib/site-content";

describe("site content helpers", () => {
  it("returns locale-specific defaults when faq content is empty", () => {
    expect(
      resolveFaqMarkdown({ kind: "participation", locale: "en", value: "" }),
    ).toBe(getDefaultParticipationRulesMarkdown("en"));
    expect(resolveFaqMarkdown({ kind: "lineup", locale: "ru", value: null })).toBe(
      getDefaultLineupDetailsMarkdown("ru"),
    );
  });

  it("localizes built-in default faq content without overriding custom copy", () => {
    expect(
      resolveFaqMarkdown({
        kind: "participation",
        locale: "en",
        value: getDefaultParticipationRulesMarkdown("ru"),
      }),
    ).toBe(getDefaultParticipationRulesMarkdown("en"));

    const customCopy = "## Custom\n\n- Keep it local";
    expect(
      resolveFaqMarkdown({ kind: "lineup", locale: "ru", value: customCopy }),
    ).toBe(customCopy);
  });
});
