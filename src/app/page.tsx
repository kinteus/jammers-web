import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { getEventStatusLabel, pick } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { getHomePageData } from "@/server/query-data";

import { BrandLogo } from "@/components/brand-logo";
import { ArchiveStatsSection } from "@/components/archive-stats-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Gig Boards",
  description:
    "Track upcoming gigs, see which songs are already moving, and join the live line-up for The Jammers community.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "The Jammers",
    description:
      "Track upcoming gigs, see which songs are already moving, and join the live line-up for The Jammers community.",
    url: "/",
  },
};

export default async function HomePage() {
  const [{ events, publishedEvents, archiveStats }, user, locale] = await Promise.all([
    getHomePageData(),
    getCurrentUser(),
    getLocale(),
  ]);
  const now = Date.now();
  const featuredEvent =
    events
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ??
    events[0] ??
    null;
  const featuredRequiredOpenSeats = featuredEvent
    ? featuredEvent.tracks.reduce(
        (count, track) => count + getTrackCompletionSummary(track.seats).requiredOpen,
        0,
      )
    : 0;
  const featuredTracksNeedingPlayers = featuredEvent
    ? featuredEvent.tracks.filter((track) => !getTrackCompletionSummary(track.seats).isComplete).length
    : 0;
  const joiningSteps = [
    {
      title: pick(locale, { en: "Open the live board", ru: "Открой живой борд" }),
      body: pick(locale, {
        en: "Start with the current gig, not with a blank idea. The board already shows what the night actually needs.",
        ru: "Начинай с текущего гига, а не с абстрактной идеи. На борде уже видно, что именно нужно этому вечеру.",
      }),
    },
    {
      title: pick(locale, { en: "Fill real gaps first", ru: "Сначала закрой нехватку" }),
      body: pick(locale, {
        en: "If you can cover an open role, take it first. This keeps the line-up healthier before more songs are added.",
        ru: "Если можешь закрыть открытую роль, сначала займи её. Так лайнап крепнет до того, как накидывать новые песни.",
      }),
    },
    {
      title: pick(locale, { en: "Propose only after checking", ru: "Предлагай после проверки" }),
      body: pick(locale, {
        en: "New songs are strongest when they do not duplicate what is already moving on the board.",
        ru: "Новые песни лучше всего заходят, когда не дублируют то, что уже движется на борде.",
      }),
    },
  ];

  return (
    <div className="space-y-8 text-sand">
      <section className="space-y-6 border-b border-white/8 pb-8">
        <div className="brand-stage overflow-hidden rounded-[2rem] border border-white/10 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.38)] md:px-8 md:py-10">
          <div className="mx-auto max-w-6xl space-y-7">
            <div className="max-w-[820px]">
              <BrandLogo className="w-full" priority variant="dark" />
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                {pick(locale, {
                  en: "Cyprus music community",
                  ru: "Музыкальное коммьюнити Кипра",
                })}
              </p>
              <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-sand md:text-6xl">
                {pick(locale, { en: "We Are The Jammers", ru: "Кто мы? The Jammers!" })}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-white/80">
                {pick(locale, {
                  en: "A fast live board for the Cyprus music crowd: open the next gig, see what songs are already in motion and jump into the line-up without friction.",
                  ru: "Живой борд для музыкального коммьюнити Кипра: открой ближайший гиг, быстро посмотри, какие песни уже в движении, и впишись в лайнап без лишней суеты.",
                })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={featuredEvent ? `/events/${featuredEvent.slug}` : "#gigs"}>
                  <Button variant="primary">
                    {pick(locale, { en: "Go to next gig", ru: "Открыть ближайший гиг" })}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="secondary">
                    {user
                      ? pick(locale, { en: "Open profile", ru: "Открыть профиль" })
                      : pick(locale, { en: "Sign in to join", ru: "Войти и вписаться" })}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Card className="brand-shell border-gold/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%),radial-gradient(circle_at_top_right,rgba(185,0,22,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,179,0,0.12),transparent_24%),#191512]">
          <div className="flex flex-wrap items-start gap-3">
            <Badge className="border-gold/30 bg-gold/14 text-[#fff3cf]">BETA</Badge>
            <p className="max-w-4xl text-sm leading-6 text-white/78">
              {pick(locale, {
                en: "The site is running in beta mode. Core flows are already live, but some edges may still change while we polish the experience with the community.",
                ru: "Сайт работает в BETA-режиме. Основные сценарии уже доступны, но часть деталей ещё может меняться, пока мы дошлифовываем опыт вместе с коммьюнити.",
              })}
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="brand-shell space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "First gig?", ru: "Первый гиг?" })}
            </p>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {pick(locale, {
                en: "How to join without slowing the board down",
                ru: "Как влиться и не затормозить борд",
              })}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {joiningSteps.map((step, index) => (
              <div className="brand-shell-soft rounded-xl p-4" key={step.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                  0{index + 1}
                </p>
                <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-sand">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/72">{step.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="brand-stage space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Right now", ru: "Прямо сейчас" })}
            </p>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {featuredEvent
                ? pick(locale, {
                    en: "What needs attention on the next gig",
                    ru: "Что сейчас просит внимания в ближайшем гиге",
                  })
                : pick(locale, {
                    en: "Why the board matters",
                    ru: "Зачем вообще нужен этот борд",
                  })}
            </h2>
          </div>

          {featuredEvent ? (
            <>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-sand">{featuredEvent.title}</p>
                <p className="text-sm leading-6 text-white/74">
                  {pick(locale, {
                    en: "The healthiest next move is usually to close open seats before adding more weight to the set.",
                    ru: "Лучший следующий шаг почти всегда один: сначала закрыть открытые места, а уже потом утяжелять сет новыми песнями.",
                  })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {pick(locale, { en: "Required seats open", ru: "Открыто обязательных мест" })}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-sand">{featuredRequiredOpenSeats}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {pick(locale, { en: "Tracks needing players", ru: "Треков ждут людей" })}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-sand">{featuredTracksNeedingPlayers}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {pick(locale, { en: "Players already in", ru: "Музыкантов уже в деле" })}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-sand">{featuredEvent.participantCount}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/events/${featuredEvent.slug}`}>
                  <Button variant="secondary">
                    {pick(locale, { en: "Review the board", ru: "Посмотреть борд" })}
                  </Button>
                </Link>
                <Link href="/faq">
                  <Button variant="ghost">
                    {pick(locale, { en: "Read how it works", ru: "Как это работает" })}
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "The board gives the community one shared source of truth: what songs exist, who is still missing, and which setlists already made it to the stage.",
                ru: "Борд даёт коммьюнити единый источник правды: какие песни уже есть, кого ещё не хватает и какие сетлисты уже добрались до сцены.",
              })}
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Next up", ru: "Ближайший гиг" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, {
              en: "What the next gig looks like right now",
              ru: "Что сейчас происходит в ближайшем гиге",
            })}
          </h2>
        </div>
        <Card className="brand-shell border-white/10 p-0">
          <div className="h-1 w-full stage-rule" />
          <div className="space-y-4 p-5">
            {featuredEvent ? (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-blue/24 bg-blue/16 text-white">
                      {getEventStatusLabel(featuredEvent.effectiveStatus, locale)}
                    </Badge>
                    <span className="text-sm text-white/58">
                      {formatDateTime(featuredEvent.startsAt, locale)} ·{" "}
                      {featuredEvent.venueName ??
                        pick(locale, { en: "Venue TBD", ru: "Площадка уточняется" })}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
                    {featuredEvent.title}
                  </h3>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="brand-shell-soft rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      {pick(locale, { en: "Tracks proposed", ru: "Заявлено треков" })}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-sand">{featuredEvent.trackCount}</p>
                  </div>
                  <div className="brand-shell-soft rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      {pick(locale, { en: "Tracks assembled", ru: "Собрано треков" })}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-sand">
                      {featuredEvent.completedTrackCount}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/events/${featuredEvent.slug}`}>
                    <Button variant="secondary">
                      {pick(locale, { en: "Go to gig board", ru: "Перейти к борду гига" })}
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm leading-6 text-white/68">
                {pick(locale, {
                  en: "Once the next gig is ready, this block becomes the fastest way into the live board.",
                  ru: "Как только появится следующий гиг, этот блок станет самым быстрым входом в живой борд.",
                })}
              </p>
            )}
          </div>
        </Card>
      </section>

      <section className="space-y-4" id="gigs">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Gigs", ru: "Гиги" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, { en: "Upcoming gig boards", ru: "Ближайшие гиги" })}
          </h2>
        </div>

        {events.length === 0 ? (
          <Card className="brand-shell">
            <p className="text-sm leading-6 text-white/68">
              {pick(locale, {
                en: "No gigs yet. The next event will appear here as the public entry point into the live board.",
                ru: "Пока нет гигов. Следующее событие появится здесь как главный публичный вход в живой борд.",
              })}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Card className="brand-shell rounded-[1.5rem] border-white/10" key={event.id}>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-blue/24 bg-blue/16 text-white">
                        {getEventStatusLabel(event.effectiveStatus, locale)}
                      </Badge>
                      <span className="text-sm text-white/58">
                        {formatDateTime(event.startsAt, locale)} ·{" "}
                        {event.venueName ?? pick(locale, { en: "Venue TBD", ru: "Площадка уточняется" })}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                      {event.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-white/62">
                      <span>
                        {event.trackCount} {pick(locale, { en: "proposed", ru: "заявлено" })}
                      </span>
                      <span>
                        {event.completedTrackCount} {pick(locale, { en: "assembled", ru: "собрано" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Link href={`/events/${event.slug}`}>
                      <Button variant="secondary">
                        {pick(locale, { en: "Open gig", ru: "Открыть гиг" })}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ArchiveStatsSection locale={locale} stats={archiveStats} />

      <section className="space-y-4 border-t border-white/8 pt-8" id="published">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Published", ru: "Опубликовано" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, { en: "Released setlists", ru: "Опубликованные сетлисты" })}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {publishedEvents.map((event) => (
            <Card className="brand-shell rounded-[1.4rem] border-white/10" key={event.id}>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {event.title}
              </h3>
              <p className="text-sm leading-6 text-white/68">
                {event.setlistItems.length}{" "}
                {pick(locale, { en: "main-set tracks released for", ru: "треков мейн-сета для" })}{" "}
                {formatDateTime(event.startsAt, locale)}.
              </p>
              <Link href={`/events/${event.slug}`}>
                <Button variant="secondary">
                  {pick(locale, { en: "Open setlist", ru: "Открыть сетлист" })}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
