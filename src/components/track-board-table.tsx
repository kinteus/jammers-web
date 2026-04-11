import { TrackSeatStatus, type UserRole } from "@prisma/client";
import { ExternalLink, FileText, LogOut, Minus, Send, UserPlus } from "lucide-react";

import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { expandSeatColumns, type LineupSlotLite } from "@/lib/event-board";
import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey } from "@/lib/role-families";
import { parseClosedOptionalSeatRequestMeta } from "@/lib/track-invite-meta";
import { getTrackInfoKeys, getTrackInfoLabel, type TrackInfoField } from "@/lib/track-info-flags";
import { cn } from "@/lib/utils";

import {
  cancelTrackAction,
  claimSeatAction,
  inviteToSeatAction,
  releaseSeatAction,
} from "@/server/actions";

type BoardUser = {
  id: string;
  role: UserRole;
  telegramUsername: string | null;
  fullName: string | null;
} | null;

type BoardTrack = {
  id: string;
  proposedById: string;
  proposedBy: {
    telegramUsername: string | null;
    fullName: string | null;
  };
  song: {
    title: string;
    artist: {
      name: string;
    };
  };
  playbackRequired: boolean;
  trackInfoKeysJson: string | null;
  comment: string | null;
  seats: Array<{
    id: string;
    seatIndex: number;
    label: string;
    status: TrackSeatStatus;
    isOptional: boolean;
    userId: string | null;
    user: {
      telegramUsername: string | null;
      fullName: string | null;
    } | null;
    lineupSlotId: string;
    invites: Array<{
      id: string;
      status: string;
      deliveryNote: string | null;
      senderId: string;
      sender: {
        telegramUsername: string | null;
        fullName: string | null;
      };
      recipient: {
        telegramUsername: string | null;
        fullName: string | null;
      };
    }>;
  }>;
};

type SeatRequestEntry = {
  id: string;
  kind: "request" | "invite";
  requesterId: string;
  requesterLabel: string;
  targetLabel: string;
  mode: "self" | "friend";
};

function groupColumns(columns: ReturnType<typeof expandSeatColumns>) {
  const groups: Array<{ family: ReturnType<typeof getRoleFamilyKey>; columns: typeof columns }> = [];

  for (const column of columns) {
    const family = getRoleFamilyKey(column.label, column.lineupKey);
    const current = groups[groups.length - 1];

    if (current && current.family === family) {
      current.columns.push(column);
      continue;
    }

    groups.push({ family, columns: [column] });
  }

  return groups;
}

function formatPersonLabel(
  user: {
    telegramUsername: string | null;
    fullName: string | null;
  } | null,
  locale: Locale,
) {
  if (!user) {
    return pick(locale, { en: "Unassigned", ru: "Не назначено" });
  }
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }
  return user.fullName ?? pick(locale, { en: "Unknown musician", ru: "Неизвестный музыкант" });
}

function getTelegramProfileUrl(user: {
  telegramUsername: string | null;
  fullName: string | null;
} | null) {
  if (!user?.telegramUsername) {
    return null;
  }

  return `https://t.me/${user.telegramUsername}`;
}

