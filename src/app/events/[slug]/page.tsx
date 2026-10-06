import { headers } from "next/headers";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Clock3, LogIn } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  allowsClosedOptionalSeatRequests,
  getAllowedNextEventStatuses,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import { countLineupParticipants, matchesRoleFilters } from "@/lib/event-board";
import { getGigDisplayTitle } from "@/lib/gig-title";
import { getTrackBoardEmptyState } from "@/lib/event-board-copy";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  COUNT_FORMS,
  formatCount,
  getEventStatusActionConfirm,
  getEventStatusActionLabel,
  getEventStatusLabel,
  getRoleFamilyLabel,
  pick,
  type Locale,
} from "@/lib/i18n";
import { getRoleFamilyKey, roleFamilyOrder, type RoleFamilyKey } from "@/lib/role-families";
import { getEventTrackInfoFields } from "@/lib/track-info-flags";
import { serializeJsonForHtmlScript } from "@/lib/html-script";
import { env } from "@/lib/env";
import { cn, formatDateTime, formatEventDateShort, formatEventTime } from "@/lib/utils";
import { countJoinedTracks } from "@/lib/domain/rules";
import {
  createTrackAction,
  updateEventStatusAction,
} from "@/server/actions";
import { getEventWorkspace } from "@/server/query-data";

import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { BoardRealtimeRefresh } from "@/components/board-realtime-refresh";
import { SignInLink } from "@/components/sign-in-link";
import { TrackBoardFilters } from "@/components/track-board-filters";
import { TrackBoardTable } from "@/components/track-board-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

const EventRegistrationCountdown = nextDynamic(
  () =>
    import("@/components/event-registration-countdown").then(
      (module) => module.EventRegistrationCountdown,
    ),
  {
    loading: () => <span className="font-semibold text-sand">...</span>,
  },
);

const FloatingToast = nextDynamic(
  () => import("@/components/floating-toast").then((module) => module.FloatingToast),
);

