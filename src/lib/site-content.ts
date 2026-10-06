import type { Locale } from "@/lib/i18n";

export const SITE_CONTENT_ID = "main";
export const DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT = 18;
export const DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT = 8;

// Wording follows the glossary: gig, board (таблица), song, seat (место), participant
// (участник), proposer (автор заявки), performed song (песня из сетлиста).
const DEFAULT_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
  en: `## How it works

- Start by scanning the songs already on the board and the seats that are still open.
- If you see a seat you can really cover, take it right away.
- Only propose a new song after checking that it is not already there.
- If the gig is closed, optional seats can still be requested through the song's proposer.

## What matters most

- Take only the seats you can genuinely carry.
- If your plans change, release the seat as early as possible.
- Respect the final setlist and the proposer's decisions on optional seats.
`,
  ru: `## Как это работает

- Сначала смотри таблицу гига: уже заявленные песни и открытые места.
- Если видишь место, которое реально закроешь, занимай его сразу.
- Новую песню предлагай только после того, как проверил, что её ещё нет в таблице.
- Если гиг закрыт, опциональные места всё ещё можно запросить у автора заявки.

## Что важно помнить

- Занимай только те места, которые реально можешь закрыть, чтобы таблица оставалась надёжной.
- Если планы изменились, освобождай место как можно раньше.
- Уважай финальный сетлист и решения автора заявки по опциональным местам.
`,
};

const DEFAULT_LINEUP_DETAILS_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
  en: `## What the seats on the board mean

- **Required** seats are needed for the song to count as assembled.
- **OPT / optional** seats add color and energy, but do not block completion.
- Extra flags such as **Playback** only add context to the song.

## Before you join

- Check the key, playback, the proposer's notes, and who is already in the song.
- If you want to bring someone in, use the invite control directly on that seat.

## Glossary

- **Gig**: one event, a date and a venue.
- **Board**: the list of songs proposed for a gig.
- **Song**: one entry on the board.
- **Seat**: one instrument place in a song, either required or optional.
- **Participant**: a person who took a seat.
- **Proposer**: the person who added the song to the board.
- **Performed song**: a song that made the final setlist and was played on stage.
`,
  ru: `## Что значат места в таблице

- **Обязательные** места нужны, чтобы песня считалась собранной.
- **OPT / опциональные** места дают дополнительный цвет и энергию, но не блокируют собранность.
- Дополнительные флаги вроде **Плейбэк** лишь добавляют контекст к песне.

## Перед тем как вписаться

- Проверь тональность, плейбэк, заметки автора заявки и кто уже есть в песне.
- Если хочешь позвать человека, используй кнопку приглашения прямо в нужном месте.

## Словарь

- **Гиг**: одно мероприятие, дата и площадка.
- **Таблица**: список песен, предложенных на гиг.
- **Песня**: одна запись в таблице.
- **Место**: одна инструментальная позиция в песне, обязательная или опциональная.
- **Участник**: человек, который занял место.
- **Автор заявки**: человек, который добавил песню в таблицу.
- **Песня из сетлиста**: песня, которая попала в финальный сетлист и прозвучала на сцене.
`,
};

// Previous default texts. A stored copy of an old default is still treated as "the default",
// so it localises and picks up the current wording instead of freezing the old text.
const LEGACY_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
  en: `## How it works

- Start by scanning the songs already on the board and the seats that are still open.
- If you see a role you can really cover, join it right away.
- Only propose a new song after checking that it is not already there.
- If the gig is closed, optional seats can still be requested through the track author.

## What matters most

- Join only the parts you can genuinely carry.
- If your plans change, release the seat as early as possible.
- Respect the final set and the track author's decisions on optional seats.
`,
  ru: `## Как это работает

- Сначала смотри текущий сетлист, уже заявленные песни и открытые партии.
- Если видишь свою роль, вписывайся сразу в сетлист.
- Если песни нет, предлагай её только после проверки поиска.
- Если гиг закрыт, optional-позиции всё ещё можно запрашивать через автора трека.

## Что важно помнить

- Вписывайся только на те партии, которые реально можешь закрыть, чтобы сетлист оставался надёжным.
- Если планы изменились, освобождай место как можно раньше.
- Уважай финальный сет и решения автора трека по optional-позициям.
`,
};

