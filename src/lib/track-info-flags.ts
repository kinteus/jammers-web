import { slugify } from "@/lib/utils";

export type TrackInfoField = {
  key: string;
  label: string;
  labels?: Partial<Record<"en" | "ru", string>>;
};

export const DEFAULT_TRACK_INFO_FIELDS: TrackInfoField[] = [
  {
    key: "playback",
    label: "Плейбэк",
  },
];

const PLAYBACK_KEY = DEFAULT_TRACK_INFO_FIELDS[0].key;

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseTrackInfoFields(value: string | null | undefined): TrackInfoField[] {
  const parsed = safeParseJson<TrackInfoField[]>(value, []);
  return parsed
    .map((item) => ({
      key: slugify(item.key || item.label),
      label: item.label?.trim(),
      ...(item.labels ? { labels: { en: item.labels.en?.trim(), ru: item.labels.ru?.trim() } } : {}),
    }))
    .filter((item) => item.key && item.label);
}

export function getEventTrackInfoFields(
  value: string | null | undefined,
  allowPlaybackFallback = false,
): TrackInfoField[] {
  const parsed = parseTrackInfoFields(value);
  if (parsed.length > 0) {
    return parsed;
  }

  return allowPlaybackFallback ? DEFAULT_TRACK_INFO_FIELDS : [];
}

export function parseTrackInfoFieldsInput(
  input: string | null | undefined,
  fallback = DEFAULT_TRACK_INFO_FIELDS,
): TrackInfoField[] {
  const lines = (input ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return fallback;
  }

  const seen = new Set<string>();
  const fields: TrackInfoField[] = [];

  for (const line of lines) {
    const [rawLabel, rawKey, english, russian] = line.includes("|")
      ? line.split("|").map((part) => part.trim())
      : [line, ""];
    const label = rawLabel;
    const key = slugify(rawKey || rawLabel);

    if (!label || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    fields.push({ key, label, ...(english || russian ? { labels: { en: english || undefined, ru: russian || undefined } } : {}) });
  }

  return fields.length > 0 ? fields : fallback;
}

export function serializeTrackInfoFields(fields: TrackInfoField[]): string {
  return JSON.stringify(fields);
}

export function formatTrackInfoFieldsForTextarea(fields: TrackInfoField[]): string {
  return fields.map((field) => {
    if (field.labels) return [field.label, field.key, field.labels.en ?? "", field.labels.ru ?? ""].join("|");
    return field.key === slugify(field.label) ? field.label : `${field.label}|${field.key}`;
  }).join("\n");
}

export function parseTrackInfoKeys(value: string | null | undefined): string[] {
  const parsed = safeParseJson<string[]>(value, []);
  return [...new Set(parsed.map((item) => slugify(item)).filter(Boolean))];
}

export function serializeTrackInfoKeys(keys: string[]): string {
  return JSON.stringify([...new Set(keys.map((item) => slugify(item)).filter(Boolean))]);
}

export function getTrackInfoKeys(
  value: string | null | undefined,
  playbackRequired = false,
): string[] {
  const parsed = parseTrackInfoKeys(value);
  if (parsed.length > 0) {
    return parsed;
  }

  return playbackRequired ? [PLAYBACK_KEY] : [];
}

export function getTrackInfoLabel(field: TrackInfoField, locale: "en" | "ru") {
  if (field.labels?.[locale]) return field.labels[locale];
  if ([PLAYBACK_KEY, "плейбэк", "плейбек", "плэйбэк"].includes(field.key)) {
    return locale === "ru" ? "Плейбэк" : "Playback";
  }

  return field.label;
}
