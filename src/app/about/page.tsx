import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ABOUT_PAGE_CONTENT } from "@/lib/about-page-content";
import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About Us",
  description: "Meet The Jammers organizers, community, contacts, and partners.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    title: "About Us",
    description: "Meet The Jammers organizers, community, contacts, and partners.",
    url: "/about",
    images: [
      {
        url: "/brand/the-jammers-logo.png",
        width: 1200,
        height: 630,
        alt: "The Jammers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us",
    description: "Meet The Jammers organizers, community, contacts, and partners.",
    images: ["/brand/the-jammers-logo.png"],
  },
};

export default async function AboutPage() {
  const locale = await getLocale();
  const heroImage = ABOUT_PAGE_CONTENT.gallery[0];

  return (
    <div className="space-y-8">
      <section className="brand-stage relative overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.46)]">
        <div className="absolute inset-0">
          <Image
            alt={heroImage.alt}
            className="h-full w-full object-cover object-center opacity-72"
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            src={heroImage.src}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,0.18),rgba(7,7,7,0.72)_42%,rgba(7,7,7,0.94)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_50%_100%,rgba(255,179,0,0.18),transparent_60%)]" />
        </div>

        <div className="relative z-10 flex min-h-[560px] flex-col justify-end px-6 py-8 sm:px-8 lg:px-10">
          <div className="max-w-3xl space-y-4">
            <Badge className="border-gold/24 bg-black/24 text-sand">
              {pick(locale, ABOUT_PAGE_CONTENT.badge)}
            </Badge>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">
                {pick(locale, ABOUT_PAGE_CONTENT.eyebrow)}
              </h2>
              <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.03em] text-sand sm:text-5xl">
                {pick(locale, ABOUT_PAGE_CONTENT.title)}
              </h1>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
              {pick(locale, ABOUT_PAGE_CONTENT.intro)}
            </p>
            <p className="max-w-2xl text-sm leading-7 text-white/66">
              {pick(locale, ABOUT_PAGE_CONTENT.heroNote)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="brand-shell rounded-[1.6rem] border-white/10 p-5 sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/52">
                {pick(locale, ABOUT_PAGE_CONTENT.galleryLabel)}
              </p>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {heroImage.caption[locale]}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_220px]">
              <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/20">
                <div className="relative aspect-[16/10]">
                  <Image
                    alt={heroImage.alt}
                    className="h-full w-full object-cover"
                    fill
                    sizes="(min-width: 1024px) 720px, 100vw"
                    src={heroImage.src}
                  />
                </div>
              </div>
              <div className="brand-shell-soft rounded-[1.25rem] p-4">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                      01
                    </p>
                    <p className="text-sm leading-6 text-white/74">
                      {pick(locale, {
                        en: "The gallery is ready for more images later, so new nights, backstage details, and partner moments can expand this page without changing its structure.",
                        ru: "Галерея уже готова к новым фото, так что следующие вечера, backstage-моменты и кадры с партнёрами можно будет добавить без перестройки страницы.",
                      })}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/44">
                    {pick(locale, {
                      en: "Future-ready photo rail",
                      ru: "Готово для расширения галереи",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="brand-stage rounded-[1.6rem] border-white/10 p-5 sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/52">
                {pick(locale, ABOUT_PAGE_CONTENT.contactsLabel)}
              </p>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, {
                  en: "Reach the team",
                  ru: "Связаться с командой",
                })}
              </h2>
            </div>
            <p className="text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "Write to the team about gigs, partnerships, song coordination, or anything that needs a human answer.",
                ru: "Пиши команде про гиги, партнёрства, координацию песен и всё, где нужен живой ответ.",
              })}
            </p>
            <div className="space-y-3">
              {ABOUT_PAGE_CONTENT.contacts.map((contact) => {
                const content = (
                  <div className="brand-shell-soft flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                        {contact.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-sand">{contact.value}</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.16em] text-gold">
                      {pick(locale, { en: "Contact", ru: "Контакт" })}
                    </span>
                  </div>
                );

                return contact.href ? (
                  <Link href={contact.href} key={contact.label} target="_blank">
                    {content}
                  </Link>
                ) : (
                  <div key={contact.label}>{content}</div>
                );
              })}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/52">
            {pick(locale, ABOUT_PAGE_CONTENT.organizersLabel)}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, {
              en: "People who keep the scene moving",
              ru: "Люди, которые двигают сцену дальше",
            })}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ABOUT_PAGE_CONTENT.organizers.map((organizer) => (
            <Card className="brand-shell rounded-[1.35rem] border-white/10 p-5" key={organizer.name}>
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
                    {organizer.name}
                  </h3>
                  <p className="text-sm text-white/66">{organizer.role[locale]}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    {organizer.contactLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-sand">{organizer.contactValue}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-white/8 pt-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/52">
            {pick(locale, ABOUT_PAGE_CONTENT.partnersLabel)}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, {
              en: "Partners who amplify the night",
              ru: "Партнёры, которые усиливают вечер",
            })}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ABOUT_PAGE_CONTENT.partners.map((partner) => {
            const card = (
              <Card className="brand-shell-soft rounded-[1.25rem] border-white/10 p-5" key={partner.name}>
                <div className="flex min-h-[132px] flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      {pick(locale, {
                        en: "Partner slot",
                        ru: "Слот партнёра",
                      })}
                    </p>
                    <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                      {partner.name}
                    </h3>
                  </div>
                  <p className="text-sm leading-6 text-white/66">
                    {pick(locale, {
                      en: partner.href
                        ? "External link and optional logo are supported here."
                        : "Ready for a future logo and external link when they are available.",
                      ru: partner.href
                        ? "Здесь уже поддерживаются внешняя ссылка и необязательный логотип."
                        : "Здесь готово место для будущего логотипа и внешней ссылки.",
                    })}
                  </p>
                </div>
              </Card>
            );

            return partner.href ? (
              <Link href={partner.href} key={partner.name} target="_blank">
                {card}
              </Link>
            ) : (
              card
            );
          })}
        </div>
      </section>
    </div>
  );
}
