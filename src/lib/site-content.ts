import type { Locale } from "@/lib/i18n";

export const SITE_CONTENT_ID = "main";

const DEFAULT_PARTICIPATION_RULES_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
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

- Сначала смотри уже заявленные песни и открытые партии.
- Если видишь свою роль, вписывайся сразу на борде.
- Если песни нет, предлагай её только после проверки поиска.
- Если гиг закрыт, optional-позиции всё ещё можно запрашивать через автора трека.

## Что важно помнить

- Вписывайся только на те партии, которые реально можешь закрыть.
- Если планы изменились, освобождай место как можно раньше.
- Уважай финальный сет и решения автора трека по optional-позициям.
`,
};

const DEFAULT_LINEUP_DETAILS_MARKDOWN_BY_LOCALE: Record<Locale, string> = {
  en: `## What the board roles mean

- **Required** roles are needed for the song to count as assembled.
- **OPT / optional** roles add color and energy, but do not block completion.
- Extra flags such as **Playback** only add context to the song.

## Before you join

- Check the key, playback, track notes, and the overall line-up.
- If you want to bring someone in, use the invite control directly on that seat.
`,
  ru: `## Что значат роли в борде

- **Required** роли нужны, чтобы песня считалась собранной.
- **OPT / optional** роли дают дополнительный цвет и энергию, но не блокируют собранность.
- Дополнительные флаги вроде **Плейбэк** лишь добавляют контекст к песне.

## Перед тем как вписаться

- Проверь тональность, плейбэк, заметки автора и общий состав.
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

  if (resolvedValue === defaults.en.trim() || resolvedValue === defaults.ru.trim()) {
    return defaults[locale];
  }

  return value!;
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
