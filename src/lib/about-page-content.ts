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

export type AboutPageContent = {
  badge: LocalizedText;
  title: LocalizedText;
  eyebrow: LocalizedText;
  intro: LocalizedText;
  heroNote: LocalizedText;
  galleryLabel: LocalizedText;
  organizersLabel: LocalizedText;
  contactsLabel: LocalizedText;
  partnersLabel: LocalizedText;
  gallery: AboutGalleryItem[];
  organizers: AboutOrganizer[];
  contacts: AboutContact[];
  partners: AboutPartner[];
};

export const ABOUT_PAGE_CONTENT: AboutPageContent = {
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
      role: { en: "Community organizer", ru: "Bad Boy, дед, ворчун" },
      contactLabel: "Telegram",
      contactValue: "@kinteus",
    },
    {
      name: "Анастасия Ивченко",
      role: { en: "Community organizer", ru: "Душа и сердце сообщества" },
      contactLabel: "Telegram",
      contactValue: "@ana_ivchenko",
    },
    {
      name: "Андрей Кротов",
      role: { en: "Community organizer", ru: "Машина, Властелин, Легенда" },
      contactLabel: "Telegram",
      contactValue: "@A_Krotov",
    },
    {
      name: "Алексей Бурсан",
      role: { en: "Community organizer", ru: "Серый кардинал" },
      contactLabel: "Telegram",
      contactValue: "@bodomic",
    },
    {
      name: "Алеся",
      role: { en: "Community organizer", ru: "Жизнерадостный ивент-мэйкер" },
      contactLabel: "Telegram",
      contactValue: "@alesichd",
    },
  ],
  contacts: [
    {
      label: "Telegram",
      value: "@kinteus",
    },
    {
      label: "Email",
      value: "maksim.naumov.music@gmail.com",
    },
    {
      label: "Phone",
      value: "+357 99 250122",
    },
  ],
  partners: [
    { name: "GoSound" },
    { name: "Muse" },
    { name: "Lyra" },
    { name: "Drum4Fun" },
  ],
};
