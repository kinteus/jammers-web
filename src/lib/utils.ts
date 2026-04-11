import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

import type { Locale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: Date | string, locale: Locale = "en") {
  return format(new Date(value), "dd MMM yyyy, HH:mm", {
    locale: locale === "ru" ? ru : enUS,
  });
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