const LEGACY_LINEUP_DETAILS_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
  en: `## What the board roles mean

- **Required** roles are needed for the song to count as assembled.
- **OPT / optional** roles add color and energy, but do not block completion.
- Extra flags such as **Playback** only add context to the song.

## Before you join

- Check the key, playback, track notes, and the overall line-up.
- If you want to bring someone in, use the invite control directly on that seat.
`,
  ru: `## Что значат роли в сетлисте

- **Required** роли нужны, чтобы песня считалась собранной.
- **OPT / optional** роли дают дополнительный цвет и энергию, но не блокируют собранность.
- Дополнительные флаги вроде **Плейбэк** лишь добавляют контекст к песне.

## Перед тем как вписаться

- Проверь тональность, плейбэк, заметки автора и общий состав сетлиста.
- Если хочешь позвать человека, используй кнопку приглашения прямо в нужной ячейке.
`,
};

export const DEFAULT_PARTICIPATION_RULES_MARKDOWN =
  DEFAULT_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE.ru;

export const DEFAULT_LINEUP_DETAILS_MARKDOWN = DEFAULT_LINEUP_DETAILS_MARKDOWN_BY_LOCALE.ru;

export function getDefaultParticipationRulesMarkdown(locale: Locale) {
  return DEFAULT_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE[locale];
}

export function getDefaultLineupDetailsMarkdown(locale: Locale) {
  return DEFAULT_LINEUP_DETAILS_MARKDOWN_BY_LOCALE[locale];
}

export function resolveFaqMarkdown({
  kind,
  locale,
  value,
}: {
  kind: "participation" | "lineup";
  locale: Locale;
  value: string | null | undefined;
}) {
  const defaults =
    kind === "participation"
      ? DEFAULT_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE
      : DEFAULT_LINEUP_DETAILS_MARKDOWN_BY_LOCALE;
  const resolvedValue = value?.trim() ?? "";

  if (!resolvedValue) {
    return defaults[locale];
  }

  const legacyDefaults =
    kind === "participation"
      ? LEGACY_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE
      : LEGACY_LINEUP_DETAILS_MARKDOWN_BY_LOCALE;
  const knownDefaults = [defaults.en, defaults.ru, legacyDefaults.en, legacyDefaults.ru].map((text) =>
    text.trim(),
  );

  if (knownDefaults.includes(resolvedValue)) {
    return defaults[locale];
  }

  return value!;
}

export type FaqSectionKind = "participation" | "lineup";

type FaqSectionKey = "participationRules" | "lineupDetails";

type FaqLocaleContent = Record<FaqSectionKey, string>;

export type FaqContent = Record<Locale, FaqLocaleContent>;

function sectionKeyForKind(kind: FaqSectionKind): FaqSectionKey {
  return kind === "participation" ? "participationRules" : "lineupDetails";
}

function emptyLocaleContent(): FaqLocaleContent {
  return { participationRules: "", lineupDetails: "" };
}

export function parseFaqContent(value: string | null | undefined): FaqContent | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<Record<Locale, Partial<FaqLocaleContent>>>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const read = (locale: Locale): FaqLocaleContent => {
      const localeContent = parsed[locale];
      return {
        participationRules:
          typeof localeContent?.participationRules === "string"
            ? localeContent.participationRules
            : "",
        lineupDetails:
          typeof localeContent?.lineupDetails === "string" ? localeContent.lineupDetails : "",
      };
    };

    return { en: read("en"), ru: read("ru") };
  } catch {
    return null;
  }
}

export function serializeFaqContent(content: FaqContent) {
  return JSON.stringify(content);
}

export function getFaqContentForLocale(
  faqContentJson: string | null | undefined,
  locale: Locale,
): FaqLocaleContent {
  return parseFaqContent(faqContentJson)?.[locale] ?? emptyLocaleContent();
}

export function resolveFaqSectionMarkdown({
  kind,
  locale,
  faqContentJson,
  legacyValue,
}: {
  kind: FaqSectionKind;
  locale: Locale;
  faqContentJson: string | null | undefined;
  legacyValue?: string | null;
}) {
  const fromJson = parseFaqContent(faqContentJson)?.[locale]?.[sectionKeyForKind(kind)]?.trim();
  if (fromJson) {
    // An unedited copy of a (current or previous) default resolves to the current default.
    return resolveFaqMarkdown({ kind, locale, value: fromJson });
  }

  return resolveFaqMarkdown({ kind, locale, value: legacyValue });
}

export function parseVideoUrls(value: string | null | undefined) {
  try {
    const parsed = value ? (JSON.parse(value) as string[]) : [];
    return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function serializeVideoUrls(urls: string[]) {
  return JSON.stringify(urls);
}

export function parseVideoUrlsInput(input: string | null | undefined) {
  return (input ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatVideoUrlsForTextarea(urls: string[]) {
  return urls.join("\n");
}

export function extractYoutubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}
