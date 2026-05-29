import { describe, expect, it } from "vitest";

import {
  getDefaultLineupDetailsMarkdown,
  getDefaultParticipationRulesMarkdown,
  resolveFaqMarkdown,
  resolveFaqSectionMarkdown,
  serializeFaqContent,
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

  it("resolves per-locale faq markdown from the locale-keyed JSON blob", () => {
    const json = serializeFaqContent({
      en: { participationRules: "## EN rules", lineupDetails: "## EN lineup" },
      ru: { participationRules: "## RU правила", lineupDetails: "## RU лайнап" },
    });

    expect(
      resolveFaqSectionMarkdown({ kind: "participation", locale: "en", faqContentJson: json }),
    ).toBe("## EN rules");
    expect(
      resolveFaqSectionMarkdown({ kind: "lineup", locale: "ru", faqContentJson: json }),
    ).toBe("## RU лайнап");
  });

  it("falls back to the legacy single blob when the JSON locale value is empty", () => {
    const json = serializeFaqContent({
      en: { participationRules: "", lineupDetails: "" },
      ru: { participationRules: "", lineupDetails: "" },
    });

    expect(
      resolveFaqSectionMarkdown({
        kind: "participation",
        locale: "ru",
        faqContentJson: json,
        legacyValue: "## Legacy custom",
      }),
    ).toBe("## Legacy custom");
  });

  it("falls back to locale defaults when nothing is stored", () => {
    expect(
      resolveFaqSectionMarkdown({ kind: "lineup", locale: "en", faqContentJson: null }),
    ).toBe(getDefaultLineupDetailsMarkdown("en"));
  });

  it("uses setlist wording in russian built-in defaults", () => {
    const participation = getDefaultParticipationRulesMarkdown("ru");
    const lineup = getDefaultLineupDetailsMarkdown("ru");

    expect(participation).toContain("сетлист");
    expect(participation).not.toContain("борд");
    expect(lineup).toContain("## Что значат роли в сетлисте");
    expect(lineup).not.toContain("борд");
  });
});
