import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Disc3, Music2, Radio, Square } from "lucide-react";

import { ABOUT_PAGE_CONTENT } from "@/lib/about-page-content";
import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

import { Button } from "@/components/ui/button";
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

const partnerIcons = [Square, Music2, Radio, Disc3];

export default async function AboutPage() {
  const locale = await getLocale();
  const heroPhoto = ABOUT_PAGE_CONTENT.gallery[0];

  return (
    <div className="space-y-10">
      <section className="reference-section grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-3xl space-y-8 px-6 py-12 md:px-8 md:py-20">
          <p className="reference-kicker">{pick(locale, ABOUT_PAGE_CONTENT.badge)}</p>
          <div className="space-y-8">
            <h1 className="font-display text-6xl uppercase text-sand md:text-7xl">
              {pick(locale, ABOUT_PAGE_CONTENT.title)}
            </h1>
            <div className="max-w-2xl space-y-5 text-base leading-7 text-sand/68">
              <p>{pick(locale, ABOUT_PAGE_CONTENT.intro)}</p>
              <p>{pick(locale, ABOUT_PAGE_CONTENT.heroNote)}</p>
            </div>
          </div>
        </div>
        {heroPhoto ? (
          // Real gig photo fills the hero's right half (below the text on mobile).
          // next/image serves resized WebP/AVIF instead of the 4.8 MB original.
          <figure className="relative min-h-[16rem] lg:min-h-full" data-about-hero-photo>
            <Image
              alt={heroPhoto.alt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src={heroPhoto.src}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#151515] lg:via-transparent"
            />
          </figure>
        ) : null}
      </section>

      <section className="space-y-5">
        <div className="space-y-5">
          <p className="reference-kicker">{pick(locale, { en: "Get in touch", ru: "Связаться" })}</p>
          <h2 className="font-display text-4xl uppercase text-sand">
            {pick(locale, { en: "Talk to the team", ru: "Написать команде" })}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-sand/62">
            {pick(locale, {
              en: "For gigs, partnerships, coordination or anything that needs a real reply.",
              ru: "Про гиги, партнёрства, координацию и всё, где нужен живой ответ.",
            })}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-3">
            {ABOUT_PAGE_CONTENT.contacts.map((contact) => {
              const href =
                contact.href ??
                (contact.value.startsWith("@")
                  ? `https://t.me/${contact.value.slice(1)}`
                  : contact.value.includes("@")
                    ? `mailto:${contact.value}`
                    : undefined);
              const content = (
                <div className="reference-section flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sand/44">
                      {contact.label}
                    </p>
                    <p className="mt-2 text-sm font-bold text-sand">{contact.value}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-sand/72" />
                </div>
              );

              return href ? (
                <Link href={href} key={contact.label} rel="noreferrer" target="_blank">
                  {content}
                </Link>
              ) : (
                <div key={contact.label}>{content}</div>
              );
            })}
          </div>

          <Card className="space-y-5 px-6 py-6">
            <div className="space-y-3">
              <p className="reference-kicker">{pick(locale, ABOUT_PAGE_CONTENT.galleryLabel)}</p>
              <h3 className="font-display text-2xl uppercase text-sand">
                {pick(locale, ABOUT_PAGE_CONTENT.gallery[0]?.caption ?? { en: "Community moment", ru: "Момент сообщества" })}
              </h3>
              <p className="text-sm leading-6 text-sand/62">
                {pick(locale, {
                  en: "Photo gallery is wired up: future gig and backstage moments will land here.",
                  ru: "Галерея готова: будущие фото с гигов и backstage-моменты попадут сюда.",
                })}
              </p>
            </div>
            <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-white/10 bg-[repeating-linear-gradient(135deg,rgba(229,57,53,.16)_0,rgba(229,57,53,.16)_6px,rgba(255,179,0,.08)_6px,rgba(255,179,0,.08)_12px)] text-[11px] font-bold uppercase tracking-[0.28em] text-sand/45">
              [ Gallery preview ]
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-5">
          <p className="reference-kicker">{pick(locale, ABOUT_PAGE_CONTENT.organizersLabel)}</p>
          <h2 className="font-display text-4xl uppercase text-sand">
            {pick(locale, {
              en: "People moving the scene forward",
              ru: "Люди, которые двигают сцену дальше",
            })}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ABOUT_PAGE_CONTENT.organizers.map((organizer) => (
            <Card className="space-y-6 px-5 py-5" key={organizer.name}>
              <div className="space-y-4">
                <h3 className="font-display text-2xl uppercase text-sand">{organizer.name}</h3>
                <p className="text-sm text-sand/58">{organizer.role[locale]}</p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <a
                  className="text-sm font-bold text-gold hover:text-gold/80"
                  href={`https://t.me/${organizer.contactValue.replace(/^@/, "")}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {organizer.contactLabel} {organizer.contactValue} →
                </a>
              </div>
            </Card>
          ))}
          <Card className="space-y-5 border-gold/30 bg-gold/[0.055] px-5 py-5">
            <p className="reference-kicker">{pick(locale, { en: "Open seat", ru: "Свободное место" })}</p>
            <h3 className="font-display text-2xl uppercase text-sand">
              {pick(locale, { en: "Want to help?", ru: "Хочешь помочь?" })}
            </h3>
            <p className="text-sm leading-6 text-sand/62">
              {pick(locale, {
                en: "We're growing the crew: sound, photo, hospitality, anything in between.",
                ru: "Команда растёт: звук, фото, hospitality и всё между ними.",
              })}
            </p>
            <a className="text-sm font-bold text-gold" href="https://t.me/kinteus" rel="noreferrer" target="_blank">
              {pick(locale, { en: "Write to @kinteus", ru: "Написать @kinteus" })} →
            </a>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-5">
          <p className="reference-kicker">{pick(locale, ABOUT_PAGE_CONTENT.partnersLabel)}</p>
          <h2 className="font-display text-4xl uppercase text-sand">
            {pick(locale, {
              en: "Brands that lift the night",
              ru: "Бренды, которые усиливают вечер",
            })}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ABOUT_PAGE_CONTENT.partners.map((partner, index) => {
            const Icon = partnerIcons[index % partnerIcons.length] ?? Square;

            return (
              <Card className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-6 text-center" key={partner.name}>
                <Icon className="h-6 w-6 text-sand/45" />
                <h3 className="font-display text-2xl uppercase text-sand">{partner.name}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sand/45">
                  {pick(locale, { en: "Partner", ru: "Партнёр" })}
                </p>
              </Card>
            );
          })}
        </div>
        <Card className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-xl uppercase text-sand">
              {pick(locale, { en: "Want to be on this row?", ru: "Хочешь быть здесь?" })}
            </h3>
            <p className="mt-1 text-sm text-sand/62">
              {pick(locale, {
                en: "Venues, gear brands, studios, hospitality: write to the team.",
                ru: "Площадки, бренды, студии, hospitality: напиши команде.",
              })}
            </p>
          </div>
          <Button asChild variant="secondary">
            <a href="https://t.me/kinteus" rel="noreferrer" target="_blank">
              {pick(locale, { en: "Become a partner", ru: "Стать партнёром" })} →
            </a>
          </Button>
        </Card>
      </section>
    </div>
  );
}
