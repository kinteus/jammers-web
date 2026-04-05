import type { RoleFamilyKey } from "@/lib/role-families";

export type Locale = "en" | "ru";

export const localeCookieName = "jammers-locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

export function pick<T>(locale: Locale, values: Record<Locale, T>) {
  return values[locale];
}

export function getEventStatusLabel(status: string, locale: Locale) {
  const labels: Record<string, Record<Locale, string>> = {
    DRAFT: { en: "Draft", ru: "Черновик" },
    OPEN: { en: "Open", ru: "Открыт" },
    CLOSED: { en: "Closed", ru: "Закрыт" },
    PUBLISHED: { en: "Published", ru: "Опубликован" },
  };

  return labels[status]?.[locale] ?? status;
}

export function getRoleFamilyLabel(role: RoleFamilyKey, locale: Locale) {
  const labels: Record<RoleFamilyKey, Record<Locale, string>> = {
    rhythm: { en: "Rhythm", ru: "Ритм" },
    guitars: { en: "Guitars", ru: "Гитары" },
    bass: { en: "Bass", ru: "Бас" },
    vocals: { en: "Vocals", ru: "Вокал" },
    keys: { en: "Keys", ru: "Клавиши" },
    extras: { en: "Extras", ru: "Доп." },
  };

  return labels[role][locale];
}
