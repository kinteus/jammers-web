import { slugify } from "@/lib/utils";

export type TrackInfoField = {
  key: string;
  label: string;
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
    const [rawLabel, rawKey] = line.includes("|")
      ? line.split("|").map((part) => part.trim())
      : [line, ""];
    const label = rawLabel;
    const key = slugify(rawKey || rawLabel);

    if (!label || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    fields.push({ key, label });
  }

  return fields.length > 0 ? fields : fallback;
}

export function serializeTrackInfoFields(fields: TrackInfoField[]): string {
  return JSON.stringify(fields);
}

export function formatTrackInfoFieldsForTextarea(fields: TrackInfoField[]): string {
  return fields.map((field) => field.label).join("\n");
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
  if (field.key === PLAYBACK_KEY) {
    return locale === "ru" ? "Плейбэк" : "Playback";
  }

  return field.label;
}