const TrackProposalLauncher = nextDynamic(
  () =>
    import("@/components/track-proposal-launcher").then(
      (module) => module.TrackProposalLauncher,
    ),
);

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
        title: "Gig Temporarily Unavailable",
        description: "The gig board is temporarily unavailable while the database connection is being restored.",
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
      title: "Gig Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const gigTitle = getGigDisplayTitle(event, await getLocale());
  const dateLabel = `${formatEventDateShort(event.startsAt)}, ${formatEventTime(event.startsAt)}`;
  const venueLabel = event.venueName ? ` at ${event.venueName}` : "";
  const description =
    event.description?.trim() ||
    `${gigTitle}${venueLabel} on ${dateLabel}. See the live board, who is in which seat, and published setlist details.`;

  return {
    title: gigTitle,
    description,
    alternates: {
      canonical: `/events/${event.id}`,
    },
    openGraph: {
      type: "article",
      title: gigTitle,
      description,
      url: `/events/${event.id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: gigTitle,
      description,
    },
  };
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
      en: "Songs still looking for participants",
      ru: "Песни, где ещё нужны участники",
    });
  }
  return pick(locale, { en: "Songs already proposed", ru: "Песни, уже предложенные в гиг" });
}

function getFloatingFeedback({
  error,
  locale,
  notice,
  minRequired,
  maxTracks,
}: {
  error: string | null;
  locale: Locale;
  notice: string | null;
  minRequired?: number | null;
  maxTracks?: number | null;
}) {
  if (notice === "seat-claimed") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "You're in", ru: "Ты в составе" }),
      description: pick(locale, {
        en: "The seat was claimed and the board has been updated.",
        ru: "Место занято, таблица уже обновлена.",
      }),
    };
  }

  if (notice === "track-updated") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Song updated", ru: "Песня обновлена" }),
      description: pick(locale, {
        en: "The arrangement changes are saved and the board has been updated.",
        ru: "Изменения аранжировки сохранены, таблица уже обновлена.",
      }),
    };
  }

  if (notice === "opt-request-sent") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Request sent", ru: "Запрос отправлен" }),
      description: pick(locale, {
        en: "The proposer will review your request.",
        ru: "Автор заявки увидит и рассмотрит твой запрос.",
      }),
    };
  }

  if (notice === "opt-request-saved") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Saved", ru: "Сохранено" }),
      description: pick(locale, {
        en: "Your request is saved and visible to the proposer.",
        ru: "Твой запрос сохранён и виден автору заявки.",
      }),
    };
  }

  if (notice === "invite-sent") {
    return {
      tone: "success" as const,
      title: pick(locale, { en: "Invite sent", ru: "Инвайт отправлен" }),
      description: pick(locale, {
        en: "The participant now has a seat invite in the app and a Telegram message if their chat is linked.",
        ru: "У участника появился инвайт в приложении и сообщение в Telegram, если чат уже привязан.",
      }),
    };
  }

  if (notice === "invite-saved-without-telegram") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Invite saved, Telegram not delivered", ru: "Инвайт сохранён, Telegram не доставлен" }),
      description: pick(locale, {
        en: "The invite exists in the app, but Telegram delivery failed. Ask the participant to sign in and check their profile invites.",
        ru: "Инвайт сохранён в приложении, но Telegram не доставился. Попроси участника войти в систему и проверить инвайты в профиле.",
      }),
    };
  }

  if (error === "seat-occupied") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Seat already taken", ru: "Место уже занято" }),
      description: pick(locale, {
        en: "Someone claimed this seat first. Pick another open seat or refresh the board.",
        ru: "Кто-то занял это место раньше. Выбери другое открытое место или обнови таблицу.",
      }),
    };
  }

  if (error === "seat-unavailable") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Seat unavailable", ru: "Место недоступно" }),
      description: pick(locale, {
        en: "This seat is currently disabled in the arrangement.",
        ru: "Это место сейчас выключено в аранжировке.",
      }),
    };
  }

  if (error === "track-limit") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Song limit reached", ru: "Лимит песен достигнут" }),
      description: pick(locale, {
        en: "Leave one of your current songs before joining another one in this gig.",
        ru: "Сначала выпишись из одной из текущих песен, а потом вписывайся в новую.",
      }),
    };
  }

  if (error === "track-exists") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Song already on the board", ru: "Песня уже есть в таблице" }),
      description: pick(locale, {
        en: "This song has already been proposed for the current gig.",
        ru: "Эта песня уже заявлена в текущий гиг.",
      }),
    };
  }

  if (error === "min-required-seats") {
    const requiredCount = minRequired && minRequired > 0 ? minRequired : null;
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Too few required seats", ru: "Слишком мало обязательных мест" }),
      description: requiredCount
        ? pick(locale, {
            en: `This gig needs at least ${requiredCount} required seats per song. Mark more seats as required before publishing the song.`,
            ru: `Этому гигу нужно минимум ${requiredCount} обязательных мест на песню. Оставь больше мест обязательными перед публикацией песни.`,
          })
        : pick(locale, {
            en: "This gig has a minimum number of required seats per song. Mark more seats as required before publishing the song.",
            ru: "У этого гига задан минимум обязательных мест на песню. Оставь больше мест обязательными перед публикацией песни.",
          }),
    };
  }

  if (error === "no-song-selected") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "No song chosen", ru: "Песня не выбрана" }),
      description: pick(locale, {
        en: "Pick a song from the search results before publishing the proposal.",
        ru: "Выбери песню из результатов поиска, прежде чем публиковать заявку в таблицу.",
      }),
    };
  }

  if (error === "username-required") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Telegram username needed", ru: "Нужен Telegram-ник" }),
      description: pick(locale, {
        en: "Set your Telegram username in your profile before changing the board.",
        ru: "Укажи свой Telegram-ник в профиле, прежде чем менять таблицу.",
      }),
    };
  }

  if (error === "no-self-seat") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Add yourself first", ru: "Сначала впишись сам" }),
      description: pick(locale, {
        en: "You must take at least one seat yourself before proposing a song.",
        ru: "Нельзя предложить песню, не вписав себя хотя бы на одно место.",
      }),
    };
  }

  if (error === "track-limit") {
    const limit = maxTracks && maxTracks > 0 ? maxTracks : null;
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Song limit reached", ru: "Достигнут лимит песен" }),
      description: limit
        ? pick(locale, {
            en: `You can join at most ${limit} songs on this gig. Leave one of your current songs before proposing another with yourself in it.`,
            ru: `На этом гиге можно участвовать максимум в ${limit} песнях. Выпишись из одной из текущих песен, прежде чем предлагать новую с собой в составе.`,
          })
        : pick(locale, {
            en: "You have reached this gig's song limit. Leave one of your current songs before proposing another with yourself in it.",
            ru: "Ты достиг лимита песен на этом гиге. Выпишись из одной из текущих песен, прежде чем предлагать новую с собой в составе.",
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
      title: pick(locale, { en: "Already on this instrument", ru: "На этом инструменте ты уже есть" }),
      description: pick(locale, {
        en: "You can join the same song multiple times only on different instruments.",
        ru: "В одну песню можно вписаться несколько раз только на разные типы инструментов.",
      }),
    };
  }

  if (error === "invite-recipient-required") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Enter a username", ru: "Укажи username" }),
      description: pick(locale, {
        en: "Type the participant's Telegram username before sending the invite.",
        ru: "Введи Telegram username участника перед отправкой инвайта.",
      }),
    };
  }

  if (error === "invite-recipient-not-found") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Participant not found", ru: "Участник не найден" }),
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
        en: "Only the proposer or an admin can invite someone to this seat.",
        ru: "Позвать кого-то на это место может только автор заявки или админ.",
      }),
    };
  }

  if (error === "invite-already-pending") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Invite already pending", ru: "Инвайт уже ожидает ответа" }),
      description: pick(locale, {
        en: "This participant already has an active invite for the selected seat.",
        ru: "У этого участника уже есть активный инвайт на выбранное место.",
      }),
    };
  }

  if (error === "invite-track-limit") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Participant hit the song limit", ru: "У участника достигнут лимит песен" }),
      description: pick(locale, {
        en: "They need to leave one of their current songs before you can place them on this song.",
        ru: "Сначала ему нужно выписаться из одной из текущих песен, и только потом можно поставить его сюда.",
      }),
    };
  }

  if (error === "invite-duplicate-role-family") {
    return {
      tone: "error" as const,
      title: pick(locale, { en: "Participant already plays this instrument here", ru: "Участник уже играет на этом инструменте в песне" }),
      description: pick(locale, {
        en: "They can join the same song twice only on different instruments.",
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
  const inviteableUsers: { id: string; fullName: string | null; telegramUsername: string | null }[] = [];
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
  const minRequired =
    typeof resolvedSearchParams.minRequired === "string"
      ? Number.parseInt(resolvedSearchParams.minRequired, 10)
      : null;
  const maxTracks =
    typeof resolvedSearchParams.maxTracks === "string"
      ? Number.parseInt(resolvedSearchParams.maxTracks, 10)
      : null;
  const requestedView =
    typeof resolvedSearchParams.view === "string"
      ? resolvedSearchParams.view
      : resolvedSearchParams.mine === "1"
        ? "mine"
        : "all";
  const searchQuery =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";
  const highlightTrackId =
    typeof resolvedSearchParams.highlightTrack === "string"
      ? resolvedSearchParams.highlightTrack
      : null;
  const signInReturnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (key === "auth" || key === "authError") {
      continue;
    }

    if (typeof value === "string") {
      signInReturnParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        signInReturnParams.append(key, entry);
      }
    }
  }
  const signInReturnTo = `/events/${event.id}${
    signInReturnParams.toString() ? `?${signInReturnParams.toString()}` : ""
  }#track-board`;
  const roleFilters = parseRoleFilters(resolvedSearchParams.roles);
  const searchNeedle = searchQuery.toLowerCase();
  const activeView =
    requestedView === "mine" && user
      ? "mine"
      : requestedView === "open"
        ? "open"
        : "all";
  const floatingFeedback = getFloatingFeedback({
    error,
    locale,
    notice,
    minRequired: minRequired && Number.isFinite(minRequired) ? minRequired : null,
    maxTracks: maxTracks && Number.isFinite(maxTracks) ? maxTracks : null,
  });

  const roleOptions = roleFamilyOrder.filter((family) =>
    event.lineupSlots.some((slot) => getRoleFamilyKey(slot.label, slot.key) === family),
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: getGigDisplayTitle(event, locale),
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

  const publishedMainTrackIds = event.setlistItems
    .filter((item) => item.section === "MAIN")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => item.trackId);
  const publishedTrackById = new Map(event.tracks.map((track) => [track.id, track]));
  const boardTracks =
    effectiveStatus === "PUBLISHED"
      ? publishedMainTrackIds
          .map((trackId) => publishedTrackById.get(trackId))
          .filter((track): track is (typeof event.tracks)[number] => Boolean(track))
      : event.tracks;

  // Same rule as the Setlists archive: published or archived gigs that already started.
  const isPastSetlistGig =
    (event.status === "PUBLISHED" || event.status === "ARCHIVED") &&
    new Date(event.startsAt).getTime() < Date.now();
  const joinedTrackCount = user ? countJoinedTracks(event.tracks, user.id) : 0;
  const atTrackLimit = Boolean(user) && joinedTrackCount >= event.maxTracksPerUser;

  const selectedParticipant = typeof resolvedSearchParams.participant === "string" ? resolvedSearchParams.participant : "";
  const participants = Array.from(new Map(boardTracks.flatMap((track) =>
    track.seats.flatMap((seat) => seat.userId && seat.user
      ? [[seat.userId, { id: seat.userId, label: seat.user.telegramUsername ? `@${seat.user.telegramUsername}` : seat.user.fullName ?? seat.userId }] as const]
      : []),
  )).values()).sort((a, b) => a.label.localeCompare(b.label, locale));
  const visibleTracks = boardTracks.filter((track) => {
    if (selectedParticipant && !track.seats.some((seat) => seat.userId === selectedParticipant)) return false;
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

    const matchesRoles = matchesRoleFilters({
      getRoleKey: (seat) => getRoleFamilyKey(seat.label, seat.lineupSlot?.key ?? ""),
      onlyRequiredSeats: activeView === "open",
      roles: roleFilters,
      seats: track.seats,
    });

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

  // Stable song numbers keyed by the full board order (or the published setlist
  // order). Client-side filtering/sorting must not renumber the songs.
  const trackNumberById: Record<string, number> = {};
  boardTracks.forEach((track, index) => {
    trackNumberById[track.id] = index + 1;
  });

  const signedParticipantCount = new Set(
    event.tracks.flatMap((track) => track.seats.map((seat) => seat.userId).filter(Boolean)),
  ).size;
  const lineupParticipantCounts = countLineupParticipants(boardTracks);
  const readyTrackCount = event.tracks.filter(
    (track) => getTrackCompletionSummary(track.seats).isComplete,
  ).length;
  const selectedRoleLabel = roleFilters.map((role) => getRoleFamilyLabel(role, locale)).join(" + ");
  const allowClosedOptionalRequests = allowsClosedOptionalSeatRequests(event);
  const trackInfoFields = getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback);
  const isAdmin = user?.role === "ADMIN";
  const showAdminStatusControl = isAdmin && !env.LIVE_PRODUCTION_TUNNEL;
  const renderedAtMs = Date.now();
  const registrationOpensSoon =
    effectiveStatus === "DRAFT" &&
    Boolean(event.registrationOpensAt && event.registrationOpensAt.getTime() > renderedAtMs);
  const showRegistrationMeta = effectiveStatus !== "PUBLISHED";
  const nextAdminStatuses = getAllowedNextEventStatuses(event.status);

  return (
    <div className="space-y-8 text-sand">
      <BoardRealtimeRefresh eventId={event.id} />
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonForHtmlScript(structuredData) }}
        type="application/ld+json"
        nonce={(await headers()).get("x-nonce") ?? undefined}
      />
      {notice === "track-created" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "The song is now on the board.",
            ru: "Песня появилась в таблице.",
          })}
        </div>
      ) : null}

      {notice === "song-requested" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Admins received the song request. As soon as it lands in the catalog, you can add it to the board.",
            ru: "Админы получили запрос на песню. Как только она появится в каталоге, её можно будет добавить в таблицу.",
          })}
        </div>
      ) : null}

      {floatingFeedback ? (
        <FloatingToast
          description={floatingFeedback.description}
          locale={locale}
          title={floatingFeedback.title}
          tone={floatingFeedback.tone}
        />
      ) : null}

      <section className="space-y-7 border-b border-white/8 pb-8">
        {/* Past gigs are reached from Setlists, so the back link returns there. */}
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-sand/52 hover:text-gold"
          data-gig-back-link
          href={isPastSetlistGig ? "/archive" : "/"}
        >
          ←{" "}
          {isPastSetlistGig
            ? pick(locale, { en: "Back to setlists", ru: "К сетлистам" })
            : pick(locale, { en: "Back to home", ru: "На главную" })}
        </Link>
        <div className="space-y-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-gold/30 bg-gold/10 text-gold">
                {getEventStatusLabel(effectiveStatus, locale)}
              </Badge>
              {effectiveStatus === "OPEN" ? (
                <Badge className="border-red/24 bg-red/14 text-white">
                  {pick(locale, {
                    en: "Fill the board before adding songs",
                    ru: "Сначала заполни таблицу, потом добавляй песни",
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
              <h1 className="font-display text-5xl uppercase text-sand lg:text-6xl">
                {getGigDisplayTitle(event, locale)}
              </h1>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-sand/58">
                <span>{formatDateTime(event.startsAt, locale)}</span>
                <span>{event.venueName ?? pick(locale, { en: "Venue TBD", ru: "Площадка уточняется" })}</span>
                <span>
                  {pick(locale, {
                    en: `${formatCount(locale, signedParticipantCount, COUNT_FORMS.participants)} signed up`,
                    ru: `Вписано: ${formatCount(locale, signedParticipantCount, COUNT_FORMS.participants)}`,
                  })}
                </span>
              </div>
              {event.description ? (
                <p className="max-w-4xl text-sm leading-6 text-sand/68">{event.description}</p>
              ) : null}
            </div>

            <div
              className={`reference-section grid gap-4 px-5 py-4 ${
                effectiveStatus === "PUBLISHED" ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-sand/45">
                  {pick(locale, { en: "Songs on board", ru: "Песен в таблице" })}
                </p>
                <p className="mt-2 font-display text-4xl text-sand">{event.tracks.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-sand/45">
                  {pick(locale, { en: "Songs ready", ru: "Песен собрано" })}
                </p>
                <p className="mt-2 font-display text-4xl text-gold">{readyTrackCount}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-sand/45">
                  {pick(locale, { en: "Participants on board", ru: "Участников в таблице" })}
                </p>
                <p className="mt-2 font-display text-4xl text-emerald-300">{lineupParticipantCounts.total}</p>
              </div>
              {effectiveStatus === "PUBLISHED" ? null : (
                <div>
                  <p className="text-xs font-bold text-sand/45">
                    {pick(locale, {
                      en: "Participants in ready songs",
                      ru: "Участников в собранных песнях",
                    })}
                  </p>
                  <p className="mt-2 font-display text-4xl text-emerald-300">
                    {lineupParticipantCounts.inReadyTracks}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="#track-board">
                  {pick(locale, { en: "Jump to songs", ru: "К песням" })}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Link href="/faq">
                <Button variant="secondary">
                  {pick(locale, {
                    en: "New here? FAQ explains how this works",
                    ru: "Новичок? В FAQ есть как это работает",
                  })}
                </Button>
              </Link>
            </div>

            {showRegistrationMeta ? (
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
              </div>
            ) : null}

            {showAdminStatusControl ? (
              <Card className="brand-shell-soft space-y-3 border-white/10">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {pick(locale, { en: "Admin status control", ru: "Управление статусом" })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>{pick(locale, { en: "Registration status:", ru: "Статус регистрации:" })}</span>
                    <Badge className="border-gold/24 bg-gold/12 text-gold" data-admin-current-status>
                      {getEventStatusLabel(effectiveStatus, locale)}
                    </Badge>
                  </div>
                  {effectiveStatus !== event.status ? (
                    <p className="text-xs leading-5 text-white/55">
                      {pick(locale, {
                        en: `Set automatically by the registration dates (saved as ${getEventStatusLabel(event.status, locale)}).`,
                        ru: `Выставлено автоматически по датам регистрации (сохранено как «${getEventStatusLabel(event.status, locale)}»).`,
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextAdminStatuses.map((status) => {
                    const label = getEventStatusActionLabel(status, effectiveStatus, locale);
                    const confirmMessage = getEventStatusActionConfirm(status, locale);

                    return (
                      <form action={updateEventStatusAction} key={status}>
                        <input name="eventId" type="hidden" value={event.id} />
                        <input name="eventSlug" type="hidden" value={event.id} />
                        <input name="status" type="hidden" value={status} />
                        {confirmMessage ? (
                          <ConfirmSubmitButton
                            confirmMessage={confirmMessage}
                            data-admin-status-action={status}
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            {label}
                          </ConfirmSubmitButton>
                        ) : (
                          <Button data-admin-status-action={status} size="sm" type="submit" variant="secondary">
                            {label}
                          </Button>
                        )}
                      </form>
                    );
                  })}
                </div>
              </Card>
            ) : null}
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
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/66">
            <span>
              {pick(locale, {
                en: "Start here: scan the songs and take the seat you can really cover.",
                ru: "Начинай отсюда: смотри песни и занимай то место, которое реально можешь закрыть.",
              })}
            </span>
            {user && effectiveStatus === "OPEN" ? (
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  atTrackLimit
                    ? "border-gold/40 bg-gold/12 text-gold"
                    : "border-white/14 bg-white/6 text-white/80",
                )}
                data-board-track-limit
                title={pick(locale, {
                  en: `Each participant can be in up to ${event.maxTracksPerUser} songs per gig.`,
                  ru: `На одном гиге можно участвовать максимум в ${event.maxTracksPerUser} песнях.`,
                })}
              >
                {atTrackLimit
                  ? pick(locale, {
                      en: `Limit reached: ${joinedTrackCount} of ${event.maxTracksPerUser} songs. Leave one to join another.`,
                      ru: `Лимит: ${joinedTrackCount} из ${event.maxTracksPerUser} песен. Выйди из одной, чтобы вписаться в другую.`,
                    })
                  : pick(locale, {
                      en: `You're in ${joinedTrackCount} of ${event.maxTracksPerUser} songs`,
                      ru: `Ты в ${joinedTrackCount} из ${event.maxTracksPerUser} песен`,
                    })}
              </span>
            ) : null}
            <Link className="font-semibold text-gold transition hover:text-gold/80 hover:underline" href="/faq">
              {pick(locale, {
                en: "Need the board rules? FAQ has the short version.",
                ru: "Нужны правила таблицы? В FAQ есть короткое объяснение.",
              })}
            </Link>
          </div>
          {roleFilters.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/62">
              {pick(locale, { en: "Instrument filter", ru: "Фильтр по инструментам" })}: {selectedRoleLabel}
            </p>
          ) : null}
        </div>

        <Card className="brand-shell space-y-4 border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TrackBoardFilters
              key={event.id}
              participants={participants}
              selectedParticipant={selectedParticipant}
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
                <TrackProposalLauncher
                  createTrackAction={createTrackAction}
                  eventId={event.id}
                  eventSlug={event.id}
                  inviteableUsers={inviteableUsers}
                  lineupSlots={event.lineupSlots}
                  locale={locale}
                  requiresSelfSeat={user.role !== "ADMIN"}
                  trackInfoFields={trackInfoFields}
                />
              ) : null}
            </div>
          </div>
        </Card>

        {!user && effectiveStatus === "OPEN" ? (
          // Guests can't take seats; put the sign-in prompt right above the songs it unlocks.
          <div
            className="flex flex-col gap-3 rounded-xl border border-gold/24 bg-gold/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-board-sign-in-banner
          >
            <p className="text-sm leading-6 text-white/82">
              {pick(locale, {
                en: "Sign in with Telegram to take a seat or propose a song.",
                ru: "Войди через Telegram, чтобы занять место или предложить песню.",
              })}
            </p>
            <SignInLink returnTo={signInReturnTo}>
              <Button size="sm">
                <LogIn className="mr-2 h-4 w-4" />
                {pick(locale, { en: "Sign in to join", ru: "Войти и вписаться" })}
              </Button>
            </SignInLink>
          </div>
        ) : null}

        {visibleTracks.length === 0 ? (
          <Card className="brand-shell">
            <p className="text-sm leading-6 text-white/68">
              {getTrackBoardEmptyState({
                activeView,
                hasFilters: searchQuery.length > 0 || roleFilters.length > 0,
                locale,
                totalTrackCount: boardTracks.length,
              })}
            </p>
          </Card>
        ) : (
          <TrackBoardTable
            allowClosedOptionalRequests={allowClosedOptionalRequests}
            eventSlug={event.id}
            highlightTrackId={highlightTrackId}
            inviteableUsers={inviteableUsers}
            isOpen={effectiveStatus === "OPEN"}
            lineupSlots={event.lineupSlots}
            locale={locale}
            trackInfoFields={trackInfoFields}
            trackNumbers={trackNumberById}
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

        {user && effectiveStatus === "OPEN" && visibleTracks.length > 0 ? (
          <div className="flex justify-center pt-2">
            <TrackProposalLauncher
              createTrackAction={createTrackAction}
              eventId={event.id}
              eventSlug={event.id}
              inviteableUsers={inviteableUsers}
              lineupSlots={event.lineupSlots}
              locale={locale}
              requiresSelfSeat={user.role !== "ADMIN"}
              trackInfoFields={trackInfoFields}
            />
          </div>
        ) : null}
      </section>

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
                  ru: "Этот гиг уже виден, но добавление песен и вписка на места откроются только со стартом регистрации.",
                })}
              </p>
              <p className="text-lg font-semibold text-sand">
                {pick(locale, { en: "Starts in:", ru: "Старт через:" })}{" "}
                <EventRegistrationCountdown
                  initialNowMs={renderedAtMs}
                  locale={locale}
                  refreshOnComplete
                  target={event.registrationOpensAt}
                />
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {effectiveStatus !== "OPEN" && !registrationOpensSoon ? (
        <Card className="brand-shell space-y-3">
          <Badge className="border-white/10 bg-transparent text-white/62">
            {pick(locale, { en: "Board status", ru: "Статус таблицы" })}
          </Badge>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-1 h-5 w-5 text-blue" />
            <p className="max-w-3xl text-sm leading-6 text-white/68">
              {effectiveStatus === "CLOSED"
                ? pick(locale, {
                    en: "Registration is closed for this gig. The board is now in review mode while admins lock the final set.",
                    ru: "Набор в этот гиг уже закрыт. Таблица перешла в режим просмотра, пока админы собирают финальный сет.",
                  })
                : pick(locale, {
                    en: "This gig is no longer editable, so the page shifts into inspection mode: review the proposed songs, who ended up in which seat and, when published, the released order.",
                    ru: "Этот гиг больше нельзя редактировать, поэтому страница переходит в режим просмотра: можно изучить предложенные песни, итоговый состав и, если сет уже опубликован, итоговый порядок.",
                  })}
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
