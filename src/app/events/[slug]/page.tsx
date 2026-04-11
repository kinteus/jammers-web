import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";
import { ArrowRight, Clock3, LogIn } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  allowsClosedOptionalSeatRequests,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  getEventStatusLabel,
  getRoleFamilyLabel,
  pick,
  type Locale,
} from "@/lib/i18n";
import { getRoleFamilyKey, roleFamilyOrder, type RoleFamilyKey } from "@/lib/role-families";
import { getEventTrackInfoFields, getTrackInfoLabel } from "@/lib/track-info-flags";
import { env } from "@/lib/env";
import { cn, formatDateTime } from "@/lib/utils";
import {
  createTrackAction,
  requestSongCatalogAction,
  updateEventStatusAction,
} from "@/server/actions";
import { getEventWorkspace } from "@/server/query-data";

import { InstrumentToken } from "@/components/instrument-token";
import { EventBoardGuide } from "@/components/event-board-guide";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { TrackBoardFilters } from "@/components/track-board-filters";
import { TrackBoardTable } from "@/components/track-board-table";
import { TrackProposalComposer } from "@/components/track-proposal-composer";
import { TrackProposalDialog } from "@/components/track-proposal-dialog";
import { EventRegistrationCountdown } from "@/components/event-registration-countdown";
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
  let event = null;

  try {
    event = await getEventWorkspace(slug);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        title: "Event Temporarily Unavailable",
        description: "The event board is temporarily unavailable while the database connection is being restored.",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    throw error;
  }

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
      canonical: `/events/${event.id}`,
    },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: `/events/${event.id}`,
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

