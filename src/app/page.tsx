import { EventStatus, TrackSeatStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Drum,
  Guitar,
  MicVocal,
  Piano,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { getRoleFamilyLabel, pick } from "@/lib/i18n";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { getRoleFamilyKey, type RoleFamilyKey } from "@/lib/role-families";
import { normalizeVenueMapUrl } from "@/lib/url-security";
import { formatDateTime } from "@/lib/utils";
import { getHomePageData } from "@/server/query-data";

import { ArchiveStatsSection } from "@/components/archive-stats-section";
import { CommunityQuotesCloud } from "@/components/community-quotes-cloud";
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
const PUBLISHED_LINEUP_FAMILY_ORDER: RoleFamilyKey[] = [
  "rhythm",
  "guitars",
  "bass",
  "vocals",
  "keys",
  "extras",
];
const PUBLISHED_LINEUP_ICONS: Record<RoleFamilyKey, LucideIcon> = {
  rhythm: Drum,
  guitars: Guitar,
  bass: AudioLines,
  vocals: MicVocal,
  keys: Piano,
  extras: Shapes,
};

function formatPublishedPlayerLabel(
  user: {
    telegramUsername: string | null;
    fullName: string | null;
  },
  locale: Awaited<ReturnType<typeof getLocale>>,
) {
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }

  return user.fullName ?? pick(locale, { en: "Assigned player", ru: "Назначенный музыкант" });
}

function buildPublishedLineupSummary(
  event: Awaited<ReturnType<typeof getHomePageData>>["publishedEvents"][number],
  locale: Awaited<ReturnType<typeof getLocale>>,
) {
  const familyMap = new Map<
    RoleFamilyKey,
    {
      family: RoleFamilyKey;
      label: string;
      occupiedSeats: number;
      players: string[];
    }
  >();

  for (const item of event.setlistItems) {
    for (const seat of item.track.seats) {
      if (seat.status !== TrackSeatStatus.CLAIMED || !seat.user) {
        continue;
      }

      const family = getRoleFamilyKey(seat.label);
      const entry = familyMap.get(family) ?? {
        family,
        label: getRoleFamilyLabel(family, locale),
        occupiedSeats: 0,
        players: [],
      };

      entry.occupiedSeats += 1;
      const playerLabel = formatPublishedPlayerLabel(seat.user, locale);
      if (!entry.players.includes(playerLabel)) {
        entry.players.push(playerLabel);
      }

      familyMap.set(family, entry);
    }
  }

  return PUBLISHED_LINEUP_FAMILY_ORDER.map((family) => familyMap.get(family)).filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );
}

function formatPublishedLineupMeta(
  players: string[],
  locale: Awaited<ReturnType<typeof getLocale>>,
) {
  if (players.length === 0) {
    return pick(locale, { en: "Assigned players", ru: "Назначенные музыканты" });
  }

  const visiblePlayers = players.slice(0, 2);
  const remainingPlayers = players.length - visiblePlayers.length;

  return visiblePlayers.join(", ").concat(
    remainingPlayers > 0
      ? pick(locale, {
          en: ` +${remainingPlayers} more`,
          ru: ` +${remainingPlayers} ещё`,
        })
      : "",
  );
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
      primaryCta: {
        href: `/events/${event.id}`,
        label: pick(locale, { en: "Review the locked board", ru: "Посмотреть закрытый сетлист" }),
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
      label: pick(locale, { en: "Open the board and fill a gap", ru: "Открыть сетлист и закрыть нехватку" }),
    },
    secondaryCta: {
      href: "/faq",
      label: pick(locale, { en: "New here? Read how it works", ru: "Новичок? Читать как это работает" }),
    },
  };
}

export default async function HomePage() {
  let events;
  let communityQuotes;
  let communityQuotesDesktopDisplayLimit;
  let communityQuotesMobileDisplayLimit;
  let publishedEvents;
  let archiveStats;
  let user;
  let locale;

  try {
    [{
      events,
      communityQuotes,
      communityQuotesDesktopDisplayLimit,
      communityQuotesMobileDisplayLimit,
      publishedEvents,
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
  return (
    <div className="home-page-shell relative isolate space-y-8 text-sand">
      <section className="space-y-4">
        <div className={HERO_FRAME_CLASS}>
          <div className="max-w-3xl rounded-[1.6rem] border border-dashed border-gold/26 bg-[linear-gradient(180deg,rgba(255,179,0,0.08),rgba(255,179,0,0.03)),rgba(16,14,13,0.92)] px-5 py-4 shadow-[0_16px_42px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-lg font-semibold uppercase tracking-[0.3em] text-gold md:text-xl">
                  BETA
                </p>
                <p className="max-w-2xl text-sm leading-6 text-white/74">
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
          <div className="brand-stage overflow-hidden rounded-[2rem] border border-white/10 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.38)] md:px-8 md:py-10">
            <div className="mx-auto flex max-w-4xl flex-col items-center space-y-7 text-center">
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
                <div className="mx-auto flex flex-wrap justify-center gap-3">
                  <Button asChild variant="primary">
                    <Link href={featuredEvent ? `/events/${featuredEvent.id}` : "#gigs"}>
                      {pick(locale, { en: "Open next gig board", ru: "Открыть сетлист ближайшего гига" })}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
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
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {pick(locale, { en: "Right now", ru: "Прямо сейчас" })}
            </div>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {rightNowContent
                ? rightNowContent.title
                : pick(locale, {
                    en: "Why the board matters",
                    ru: "Зачем вообще нужен этот сетлист",
                  })}
            </h2>
          </div>

          {featuredEvent ? (
            <>
              <div className="space-y-2">
                <p className="font-display text-2xl font-semibold tracking-[0.02em] text-sand">
                  {featuredEvent.title}
                </p>
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
          {publishedEvents.map((event) => {
            const lineupSummary = buildPublishedLineupSummary(event, locale);

            return (
              <Card className="brand-shell rounded-[1.25rem] border-white/10 px-5 py-4" key={event.id}>
                <div className="flex flex-col gap-4">
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
                    <Button asChild variant="secondary">
                      <Link href={`/events/${event.id}`}>
                        {pick(locale, { en: "Open setlist", ru: "Открыть сетлист" })}
                      </Link>
                    </Button>
                  </div>
                  {lineupSummary.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {lineupSummary.map((entry) => {
                        const Icon = PUBLISHED_LINEUP_ICONS[entry.family];

                        return (
                          <div
                            className="rounded-xl border border-white/10 bg-black/24 px-3 py-3"
                            key={`${event.id}-${entry.family}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/18 bg-gold/10 text-gold">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-sand">{entry.label}</p>
                                <p className="text-[11px] text-white/56">
                                  {formatPublishedLineupMeta(entry.players, locale)}
                                </p>
                              </div>
                              <span className="ml-auto rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] font-semibold text-white/82">
                                {entry.occupiedSeats}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
