import { clsx, type ClassValue } from "clsx";
import { enUS, ru } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { twMerge } from "tailwind-merge";

import type { Locale } from "@/lib/i18n";

// The community runs in a single timezone; render every wall-clock time in Cyprus local time
// so values match how admins enter them, regardless of the server timezone (UTC in production).
export const EVENT_TIME_ZONE = "Europe/Nicosia";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatInEventTimeZone(value: Date | string, pattern: string, locale: Locale) {
  return formatInTimeZone(new Date(value), EVENT_TIME_ZONE, pattern, {
    locale: locale === "ru" ? ru : enUS,
  });
}

// "8 Oct 2026, 20:00". All user-facing dates go through the helpers below so pages agree.
export function formatDateTime(value: Date | string, locale: Locale = "en") {
  return formatInEventTimeZone(value, "d MMM yyyy, HH:mm", locale);
}

// "18 October 2026"
export function formatEventDateLong(value: Date | string, locale: Locale = "en") {
  return formatInEventTimeZone(value, "d MMMM yyyy", locale);
}

// "18 Oct 2026"
export function formatEventDateShort(value: Date | string, locale: Locale = "en") {
  return formatInEventTimeZone(value, "d MMM yyyy", locale);
}

// "20:00"
export function formatEventTime(value: Date | string, locale: Locale = "en") {
  return formatInEventTimeZone(value, "HH:mm", locale);
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "item";
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildSlugLookupCandidates(value: string) {
  const decoded = safeDecodeURIComponent(value);
  const candidates = [
    value,
    decoded,
    value.normalize("NFC"),
    decoded.normalize("NFC"),
    slugify(decoded),
  ].filter(Boolean);

  return [...new Set(candidates)];
}