function getFloatingFeedback({
  error,
  locale,
  notice,
}: {
  error: string | null;
  locale: Locale;
  notice: string | null;
}) {
  if (notice === "seat-claimed") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "You're in", ru: "Ты в лайнапе" }),
      description: pick(locale, {
        en: "The seat was claimed and the board has been updated.",
        ru: "Место занято, борд уже обновлён.",
      }),
    };
  }

  if (notice === "opt-request-sent") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Request sent", ru: "Запрос отправлен" }),
      description: pick(locale, {
        en: "The track proposer will review your request.",
        ru: "Автор трека увидит и рассмотрит твой запрос.",
      }),
    };
  }

  if (notice === "opt-request-saved") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Saved", ru: "Сохранено" }),
      description: pick(locale, {
        en: "Your request is saved and visible to the track proposer.",
        ru: "Твой запрос сохранён и виден автору трека.",
      }),
    };
  }

  if (notice === "invite-sent") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Invite sent", ru: "Инвайт отправлен" }),
      description: pick(locale, {
        en: "The player now has a seat invite in the app and a Telegram message if their chat is linked.",
        ru: "У музыканта появился инвайт в приложении и сообщение в Telegram, если чат уже привязан.",
      }),
    };
  }

  if (notice === "invite-saved-without-telegram") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Invite saved, Telegram not delivered", ru: "Инвайт сохранён, Telegram не доставлен" }),
      description: pick(locale, {
        en: "The invite exists in the app, but Telegram delivery failed. Ask the player to sign in and check their profile invites.",
        ru: "Инвайт сохранён в приложении, но Telegram не доставился. Попроси музыканта войти в систему и проверить инвайты в профиле.",
      }),
    };
  }

  if (error === "seat-occupied") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Seat already taken", ru: "Место уже занято" }),
      description: pick(locale, {
        en: "Someone claimed this position first. Pick another open seat or refresh the board.",
        ru: "Кто-то занял это место раньше. Выбери другое открытое место или обнови борд.",
      }),
    };
  }

  if (error === "seat-unavailable") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Seat unavailable", ru: "Место недоступно" }),
      description: pick(locale, {
        en: "This position is currently disabled in the arrangement.",
        ru: "Эта позиция сейчас выключена в аранжировке.",
      }),
    };
  }

  if (error === "track-limit") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Track limit reached", ru: "Лимит треков достигнут" }),
      description: pick(locale, {
        en: "Leave one of your current songs before joining another one in this gig.",
        ru: "Сначала выпишись из одной из текущих песен, а потом вписывайся в новую.",
      }),
    };
  }

  if (error === "track-exists") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Song already on the board", ru: "Песня уже есть на борде" }),
      description: pick(locale, {
        en: "This song has already been proposed for the current gig.",
        ru: "Эта песня уже заявлена в текущий гиг.",
      }),
    };
  }

  if (error === "event-locked") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Gig locked", ru: "Гиг закрыт" }),
      description: pick(locale, {
        en: "Participant changes are closed for this gig right now.",
        ru: "Сейчас этот гиг закрыт для изменений участников.",
      }),
    };
  }

  if (error === "opt-request-exists") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Request already pending", ru: "Запрос уже отправлен" }),
      description: pick(locale, {
        en: "There is already a pending request for this optional seat.",
        ru: "Для этого optional-места уже есть ожидающий запрос.",
      }),
    };
  }

  if (error === "duplicate-role-family") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Already on this role", ru: "Эта роль уже занята тобой" }),
      description: pick(locale, {
        en: "You can join the same song multiple times only with different instrument families.",
        ru: "В одну песню можно вписаться несколько раз только на разные типы инструментов.",
      }),
    };
  }

  if (error === "invite-recipient-required") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Enter a username", ru: "Укажи username" }),
      description: pick(locale, {
        en: "Type the player's Telegram username before sending the invite.",
        ru: "Введи Telegram username музыканта перед отправкой инвайта.",
      }),
    };
  }

  if (error === "invite-recipient-not-found") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Player not found", ru: "Музыкант не найден" }),
      description: pick(locale, {
        en: "Invites work only for people who already created a profile in The Jammers.",
        ru: "Инвайты работают только для тех, кто уже создал профиль в The Jammers.",
      }),
    };
  }

  if (error === "invite-not-allowed") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Invite not allowed", ru: "Нельзя отправить инвайт" }),
      description: pick(locale, {
        en: "Only the track proposer or an admin can invite someone to this seat.",
        ru: "Позвать кого-то на это место может только автор трека или админ.",
      }),
    };
  }

  if (error === "invite-already-pending") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Invite already pending", ru: "Инвайт уже ожидает ответа" }),
      description: pick(locale, {
        en: "This player already has an active invite for the selected seat.",
        ru: "У этого музыканта уже есть активный инвайт на выбранное место.",
      }),
    };
  }

  if (error === "invite-track-limit") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Player hit the track limit", ru: "У музыканта достигнут лимит треков" }),
      description: pick(locale, {
        en: "They need to leave one of their current songs before you can place them on this track.",
        ru: "Сначала ему нужно выписаться из одной из текущих песен, и только потом можно поставить его сюда.",
      }),
    };
  }

  if (error === "invite-duplicate-role-family") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Player already covers this role", ru: "Музыкант уже закрывает эту роль" }),
      description: pick(locale, {
        en: "They can join the same song twice only on different instrument families.",
        ru: "В одну песню можно поставить человека дважды только на разные типы инструментов.",
      }),
    };
  }

  return null;
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  let event;
  let user;
  let locale;

  try {
    [event, user, locale] = await Promise.all([
      getEventWorkspace(slug),
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
          en: "This gig can't load right now",
          ru: "Сейчас этот гиг не загружается",
        })}
      />
    );
  }

  if (!event) {
    notFound();
  }

  if (slug !== event.id) {
    redirect(`/events/${event.id}`);
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
  const floatingFeedback = getFloatingFeedback({ error, locale, notice });

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
      effectiveStatus === "PUBLISHED" ? "EventCompleted" : "EventScheduled"
    }`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${env.NEXT_PUBLIC_APP_URL}/events/${event.id}`,
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
  const isAdmin = user?.role === "ADMIN";
  const registrationOpensSoon =
    effectiveStatus === "DRAFT" &&
    Boolean(event.registrationOpensAt && event.registrationOpensAt > new Date());

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

      {floatingFeedback ? (
        <div className="pointer-events-none fixed right-4 top-24 z-[90] w-[min(calc(100vw-2rem),26rem)]">
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur",
              floatingFeedback.tone === "success"
                ? "border-blue/40 bg-blue/18 text-white"
                : "border-red/40 bg-red/16 text-white",
            )}
            role="status"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/74">
              {floatingFeedback.tone === "success"
                ? pick(locale, { en: "Update", ru: "Обновление" })
                : pick(locale, { en: "Heads up", ru: "Внимание" })}
            </p>
            <p className="mt-1 font-semibold text-sand">{floatingFeedback.title}</p>
            <p className="mt-1 text-sm leading-6 text-white/82">{floatingFeedback.description}</p>
          </div>
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
              {registrationOpensSoon ? (
                <Badge className="border-gold/28 bg-gold/14 text-white">
                  {pick(locale, {
                    en: "Registration opens soon",
                    ru: "Скоро старт набора",
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
                <Link href={`/events/${event.id}?view=mine`}>
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
              {event.registrationOpensAt ? (
                <span>
                  {pick(locale, { en: "Registration opens:", ru: "Регистрация открывается:" })}{" "}
                  {formatDateTime(event.registrationOpensAt, locale)}
                </span>
              ) : null}
              <span>
                {pick(locale, { en: "Registration closes:", ru: "Регистрация закрывается:" })}{" "}
                {event.registrationClosesAt
                  ? formatDateTime(event.registrationClosesAt, locale)
                  : pick(locale, { en: "manual", ru: "вручную" })}
              </span>
              {trackInfoFields.length > 0 ? (
                <span>
                  {pick(locale, { en: "Extra flags:", ru: "Доп. флаги:" })}{" "}
                  {trackInfoFields.map((field) => getTrackInfoLabel(field, locale)).join(", ")}
                </span>
              ) : null}
            </div>

            {isAdmin ? (
              <Card className="brand-shell-soft space-y-3 border-white/10">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {pick(locale, { en: "Admin status control", ru: "Управление статусом" })}
                  </p>
                  <p className="text-sm leading-6 text-white/70">
                    {pick(locale, {
                      en: `Stored status: ${event.status}. Effective status now: ${effectiveStatus}.`,
                      ru: `Сохранённый статус: ${event.status}. Фактический статус сейчас: ${effectiveStatus}.`,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["DRAFT", "OPEN", "CLOSED", "CURATING", "PUBLISHED"].map((status) => (
                    <form action={updateEventStatusAction} key={status}>
                      <input name="eventId" type="hidden" value={event.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <input name="status" type="hidden" value={status} />
                      <Button
                        size="sm"
                        type="submit"
                        variant={event.status === status ? "primary" : "secondary"}
                      >
                        {status}
                      </Button>
                    </form>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </section>

      <EventBoardGuide
        allowClosedOptionalRequests={allowClosedOptionalRequests}
        locale={locale}
        optionalOpenSeatCount={optionalOpenSeatCount}
        requiredOpenSeatCount={requiredOpenSeatCount}
        roleShortages={roleShortages}
        tracksNeedingPlayers={tracksNeedingPlayers}
      />

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
                    <input name="eventSlug" type="hidden" value={event.id} />
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
            eventSlug={event.id}
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
              <input name="eventSlug" type="hidden" value={event.id} />
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

      {registrationOpensSoon && event.registrationOpensAt ? (
        <Card className="brand-shell space-y-4 border-gold/18 bg-gold/[0.06]">
          <Badge className="border-gold/26 bg-gold/14 text-white">
            {pick(locale, { en: "Registration countdown", ru: "Обратный отсчёт набора" })}
          </Badge>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-1 h-5 w-5 text-gold" />
            <div className="space-y-2">
              <p className="max-w-3xl text-sm leading-6 text-white/74">
                {pick(locale, {
                  en: "This gig is already visible, but song proposals and seat claims stay locked until registration starts.",
                  ru: "Этот гиг уже виден на борде, но добавление песен и вписка в партии откроются только со стартом регистрации.",
                })}
              </p>
              <p className="text-lg font-semibold text-sand">
                {pick(locale, { en: "Starts in:", ru: "Старт через:" })}{" "}
                <EventRegistrationCountdown locale={locale} target={event.registrationOpensAt} />
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {effectiveStatus !== "OPEN" && !registrationOpensSoon ? (
        <Card className="brand-shell space-y-3">
          <Badge className="border-white/10 bg-transparent text-white/62">
            {pick(locale, { en: "Board status", ru: "Статус борда" })}
          </Badge>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-1 h-5 w-5 text-blue" />
            <p className="max-w-3xl text-sm leading-6 text-white/68">
              {effectiveStatus === "CLOSED" || effectiveStatus === "CURATING"
                ? pick(locale, {
                    en: "Registration is closed for this gig. The board is now in review mode while admins lock the final set.",
                    ru: "Набор в этот гиг уже закрыт. Борд перешёл в режим просмотра, пока админы собирают финальный сет.",
                  })
                : pick(locale, {
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
