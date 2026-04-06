import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";
import { ArrowRight, Clock3, LogIn } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  allowsClosedOptionalSeatRequests,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import {
  getEventStatusLabel,
  getRoleFamilyLabel,
  pick,
  type Locale,
} from "@/lib/i18n";
import { getRoleFamilyKey, roleFamilyOrder, type RoleFamilyKey } from "@/lib/role-families";
import { getEventTrackInfoFields } from "@/lib/track-info-flags";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import { createTrackAction, requestSongCatalogAction } from "@/server/actions";
import { getEventWorkspace } from "@/server/query-data";

import { InstrumentToken } from "@/components/instrument-token";
import { TrackBoardFilters } from "@/components/track-board-filters";
import { TrackBoardTable } from "@/components/track-board-table";
import { TrackProposalComposer } from "@/components/track-proposal-composer";
import { TrackProposalDialog } from "@/components/track-proposal-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<EventPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventWorkspace(slug);

  if (!event) {
    return {
      title: "Event Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  const venueLabel = event.venueName ? ` at ${event.venueName}` : "";
  const description =
    event.description?.trim() ||
    `${event.title}${venueLabel} on ${dateLabel}. See the live board, current line-up, and published setlist details.`;

  return {
    title: event.title,
    description,
    alternates: {
      canonical: `/events/${event.slug}`,
    },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: `/events/${event.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
  };
}

function getRoleShortages(
  tracks: Array<{
    seats: Array<{
      label: string;
      status: TrackSeatStatus;
      isOptional: boolean;
    }>;
  }>,
) {
  const roleCounts = new Map<string, number>();

  for (const track of tracks) {
    for (const seat of track.seats) {
      if (seat.status !== TrackSeatStatus.OPEN || seat.isOptional) {
        continue;
      }

      roleCounts.set(seat.label, (roleCounts.get(seat.label) ?? 0) + 1);
    }
  }

  return [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function parseRoleFilters(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is RoleFamilyKey =>
      roleFamilyOrder.includes(entry as RoleFamilyKey),
    );
}

function filterLabel(locale: Locale, view: "all" | "open" | "mine") {
  if (view === "mine") {
    return pick(locale, { en: "Your current songs", ru: "Твои текущие песни" });
  }
  if (view === "open") {
    return pick(locale, {
      en: "Songs still looking for players",
      ru: "Песни, где ещё нужны музыканты",
    });
  }
  return pick(locale, { en: "Songs already proposed", ru: "Песни, уже предложенные в гиг" });
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const [event, user, locale] = await Promise.all([
    getEventWorkspace(slug),
    getCurrentUser(),
    getLocale(),
  ]);

  if (!event) {
    notFound();
  }

  const effectiveStatus = getEffectiveEventStatus(event);
  const notice =
    typeof resolvedSearchParams.notice === "string" ? resolvedSearchParams.notice : null;
  const error =
    typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const requestedView =
    typeof resolvedSearchParams.view === "string"
      ? resolvedSearchParams.view
      : resolvedSearchParams.mine === "1"
        ? "mine"
        : "all";
  const searchQuery =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";
  const roleFilters = parseRoleFilters(resolvedSearchParams.roles);
  const searchNeedle = searchQuery.toLowerCase();
  const activeView =
    requestedView === "mine" && user
      ? "mine"
      : requestedView === "open"
        ? "open"
        : "all";

  const roleOptions = roleFamilyOrder.filter((family) =>
    event.lineupSlots.some((slot) => getRoleFamilyKey(slot.label, slot.key) === family),
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: event.title,
    description: event.description ?? undefined,
    startDate: new Date(event.startsAt).toISOString(),
    eventStatus: `https://schema.org/${
      effectiveStatus === "PUBLISHED"
        ? "EventCompleted"
        : effectiveStatus === "CLOSED"
          ? "EventPostponed"
          : "EventScheduled"
    }`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${env.NEXT_PUBLIC_APP_URL}/events/${event.slug}`,
    location: event.venueName
      ? {
          "@type": "Place",
          name: event.venueName,
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: "The Jammers",
      url: env.NEXT_PUBLIC_APP_URL,
    },
  };

  const visibleTracks = event.tracks.filter((track) => {
    const matchesSearch =
      searchNeedle.length === 0 ||
      [
        track.song.title,
        track.song.artist.name,
        track.proposedBy.telegramUsername ? `@${track.proposedBy.telegramUsername}` : null,
        track.proposedBy.fullName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchNeedle);

    if (!matchesSearch) {
      return false;
    }

    const matchesRoles =
      roleFilters.length === 0 ||
      roleFilters.every((role) =>
        track.seats.some(
          (seat) =>
            seat.status === TrackSeatStatus.OPEN &&
            getRoleFamilyKey(seat.label, seat.lineupSlot?.key ?? "") === role,
        ),
      );

    if (!matchesRoles) {
      return false;
    }

    if (activeView === "mine" && user) {
      return track.seats.some((seat) => seat.userId === user.id);
    }
    if (activeView === "open") {
      return !getTrackCompletionSummary(track.seats).isComplete;
    }
    return true;
  });

  const participantCount = new Set(
    event.tracks.flatMap((track) => track.seats.map((seat) => seat.userId).filter(Boolean)),
  ).size;
  const requiredOpenSeatCount = event.tracks.reduce(
    (count, track) => count + getTrackCompletionSummary(track.seats).requiredOpen,
    0,
  );
  const optionalOpenSeatCount = event.tracks.reduce(
    (count, track) => count + getTrackCompletionSummary(track.seats).optionalOpen,
    0,
  );
  const completedTrackCount = event.tracks.filter((track) =>
    getTrackCompletionSummary(track.seats).isComplete,
  ).length;
  const tracksNeedingPlayers = event.tracks.filter(
    (track) => !getTrackCompletionSummary(track.seats).isComplete,
  ).length;
  const roleShortages = getRoleShortages(event.tracks);
  const selectedRoleLabel = roleFilters.map((role) => getRoleFamilyLabel(role, locale)).join(" + ");
  const allowClosedOptionalRequests = allowsClosedOptionalSeatRequests(event);
  const trackInfoFields = getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback);

  return (
    <div className="space-y-8 text-sand">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      {notice === "track-created" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "The song is now on the board.",
            ru: "Песня появилась на борде.",
          })}
        </div>
      ) : null}

      {notice === "song-requested" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Admins received the song request. As soon as it lands in the catalog, you can add it to the board.",
            ru: "Админы получили запрос на песню. Как только она появится в каталоге, её можно будет добавить на борд.",
          })}
        </div>
      ) : null}

      {notice === "seat-claimed" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Seat taken. You're in the line-up now.",
            ru: "Место занято. Ты теперь в лайнапе.",
          })}
        </div>
      ) : null}

      {notice === "opt-request-sent" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Request sent to the track proposer. The line-up will update after approval.",
            ru: "Запрос отправлен автору трека. Лайнап обновится после одобрения.",
          })}
        </div>
      ) : null}

      {notice === "opt-request-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "The request is saved. The track author will still see it in the app.",
            ru: "Запрос сохранён. Автор трека всё равно увидит его в приложении.",
          })}
        </div>
      ) : null}

      {error === "track-exists" ? (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "This song is already on the current gig board.",
            ru: "Эта песня уже есть на текущем борде.",
          })}
        </div>
      ) : null}

      {error === "event-locked" ? (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "This gig is locked for participant changes right now.",
            ru: "Этот гиг сейчас закрыт для изменений участников.",
          })}
        </div>
      ) : null}

      {error === "opt-request-exists" ? (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "There is already a pending request for this optional seat.",
            ru: "Для этого optional-места уже есть ожидающий запрос.",
          })}
        </div>
      ) : null}

      <section className="border-b border-white/8 pb-8">
        <div className="brand-stage rounded-[1.8rem] border border-white/10 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] md:px-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue/24 bg-blue/16 text-white">
                {getEventStatusLabel(effectiveStatus, locale)}
              </Badge>
              {effectiveStatus === "OPEN" ? (
                <Badge className="border-red/24 bg-red/14 text-white">
                  {pick(locale, {
                    en: "Fill the board before adding songs",
                    ru: "Сначала закрывай борд, потом добавляй песни",
                  })}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-sand lg:text-5xl">
                {event.title}
              </h1>
              <p className="text-sm text-white/58">
                {formatDateTime(event.startsAt, locale)} ·{" "}
                {event.venueName ?? pick(locale, { en: "Venue TBD", ru: "Площадка уточняется" })}
              </p>
              {event.description ? (
                <p className="max-w-4xl text-base leading-7 text-white/78">{event.description}</p>
              ) : (
                <p className="max-w-4xl text-base leading-7 text-white/78">
                  {pick(locale, {
                    en: "Open the board fast, scan what still needs people, and strengthen the gig before adding more weight to the set.",
                    ru: "Сначала быстро открой борд, пойми, где ещё нужны люди, и усили гиг, прежде чем добавлять новые песни в сет.",
                  })}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="brand-shell-soft rounded-xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {pick(locale, { en: "Tracks proposed", ru: "Заявлено треков" })}
                </p>
                <p className="mt-1 text-3xl font-semibold text-sand">{event.tracks.length}</p>
              </div>
              <div className="brand-shell-soft rounded-xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {pick(locale, { en: "Tracks assembled", ru: "Собрано треков" })}
                </p>
                <p className="mt-1 text-3xl font-semibold text-sand">{completedTrackCount}</p>
              </div>
              <div className="brand-shell-soft rounded-xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {pick(locale, { en: "Required seats open", ru: "Открыто обязательных мест" })}
                </p>
                <p className="mt-1 text-3xl font-semibold text-sand">{requiredOpenSeatCount}</p>
              </div>
              <div className="brand-shell-soft rounded-xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {pick(locale, { en: "Players committed", ru: "Музыкантов в лайнапе" })}
                </p>
                <p className="mt-1 text-3xl font-semibold text-sand">{participantCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="#track-board">
                  {pick(locale, { en: "Jump to songs", ru: "К песням" })}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              {user ? (
                <Link href={`/events/${slug}?view=mine`}>
                  <Button variant="secondary">
                    {pick(locale, { en: "My songs", ru: "Мои песни" })}
                  </Button>
                </Link>
              ) : effectiveStatus === "OPEN" ? (
                <Link href="/profile">
                  <Button variant="secondary">
                    <LogIn className="mr-2 h-4 w-4" />
                    {pick(locale, { en: "Sign in to join", ru: "Войти и вписаться" })}
                  </Button>
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-white/58">
              <span>
                {pick(locale, { en: "Registration closes:", ru: "Регистрация закрывается:" })}{" "}
                {event.registrationClosesAt
                  ? formatDateTime(event.registrationClosesAt, locale)
                  : pick(locale, { en: "manual", ru: "вручную" })}
              </span>
              {trackInfoFields.length > 0 ? (
                <span>
                  {pick(locale, { en: "Extra flags:", ru: "Доп. флаги:" })}{" "}
                  {trackInfoFields.map((field) => field.label).join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4" id="track-board">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Songs first", ru: "Сначала песни" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {filterLabel(locale, activeView)}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-white/68">
            {pick(locale, {
              en: "Start here: scan the songs, filter what you need and take the part you can really cover.",
              ru: "Начинай отсюда: смотри песни, быстро фильтруй нужное и занимай ту партию, которую реально можешь закрыть.",
            })}
          </p>
          {roleFilters.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/62">
              {pick(locale, { en: "Open role focus", ru: "Фокус по открытым ролям" })}: {selectedRoleLabel}
            </p>
          ) : null}
        </div>

        <Card className="brand-shell space-y-4 border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TrackBoardFilters
              activeView={activeView}
              locale={locale}
              roleOptions={roleOptions}
              searchQuery={searchQuery}
              selectedRoles={roleFilters}
              showMineView={Boolean(user)}
              visibleCount={visibleTracks.length}
            />

            <div className="flex flex-wrap items-center gap-2">
              {user && effectiveStatus === "OPEN" ? (
                <TrackProposalDialog locale={locale}>
                  <form action={createTrackAction} className="space-y-5">
                    <input name="eventId" type="hidden" value={event.id} />
                    <input name="eventSlug" type="hidden" value={event.slug} />
                    <TrackProposalComposer
                      lineupSlots={event.lineupSlots}
                      locale={locale}
                      trackInfoFields={trackInfoFields}
                    />
                    <div className="flex justify-end">
                      <SubmitButton className="min-w-[220px]" pendingLabel={pick(locale, { en: "Adding track...", ru: "Добавляем трек..." })} type="submit">
                        {pick(locale, { en: "Publish proposal to board", ru: "Опубликовать трек на борде" })}
                      </SubmitButton>
                    </div>
                  </form>
                </TrackProposalDialog>
              ) : null}
              {!user && effectiveStatus === "OPEN" ? (
                <Link href="/profile">
                  <Button size="sm" variant="secondary">
                    <LogIn className="mr-2 h-4 w-4" />
                    {pick(locale, { en: "Sign in to join", ru: "Войти и вписаться" })}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/62">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red" />
              {requiredOpenSeatCount} {pick(locale, { en: "required open", ru: "обязательных открыто" })}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2">
              <Clock3 className="h-3.5 w-3.5 text-blue" />
              {tracksNeedingPlayers} {pick(locale, { en: "tracks need players", ru: "треков ждут людей" })}
            </span>
            {optionalOpenSeatCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-blue" />
                {optionalOpenSeatCount} {pick(locale, { en: "optional open", ru: "optional открыто" })}
              </span>
            ) : null}
          </div>
        </Card>

        {visibleTracks.length === 0 ? (
          <Card className="brand-shell">
            <p className="text-sm leading-6 text-white/68">
              {activeView === "mine"
                ? pick(locale, {
                    en: "You are not part of any songs here yet.",
                    ru: "Ты пока не участвуешь ни в одной из этих песен.",
                  })
                : activeView === "open"
                  ? pick(locale, {
                      en: "Every visible song is already assembled.",
                      ru: "Все видимые песни уже собраны.",
                    })
                  : pick(locale, {
                      en: "This gig does not have song proposals yet.",
                      ru: "В этом гиге пока нет заявленных песен.",
                    })}
            </p>
          </Card>
        ) : (
          <TrackBoardTable
            allowClosedOptionalRequests={allowClosedOptionalRequests}
            eventSlug={event.slug}
            isOpen={effectiveStatus === "OPEN"}
            lineupSlots={event.lineupSlots}
            locale={locale}
            trackInfoFields={trackInfoFields}
            tracks={visibleTracks}
            user={
              user
                ? {
                    id: user.id,
                    role: user.role,
                    telegramUsername: user.telegramUsername,
                    fullName: user.fullName,
                  }
                : null
            }
          />
        )}
      </section>

      <details className="group brand-shell overflow-hidden rounded-xl border-white/10">
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/65 transition hover:bg-white/6">
          <span>{pick(locale, { en: "Board context and line-up map", ru: "Контекст борда и карта лайнапа" })}</span>
          <span className="text-[10px] text-white/38 group-open:hidden">
            {pick(locale, { en: "Expand", ru: "Открыть" })}
          </span>
          <span className="hidden text-[10px] text-white/38 group-open:inline">
            {pick(locale, { en: "Collapse", ru: "Свернуть" })}
          </span>
        </summary>
        <div className="grid gap-4 border-t border-white/10 p-5 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Most needed roles", ru: "Самые нужные роли" })}
            </p>
            {roleShortages.length === 0 ? (
              <p className="text-sm leading-6 text-white/68">
                {pick(locale, {
                  en: "No required open parts right now. The current proposals are assembled, so review can stay focused on the existing board.",
                  ru: "Сейчас обязательных открытых мест нет. Текущие заявки уже собраны, так что можно просто спокойно просмотреть борд.",
                })}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {roleShortages.map(([label, count]) => (
                  <div className="brand-shell-soft flex items-center justify-between gap-3 rounded-xl px-4 py-3" key={label}>
                    <InstrumentToken
                      className="flex-1 border-transparent bg-transparent px-0 py-0"
                      compact
                      label={label}
                      locale={locale}
                      meta={pick(locale, {
                        en: count === 1 ? "1 open part" : `${count} open parts`,
                        ru: count === 1 ? "1 открытая партия" : `${count} открытые партии`,
                      })}
                    />
                    <span className="text-sm font-semibold text-gold">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Line-up map", ru: "Карта лайнапа" })}
            </p>
            <div className="grid gap-3">
              {event.lineupSlots.map((slot) => (
                <div className="brand-shell-soft flex items-center justify-between gap-3 rounded-xl px-4 py-3" key={slot.id}>
                  <InstrumentToken
                    className="flex-1 border-transparent bg-transparent px-0 py-0"
                    compact
                    keyHint={slot.key}
                    label={slot.label}
                    locale={locale}
                    meta={pick(locale, {
                      en: slot.allowOptional ? "Optional allowed" : "Required only",
                      ru: slot.allowOptional ? "Optional разрешён" : "Только обязательные",
                    })}
                  />
                  <span className="text-sm text-white/60">
                    {slot.seatCount}{" "}
                    {pick(locale, {
                      en: slot.seatCount === 1 ? "seat" : "seats",
                      ru: slot.seatCount === 1 ? "место" : "места",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {effectiveStatus === "PUBLISHED" ? (
        <section className="space-y-4 border-t border-white/8 pt-8">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Published", ru: "Опубликовано" })}
            </p>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {pick(locale, { en: "Final running order", ru: "Финальный порядок" })}
            </h2>
          </div>
          <div className="grid gap-3">
            {event.setlistItems
              .filter((item) => item.section === "MAIN")
              .map((item) => (
                <Card className="brand-shell space-y-2" key={item.id}>
                  <p className="font-semibold text-sand">
                    {item.orderIndex}. {item.track.song.artist.name} - {item.track.song.title}
                  </p>
                  <p className="text-sm leading-6 text-white/68">
                    {item.track.seats
                      .filter((seat) => seat.user)
                      .map(
                        (seat) =>
                          `${seat.label}: @${seat.user?.telegramUsername ?? seat.user?.fullName}`,
                      )
                      .join(", ")}
                  </p>
                </Card>
              ))}
          </div>
        </section>
      ) : null}

      {effectiveStatus === "OPEN" && user ? (
        <section className="space-y-4 border-t border-white/8 pt-8" id="missing-song-request">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Missing song", ru: "Нет нужной песни" })}
            </p>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
              {pick(locale, { en: "Can't find it in search?", ru: "Не нашёл в поиске?" })}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-white/68">
              {pick(locale, {
                en: "Request a catalog addition only after searching the board and the song database first.",
                ru: "Проси добавить песню в каталог только после того, как проверил и борд, и поисковую базу песен.",
              })}
            </p>
          </div>
          <Card className="brand-shell">
            <form action={requestSongCatalogAction} className="grid gap-4 lg:grid-cols-2">
              <input name="eventSlug" type="hidden" value={event.slug} />
              <label className="block space-y-2 text-sm text-sand">
                <span>{pick(locale, { en: "Artist", ru: "Артист" })}</span>
                <input className="w-full px-4 py-3" name="artistName" required />
              </label>
              <label className="block space-y-2 text-sm text-sand">
                <span>{pick(locale, { en: "Track title", ru: "Название трека" })}</span>
                <input className="w-full px-4 py-3" name="trackTitle" required />
              </label>
              <label className="block space-y-2 text-sm text-sand lg:col-span-2">
                <span>{pick(locale, { en: "Comment", ru: "Комментарий" })}</span>
                <textarea className="min-h-24 w-full px-4 py-3" name="comment" />
              </label>
              <div className="lg:col-span-2">
                <SubmitButton
                  pendingLabel={pick(locale, { en: "Sending request...", ru: "Отправляем запрос..." })}
                  type="submit"
                  variant="secondary"
                >
                  {pick(locale, { en: "Ask admins to add the song", ru: "Попросить админов добавить песню" })}
                </SubmitButton>
              </div>
            </form>
          </Card>
        </section>
      ) : null}

      {effectiveStatus !== "OPEN" ? (
        <Card className="brand-shell space-y-3">
          <Badge className="border-white/10 bg-transparent text-white/62">
            {pick(locale, { en: "Board status", ru: "Статус борда" })}
          </Badge>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-1 h-5 w-5 text-blue" />
            <p className="max-w-3xl text-sm leading-6 text-white/68">
              {pick(locale, {
                en: "This gig is no longer editable, so the page shifts into inspection mode: review the proposed songs, the final line-up state and, when published, the released order.",
                ru: "Этот гиг больше нельзя редактировать, поэтому страница переходит в режим просмотра: можно изучить предложенные песни, финальный лайнап и, если сет уже опубликован, итоговый порядок.",
              })}
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
