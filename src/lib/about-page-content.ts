import type { Locale } from "@/lib/i18n";

type LocalizedText = Record<Locale, string>;

export type AboutGalleryItem = {
  src: string;
  alt: string;
  caption: LocalizedText;
};

export type AboutOrganizer = {
  name: string;
  role: LocalizedText;
  contactLabel: string;
  contactValue: string;
};

export type AboutContact = {
  label: string;
  value: string;
  href?: string;
};

export type AboutPartner = {
  name: string;
  href?: string;
  imageSrc?: string;
  imageAlt?: string;
};

export const ABOUT_PAGE_CONTENT = {
  badge: { en: "The Jammers", ru: "The Jammers" },
  title: { en: "About Us", ru: "О нас" },
  eyebrow: {
    en: "Built for the next chapter",
    ru: "Собрано для следующей главы",
  },
  intro: {
    en: "The Jammers is a community where songs become living setlists, strangers become bandmates, and each gig leaves enough momentum for the next one.",
    ru: "The Jammers — это сообщество, где песни превращаются в живой сетлист, незнакомые люди становятся составом, а каждый гиг оставляет импульс для следующего.",
  },
  heroNote: {
    en: "We build nights around shared energy, clear coordination, and the feeling that anyone can step into the next song prepared.",
    ru: "Мы собираем вечера вокруг общей энергии, понятной координации и ощущения, что в следующую песню можно войти подготовленным.",
  },
  galleryLabel: { en: "Photo moments", ru: "Моменты сообщества" },
  organizersLabel: { en: "Organizers", ru: "Организаторы" },
  contactsLabel: { en: "Contacts", ru: "Контакты" },
  partnersLabel: { en: "Partners", ru: "Партнёры" },
  gallery: [
    {
      src: "/about/jammers-bday-277.jpg",
      alt: "The Jammers community celebrating together on stage",
      caption: {
        en: "One of our nights together",
        ru: "Один из наших общих вечеров",
      },
    },
  ],
  organizers: [
    {
      name: "Максим Наумов",
      role: { en: "Community organizer", ru: "Организатор сообщества" },
      contactLabel: "Telegram",
      contactValue: "@replace_me",
    },
    {
      name: "Анастасия Ивченко",
      role: { en: "Community organizer", ru: "Организатор сообщества" },
      contactLabel: "Telegram",
      contactValue: "@replace_me",
    },
    {
      name: "Андрей Кротов",
      role: { en: "Community organizer", ru: "Организатор сообщества" },
      contactLabel: "Telegram",
      contactValue: "@replace_me",
    },
    {
      name: "Алексей Бурсан",
      role: { en: "Community organizer", ru: "Организатор сообщества" },
      contactLabel: "Telegram",
      contactValue: "@replace_me",
    },
    {
      name: "Алеся",
      role: { en: "Community organizer", ru: "Организатор сообщества" },
      contactLabel: "Telegram",
      contactValue: "@replace_me",
    },
  ],
  contacts: [
    {
      label: "Telegram",
      value: "@replace_me",
    },
    {
      label: "Email",
      value: "replace-me@example.com",
    },
    {
      label: "Phone",
      value: "+000 00 000000",
    },
  ],
  partners: [
    { name: "GoSound" },
    { name: "Muse" },
    { name: "Lyra" },
    { name: "Drum4Fun" },
  ],
} as const;
