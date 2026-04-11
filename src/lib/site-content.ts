export const SITE_CONTENT_ID = "main";

export const DEFAULT_PARTICIPATION_RULES_MARKDOWN = `## Как это работает

- Сначала смотри уже заявленные песни и открытые партии.
- Если видишь свою роль, вписывайся сразу на борде.
- Если песни нет, предлагай её только после проверки поиска.
- Если гиг закрыт, optional-позиции всё ещё можно запрашивать через автора трека.

## Что важно помнить

- Вписывайся только на те партии, которые реально можешь закрыть.
- Если планы изменились, освобождай место как можно раньше.
- Уважай финальный сет и решения автора трека по optional-позициям.
`;

export const DEFAULT_LINEUP_DETAILS_MARKDOWN = `## Что значат роли в борде

- **Required** роли нужны, чтобы песня считалась собранной.
- **OPT / optional** роли дают дополнительный цвет и энергию, но не блокируют собранность.
- Дополнительные флаги вроде **Плейбэк** лишь добавляют контекст к песне.

## Перед тем как вписаться

- Проверь тональность, плейбэк, заметки автора и общий состав.
- Если хочешь позвать человека, используй кнопку приглашения прямо в нужной ячейке.
`;

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
