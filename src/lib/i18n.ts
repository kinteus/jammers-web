import type { RoleFamilyKey } from "@/lib/role-families";

export type Locale = "en" | "ru";

export const localeCookieName = "jammers-locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

export function pick<T>(locale: Locale, values: Record<Locale, T>) {
  return values[locale];
}

type PluralForms = {
  en: { one: string; other: string };
  ru: { one: string; few: string; many: string };
};

// "1 track" / "2 tracks"; "1 трек" / "3 трека" / "5 треков".
export function formatCount(locale: Locale, count: number, forms: PluralForms) {
  if (locale === "ru") {
    const rule = new Intl.PluralRules("ru-RU").select(count);
    const word = rule === "one" ? forms.ru.one : rule === "few" ? forms.ru.few : forms.ru.many;
    return `${count} ${word}`;
  }

  const word = new Intl.PluralRules("en-GB").select(count) === "one" ? forms.en.one : forms.en.other;
  return `${count} ${word}`;
}

export const COUNT_FORMS = {
  tracks: { en: { one: "track", other: "tracks" }, ru: { one: "трек", few: "трека", many: "треков" } },
  gigs: { en: { one: "gig", other: "gigs" }, ru: { one: "гиг", few: "гига", many: "гигов" } },
  plays: { en: { one: "play", other: "plays" }, ru: { one: "раз", few: "раза", many: "раз" } },
  times: { en: { one: "time", other: "times" }, ru: { one: "раз", few: "раза", many: "раз" } },
  // Glossary (Notion task "Define a glossary"): gig · board/таблица · song · seat/место ·
  // participant/участник · proposer/автор заявки · performed song/песня из сетлиста.
  songs: { en: { one: "song", other: "songs" }, ru: { one: "песня", few: "песни", many: "песен" } },
  performedSongs: {
    en: { one: "performed song", other: "performed songs" },
    ru: { one: "песня из сетлиста", few: "песни из сетлиста", many: "песен из сетлиста" },
  },
  seats: { en: { one: "seat", other: "seats" }, ru: { one: "место", few: "места", many: "мест" } },
  participants: {
    en: { one: "participant", other: "participants" },
    ru: { one: "участник", few: "участника", many: "участников" },
  },
  sharedSongs: {
    en: { one: "shared song", other: "shared songs" },
    ru: { one: "общая песня", few: "общие песни", many: "общих песен" },
  },
} satisfies Record<string, PluralForms>;

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
      en: "Close registration? Participants won't be able to join required seats.",
      ru: "Закрыть регистрацию? Участники не смогут записываться на обязательные места.",
    },
    PUBLISHED: {
      en: "Publish the setlist? Confirmed participants will be notified.",
      ru: "Опубликовать сетлист? Подтверждённые участники получат уведомление.",
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
