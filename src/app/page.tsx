import { EventStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getHomeFeaturedSortTime,
  isHomeFeaturedEventCandidate,
} from "@/lib/domain/home-featured-event";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { normalizeVenueMapUrl } from "@/lib/url-security";
import { formatDateTime } from "@/lib/utils";
import { getHomePageData } from "@/server/query-data";

import { ArchiveStatsSection } from "@/components/archive-stats-section";
import { CommunityQuotesCloud } from "@/components/community-quotes-cloud";
import { EventRegistrationCountdown } from "@/components/event-registration-countdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";

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

const HERO_FRAME_CLASS = "mx-auto max-w-[1360px]";

function formatGigDate(value: Date | string, locale: Awaited<ReturnType<typeof getLocale>>) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatGigTime(value: Date | string, locale: Awaited<ReturnType<typeof getLocale>>) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRightNowContent({
  event,
  featuredRequiredOpenSeats,
  featuredTracksNeedingPlayers,
  locale,
}: {
  event: {
    id: string;
    title: string;
    venueName: string | null;
    venueMapUrl: string | null;
    startsAt: Date | string;
    effectiveStatus: EventStatus;
    registrationOpensAt: Date | string | null;
    participantCount: number;
  };
  featuredRequiredOpenSeats: number;
  featuredTracksNeedingPlayers: number;
  locale: Awaited<ReturnType<typeof getLocale>>;
}) {
  const safeVenueMapUrl = normalizeVenueMapUrl(event.venueMapUrl);
  const venueValue: ReactNode = event.venueName ? (
    safeVenueMapUrl ? (
      <a
        className="text-gold transition hover:text-gold/80 hover:underline"
        href={safeVenueMapUrl}
        rel="noreferrer"
        target="_blank"
      >
        {event.venueName}
      </a>
    ) : (
      event.venueName
    )
  ) : (
    pick(locale, { en: "Venue TBD", ru: "Площадка уточняется" })
  );
  const eventDetails = [
    {
      label: pick(locale, { en: "Date", ru: "Дата" }),
      value: formatGigDate(event.startsAt, locale),
    },
    {
      label: pick(locale, { en: "Time", ru: "Время" }),
      value: formatGigTime(event.startsAt, locale),
    },
    {
      label: pick(locale, { en: "Venue", ru: "Место" }),
      value: venueValue,
    },
  ];

  if (event.effectiveStatus === EventStatus.PUBLISHED) {
    return {
      title: pick(locale, {
        en: "The setlist is live",
        ru: "Сетлист уже опубликован",
      }),
      intro: pick(locale, {
        en: "The nearest gig is already locked in. Check the venue details, then use the FAQ if you need a quick reminder on the technical side of the night.",
        ru: "Ближайший гиг уже зафиксирован. Проверь площадку, а затем загляни в FAQ, если нужно быстро освежить технические детали вечера.",
      }),
      stats: [
        {
          label: pick(locale, { en: "Venue", ru: "Площадка" }),
          value: venueValue,
        },
        {
          label: pick(locale, { en: "Gig date", ru: "Дата гига" }),
          value: formatDateTime(event.startsAt, locale),
        },
      ],
      eventDetails,
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "See the final setlist", ru: "Открыть финальный сетлист" }),
      },
      secondaryCta: {
        href: "/faq",
        label: pick(locale, { en: "Need the details? Read FAQ", ru: "Нужны детали? Читать FAQ" }),
      },
    };
  }

  if (event.effectiveStatus === EventStatus.DRAFT) {
    return {
      title: pick(locale, {
        en: "Registration is not open yet",
        ru: "Регистрация ещё не открыта",
      }),
      intro: pick(locale, {
        en: "The gig is already visible on the board, but sign-up and song proposals unlock only after registration opens. Use the waiting time to review the rules and board logic.",
        ru: "Гиг уже появился в сетлисте, но вписка и добавление песен откроются только со стартом регистрации. Пока есть время, лучше разобраться в правилах и логике сетлиста.",
      }),
      stats: [
        {
          label: pick(locale, { en: "Registration opens", ru: "Регистрация откроется" }),
          value:
            event.registrationOpensAt !== null
              ? formatDateTime(event.registrationOpensAt, locale)
              : pick(locale, { en: "TBA", ru: "Скоро" }),
        },
        {
          label: pick(locale, { en: "Gig date", ru: "Дата гига" }),
          value: formatDateTime(event.startsAt, locale),
        },
      ],
      eventDetails,
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Watch this gig board", ru: "Следить за этим сетлистом" }),
      },
      secondaryCta: {
        href: "/faq",
        label: pick(locale, { en: "Don't know the rules yet?", ru: "Ещё не знаешь правила?" }),
      },
    };
  }

  if (event.effectiveStatus === EventStatus.CLOSED) {
    return {
      title: pick(locale, {
        en: "Sign-up is closed",
        ru: "Набор уже закрыт",
      }),
      intro: pick(locale, {
        en: "The board is now in curation mode. The final setlist will be published soon, and everyone who made the final line-up will be notified.",
        ru: "Сетлист перешёл в режим кураторской сборки. Финальный сетлист скоро будет опубликован, а все, кто попал в итоговый лайнап, получат уведомление.",
      }),
      stats: [
        {
          label: pick(locale, { en: "Players already in", ru: "Музыкантов уже в деле" }),
          value: String(event.participantCount),
        },
        {
          label: pick(locale, { en: "Gig date", ru: "Дата гига" }),
          value: formatDateTime(event.startsAt, locale),
        },
      ],
      eventDetails,
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Review the locked board", ru: "Посмотреть закрытый сетлист" }),
      },
      secondaryCta: null,
    };
  }

  return {
    title: pick(locale, {
      en: "Open seats on the board",
      ru: "Открытые места в сетлисте",
    }),
    intro: pick(locale, {
      en: "The healthiest next move is usually to close open seats before adding more weight to the set.",
      ru: "Лучший следующий шаг почти всегда один: сначала закрыть открытые места, а уже потом утяжелять сет новыми песнями.",
    }),
    stats: [
      {
        label: pick(locale, { en: "Required seats open", ru: "Открыто обязательных мест" }),
        value: String(featuredRequiredOpenSeats),
      },
      {
        label: pick(locale, { en: "Tracks needing players", ru: "Треков ждут людей" }),
        value: String(featuredTracksNeedingPlayers),
      },
      {
        label: pick(locale, { en: "Players already in", ru: "Музыкантов уже в деле" }),
        value: String(event.participantCount),
      },
    ],
    eventDetails,
    primaryCta: {
      href: `/events/${event.id}`,
      label: pick(locale, { en: "Open the board and fill a gap", ru: "Открыть сетлист и закрыть нехватку" }),
    },
    secondaryCta: {
      href: "/faq",
      label: pick(locale, { en: "New here? Read how it works", ru: "Читать как это работает" }),
    },
  };
}

