import { EventStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { getEventStatusLabel, pick } from "@/lib/i18n";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { normalizeVenueMapUrl } from "@/lib/url-security";
import { formatDateTime } from "@/lib/utils";
import { getHomePageData } from "@/server/query-data";

import { ArchiveStatsSection } from "@/components/archive-stats-section";
import { Badge } from "@/components/ui/badge";
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
    startsAt: Date;
    effectiveStatus: EventStatus;
    registrationOpensAt: Date | null;
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
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Open setlist", ru: "Открыть сетлист" }),
      },
      secondaryCta: {
        href: "/faq",
        label: pick(locale, { en: "Read FAQ", ru: "Открыть FAQ" }),
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
        ru: "Гиг уже виден на борде, но вписка и добавление песен откроются только со стартом регистрации. Пока есть время, лучше разобраться в правилах и логике борда.",
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
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Watch the board", ru: "Открыть борд" }),
      },
      secondaryCta: {
        href: "/faq",
        label: pick(locale, { en: "Read the rules", ru: "Понять правила" }),
      },
    };
  }

  if (
    event.effectiveStatus === EventStatus.CLOSED ||
    event.effectiveStatus === EventStatus.CURATING
  ) {
    return {
      title: pick(locale, {
        en: "Sign-up is closed",
        ru: "Набор уже закрыт",
      }),
      intro: pick(locale, {
        en: "The board is now in curation mode. The final setlist will be published soon, and everyone who made the final line-up will be notified.",
        ru: "Борд перешёл в режим кураторской сборки. Финальный сетлист скоро будет опубликован, а все, кто попал в итоговый лайнап, получат уведомление.",
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
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Review the board", ru: "Посмотреть борд" }),
      },
      secondaryCta: null,
    };
  }

  return {
    title: pick(locale, {
      en: "What needs attention on the next gig",
      ru: "Что сейчас просит внимания в ближайшем гиге",
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
    primaryCta: {
      href: `/events/${event.id}`,
      label: pick(locale, { en: "Review the board", ru: "Посмотреть борд" }),
    },
    secondaryCta: {
      href: "/faq",
      label: pick(locale, { en: "Read how it works", ru: "Как это работает" }),
    },
  };
}

export default async function HomePage() {
  let events;
  let publishedEvents;
  let archiveStats;
  let user;
  let locale;

  try {
    [{ events, publishedEvents, archiveStats }, user, locale] = await Promise.all([
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
          ru: "Живой борд временно недоступен",
        })}
      />
    );
  }

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
  const rightNowContent = featuredEvent
    ? getRightNowContent({
        event: featuredEvent,
        featuredRequiredOpenSeats,
        featuredTracksNeedingPlayers,
        locale,
      })
    : null;
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
      <section className="space-y-4">
        <Card className="brand-stage overflow-hidden border-gold/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_top_left,rgba(255,179,0,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(185,0,22,0.14),transparent_28%),#17120f] shadow-[0_22px_70px_rgba(0,0,0,0.34)]">
          <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-6">
            <div className="space-y-3">
              <Badge className="border-gold/30 bg-gold/16 text-[#fff3cf]">BETA</Badge>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand md:text-4xl">
                  {pick(locale, {
                    en: "The platform is live, but still evolving fast",
                    ru: "Платформа уже живая, но всё ещё быстро эволюционирует",
                  })}
                </h2>
                <p className="max-w-4xl text-sm leading-6 text-white/82 md:text-base">
                  {pick(locale, {
                    en: "Core flows are already usable for real gigs. Expect interface refinements, small workflow shifts, and quick improvements as we tighten the product with the community.",
                    ru: "Основные сценарии уже можно использовать для реальных гигов. При этом интерфейс, отдельные шаги и мелкие workflow-решения ещё будут быстро улучшаться по мере шлифовки продукта вместе с коммьюнити.",
                  })}
                </p>
              </div>
            </div>
            <div className="brand-shell-soft min-w-[220px] rounded-2xl px-4 py-4 text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "If something feels unclear or rough, the FAQ feedback form goes straight to the team.",
                ru: "Если что-то выглядит сыро или непонятно, форма обратной связи в FAQ сразу уходит команде.",
              })}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-6 border-b border-white/8 pb-8">
        <div className="brand-stage overflow-hidden rounded-[2rem] border border-white/10 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.38)] md:px-8 md:py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center space-y-7 text-center">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                {pick(locale, {
                  en: "Cyprus music community",
                  ru: "Музыкальное коммьюнити Кипра",
                })}
              </p>
              <h1 className="font-display text-5xl font-semibold uppercase tracking-[0.04em] text-sand md:text-7xl">
                {pick(locale, { en: "We Are The Jammers", ru: "Кто мы? The Jammers!" })}
              </h1>
              <p className="mx-auto max-w-3xl text-base leading-7 text-white/80">
                {pick(locale, {
                  en: "A fast live board for the Cyprus music crowd: open the next gig, see what songs are already in motion and jump into the line-up without friction.",
                  ru: "Живой борд для музыкального коммьюнити Кипра: открой ближайший гиг, быстро посмотри, какие песни уже в движении, и впишись в лайнап без лишней суеты.",
                })}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href={featuredEvent ? `/events/${featuredEvent.id}` : "#gigs"}>
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
              {rightNowContent
                ? rightNowContent.title
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
                <p className="text-sm leading-6 text-white/74">{rightNowContent?.intro}</p>
              </div>
              {rightNowContent && rightNowContent.stats.length > 0 ? (
                <div
                  className={rightNowContent.stats.length === 3 ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}
                >
                  {rightNowContent.stats.map((stat) => (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4" key={stat.label}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                      <div className="mt-2 text-3xl font-semibold text-sand">{stat.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Link href={rightNowContent?.primaryCta.href ?? `/events/${featuredEvent.id}`}>
                  <Button variant="secondary">
                    {rightNowContent?.primaryCta.label ??
                      pick(locale, { en: "Review the board", ru: "Посмотреть борд" })}
                  </Button>
                </Link>
                {rightNowContent?.secondaryCta ? (
                  <Link href={rightNowContent.secondaryCta.href}>
                    <Button variant="ghost">{rightNowContent.secondaryCta.label}</Button>
                  </Link>
                ) : null}
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
                    <Link href={`/events/${event.id}`}>
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
        <div className="space-y-3">
          {publishedEvents.map((event) => (
            <Card className="brand-shell rounded-[1.25rem] border-white/10 px-5 py-4" key={event.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
                    {event.title}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-sm text-white/66">
                    <span>
                      {event.setlistItems.length}{" "}
                      {pick(locale, { en: "main-set tracks", ru: "треков мейн-сета" })}
                    </span>
                    <span>{formatDateTime(event.startsAt, locale)}</span>
                  </div>
                </div>
                <Link href={`/events/${event.id}`}>
                  <Button variant="secondary">
                    {pick(locale, { en: "Open setlist", ru: "Открыть сетлист" })}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
