import { slugify } from "@/lib/utils";

const cyrillicToLatinMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function transliterateToAscii(value: string) {
  return Array.from(value.toLowerCase())
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join("");
}

export function slugifyRouteSegment(value: string) {
  return slugify(transliterateToAscii(value));
}

export function getEventRouteSlug(slug: string) {
  return slugifyRouteSegment(safeDecodeURIComponent(slug));
}

export function buildEventSlugLookupCandidates(value: string) {
  const decoded = safeDecodeURIComponent(value);
  const candidates = [
    value,
    decoded,
    value.normalize("NFC"),
    decoded.normalize("NFC"),
    slugify(decoded),
    slugifyRouteSegment(decoded),
  ].filter(Boolean);

  return [...new Set(candidates)];
}
