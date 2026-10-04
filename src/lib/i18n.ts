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
    ARCHIVED: { en: "Archived", ru: "Архив" },
  };

  return labels[status]?.[locale] ?? status;
}

// Verb labels for admin status buttons: the button says what will happen, not the target state.
export function getEventStatusActionLabel(target: string, current: string, locale: Locale) {
  const labels: Record<string, Record<Locale, string>> = {
    OPEN:
      current === "CLOSED"
        ? { en: "Reopen registration", ru: "Снова открыть регистрацию" }
        : { en: "Open registration", ru: "Открыть регистрацию" },
    CLOSED: { en: "Close registration", ru: "Закрыть регистрацию" },
    PUBLISHED: { en: "Publish setlist", ru: "Опубликовать сетлист" },
    ARCHIVED: { en: "Move to archive", ru: "Перенести в архив" },
    DRAFT: { en: "Back to draft", ru: "Вернуть в черновик" },
  };

  return labels[target]?.[locale] ?? target;
}

export function getEventStatusActionConfirm(target: string, locale: Locale) {
  const messages: Record<string, Record<Locale, string>> = {
    CLOSED: {
      en: "Close registration? Players won't be able to join required seats.",
      ru: "Закрыть регистрацию? Игроки не смогут записываться на обязательные места.",
    },
    PUBLISHED: {
      en: "Publish the setlist? Confirmed players will be notified.",
      ru: "Опубликовать сетлист? Подтверждённые игроки получат уведомление.",
    },
    ARCHIVED: {
      en: "Move this gig to the archive?",
      ru: "Перенести этот гиг в архив?",
    },
  };

  return messages[target]?.[locale] ?? null;
}

export function getRoleFamilyLabel(role: RoleFamilyKey, locale: Locale) {
  const labels: Record<RoleFamilyKey, Record<Locale, string>> = {
    rhythm: { en: "Drums", ru: "Барабаны" },
    guitars: { en: "Guitars", ru: "Гитары" },
    bass: { en: "Bass", ru: "Бас" },
    vocals: { en: "Vocals", ru: "Вокал" },
    keys: { en: "Keys", ru: "Клавиши" },
    extras: { en: "Extras", ru: "Доп." },
  };

  return labels[role][locale];
}