function getYoutubeSearchUrl(track: BoardTrack) {
  const query = `${track.song.artist.name} ${track.song.title}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function statusDotClass(status: TrackSeatStatus) {
  if (status === TrackSeatStatus.CLAIMED) {
    return "bg-blue";
  }
  if (status === TrackSeatStatus.UNAVAILABLE) {
    return "bg-white/38";
  }
  return "bg-gold";
}

function cellClass(status: TrackSeatStatus, isOptional: boolean) {
  if (status === TrackSeatStatus.CLAIMED) {
    return "bg-blue/[0.08] hover:bg-blue/[0.12]";
  }
  if (status === TrackSeatStatus.UNAVAILABLE) {
    return "bg-white/[0.03] hover:bg-white/[0.05]";
  }
  if (isOptional) {
    return "bg-gold/[0.06] hover:bg-gold/[0.1]";
  }
  return "bg-gold/[0.12] hover:bg-gold/[0.16]";
}

function iconButtonClass(variant: "primary" | "secondary" = "secondary") {
  return cn(
    "ui-tooltip ui-tooltip-bottom inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25 hover:-translate-y-0.5",
    variant === "primary" && "border-gold/50 bg-gold text-ink hover:bg-gold/90",
    variant === "secondary" && "text-white/62 hover:border-white/10 hover:bg-white/10 hover:text-white",
  );
}

function cellFrameClass() {
  return "border-white/12";
}

function buildSeatIndex(track: BoardTrack) {
  return new Map(track.seats.map((seat) => [`${seat.lineupSlotId}:${seat.seatIndex}`, seat] as const));
}

function getSeatRequests(seat: BoardTrack["seats"][number]): SeatRequestEntry[] {
  return seat.invites.map((invite) => {
    const senderLabel = invite.sender.telegramUsername
      ? `@${invite.sender.telegramUsername}`
      : invite.sender.fullName ?? "Unknown";
    const recipientLabel = invite.recipient.telegramUsername
      ? `@${invite.recipient.telegramUsername}`
      : invite.recipient.fullName ?? "Unknown";
    const meta = parseClosedOptionalSeatRequestMeta(invite.deliveryNote);
    if (!meta) {
      return {
        id: invite.id,
        kind: "invite",
        requesterId: invite.senderId,
        requesterLabel: senderLabel,
        targetLabel: recipientLabel,
        mode: "friend",
      };
    }

    return {
      id: invite.id,
      kind: "request",
      requesterId: meta.requesterId,
      requesterLabel: meta.requesterLabel,
      targetLabel: meta.targetLabel,
      mode: meta.mode,
    };
  });
}

function SeatRequestsControl({
  requests,
  locale,
  preferAbove = false,
}: {
  requests: SeatRequestEntry[];
  locale: Locale;
  preferAbove?: boolean;
}) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <details className="group/details relative">
      <summary
        className="list-none cursor-pointer rounded-full border border-white/14 bg-black/24 px-1.5 py-0.5 text-[9px] font-semibold text-white/88 transition hover:bg-black/35"
        title={pick(locale, {
          en: "Open pending requests",
          ru: "Показать ожидающие запросы",
        })}
      >
        {requests.length}
      </summary>
      <div
        className={cn(
          "absolute right-0 z-20 mt-1 w-56 space-y-2 rounded-md border border-white/10 bg-stage p-2 shadow-card",
          preferAbove ? "bottom-6" : "top-5",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/62">
          {pick(locale, { en: "Pending seat activity", ru: "Ожидает по месту" })}
        </p>
        {requests.map((request) => (
          <p className="text-[10px] leading-4 text-white/78" key={request.id}>
            {request.kind === "invite"
              ? pick(locale, {
                  en: `${request.requesterLabel} invited ${request.targetLabel}`,
                  ru: `${request.requesterLabel} пригласил(а) ${request.targetLabel}`,
                })
              : request.mode === "self"
              ? pick(locale, {
                  en: `${request.requesterLabel} asked to join`,
                  ru: `${request.requesterLabel} запросил(а) место`,
                })
              : pick(locale, {
                  en: `${request.requesterLabel} suggested ${request.targetLabel}`,
                  ru: `${request.requesterLabel} предложил(а) ${request.targetLabel}`,
                })}
          </p>
        ))}
      </div>
    </details>
  );
}

function InviteControl({
  allowClosedOptionalRequests,
  seat,
  eventSlug,
  locale,
  preferAbove = false,
}: {
  allowClosedOptionalRequests: boolean;
  seat: BoardTrack["seats"][number];
  eventSlug: string;
  locale: Locale;
  preferAbove?: boolean;
}) {
  const requestLabel = allowClosedOptionalRequests && seat.isOptional;

  return (
    <details className="group/details relative">
      <summary
        aria-label={pick(locale, {
          en: requestLabel
            ? `Suggest player for ${seat.label}`
            : `Invite player to ${seat.label}`,
          ru: requestLabel
            ? `Предложить музыканта на ${seat.label}`
            : `Позвать музыканта на ${seat.label}`,
        })}
        className={cn("list-none cursor-pointer", iconButtonClass())}
        data-tip={pick(locale, {
          en: requestLabel ? "Suggest player" : "Invite",
          ru: requestLabel ? "Предложить" : "Позвать",
        })}
        title={pick(locale, {
          en: requestLabel
            ? `Suggest player for ${seat.label}`
            : `Invite player to ${seat.label}`,
          ru: requestLabel
            ? `Предложить музыканта на ${seat.label}`
            : `Позвать музыканта на ${seat.label}`,
        })}
      >
        <Send className="h-3.5 w-3.5" />
      </summary>
      <form
        action={inviteToSeatAction}
        className={cn(
          "absolute right-0 z-20 flex w-44 flex-col gap-2 rounded-md border border-white/10 bg-stage p-2 shadow-card",
          preferAbove ? "bottom-7" : "top-7",
        )}
      >
        <input name="seatId" type="hidden" value={seat.id} />
        <input name="eventSlug" type="hidden" value={eventSlug} />
        <input
          className="w-full rounded-md px-2.5 py-1.5 text-xs"
          name="recipientUsername"
          placeholder="@username"
        />
        <button
          className="rounded-sm border border-white/10 bg-white/6 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/78 transition hover:bg-white/10"
          type="submit"
        >
          {pick(locale, {
            en: requestLabel ? "Send request" : "Send invite",
            ru: requestLabel ? "Отправить запрос" : "Отправить",
          })}
        </button>
      </form>
    </details>
  );
}

export function TrackBoardTable({
  allowClosedOptionalRequests,
  eventSlug,
  lineupSlots,
  locale,
  trackInfoFields,
  tracks,
  user,
  isOpen,
}: {
  allowClosedOptionalRequests: boolean;
  eventSlug: string;
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  trackInfoFields: TrackInfoField[];
  tracks: BoardTrack[];
  user: BoardUser;
  isOpen: boolean;
}) {
  const columns = expandSeatColumns(lineupSlots);
  const columnGroups = groupColumns(columns);

  return (
    <div className="space-y-4">
      <div className="brand-shell hidden overflow-hidden rounded-[1.25rem] border-white/14 shadow-table-glow md:block">
        <div className="h-1 w-full stage-rule" />
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="bg-[#1b1b1b] text-white">
              <th
                className="sticky left-0 z-30 w-[21.5%] border-b border-r border-white/16 bg-[#1b1b1b] px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.24em] text-white/92"
                rowSpan={2}
              >
                {pick(locale, { en: "Song", ru: "Песня" })}
              </th>
              {columnGroups.map((group, index) => (
                <th
                  className={cn(
                    "border-b border-white/16 px-0 py-0 text-left text-[10px] uppercase tracking-[0.22em] text-white/82",
                    index > 0 && "border-l border-white/16",
                  )}
                  colSpan={group.columns.length}
                  key={`${group.family}-${group.columns[0]?.seatKey ?? "group"}`}
                >
                  <div className="flex items-center gap-2 px-2 py-2">
                    <span>{getRoleFamilyLabel(group.family, locale)}</span>
                    <div className="h-px flex-1 bg-white/26" />
                  </div>
                </th>
              ))}
            </tr>
            <tr className="bg-[#1b1b1b] text-white">
              {columns.map((column, index) => {
                const previousColumn = columns[index - 1];
                const startsNewGroup =
                  index === 0 || previousColumn?.lineupKey !== column.lineupKey;

                return (
                  <th
                    className={cn(
                      "border-b border-r border-white/14 px-1 py-2 text-left text-[11px] font-semibold text-white/92",
                      startsNewGroup && "border-l border-white/16",
                    )}
                    key={column.seatKey}
                  >
                    <span className="block truncate">{column.shortLabel}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => {
              const isMyTrack = Boolean(user && track.seats.some((seat) => seat.userId === user.id));
              const completion = getTrackCompletionSummary(track.seats);
              const seatIndex = buildSeatIndex(track);
              const activeTrackInfoLabels = trackInfoFields
                .filter((field) =>
                  getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired).includes(field.key),
                )
                .map((field) => getTrackInfoLabel(field, locale));
              const preferInviteAbove = index >= tracks.length - 2;
              const canManageTrack = Boolean(
                isOpen && user && (user.role === "ADMIN" || track.proposedById === user.id),
              );
              const rowBackground = isMyTrack
                ? "bg-blue/12"
                : index % 2 === 0
                  ? "bg-white/[0.05]"
                  : "bg-white/[0.08]";

              return (
                <tr
                  className={cn("transition hover:bg-white/[0.12]", rowBackground)}
                  id={`track-${track.id}`}
                  key={track.id}
                >
                  <td
                    className={cn(
                      "sticky-song-cell sticky left-0 z-20 border-b border-r border-cloud px-2 py-1.5 align-top",
                      "border-white/14",
                      rowBackground,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <a
                            className="truncate font-display text-[1.05rem] font-semibold text-sand transition hover:text-white hover:underline"
                            href={getYoutubeSearchUrl(track)}
                            rel="noreferrer"
                            target="_blank"
                            title={pick(locale, {
                              en: `Search on YouTube: ${track.song.artist.name} - ${track.song.title}`,
                              ru: `Искать на YouTube: ${track.song.artist.name} - ${track.song.title}`,
                            })}
                          >
                            {track.song.title}
                          </a>
                          <a
                            className="ui-tooltip ui-tooltip-bottom inline-flex h-5 w-5 items-center justify-center rounded-sm text-white/46 transition hover:text-white"
                            data-tip={pick(locale, { en: "Open on YouTube", ru: "Открыть на YouTube" })}
                            href={getYoutubeSearchUrl(track)}
                            rel="noreferrer"
                            target="_blank"
                            title={pick(locale, { en: "Open on YouTube", ru: "Открыть на YouTube" })}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {isMyTrack ? (
                            <span
                              className="h-2 w-2 rounded-full bg-blue"
                              title={pick(locale, {
                                en: "You are in this song",
                                ru: "Ты в этой песне",
                              })}
                            />
                          ) : null}
                        </div>

                        <p className="truncate text-[11px] text-white/74">
                          {track.song.artist.name} · {formatPersonLabel(track.proposedBy, locale)} ·{" "}
                          {completion.isComplete
                            ? completion.optionalOpen > 0
                              ? pick(locale, {
                                  en: `Ready + ${completion.optionalOpen} optional`,
                                  ru: `Собрано + ${completion.optionalOpen} optional`,
                                })
                              : pick(locale, { en: "Ready", ru: "Собрано" })
                            : pick(locale, {
                                en: `${completion.requiredOpen} required open`,
                                ru: `${completion.requiredOpen} обязательных открыто`,
                              })}
                        </p>
                        {activeTrackInfoLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {activeTrackInfoLabels.map((label) => (
                              <span
                                className="rounded-full border border-gold/18 bg-gold/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold"
                                key={label}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {track.comment ? (
                          <details className="group relative">
                            <summary
                              className={cn("list-none cursor-pointer text-white", iconButtonClass())}
                              data-tip={pick(locale, { en: "Notes", ru: "Заметки" })}
                              title={pick(locale, {
                                en: "Track notes",
                                ru: "Заметки к треку",
                              })}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </summary>
                            <div className="absolute right-0 top-7 z-20 w-64 rounded-md border border-white/10 bg-stage p-3 text-xs leading-5 text-white/74 shadow-card">
                              {track.comment}
                            </div>
                          </details>
                        ) : null}
                        {canManageTrack ? (
                          <form action={cancelTrackAction}>
                            <input name="trackId" type="hidden" value={track.id} />
                            <input name="eventSlug" type="hidden" value={eventSlug} />
                            <button
                              aria-label={pick(locale, {
                                en: `Remove ${track.song.title}`,
                                ru: `Убрать ${track.song.title}`,
                              })}
                              className={cn(
                                iconButtonClass(),
                                "text-red hover:bg-red/10 hover:text-white",
                              )}
                              data-tip={pick(locale, { en: "Remove", ru: "Убрать" })}
                              title={pick(locale, {
                                en: `Remove ${track.song.title}`,
                                ru: `Убрать ${track.song.title}`,
                              })}
                              type="submit"
                            >
                              <LogOut className="h-3.5 w-3.5 rotate-180" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {columns.map((column) => {
                    const seat = seatIndex.get(`${column.slotId}:${column.seatIndex}`);

                    if (!seat) {
                      return (
                        <td className="border-b border-r border-white/12 px-0.5 py-0" key={column.seatKey} />
                      );
                    }

                    const canClaim = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        (isOpen || (allowClosedOptionalRequests && seat.isOptional)),
                    );
                    const canManage = Boolean(
                      isOpen &&
                      user &&
                        (user.role === "ADMIN" ||
                          track.proposedById === user.id ||
                          seat.userId === user.id),
                    );
                    const canInvite = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        ((isOpen &&
                          (user.role === "ADMIN" || track.proposedById === user.id)) ||
                          (allowClosedOptionalRequests && seat.isOptional)),
                    );
                    const seatRequests = getSeatRequests(seat);
                    const userHasPendingRequest = Boolean(
                      user &&
                        seatRequests.some(
                          (request) =>
                            request.kind === "request" && request.requesterId === user.id,
                        ),
                    );

                    return (
                      <td
                        className={cn(
                          "group relative border-b border-r border-white/12 px-0.5 py-0 align-middle transition",
                          cellClass(seat.status, seat.isOptional),
                          cellFrameClass(),
                        )}
                        key={column.seatKey}
                        title={
                          seat.user
                            ? `${seat.label}: ${formatPersonLabel(seat.user, locale)}`
                            : seat.status === TrackSeatStatus.UNAVAILABLE
                              ? pick(locale, {
                                  en: `${seat.label}: empty in this arrangement`,
                                  ru: `${seat.label}: пусто в этой аранжировке`,
                                })
                              : seat.isOptional
                                ? pick(locale, {
                                    en: `${seat.label}: optional part`,
                                    ru: `${seat.label}: optional партия`,
                                  })
                                : pick(locale, {
                                    en: `${seat.label}: open`,
                                    ru: `${seat.label}: открыто`,
                                  })
                        }
                      >
                        <div className="relative flex h-11 items-center justify-center px-0.5 py-0.5 transition">
                          <span
                            className={cn(
                              "absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                              statusDotClass(seat.status),
                            )}
                          />

                          {seat.status === TrackSeatStatus.OPEN ? (
                            <>
                              {seat.isOptional ? (
                                <span className="absolute left-1.5 bottom-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-gold/84">
                                  OPT
                                </span>
                              ) : null}
                              {canInvite ? (
                                <div className="absolute right-1 top-1">
                                  <InviteControl
                                    allowClosedOptionalRequests={allowClosedOptionalRequests}
                                    eventSlug={eventSlug}
                                    locale={locale}
                                    preferAbove={preferInviteAbove}
                                    seat={seat}
                                  />
                                </div>
                              ) : null}
                              {canClaim ? (
                                <form action={claimSeatAction}>
                                  <input name="seatId" type="hidden" value={seat.id} />
                                  <input name="eventSlug" type="hidden" value={eventSlug} />
                                  <button
                                    aria-label={pick(locale, {
                                      en: `Join ${seat.label}`,
                                      ru: `Занять ${seat.label}`,
                                    })}
                                    className={iconButtonClass("primary")}
                                    data-tip={pick(locale, {
                                      en:
                                        !isOpen && allowClosedOptionalRequests && seat.isOptional
                                          ? "Ask to join"
                                          : seat.isOptional
                                            ? "Join optional"
                                            : "Join",
                                      ru:
                                        !isOpen && allowClosedOptionalRequests && seat.isOptional
                                          ? "Запросить место"
                                          : seat.isOptional
                                            ? "Вписаться optional"
                                            : "Вписаться",
                                    })}
                                    title={pick(locale, {
                                      en:
                                        !isOpen && allowClosedOptionalRequests && seat.isOptional
                                          ? `Ask proposer to add you to ${seat.label}`
                                          : seat.isOptional
                                            ? `Join optional ${seat.label}`
                                            : `Join ${seat.label}`,
                                      ru:
                                        !isOpen && allowClosedOptionalRequests && seat.isOptional
                                          ? `Попросить автора трека добавить тебя на ${seat.label}`
                                          : seat.isOptional
                                            ? `Вписаться на optional ${seat.label}`
                                            : `Вписаться на ${seat.label}`,
                                    })}
                                    type="submit"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                  </button>
                                </form>
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-white/32">
                                  <UserPlus className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {userHasPendingRequest ? (
                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-blue/30 bg-blue/16 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-white">
                                  {pick(locale, { en: "Request sent", ru: "Запрос отправлен" })}
                                </span>
                              ) : null}
                            </>
                          ) : seat.user ? (
                            <>
                              {getTelegramProfileUrl(seat.user) ? (
                                <a
                                  className="max-w-full break-all px-2 text-center text-[10px] font-semibold leading-[1.05rem] text-sand transition hover:text-white hover:underline"
                                  href={getTelegramProfileUrl(seat.user) ?? undefined}
                                  rel="noreferrer"
                                  target="_blank"
                                  title={formatPersonLabel(seat.user, locale)}
                                >
                                  {formatPersonLabel(seat.user, locale)}
                                </a>
                              ) : (
                                <span
                                  className="max-w-full break-all px-2 text-center text-[10px] font-semibold leading-[1.05rem] text-sand"
                                  title={formatPersonLabel(seat.user, locale)}
                                >
                                  {formatPersonLabel(seat.user, locale)}
                                </span>
                              )}
                              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                {canManage ? (
                                  <form action={releaseSeatAction}>
                                    <input name="seatId" type="hidden" value={seat.id} />
                                    <input name="eventSlug" type="hidden" value={eventSlug} />
                                    <button
                                      aria-label={pick(locale, {
                                        en: `Release ${seat.label}`,
                                        ru: `Освободить ${seat.label}`,
                                      })}
                                      className={iconButtonClass()}
                                      data-tip={pick(locale, {
                                        en: "Release",
                                        ru: "Освободить",
                                      })}
                                      title={pick(locale, {
                                        en: `Release ${seat.label}`,
                                        ru: `Освободить ${seat.label}`,
                                      })}
                                      type="submit"
                                    >
                                      <LogOut className="h-3.5 w-3.5" />
                                    </button>
                                  </form>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <span
                              className="ui-tooltip ui-tooltip-bottom inline-flex h-5 w-5 items-center justify-center text-white/34"
                              data-tip={pick(locale, { en: "Empty", ru: "Пусто" })}
                            >
                              <Minus className="h-4 w-4" />
                            </span>
                          )}

                          {seatRequests.length > 0 ? (
                            <div className="absolute bottom-1 right-1">
                              <SeatRequestsControl
                                locale={locale}
                                preferAbove={preferInviteAbove}
                                requests={seatRequests}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {tracks.map((track) => {
          const isMyTrack = Boolean(user && track.seats.some((seat) => seat.userId === user.id));
          const completion = getTrackCompletionSummary(track.seats);
          const activeTrackInfoLabels = trackInfoFields
            .filter((field) =>
              getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired).includes(field.key),
            )
            .map((field) => getTrackInfoLabel(field, locale));
          const preferInviteAbove = tracks.length > 1;
          const canManageTrack = Boolean(
            isOpen && user && (user.role === "ADMIN" || track.proposedById === user.id),
          );
          const mobileOpenCount = track.seats.filter((seat) => seat.status === TrackSeatStatus.OPEN).length;

          return (
            <details
              className="brand-shell group rounded-xl border-white/10 shadow-card"
              id={`track-${track.id}`}
              key={track.id}
            >
              <summary className="list-none cursor-pointer px-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold text-sand">{track.song.title}</p>
                      <p className="text-[11px] text-white/60">
                        {track.song.artist.name} · {formatPersonLabel(track.proposedBy, locale)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                      {pick(locale, { en: "Details", ru: "Детали" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-white/62">
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                      {completion.isComplete
                        ? pick(locale, { en: "Ready", ru: "Собрано" })
                        : pick(locale, { en: `${mobileOpenCount} open`, ru: `${mobileOpenCount} открыто` })}
                    </span>
                    {isMyTrack ? (
                      <span className="rounded-full border border-blue/18 bg-blue/10 px-2.5 py-1 text-blue">
                        {pick(locale, { en: "You're in", ru: "Ты в составе" })}
                      </span>
                    ) : null}
                    {activeTrackInfoLabels.map((label) => (
                      <span
                        className="rounded-full border border-gold/18 bg-gold/8 px-2.5 py-1 text-gold"
                        key={label}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </summary>

              <div className="space-y-3 border-t border-white/10 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className={cn("ui-tooltip ui-tooltip-bottom inline-flex h-8 w-8 items-center justify-center rounded-sm text-white", iconButtonClass())}
                    data-tip={pick(locale, { en: "Open on YouTube", ru: "Открыть на YouTube" })}
                    href={getYoutubeSearchUrl(track)}
                    rel="noreferrer"
                    target="_blank"
                    title={pick(locale, { en: "Open on YouTube", ru: "Открыть на YouTube" })}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {isMyTrack ? <span className="h-2 w-2 rounded-full bg-blue" /> : null}
                  {track.comment ? (
                    <details className="group">
                      <summary
                        className={cn("list-none cursor-pointer text-white", iconButtonClass())}
                        data-tip={pick(locale, { en: "Notes", ru: "Заметки" })}
                        title={pick(locale, { en: "Track notes", ru: "Заметки к треку" })}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </summary>
                      <div className="mt-2 rounded-md border border-white/10 bg-stage p-3 text-xs leading-5 text-white/74 shadow-card">
                        {track.comment}
                      </div>
                    </details>
                  ) : null}
                  {canManageTrack ? (
                    <form action={cancelTrackAction}>
                      <input name="trackId" type="hidden" value={track.id} />
                      <input name="eventSlug" type="hidden" value={eventSlug} />
                      <button
                        aria-label={pick(locale, {
                          en: `Remove ${track.song.title}`,
                          ru: `Убрать ${track.song.title}`,
                        })}
                        className={cn(
                          iconButtonClass(),
                          "text-red hover:bg-red/10 hover:text-white",
                        )}
                        data-tip={pick(locale, { en: "Remove", ru: "Убрать" })}
                        type="submit"
                      >
                        <LogOut className="h-3.5 w-3.5 rotate-180" />
                      </button>
                    </form>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {track.seats.map((seat) => {
                    const canClaim = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        (isOpen || (allowClosedOptionalRequests && seat.isOptional)),
                    );
                    const canManage = Boolean(
                      isOpen &&
                        user &&
                        (user.role === "ADMIN" ||
                          track.proposedById === user.id ||
                          seat.userId === user.id),
                    );
                    const canInvite = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        ((isOpen &&
                          (user.role === "ADMIN" || track.proposedById === user.id)) ||
                          (allowClosedOptionalRequests && seat.isOptional)),
                    );
                    const seatRequests = getSeatRequests(seat);
                    const userHasPendingRequest = Boolean(
                      user &&
                        seatRequests.some(
                          (request) =>
                            request.kind === "request" && request.requesterId === user.id,
                        ),
                    );
                    const isSelfSeat = Boolean(user && seat.userId === user.id);

                    return (
                      <div
                        className={cn(
                          "group space-y-2 border px-2.5 py-2",
                          cellClass(seat.status, seat.isOptional),
                          cellFrameClass(),
                        )}
                        key={seat.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass(seat.status))} />
                            {seat.user ? (
                              getTelegramProfileUrl(seat.user) ? (
                                <a
                                  className="break-all text-[10px] font-semibold leading-[1.05rem] text-sand transition hover:text-white hover:underline"
                                  href={getTelegramProfileUrl(seat.user) ?? undefined}
                                  rel="noreferrer"
                                  target="_blank"
                                  title={formatPersonLabel(seat.user, locale)}
                                >
                                  {formatPersonLabel(seat.user, locale)}
                                </a>
                              ) : (
                                <span
                                  className="break-all text-[10px] font-semibold leading-[1.05rem] text-sand"
                                  title={formatPersonLabel(seat.user, locale)}
                                >
                                  {formatPersonLabel(seat.user, locale)}
                                </span>
                              )
                            ) : seat.status === TrackSeatStatus.UNAVAILABLE ? (
                              <span
                                className="ui-tooltip ui-tooltip-bottom inline-flex h-5 w-5 items-center justify-center text-white/34"
                                data-tip={pick(locale, { en: "Empty", ru: "Пусто" })}
                              >
                                <Minus className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-sand">
                                {seat.isOptional ? `${seat.label} · OPT` : seat.label}
                              </span>
                            )}
                          </div>

                          {seatRequests.length > 0 ? (
                            <SeatRequestsControl
                              locale={locale}
                              preferAbove={preferInviteAbove}
                              requests={seatRequests}
                            />
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {canClaim ? (
                            <form action={claimSeatAction}>
                              <input name="seatId" type="hidden" value={seat.id} />
                              <input name="eventSlug" type="hidden" value={eventSlug} />
                              <button
                                aria-label={pick(locale, {
                                  en: `Join ${seat.label}`,
                                  ru: `Занять ${seat.label}`,
                                })}
                                className="rounded-sm border border-gold/40 bg-gold px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-gold/90"
                                type="submit"
                              >
                                {!isOpen && allowClosedOptionalRequests && seat.isOptional
                                  ? pick(locale, { en: "Request spot", ru: "Запросить место" })
                                  : pick(locale, { en: "Join", ru: "Вписаться" })}
                              </button>
                            </form>
                          ) : null}

                          {canInvite ? (
                            <div className="inline-flex items-center gap-1 rounded-sm border border-white/16 bg-white/8 px-1.5 py-1">
                              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/78">
                                {pick(locale, { en: "Invite", ru: "Позвать" })}
                              </span>
                              <InviteControl
                                allowClosedOptionalRequests={allowClosedOptionalRequests}
                                eventSlug={eventSlug}
                                locale={locale}
                                preferAbove={preferInviteAbove}
                                seat={seat}
                              />
                            </div>
                          ) : null}

                          {canManage && seat.status === TrackSeatStatus.CLAIMED ? (
                            <form action={releaseSeatAction}>
                              <input name="seatId" type="hidden" value={seat.id} />
                              <input name="eventSlug" type="hidden" value={eventSlug} />
                              <button
                                aria-label={pick(locale, {
                                  en: `Release ${seat.label}`,
                                  ru: `Освободить ${seat.label}`,
                                })}
                                className="rounded-sm border border-white/16 bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/14"
                                type="submit"
                              >
                                {isSelfSeat
                                  ? pick(locale, { en: "Leave", ru: "Выписаться" })
                                  : pick(locale, { en: "Release", ru: "Освободить" })}
                              </button>
                            </form>
                          ) : null}

                          {userHasPendingRequest ? (
                            <span className="rounded-full border border-blue/30 bg-blue/16 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                              {pick(locale, { en: "Request sent", ru: "Запрос отправлен" })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
