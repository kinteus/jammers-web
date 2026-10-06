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

  it("uses the glossary wording in russian built-in defaults", () => {
    const participation = getDefaultParticipationRulesMarkdown("ru");
    const lineup = getDefaultLineupDetailsMarkdown("ru");

    expect(participation).toContain("таблиц");
    expect(participation).toContain("автора заявки");
    expect(participation).not.toContain("борд");
    expect(participation).not.toMatch(/трек|партии|optional-позиции/);
    expect(lineup).toContain("## Что значат места в таблице");
    expect(lineup).toContain("## Словарь");
    expect(lineup).not.toContain("борд");
  });

  it("adds a glossary to the english line-up defaults", () => {
    expect(getDefaultLineupDetailsMarkdown("en")).toContain("## Glossary");
    expect(getDefaultLineupDetailsMarkdown("en")).toContain("**Participant**");
  });

  it("keeps partial copies of old defaults as custom text", () => {
    const partial = "## Что значат роли в сетлисте\n\n- **Required** роли нужны, чтобы песня считалась собранной.";
    expect(resolveFaqMarkdown({ kind: "lineup", locale: "en", value: partial })).toBe(partial);
  });

  it("treats a stored copy of the previous default as the current default", () => {
    const previousRuDefault = `## Что значат роли в сетлисте

- **Required** роли нужны, чтобы песня считалась собранной.
- **OPT / optional** роли дают дополнительный цвет и энергию, но не блокируют собранность.
- Дополнительные флаги вроде **Плейбэк** лишь добавляют контекст к песне.

## Перед тем как вписаться

- Проверь тональность, плейбэк, заметки автора и общий состав сетлиста.
- Если хочешь позвать человека, используй кнопку приглашения прямо в нужной ячейке.
`;
    expect(resolveFaqMarkdown({ kind: "lineup", locale: "en", value: previousRuDefault })).toBe(
      getDefaultLineupDetailsMarkdown("en"),
    );
    expect(
      resolveFaqSectionMarkdown({
        kind: "lineup",
        locale: "ru",
        faqContentJson: JSON.stringify({ ru: { lineupDetails: previousRuDefault } }),
      }),
    ).toBe(getDefaultLineupDetailsMarkdown("ru"));
  });
});