export default async function HomePage() {
  let events;
  let communityQuotes;
  let communityQuotesDesktopDisplayLimit;
  let communityQuotesMobileDisplayLimit;
  let archiveStats;
  let user;
  let locale;

  try {
    [{
      events,
      communityQuotes,
      communityQuotesDesktopDisplayLimit,
      communityQuotesMobileDisplayLimit,
      archiveStats,
    }, user, locale] = await Promise.all([
      getHomePageData(),
      getCurrentUser(),
      getLocale(),
    ]);
  } catch (error) {
    locale = await getLocale();

    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return (
      <DatabaseUnavailableState
        locale={locale}
        title={pick(locale, {
          en: "The live board is temporarily unavailable",
          ru: "Живой сетлист временно недоступен",
        })}
      />
    );
  }

  const now = Date.now();
  const featuredEvent =
    events
      .filter((event) => isHomeFeaturedEventCandidate(event, now))
      .sort((a, b) => getHomeFeaturedSortTime(a, now) - getHomeFeaturedSortTime(b, now))[0] ??
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
  const rightNowContent = featuredEvent
    ? getRightNowContent({
        event: featuredEvent,
        featuredRequiredOpenSeats,
        featuredTracksNeedingPlayers,
        locale,
      })
    : null;
  const isFeaturedLive =
    featuredEvent?.effectiveStatus === EventStatus.PUBLISHED &&
    new Date(featuredEvent.startsAt).getTime() <= now;
  return (
    <div className="home-page-shell relative isolate space-y-8 text-sand">
      <section className="space-y-4">
        <div className={HERO_FRAME_CLASS}>
          <div className="rounded-xl border border-dashed border-gold/28 bg-gold/[0.035] px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="reference-kicker">
                  BETA
                </p>
                <p className="max-w-2xl text-sm leading-6 text-sand/62">
                  {pick(locale, {
                    en: "Some edges are still rough. If a flow feels unclear or breaks, send feedback from the FAQ form.",
                    ru: "Некоторые части ещё сыроваты. Если сценарий непонятен или что-то ломается, отправь feedback через форму в FAQ.",
                  })}
                </p>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                {pick(locale, {
                  en: "Temporary build zone",
                  ru: "Временная зона доработки",
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className={`${HERO_FRAME_CLASS} border-b border-white/8 pb-8`}>
          <div className="reference-hero px-6 py-10 md:px-8 md:py-14">
            <div className="mx-auto flex max-w-4xl flex-col items-center space-y-7 text-center">
              <div className="space-y-4">
                <p className="reference-kicker">
                  {pick(locale, {
                    en: "Cyprus music community",
                    ru: "Музыкальное коммьюнити Кипра",
                  })}
                </p>
                <h1 className="font-display text-5xl uppercase text-sand md:text-7xl">
                  {pick(locale, { en: "We Are The Jammers", ru: "Кто мы? The Jammers!" })}
                </h1>
                <p className="mx-auto max-w-xl text-base leading-7 text-sand/60">
                  {pick(locale, {
                    en: "Where strangers become bandmates and songs turn into living setlists. One jam at a time.",
                    ru: "Здесь незнакомые люди становятся составом, а песни превращаются в живые сетлисты. Джем за джемом.",
                  })}
                </p>
                <div className="mx-auto flex flex-wrap justify-center gap-3">
                  {featuredEvent ? (
                    <Button asChild variant="primary">
                      <Link href={`/events/${featuredEvent.id}`}>
                        {pick(locale, { en: "Open next gig board", ru: "Открыть сетлист ближайшего гига" })}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="secondary">
                    <Link href="/profile">
                      {user
                        ? pick(locale, { en: "Open my profile", ru: "Открыть мой профиль" })
                        : pick(locale, { en: "Sign in with Telegram", ru: "Войти через Telegram" })}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CommunityQuotesCloud
        desktopDisplayLimit={communityQuotesDesktopDisplayLimit}
        locale={locale}
        mobileDisplayLimit={communityQuotesMobileDisplayLimit}
        quotes={communityQuotes}
      />

      <section className={`${HERO_FRAME_CLASS} space-y-4`}>
        <Card className="brand-shell-soft flex flex-col gap-4 rounded-[1.5rem] px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Need orientation?", ru: "Нужна ориентация?" })}
            </p>
            <p className="text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "New here? The FAQ explains the board logic, joining rules, and what to do before proposing songs.",
                ru: "Новичок? В FAQ объяснены логика сетлиста, правила вписки и то, что стоит сделать до предложения песен.",
              })}
            </p>
          </div>
          <div className="shrink-0">
            <Button asChild variant="secondary">
              <Link href="/faq">
                {pick(locale, {
                  en: "Read the FAQ",
                  ru: "Открыть FAQ",
                })}
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="brand-stage relative overflow-hidden space-y-5 border border-gold/18 px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.44)] sm:px-6 sm:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-6 h-24 w-24 rounded-full bg-gold/10 blur-3xl"
          />
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/18 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              <span className={isFeaturedLive ? "h-1.5 w-1.5 animate-pulse rounded-full bg-red" : "h-1.5 w-1.5 rounded-full bg-gold"} />
              {isFeaturedLive
                ? pick(locale, { en: "Happening right now", ru: "Идёт прямо сейчас" })
                : pick(locale, { en: "Right now", ru: "Прямо сейчас" })}
            </div>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {featuredEvent ? (
                <>
                  {pick(locale, { en: "Next gig", ru: "Следующий гиг" })}:{" "}
                  <span className="text-gold">{featuredEvent.title}</span>
                </>
              ) : rightNowContent ? (
                rightNowContent.title
              ) : (
                pick(locale, {
                  en: "Why the board matters",
                  ru: "Зачем вообще нужен этот сетлист",
                })
              )}
            </h2>
          </div>

          {featuredEvent ? (
            <>
              <div className="space-y-3">
                {rightNowContent?.eventDetails ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {rightNowContent.eventDetails.map((detail) => (
                      <div
                        className="rounded-xl border border-white/12 bg-black/28 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        key={detail.label}
                      >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{detail.label}</p>
                        <div className="mt-1 text-base font-semibold leading-6 text-sand">{detail.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm leading-6 text-white/74">{rightNowContent?.intro}</p>
              </div>
              {rightNowContent && rightNowContent.stats.length > 0 ? (
                <div
                  className={rightNowContent.stats.length === 3 ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}
                >
                  {rightNowContent.stats.map((stat) => (
                    <div
                      className="rounded-xl border border-white/12 bg-black/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      key={stat.label}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                      <div className="mt-2 text-3xl font-semibold text-sand">{stat.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {featuredEvent ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {featuredEvent.registrationOpensAt && featuredEvent.effectiveStatus === EventStatus.DRAFT ? (
                    <div className="rounded-xl border border-gold/18 bg-black/28 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                        {pick(locale, { en: "Board opens in", ru: "Таблица откроется через" })}
                      </p>
                      <p className="mt-1 text-lg">
                        <EventRegistrationCountdown
                          initialNowMs={now}
                          locale={locale}
                          refreshOnComplete
                          target={featuredEvent.registrationOpensAt}
                        />
                      </p>
                    </div>
                  ) : null}
                  {featuredEvent.registrationClosesAt && featuredEvent.effectiveStatus === EventStatus.OPEN ? (
                    <div className="rounded-xl border border-red/18 bg-black/28 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                        {pick(locale, { en: "Board closes in", ru: "Таблица закроется через" })}
                      </p>
                      <p className="mt-1 text-lg">
                        <EventRegistrationCountdown
                          initialNowMs={now}
                          locale={locale}
                          onCompleteLabel={pick(locale, { en: "Registration is closed", ru: "Набор закрыт" })}
                          refreshOnComplete
                          target={featuredEvent.registrationClosesAt}
                        />
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-white/12 bg-black/28 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      {pick(locale, { en: "Gig starts in", ru: "Гиг начнётся через" })}
                    </p>
                    <p className="mt-1 text-lg">
                      <EventRegistrationCountdown
                        initialNowMs={now}
                        locale={locale}
                        onCompleteLabel={pick(locale, { en: "Happening now", ru: "Идёт прямо сейчас" })}
                        refreshOnComplete
                        target={featuredEvent.startsAt}
                      />
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary">
                  <Link href={rightNowContent?.primaryCta.href ?? `/events/${featuredEvent.id}`}>
                    {rightNowContent?.primaryCta.label ??
                      pick(locale, { en: "Review the board", ru: "Посмотреть сетлист" })}
                  </Link>
                </Button>
                {rightNowContent?.secondaryCta ? (
                  <Button asChild variant="ghost">
                    <Link href={rightNowContent.secondaryCta.href}>
                      {rightNowContent.secondaryCta.label}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "The board gives the community one shared source of truth: what songs exist, who is still missing, and which setlists already made it to the stage.",
                ru: "Сетлист даёт коммьюнити единый источник правды: какие песни уже есть, кого ещё не хватает и какие сетлисты уже добрались до сцены.",
              })}
            </p>
          )}
        </Card>
      </section>

      <ArchiveStatsSection locale={locale} stats={archiveStats} />

      <section className="flex flex-col gap-4 border-t border-white/8 pt-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Published setlists", ru: "Опубликованные сетлисты" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, { en: "Archive lives separately now", ru: "Архив теперь на отдельной странице" })}
          </h2>
        </div>
        <Button asChild variant="secondary">
          <Link href="/archive">
            {pick(locale, { en: "Open archive", ru: "Открыть архив" })}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
