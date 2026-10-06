import type { Locale } from "@/lib/i18n";
import { formatEventDateLong } from "@/lib/utils";

// Auto-style titles that only restate the date, in whatever language they were typed:
// "Гиг The Jammers 12 of June 2023" (legacy import), "Гиг The Jammers 27 сентября",
// "The Jammers Gig 18/10/26". Custom names like "The Jammers Hot June" don't match.
const DATE_ONLY_TITLE_PATTERNS = [
  /^гиг the jammers \d{1,2} of [a-z]+ \d{4}$/i,
  /^гиг the jammers \d{1,2} [а-яё]+( \d{4})?$/i,
  /^(the jammers gig|гиг the jammers) \d{1,2}[./]\d{1,2}[./]\d{2,4}$/i,
];

export function isDateOnlyGigTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  return DATE_ONLY_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Public display title for a gig. Date-only titles are rebuilt in the visitor's language
 * ("The Jammers · 12 June 2023" / "The Jammers · 12 июня 2023"); custom titles are kept.
 * The stored title is unchanged, and admin screens keep showing it.
 */
export function getGigDisplayTitle(
  gig: { title: string; startsAt: Date | string },
  locale: Locale,
) {
  if (!isDateOnlyGigTitle(gig.title)) {
    return gig.title;
  }

  return `The Jammers · ${formatEventDateLong(gig.startsAt, locale)}`;
}
