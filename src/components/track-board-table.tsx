"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { TrackSeatStatus, type UserRole } from "@prisma/client";
import {
  ArrowDown,
  ArrowUpDown,
  FileText,
  LogOut,
  Minus,
  Search,
  Send,
  UserPlus,
  X,
  Youtube,
} from "lucide-react";

import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { expandSeatColumns, getTrackReadinessState, type LineupSlotLite } from "@/lib/event-board";
import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey } from "@/lib/role-families";
import { parseClosedOptionalSeatRequestMeta } from "@/lib/track-invite-meta";
import { getTrackInfoKeys, getTrackInfoLabel, type TrackInfoField } from "@/lib/track-info-flags";
import { cn } from "@/lib/utils";

import {
  cancelTrackAction,
  claimSeatInlineAction,
  inviteToSeatInlineAction,
  releaseSeatInlineAction,
  updateTrackArrangementAction,
} from "@/server/actions";

import { FLOATING_TOAST_ERROR_AUTO_HIDE_MS, FloatingToast } from "@/components/floating-toast";
import { TrackArrangementEditLauncher } from "@/components/track-arrangement-edit-launcher";
import { Loader } from "@/components/ui/loader";

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
    id: string;
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

type BoardFeedback = {
  description: string;
  title: string;
  tone: "error" | "success";
};

type InviteableUser = {
  id: string;
  telegramUsername: string | null;
  fullName: string | null;
};

type BoardUpdateEventDetail = {
  eventId: string;
  reason: string;
};

const invitePopoverMargin = 12;
const invitePopoverGap = 8;
const invitePopoverMaxWidth = 288;
const invitePopoverMaxHeight = 276;
const invitePopoverMinHeight = 120;
const trackNotesPopoverMaxWidth = 256;

type InvitePopoverLayoutInput = {
  align: "end" | "start";
  maxWidth?: number;
  preferAbove: boolean;
  stickyTopBoundary?: number;
  triggerRect: Pick<DOMRect, "bottom" | "left" | "right" | "top">;
  viewportHeight: number;
  viewportWidth: number;
};

type InvitePopoverLayout = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getInvitePopoverLayout({
  align,
  maxWidth = invitePopoverMaxWidth,
  preferAbove,
  stickyTopBoundary,
  triggerRect,
  viewportHeight,
  viewportWidth,
}: InvitePopoverLayoutInput): InvitePopoverLayout {
  const topBoundary = Math.max(invitePopoverMargin, stickyTopBoundary ?? invitePopoverMargin);
  const availableWidth = Math.max(0, viewportWidth - invitePopoverMargin * 2);
  const width = Math.min(maxWidth, availableWidth);
  const preferredLeft = align === "start" ? triggerRect.left : triggerRect.right - width;
  const maxLeft = Math.max(invitePopoverMargin, viewportWidth - width - invitePopoverMargin);
  const left = clampValue(preferredLeft, invitePopoverMargin, maxLeft);

  const spaceAbove = Math.max(0, triggerRect.top - invitePopoverMargin - invitePopoverGap);
  const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - invitePopoverMargin - invitePopoverGap);
  let placeAbove = preferAbove;
  if (!placeAbove && spaceBelow < invitePopoverMaxHeight && spaceAbove > spaceBelow) {
    placeAbove = true;
  }
  if (placeAbove && spaceAbove < invitePopoverMinHeight && spaceBelow > spaceAbove) {
    placeAbove = false;
  }

  const viewportMaxHeight = Math.max(invitePopoverMinHeight, viewportHeight - invitePopoverMargin * 2);
  const sideSpace = placeAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(
    invitePopoverMaxHeight,
    viewportMaxHeight,
    Math.max(invitePopoverMinHeight, sideSpace),
  );
  const preferredTop = placeAbove
    ? triggerRect.top - maxHeight - invitePopoverGap
    : triggerRect.bottom + invitePopoverGap;
  const maxTop = Math.max(topBoundary, viewportHeight - maxHeight - invitePopoverMargin);
  const top = clampValue(preferredTop, topBoundary, maxTop);

  return { left, maxHeight, top, width };
}

function getStickyTableHeaderBottom(trigger: HTMLElement) {
  const table = trigger.closest("table");
  const header = table?.querySelector("thead");
  const headerBottom = header?.getBoundingClientRect().bottom;

  return typeof headerBottom === "number" ? headerBottom + invitePopoverGap : undefined;
}

// The board table grows with the page (no internal vertical scroll). Its horizontal scroll
// wrapper uses `overflow-x: auto`, which makes it a vertical scroll container too, so a plain
// `position: sticky` header sticks to that never-scrolling wrapper instead of the viewport.
// We instead translate the whole <thead> down by the distance needed to hold it just under the
// sticky site header while the table body is still in view.
export function getStickyHeaderTranslateY({
  tableTop,
  tableHeight,
  theadHeight,
  stickyOffset,
}: {
  tableTop: number;
  tableHeight: number;
  theadHeight: number;
  stickyOffset: number;
}) {
  const desired = stickyOffset - tableTop;
  const maxTranslate = Math.max(0, tableHeight - theadHeight);
  return Math.max(0, Math.min(desired, maxTranslate));
}

function measureStickyHeaderOffset() {
  if (typeof document === "undefined") {
    return 0;
  }

  const siteHeader = document.querySelector("header");
  const rect = siteHeader?.getBoundingClientRect();
  if (!rect || rect.top > 1) {
    return 0;
  }

  return Math.max(0, Math.round(rect.bottom));
}

function useStickyTableHeader() {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);

  useEffect(() => {
    const table = tableRef.current;
    const thead = theadRef.current;
    if (!table || !thead) {
      return;
    }

    let frameId = 0;
    const update = () => {
      frameId = 0;
      const tableRect = table.getBoundingClientRect();
      const translateY = getStickyHeaderTranslateY({
        tableTop: tableRect.top,
        tableHeight: tableRect.height,
        theadHeight: thead.getBoundingClientRect().height,
        stickyOffset: measureStickyHeaderOffset(),
      });
      thead.style.transform = translateY > 0 ? `translateY(${translateY}px)` : "";
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      thead.style.transform = "";
    };
  }, []);

  return { tableRef, theadRef };
}

function useCloseOnOutsidePointerDown({
  containerRef,
  isOpen,
  onClose,
}: {
  containerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [containerRef, isOpen, onClose]);
}

type SeatAvailabilitySort = {
  direction: "open-first" | "occupied-first";
  seatIndex: number;
  slotId: string;
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

function getTrackFullTitle(track: BoardTrack) {
  return `${track.song.artist.name} - ${track.song.title}`;
}

type SeatLabelSource = {
  isOptional: boolean;
  label: string;
  status: TrackSeatStatus;
  user?: {
    telegramUsername: string | null;
    fullName: string | null;
  } | null;
};

export function getMissingRequiredSeatLabels(seats: SeatLabelSource[]) {
  return seats
    .filter((seat) => seat.status === TrackSeatStatus.OPEN && !seat.isOptional)
    .map((seat) => seat.label);
}

export function getMobileSeatDisplayLabel(seat: SeatLabelSource, locale: Locale) {
  if (seat.user) {
    return formatPersonLabel(seat.user, locale);
  }
  if (seat.status === TrackSeatStatus.UNAVAILABLE) {
    return pick(locale, {
      en: `${seat.label} · n/a`,
      ru: `${seat.label} · n/a`,
    });
  }
  if (seat.isOptional) {
    return pick(locale, {
      en: `${seat.label} · optional`,
      ru: `${seat.label} · optional`,
    });
  }

  return seat.label;
}

function getMissingRequiredSummary(seats: SeatLabelSource[], locale: Locale) {
  const missingLabels = getMissingRequiredSeatLabels(seats);
  if (missingLabels.length === 0) {
    return pick(locale, { en: "All required filled", ru: "Обязательные закрыты" });
  }

  return pick(locale, {
    en: `Missing: ${missingLabels.join(", ")}`,
    ru: `Не хватает: ${missingLabels.join(", ")}`,
  });
}

function shouldShowPlaybackColumn(trackInfoFields: TrackInfoField[]) {
  return trackInfoFields.some((field) => field.key === "playback");
}

function getVisibleTrackInfoLabels({
  locale,
  track,
  trackInfoFields,
}: {
  locale: Locale;
  track: BoardTrack;
  trackInfoFields: TrackInfoField[];
}) {
  const activeKeys = getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired);
  return trackInfoFields
    .filter((field) => field.key !== "playback" && activeKeys.includes(field.key))
    .map((field) => getTrackInfoLabel(field, locale));
}

function getSeatFlashSignature(seat: BoardTrack["seats"][number]) {
  return [
    seat.status,
    seat.userId ?? "",
    seat.isOptional ? "optional" : "required",
    seat.invites.map((invite) => `${invite.id}:${invite.status}`).join("|"),
  ].join(":");
}

function getChangedSeatIds(previousTracks: BoardTrack[], nextTracks: BoardTrack[]) {
  const previousSeats = new Map<string, string>();
  for (const track of previousTracks) {
    for (const seat of track.seats) {
      previousSeats.set(seat.id, getSeatFlashSignature(seat));
    }
  }

  return nextTracks
    .flatMap((track) => track.seats)
    .filter((seat) => previousSeats.get(seat.id) !== undefined && previousSeats.get(seat.id) !== getSeatFlashSignature(seat))
    .map((seat) => seat.id);
}

function statusDotClass(status: TrackSeatStatus, isSelfSeat = false) {
  if (isSelfSeat) {
    return "bg-blue";
  }
  if (status === TrackSeatStatus.UNAVAILABLE) {
    return "bg-white/30";
  }
  return "bg-white/46";
}

export function getSeatCellClass(
  _status: TrackSeatStatus,
  _isOptional: boolean,
  isSelfSeat = false,
) {
  if (isSelfSeat) {
    return "bg-blue/[0.14] ring-1 ring-inset ring-blue/45 hover:bg-blue/[0.18]";
  }

  return "bg-white/[0.045] hover:bg-white/[0.075]";
}

export function getTrackRowBackgroundClass({
  index,
  isReady,
}: {
  index: number;
  isMyTrack: boolean;
  isReady: boolean;
}) {
  if (isReady) {
    return "bg-emerald-500/[0.16]";
  }

  return index % 2 === 0 ? "bg-white/[0.05]" : "bg-white/[0.08]";
}

function iconButtonClass(variant: "primary" | "secondary" = "secondary") {
  return cn(
    "ui-tooltip inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25 hover:-translate-y-0.5",
    variant === "primary" && "border-gold/50 bg-gold text-ink hover:bg-gold/90",
    variant === "secondary" && "text-white/62 hover:border-white/10 hover:bg-white/10 hover:text-white",
  );
}

function claimSeatButtonClass(isOptional: boolean, variant: "icon" | "text") {
  const colorClass = isOptional
    ? "border-emerald-300/30 bg-emerald-500/[0.16] text-emerald-50 hover:border-emerald-300/45 hover:bg-emerald-500/[0.22] focus-visible:ring-emerald-300/25"
    : "border-gold/50 bg-gold text-ink hover:bg-gold/90 focus-visible:ring-gold/25";

  if (variant === "text") {
    return cn(
      "inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70",
      colorClass,
    );
  }

  return cn(
    "ui-tooltip inline-flex h-6 w-6 items-center justify-center rounded-sm border transition duration-200 focus-visible:outline-none focus-visible:ring-2 hover:-translate-y-0.5",
    colorClass,
  );
}

function cellFrameClass() {
  return "border-white/12";
}

function buildSeatIndex(track: BoardTrack) {
  return new Map(track.seats.map((seat) => [`${seat.lineupSlotId}:${seat.seatIndex}`, seat] as const));
}

function getSeatAvailabilityRank(status: TrackSeatStatus | undefined) {
  if (status === TrackSeatStatus.OPEN) {
    return 0;
  }
  if (status === TrackSeatStatus.CLAIMED) {
    return 1;
  }
  return 2;
}

export function sortTracksBySeatAvailability<
  T extends {
    id: string;
    seats: Array<{
      lineupSlotId: string;
      seatIndex: number;
      status: TrackSeatStatus;
    }>;
  },
>(tracks: T[], sort: SeatAvailabilitySort | null) {
  if (!sort) {
    return tracks;
  }

  const directionMultiplier = sort.direction === "open-first" ? 1 : -1;

  return [...tracks].sort((left, right) => {
    const leftSeat = left.seats.find(
      (seat) => seat.lineupSlotId === sort.slotId && seat.seatIndex === sort.seatIndex,
    );
    const rightSeat = right.seats.find(
      (seat) => seat.lineupSlotId === sort.slotId && seat.seatIndex === sort.seatIndex,
    );
    const leftRank = getSeatAvailabilityRank(leftSeat?.status);
    const rightRank = getSeatAvailabilityRank(rightSeat?.status);

    if (leftRank === 2 && rightRank !== 2) {
      return 1;
    }
    if (rightRank === 2 && leftRank !== 2) {
      return -1;
    }
    if (leftRank !== rightRank) {
      return (leftRank - rightRank) * directionMultiplier;
    }

    return tracks.indexOf(left) - tracks.indexOf(right);
  });
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

function ClaimSeatButton({
  className,
  disabled = false,
  isPending = false,
  onClick,
  label,
  title,
  variant = "icon",
}: {
  className: string;
  disabled?: boolean;
  isPending?: boolean;
  onClick: () => void;
  label: string;
  title: string;
  variant?: "icon" | "text";
}) {
  return (
    <button
      aria-label={title}
      className={cn(className, isPending && "cursor-wait")}
      data-tip={label}
      disabled={disabled || isPending}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      title={title}
      type="button"
    >
      {isPending ? (
        variant === "icon" ? (
          <Loader className="text-current" />
        ) : (
          <>
            <Loader className="text-current" />
            <span>{label}</span>
          </>
        )
      ) : variant === "icon" ? (
        <UserPlus className="h-3.5 w-3.5" />
      ) : (
        label
      )}
    </button>
  );
}

function buildClaimFeedback(
  locale: Locale,
  result:
    | { ok: true; notice: "seat-claimed" | "opt-request-sent" | "opt-request-saved" }
    | { ok: false; error: string },
): BoardFeedback {
  if (result.ok) {
    if (result.notice === "opt-request-sent" || result.notice === "opt-request-saved") {
      return {
        tone: "success",
        title:
          result.notice === "opt-request-saved"
            ? pick(locale, { en: "Request saved", ru: "Запрос сохранён" })
            : pick(locale, { en: "Request sent", ru: "Запрос отправлен" }),
        description: pick(locale, {
          en:
            result.notice === "opt-request-saved"
              ? "The request is saved locally and still visible to the track proposer."
              : "The track proposer will review your request.",
          ru:
            result.notice === "opt-request-saved"
              ? "Запрос сохранён локально и всё равно будет виден автору трека."
              : "Автор трека увидит и рассмотрит твой запрос.",
        }),
      };
    }

    return {
      tone: "success",
      title: pick(locale, { en: "You're in", ru: "Ты в лайнапе" }),
      description: pick(locale, {
        en: "The seat was claimed and the board updated instantly.",
        ru: "Место занято, борд обновился сразу.",
      }),
    };
  }

  if (result.error === "username-required") {
    return {
      tone: "error",
      title: pick(locale, { en: "Telegram username needed", ru: "Нужен Telegram-ник" }),
      description: pick(locale, {
        en: "Set your Telegram username in your profile before changing the board.",
        ru: "Укажи свой Telegram-ник в профиле, прежде чем менять сетлист.",
      }),
    };
  }

  if (result.error === "seat-occupied") {
    return {
      tone: "error",
      title: pick(locale, { en: "Seat already taken", ru: "Место уже занято" }),
      description: pick(locale, {
        en: "Someone joined this position first. Pick another open seat.",
        ru: "Кто-то занял это место раньше. Выбери другое открытое место.",
      }),
    };
  }

  if (result.error === "seat-unavailable") {
    return {
      tone: "error",
      title: pick(locale, { en: "Seat unavailable", ru: "Место недоступно" }),
      description: pick(locale, {
        en: "This position is disabled in the current arrangement.",
        ru: "Эта позиция выключена в текущей аранжировке.",
      }),
    };
  }

  if (result.error === "track-limit") {
    return {
      tone: "error",
      title: pick(locale, { en: "Track limit reached", ru: "Лимит треков достигнут" }),
      description: pick(locale, {
        en: "Leave one of your current songs before joining another one.",
        ru: "Сначала выпишись из одной из текущих песен, потом вписывайся в новую.",
      }),
    };
  }

  if (result.error === "duplicate-role-family") {
    return {
      tone: "error",
      title: pick(locale, { en: "Already on this role", ru: "Эта роль уже занята тобой" }),
      description: pick(locale, {
        en: "You can join the same song multiple times only with different instrument families.",
        ru: "В одну песню можно вписаться несколько раз только на разные типы инструментов.",
      }),
    };
  }

  if (result.error === "event-locked") {
    return {
      tone: "error",
      title: pick(locale, { en: "Gig locked", ru: "Гиг закрыт" }),
      description: pick(locale, {
        en: "Participant changes are closed for this gig right now.",
        ru: "Сейчас этот гиг закрыт для изменений участников.",
      }),
    };
  }

  return {
    tone: "error",
    title: pick(locale, { en: "Could not join", ru: "Не получилось вписаться" }),
    description: pick(locale, {
      en: "Please try again in a moment.",
      ru: "Попробуй ещё раз через пару секунд.",
    }),
  };
}

function buildInviteFeedback(
  locale: Locale,
  result:
    | { ok: true; notice: "invite-sent" | "invite-saved-without-telegram" | "seat-claimed" | "opt-request-sent" | "opt-request-saved" }
    | { ok: false; error: string },
): BoardFeedback {
  if (result.ok) {
    if (result.notice === "invite-saved-without-telegram") {
      return {
        tone: "success",
        title: pick(locale, { en: "Invite saved", ru: "Инвайт сохранён" }),
        description: pick(locale, {
          en: "The invite is visible in the profile, but Telegram delivery did not confirm.",
          ru: "Инвайт виден в профиле, но Telegram-доставка не подтвердилась.",
        }),
      };
    }
    if (result.notice === "opt-request-sent" || result.notice === "opt-request-saved") {
      return buildClaimFeedback(locale, { ok: true, notice: result.notice });
    }
    if (result.notice === "seat-claimed") {
      return buildClaimFeedback(locale, { ok: true, notice: result.notice });
    }

    return {
      tone: "success",
      title: pick(locale, { en: "Invite sent", ru: "Инвайт отправлен" }),
      description: pick(locale, {
        en: "The musician can accept it from their profile.",
        ru: "Музыкант сможет принять его в профиле.",
      }),
    };
  }

  const errorCopy: Record<string, BoardFeedback> = {
    "invite-recipient-required": {
      tone: "error",
      title: pick(locale, { en: "Pick a musician", ru: "Выбери музыканта" }),
      description: pick(locale, {
        en: "Use the registered musicians list before sending an invite.",
        ru: "Перед отправкой выбери человека из списка зарегистрированных музыкантов.",
      }),
    },
    "invite-already-pending": {
      tone: "error",
      title: pick(locale, { en: "Invite already pending", ru: "Инвайт уже ожидает" }),
      description: pick(locale, {
        en: "This person already has an active invite for the seat.",
        ru: "У этого человека уже есть активный инвайт на это место.",
      }),
    },
    "invite-track-limit": {
      tone: "error",
      title: pick(locale, { en: "Track limit reached", ru: "Лимит треков достигнут" }),
      description: pick(locale, {
        en: "The musician is already at the event track limit.",
        ru: "У музыканта уже достигнут лимит треков на этот гиг.",
      }),
    },
    "invite-duplicate-role-family": {
      tone: "error",
      title: pick(locale, { en: "Role already taken", ru: "Роль уже занята" }),
      description: pick(locale, {
        en: "The musician already has this instrument family on the song.",
        ru: "У музыканта уже есть эта группа инструментов в песне.",
      }),
    },
  };

  return (
    errorCopy[result.error] ?? {
      tone: "error",
      title: pick(locale, { en: "Could not send invite", ru: "Не получилось отправить" }),
      description: pick(locale, {
        en: "Please pick a registered musician and try again.",
        ru: "Выбери зарегистрированного музыканта и попробуй ещё раз.",
      }),
    }
  );
}

function applyOptimisticClaim({
  currentTracks,
  seatId,
  user,
}: {
  currentTracks: BoardTrack[];
  seatId: string;
  user: NonNullable<BoardUser>;
}) {
  return currentTracks.map((track) => ({
    ...track,
    seats: track.seats.map((seat) =>
      seat.id === seatId
        ? {
            ...seat,
            status: TrackSeatStatus.CLAIMED,
            userId: user.id,
            user: {
              telegramUsername: user.telegramUsername,
              fullName: user.fullName,
            },
          }
        : seat,
    ),
  }));
}

function SeatRequestsControl({
  align = "end",
  requests,
  locale,
  preferAbove = false,
}: {
  align?: "end" | "start";
  requests: SeatRequestEntry[];
  locale: Locale;
  preferAbove?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useCloseOnOutsidePointerDown({
    containerRef: detailsRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });

  if (requests.length === 0) {
    return null;
  }

  return (
    <details
      className="group/details relative flex w-6 justify-end"
      open={isOpen}
      ref={detailsRef}
    >
      <summary
        className="flex h-[1.125rem] w-[1.125rem] list-none cursor-pointer items-center justify-center rounded-full border border-white/16 bg-black/28 text-[8px] font-semibold leading-none text-white/88 transition hover:bg-black/40 -translate-x-[3px]"
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
        title={pick(locale, {
          en: "Open pending requests",
          ru: "Показать ожидающие запросы",
        })}
      >
        {requests.length}
      </summary>
      <div
        className={cn(
          "absolute z-40 mt-1 w-56 space-y-2 rounded-md border border-white/10 bg-stage p-2 shadow-card",
          align === "start" ? "left-0" : "right-0",
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

function TrackNotesControl({
  comment,
  locale,
  layout = "desktop",
}: {
  comment: string;
  locale: Locale;
  layout?: "desktop" | "mobile";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverLayout, setPopoverLayout] = useState<InvitePopoverLayout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPopoverLayout(null);
      return;
    }

    function updatePopoverLayout() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      setPopoverLayout(
        getInvitePopoverLayout({
          align: layout === "desktop" ? "end" : "start",
          maxWidth: trackNotesPopoverMaxWidth,
          preferAbove: false,
          stickyTopBoundary: getStickyTableHeaderBottom(trigger),
          triggerRect: trigger.getBoundingClientRect(),
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        }),
      );
    }

    updatePopoverLayout();
    window.addEventListener("resize", updatePopoverLayout);
    window.addEventListener("scroll", updatePopoverLayout, true);

    return () => {
      window.removeEventListener("resize", updatePopoverLayout);
      window.removeEventListener("scroll", updatePopoverLayout, true);
    };
  }, [isOpen, layout]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isOpen]);

  const notesPopover = isOpen ? (
    <div
      className="fixed z-[90] rounded-md border border-white/10 bg-stage p-3 text-xs leading-5 text-white/74 shadow-card"
      data-testid="track-notes-popover"
      ref={popoverRef}
      style={
        popoverLayout
          ? {
              left: `${popoverLayout.left}px`,
              maxHeight: `${popoverLayout.maxHeight}px`,
              overflowY: "auto",
              top: `${popoverLayout.top}px`,
              width: `${popoverLayout.width}px`,
            }
          : {
              left: `${invitePopoverMargin}px`,
              maxHeight: `calc(100vh - ${invitePopoverMargin * 2}px)`,
              overflowY: "auto",
              top: `${invitePopoverMargin}px`,
              width: `calc(100vw - ${invitePopoverMargin * 2}px)`,
            }
      }
    >
      {comment}
    </div>
  ) : null;

  return (
    <div className="group">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn("list-none cursor-pointer text-white", iconButtonClass())}
        data-tip={pick(locale, { en: "Notes", ru: "Заметки" })}
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
        title={pick(locale, {
          en: "Track notes",
          ru: "Заметки к треку",
        })}
        ref={triggerRef}
        type="button"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
      {notesPopover && typeof document !== "undefined"
        ? createPortal(notesPopover, document.body)
        : null}
    </div>
  );
}

function InviteControl({
  activeInviteControlId,
  allowClosedOptionalRequests,
  align = "end",
  controlId,
  inviteableUsers,
  onInviteComplete,
  onOpenChange,
  seat,
  eventSlug,
  locale,
  preferAbove = false,
}: {
  activeInviteControlId: string | null;
  allowClosedOptionalRequests: boolean;
  align?: "end" | "start";
  controlId: string;
  inviteableUsers: InviteableUser[];
  onInviteComplete: (result:
    | { ok: true; notice: "invite-sent" | "invite-saved-without-telegram" | "seat-claimed" | "opt-request-sent" | "opt-request-saved" }
    | { ok: false; error: string }, seatId: string, recipient: InviteableUser | null) => void;
  onOpenChange: (controlId: string | null) => void;
  seat: BoardTrack["seats"][number];
  eventSlug: string;
  locale: Locale;
  preferAbove?: boolean;
}) {
  const requestLabel = allowClosedOptionalRequests && seat.isOptional;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<InviteableUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLFormElement>(null);
  const [popoverLayout, setPopoverLayout] = useState<InvitePopoverLayout | null>(null);
  const isOpen = activeInviteControlId === controlId;
  const normalizedQuery = debouncedQuery.trim().toLowerCase().replace(/^@+/, "");
  const filteredUsers = inviteableUsers
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }
      return [candidate.telegramUsername, candidate.fullName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .slice(0, 8);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedUser(null);
      setIsSubmitting(false);
      setPopoverLayout(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePopoverLayout() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      setPopoverLayout(
        getInvitePopoverLayout({
          align,
          preferAbove,
          stickyTopBoundary: getStickyTableHeaderBottom(trigger),
          triggerRect: trigger.getBoundingClientRect(),
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        }),
      );
    }

    updatePopoverLayout();
    window.addEventListener("resize", updatePopoverLayout);
    window.addEventListener("scroll", updatePopoverLayout, true);

    return () => {
      window.removeEventListener("resize", updatePopoverLayout);
      window.removeEventListener("scroll", updatePopoverLayout, true);
    };
  }, [align, isOpen, preferAbove]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      onOpenChange(null);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isOpen, onOpenChange]);

  async function submitInvite() {
    if (!selectedUser || isSubmitting) {
      onInviteComplete({ ok: false, error: "invite-recipient-required" }, seat.id, selectedUser);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("seatId", seat.id);
    formData.set("eventSlug", eventSlug);
    formData.set("recipientUserId", selectedUser.id);

    try {
      const result = await inviteToSeatInlineAction(formData);
      onInviteComplete(result, seat.id, selectedUser);
      if (result.ok) {
        onOpenChange(null);
      }
    } catch {
      onInviteComplete({ ok: false, error: "invite-failed" }, seat.id, selectedUser);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <button
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
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(isOpen ? null : controlId);
        }}
        ref={triggerRef}
        type="button"
      >
        <Send className="h-3.5 w-3.5 -translate-x-[0.5px]" />
      </button>
      {isOpen ? (
        <form
          className="fixed z-40 flex flex-col gap-2 rounded-md border border-white/10 bg-stage p-2 shadow-card"
          onSubmit={(event) => {
            event.preventDefault();
            void submitInvite();
          }}
          ref={popoverRef}
          style={
            popoverLayout
              ? {
                  left: `${popoverLayout.left}px`,
                  maxHeight: `${popoverLayout.maxHeight}px`,
                  top: `${popoverLayout.top}px`,
                  width: `${popoverLayout.width}px`,
                }
              : {
                  left: `${invitePopoverMargin}px`,
                  maxHeight: `calc(100vh - ${invitePopoverMargin * 2}px)`,
                  top: `${invitePopoverMargin}px`,
                  width: `calc(100vw - ${invitePopoverMargin * 2}px)`,
                }
          }
        >
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/42" />
            <input
              aria-label={pick(locale, {
                en: "Search registered musicians",
                ru: "Поиск зарегистрированных музыкантов",
              })}
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1.5 text-xs focus:ring-0"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedUser(null);
              }}
              placeholder={pick(locale, {
                en: "Name or @telegram",
                ru: "Имя или @telegram",
              })}
              value={
                selectedUser
                  ? selectedUser.telegramUsername
                    ? `@${selectedUser.telegramUsername}`
                    : selectedUser.fullName ?? ""
                  : query
              }
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-white/10 bg-black/24">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((candidate) => {
                const label = candidate.telegramUsername
                  ? `@${candidate.telegramUsername}`
                  : candidate.fullName ?? "Unknown";
                const secondary =
                  candidate.telegramUsername && candidate.fullName ? candidate.fullName : null;

                return (
                  <button
                    className={cn(
                      "flex w-full flex-col px-2.5 py-2 text-left text-xs transition hover:bg-white/8",
                      selectedUser?.id === candidate.id && "bg-gold/12 text-sand",
                    )}
                    key={candidate.id}
                    onClick={(event) => {
                      event.preventDefault();
                      setSelectedUser(candidate);
                    }}
                    type="button"
                  >
                    <span className="truncate font-semibold text-sand">{label}</span>
                    {secondary ? (
                      <span className="truncate text-[10px] text-white/54">{secondary}</span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-2 text-[11px] text-white/54">
                {pick(locale, {
                  en: "No registered musicians found.",
                  ru: "Зарегистрированные музыканты не найдены.",
                })}
              </p>
            )}
          </div>
          <button
            className="inline-flex items-center justify-center gap-1 rounded-sm border border-white/10 bg-red/90 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-red disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !selectedUser}
            type="submit"
          >
            {isSubmitting ? <Loader className="text-current" /> : null}
            {pick(locale, {
              en: requestLabel ? "Send request" : "Send invite",
              ru: requestLabel ? "Отправить запрос" : "Отправить",
            })}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function TrackBoardTable({
  allowClosedOptionalRequests,
  eventSlug,
  highlightTrackId,
  inviteableUsers = [],
  lineupSlots,
  locale,
  trackInfoFields,
  trackNumbers,
  tracks,
  user,
  isOpen,
}: {
  allowClosedOptionalRequests: boolean;
  eventSlug: string;
  highlightTrackId?: string | null;
  inviteableUsers?: InviteableUser[];
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  trackInfoFields: TrackInfoField[];
  trackNumbers?: Record<string, number>;
  tracks: BoardTrack[];
  user: BoardUser;
  isOpen: boolean;
}) {
  const [currentTracks, setCurrentTracks] = useState(tracks);
  const [pendingSeatId, setPendingSeatId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BoardFeedback | null>(null);
  const [activeInviteControlId, setActiveInviteControlId] = useState<string | null>(null);
  const [activeHighlightTrackId, setActiveHighlightTrackId] = useState<string | null>(
    highlightTrackId ?? null,
  );
  const [flashingSeatIds, setFlashingSeatIds] = useState<Set<string>>(new Set());
  const previousTracksRef = useRef(tracks);
  const { tableRef, theadRef } = useStickyTableHeader();
  const [seatSort, setSeatSort] = useState<SeatAvailabilitySort | null>(null);
  const columns = expandSeatColumns(lineupSlots);
  const columnGroups = groupColumns(columns);
  const showPlaybackColumn = shouldShowPlaybackColumn(trackInfoFields);
  const displayTracks = sortTracksBySeatAvailability(currentTracks, seatSort);
  const tableMinWidthRem = 22 + (showPlaybackColumn ? 5.75 : 0) + columns.length * 7.5;

  useEffect(() => {
    const changedSeatIds = getChangedSeatIds(previousTracksRef.current, tracks);
    previousTracksRef.current = tracks;
    if (changedSeatIds.length > 0) {
      setFlashingSeatIds(new Set(changedSeatIds));
      const timeoutId = window.setTimeout(() => setFlashingSeatIds(new Set()), 2200);
      setFeedback({
        tone: "success",
        title: pick(locale, { en: "Board updated", ru: "Сетлист обновлён" }),
        description: pick(locale, {
          en: "Fresh changes are highlighted on the board.",
          ru: "Свежие изменения подсвечены в таблице.",
        }),
      });
      setCurrentTracks(tracks);
      return () => window.clearTimeout(timeoutId);
    }

    setCurrentTracks(tracks);
    return undefined;
  }, [locale, tracks]);

  useEffect(() => {
    function handleBoardUpdate(event: Event) {
      const detail = (event as CustomEvent<BoardUpdateEventDetail>).detail;
      setFeedback({
        tone: "success",
        title: pick(locale, { en: "Live board activity", ru: "Активность в сетлисте" }),
        description: pick(locale, {
          en: detail?.reason ? "Someone updated the board. Refreshing now." : "Refreshing the board now.",
          ru: detail?.reason ? "Кто-то обновил сетлист. Сейчас подтянем изменения." : "Сейчас подтянем изменения.",
        }),
      });
    }

    window.addEventListener("jammers:board-update", handleBoardUpdate);
    return () => window.removeEventListener("jammers:board-update", handleBoardUpdate);
  }, [locale]);

  useEffect(() => {
    setActiveHighlightTrackId(highlightTrackId ?? null);
  }, [highlightTrackId]);

  useEffect(() => {
    if (!activeHighlightTrackId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(`track-${activeHighlightTrackId}`);
      if (!element) {
        return;
      }

      const mobileDetails = element.tagName === "DETAILS" ? element : element.closest("details");
      if (mobileDetails instanceof HTMLDetailsElement) {
        mobileDetails.open = true;
      }

      element.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });

    const timeoutId = window.setTimeout(() => {
      setActiveHighlightTrackId((current) =>
        current === activeHighlightTrackId ? null : current,
      );
    }, 3600);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeHighlightTrackId]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    // Validation / error feedback must stay long enough to read the constraint; routine
    // board-update confirmations clear quickly.
    const autoHideMs = feedback.tone === "error" ? FLOATING_TOAST_ERROR_AUTO_HIDE_MS : 3200;
    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, autoHideMs);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  async function handleClaimSeat({
    isRequestOnly,
    seatId,
  }: {
    isRequestOnly: boolean;
    seatId: string;
  }) {
    if (!user || pendingSeatId) {
      return;
    }

    const previousTracks = currentTracks;

    if (!isRequestOnly) {
      setCurrentTracks((value) =>
        applyOptimisticClaim({
          currentTracks: value,
          seatId,
          user,
        }),
      );
    }

    setPendingSeatId(seatId);

    const formData = new FormData();
    formData.set("seatId", seatId);
    formData.set("eventSlug", eventSlug);
    try {
      const result = await claimSeatInlineAction(formData);

      if (!result.ok && !isRequestOnly) {
        setCurrentTracks(previousTracks);
      }

      setFeedback(buildClaimFeedback(locale, result));
    } catch {
      if (!isRequestOnly) {
        setCurrentTracks(previousTracks);
      }
      setFeedback({
        tone: "error",
        title: pick(locale, { en: "Could not join", ru: "Не получилось вписаться" }),
        description: pick(locale, {
          en: "The board did not confirm your change. Please try again.",
          ru: "Борд не подтвердил изменение. Попробуй ещё раз.",
        }),
      });
    } finally {
      setPendingSeatId(null);
    }
  }

  async function handleReleaseSeat(seatId: string) {
    if (!pendingSeatId) {
      const previousTracks = currentTracks;

      setCurrentTracks((value) =>
        value.map((track) => ({
          ...track,
          seats: track.seats.map((seat) =>
            seat.id === seatId
              ? {
                  ...seat,
                  status: TrackSeatStatus.OPEN,
                  userId: null,
                  user: null,
                }
              : seat,
          ),
        })),
      );
      setPendingSeatId(seatId);

      const formData = new FormData();
      formData.set("seatId", seatId);
      formData.set("eventSlug", eventSlug);
      try {
        const result = await releaseSeatInlineAction(formData);

        if (!result.ok) {
          setCurrentTracks(previousTracks);
          setFeedback(
            result.error === "release-not-allowed"
              ? {
                  tone: "error",
                  title: pick(locale, { en: "Can't release seat", ru: "Нельзя освободить место" }),
                  description: pick(locale, {
                    en: "Only the player or an admin can remove this participant.",
                    ru: "Освобождать это место может только сам участник или админ.",
                  }),
                }
              : result.error === "seat-open"
                ? {
                    tone: "error",
                    title: pick(locale, { en: "Seat already open", ru: "Место уже свободно" }),
                    description: pick(locale, {
                      en: "This place was already released elsewhere.",
                      ru: "Это место уже освободили в другом действии.",
                    }),
                  }
                : {
                    tone: "error",
                    title: pick(locale, { en: "Could not release seat", ru: "Не удалось освободить место" }),
                    description: pick(locale, {
                      en: "Please try again in a moment.",
                      ru: "Попробуй ещё раз через пару секунд.",
                    }),
                  },
          );
        } else {
          setFeedback({
            tone: "success",
            title: pick(locale, { en: "Seat released", ru: "Место освобождено" }),
            description: pick(locale, {
              en: "The line-up updated right away.",
              ru: "Лайнап обновился сразу.",
            }),
          });
        }
      } catch {
        setCurrentTracks(previousTracks);
        setFeedback({
          tone: "error",
          title: pick(locale, { en: "Could not release seat", ru: "Не удалось освободить место" }),
          description: pick(locale, {
            en: "The board did not confirm your change. Please try again.",
            ru: "Борд не подтвердил изменение. Попробуй ещё раз.",
          }),
        });
      } finally {
        setPendingSeatId(null);
      }
    }
  }

  function handleInviteComplete(
    result:
      | { ok: true; notice: "invite-sent" | "invite-saved-without-telegram" | "seat-claimed" | "opt-request-sent" | "opt-request-saved" }
      | { ok: false; error: string },
    seatId: string,
    recipient: InviteableUser | null,
  ) {
    setFeedback(buildInviteFeedback(locale, result));
    if (
      !user ||
      !recipient ||
      !result.ok ||
      (result.notice !== "invite-sent" && result.notice !== "invite-saved-without-telegram")
    ) {
      return;
    }

    setCurrentTracks((value) =>
      value.map((track) => ({
        ...track,
        seats: track.seats.map((seat) =>
          seat.id === seatId
            ? {
                ...seat,
                invites: [
                  ...seat.invites,
                  {
                    id: `optimistic-${seatId}-${recipient.id}`,
                    status: "PENDING",
                    deliveryNote: null,
                    senderId: user.id,
                    sender: {
                      telegramUsername: user.telegramUsername,
                      fullName: user.fullName,
                    },
                    recipient: {
                      telegramUsername: recipient.telegramUsername,
                      fullName: recipient.fullName,
                    },
                  },
                ],
              }
            : seat,
        ),
      })),
    );
  }

  function toggleSeatSort(column: (typeof columns)[number]) {
    setSeatSort((current) => {
      if (
        !current ||
        current.slotId !== column.slotId ||
        current.seatIndex !== column.seatIndex
      ) {
        return {
          direction: "open-first",
          slotId: column.slotId,
          seatIndex: column.seatIndex,
        };
      }

      if (current.direction === "open-first") {
        return {
          ...current,
          direction: "occupied-first",
        };
      }

      return null;
    });
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <FloatingToast
          description={feedback.description}
          locale={locale}
          title={feedback.title}
          tone={feedback.tone}
        />
      ) : null}

      <div className="brand-shell hidden overflow-hidden rounded-[1.25rem] border-white/14 shadow-table-glow md:block md:mx-[calc(50%-50vw)] md:w-screen md:rounded-none">
        <div className="h-1 w-full stage-rule" />
        <div className="table-scroll overflow-x-auto overflow-y-clip">
        <table
          className="table-fixed border-separate border-spacing-0"
          ref={tableRef}
          style={{ minWidth: `${tableMinWidthRem}rem`, width: "100%" }}
        >
          <colgroup>
            {/* Song column is flexible: it absorbs leftover width so the
                Artist — Track line gets as much room as possible. The table
                min-width keeps it at ~22rem before horizontal scrolling. */}
            <col />
            {showPlaybackColumn ? <col style={{ width: "5.75rem" }} /> : null}
            {columns.map((column) => (
              <col key={column.seatKey} style={{ width: "7.5rem" }} />
            ))}
          </colgroup>
          <thead className="relative z-30" ref={theadRef}>
            <tr className="h-9 bg-[#1b1b1b] text-white">
              <th
                className="sticky left-0 z-40 border-b border-r border-white/16 bg-[#1b1b1b] px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.24em] text-white/92"
                rowSpan={2}
              >
                {pick(locale, { en: "Song", ru: "Песня" })}
              </th>
              {showPlaybackColumn ? (
                <th
                  className="z-30 border-b border-r border-white/16 bg-[#1b1b1b] px-2 py-2 text-center text-[11px] uppercase tracking-[0.2em] text-white/92"
                  rowSpan={2}
                >
                  {pick(locale, { en: "Playback", ru: "Плейбэк" })}
                </th>
              ) : null}
              {columnGroups.map((group, index) => (
                <th
                  className={cn(
                    "z-30 border-b border-white/16 bg-[#1b1b1b] px-0 py-0 text-left text-[10px] uppercase tracking-[0.22em] text-white/82",
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
                      "z-30 border-b border-r border-white/14 bg-[#1b1b1b] px-1 py-1.5 text-left text-[11px] font-semibold text-white/92",
                      startsNewGroup && "border-l border-white/16",
                    )}
                    key={column.seatKey}
                  >
                    <button
                      className="ui-tooltip flex min-h-7 w-full items-center justify-between gap-1 rounded-sm px-1 text-left transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25"
                      data-tip={pick(locale, {
                        en: "Sort by free or occupied",
                        ru: "Сортировать по свободно/занято",
                      })}
                      onClick={() => toggleSeatSort(column)}
                      type="button"
                    >
                      <span className="block min-w-0 truncate" title={column.shortLabel}>
                        {column.shortLabel}
                      </span>
                      {seatSort?.slotId === column.slotId &&
                      seatSort.seatIndex === column.seatIndex ? (
                        <ArrowDown
                          className={cn(
                            "h-3 w-3 shrink-0 text-gold transition",
                            seatSort.direction === "occupied-first" && "rotate-180",
                          )}
                        />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 shrink-0 text-white/42" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayTracks.map((track, index) => {
              const isMyTrack = Boolean(user && track.seats.some((seat) => seat.userId === user.id));
              const isHighlighted = activeHighlightTrackId === track.id;
              const completion = getTrackCompletionSummary(track.seats);
              const readiness = getTrackReadinessState(track.seats);
              const seatIndex = buildSeatIndex(track);
              const activeTrackInfoLabels = getVisibleTrackInfoLabels({
                locale,
                track,
                trackInfoFields,
              });
              const preferInviteAbove = index >= displayTracks.length - 2;
              const canManageTrack = Boolean(
                isOpen && user && (user.role === "ADMIN" || track.proposedById === user.id),
              );
              // Admins can edit a track at any time; proposers only while the board is open.
              const canEditTrack = Boolean(
                user &&
                  (user.role === "ADMIN" || (isOpen && track.proposedById === user.id)),
              );
              const rowBackground = getTrackRowBackgroundClass({
                index,
                isMyTrack,
                isReady: readiness.isReady,
              });

              return (
                <tr
                  className={cn(
                    "transition hover:bg-white/[0.12]",
                    readiness.isReady &&
                      "shadow-[inset_0_2px_0_rgba(110,231,183,0.62),inset_0_-1px_0_rgba(110,231,183,0.2)] ring-1 ring-inset ring-emerald-300/28",
                    isHighlighted ? "bg-gold/[0.18]" : rowBackground,
                  )}
                  data-readiness={readiness.isReady ? "ready" : undefined}
                  id={`track-${track.id}`}
                  key={track.id}
                >
                  <td
                    data-tone={
                      isHighlighted
                        ? "highlight"
                        : readiness.isReady
                          ? "ready"
                          : index % 2 === 0
                            ? "even"
                            : "odd"
                    }
                    className={cn(
                      "sticky-song-cell sticky left-0 z-40 isolate border-b border-r border-cloud px-2 py-1.5 align-top",
                      "border-white/14",
                      readiness.isReady &&
                        "overflow-hidden border-l-4 border-l-emerald-300 pl-3 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-300/90 after:absolute after:inset-x-0 after:top-0 after:h-[3px] after:bg-emerald-300/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/44">
                            {trackNumbers?.[track.id] ?? index + 1}.
                          </span>
                          <a
                            aria-label={pick(locale, {
                              en: `Search on YouTube: ${getTrackFullTitle(track)}`,
                              ru: `Искать на YouTube: ${getTrackFullTitle(track)}`,
                            })}
                            className="block min-w-0 truncate text-[0.95rem] font-medium text-sand transition hover:text-white hover:underline"
                            href={getYoutubeSearchUrl(track)}
                            rel="noreferrer"
                            target="_blank"
                            title={getTrackFullTitle(track)}
                          >
                            {track.song.artist.name} - {track.song.title}
                          </a>
                          {activeTrackInfoLabels.length > 0 ? (
                            <span
                              className="shrink-0 rounded-full border border-gold/18 bg-gold/8 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] text-gold"
                              title={activeTrackInfoLabels.join(", ")}
                            >
                              {activeTrackInfoLabels[0]}
                              {activeTrackInfoLabels.length > 1
                                ? ` +${activeTrackInfoLabels.length - 1}`
                                : ""}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/74">
                          <span
                            className="min-w-0 truncate"
                            title={formatPersonLabel(track.proposedBy, locale)}
                          >
                            {formatPersonLabel(track.proposedBy, locale)}
                          </span>
                          <span className="shrink-0 text-white/30">·</span>
                          <span className="min-w-0 truncate">
                            {completion.isComplete
                              ? completion.optionalOpen > 0
                                ? pick(locale, {
                                    en: `${completion.optionalOpen} optional left`,
                                    ru: `${completion.optionalOpen} optional осталось`,
                                  })
                                : pick(locale, { en: "All required filled", ru: "Обязательные закрыты" })
                              : pick(locale, {
                                  en: `${completion.requiredOpen} required open`,
                                  ru: `${completion.requiredOpen} обязательных открыто`,
                                })}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {track.comment ? (
                          <TrackNotesControl comment={track.comment} locale={locale} />
                        ) : null}
                        {canEditTrack && user ? (
                          <>
                            <TrackArrangementEditLauncher
                              action={updateTrackArrangementAction}
                              className={cn("list-none cursor-pointer text-white", iconButtonClass())}
                              currentUserId={user.id}
                              eventSlug={eventSlug}
                              inviteableUsers={inviteableUsers}
                              isAdmin={user.role === "ADMIN"}
                              lineupSlots={lineupSlots}
                              locale={locale}
                              track={track}
                              trackInfoFields={trackInfoFields}
                            />
                            {canManageTrack ? (
                              <form
                                action={cancelTrackAction}
                                onSubmit={(event) => {
                                  if (
                                    !window.confirm(
                                      pick(locale, {
                                        en: `Delete "${track.song.title}" from the setlist?`,
                                        ru: `Удалить "${track.song.title}" из сетлиста?`,
                                      }),
                                    )
                                  ) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                <input name="trackId" type="hidden" value={track.id} />
                                <input name="eventSlug" type="hidden" value={eventSlug} />
                                <button
                                  aria-label={pick(locale, {
                                    en: `Delete ${track.song.title}`,
                                    ru: `Удалить ${track.song.title}`,
                                  })}
                                  className={cn(
                                    iconButtonClass(),
                                    "border-red/35 bg-red/10 text-red hover:border-red/60 hover:bg-red/20 hover:text-white",
                                  )}
                                  data-tip={pick(locale, { en: "Delete", ru: "Удалить" })}
                                  title={pick(locale, {
                                    en: `Delete ${track.song.title}`,
                                    ru: `Удалить ${track.song.title}`,
                                  })}
                                  type="submit"
                                >
                                  <X className="h-4 w-4 stroke-[3]" />
                                </button>
                              </form>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {showPlaybackColumn ? (
                    <td
                      className={cn(
                        "border-b border-r border-white/14 px-2 py-1.5 text-center align-middle text-[10px] font-semibold uppercase tracking-[0.14em]",
                        rowBackground,
                      )}
                      data-playback-cell={track.id}
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-12 justify-center rounded-full border px-2 py-1",
                          track.playbackRequired
                            ? "border-gold/28 bg-gold/12 text-gold"
                            : "border-white/10 bg-white/5 text-white/42",
                        )}
                      >
                        {track.playbackRequired
                          ? pick(locale, { en: "Yes", ru: "Да" })
                          : pick(locale, { en: "No", ru: "Нет" })}
                      </span>
                    </td>
                  ) : null}

                  {columns.map((column, columnIndex) => {
                    const seat = seatIndex.get(`${column.slotId}:${column.seatIndex}`);
                    const overlayAlign = columnIndex === 0 ? "start" : "end";

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
                        (user.role === "ADMIN" || seat.userId === user.id),
                    );
                    const canInvite = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        (isOpen || (allowClosedOptionalRequests && seat.isOptional)),
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
                    const openCellCenterClass = seatRequests.length > 0 ? "top-[54%]" : "top-1/2";

                    return (
                      <td
                        className={cn(
                          "group relative border-b border-r border-white/12 px-0.5 py-0 align-middle transition",
                          getSeatCellClass(seat.status, seat.isOptional, isSelfSeat),
                          flashingSeatIds.has(seat.id) && "board-cell-flash",
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
                        <div className="relative flex min-h-[3.7rem] flex-col px-1 py-1 transition">

                          {seat.status === TrackSeatStatus.OPEN ? (
                            <>
                              <div className="flex min-h-[1.25rem] items-center px-0.5">
                                <div className="flex min-h-[1.25rem] items-center gap-1 pr-9">
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      statusDotClass(seat.status, isSelfSeat),
                                    )}
                                  />
                                  {seat.isOptional ? (
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-gold/84">
                                      OPT
                                    </span>
                                  ) : null}
                                  {userHasPendingRequest ? (
                                    <span className="rounded-full border border-blue/30 bg-blue/16 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-white">
                                      {pick(locale, { en: "Sent", ru: "Есть" })}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {(seatRequests.length > 0 || canInvite) ? (
                                <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                                  {canInvite ? (
                                    <InviteControl
                                      activeInviteControlId={activeInviteControlId}
                                      allowClosedOptionalRequests={allowClosedOptionalRequests}
                                      align={overlayAlign}
                                      controlId={`desktop-${seat.id}`}
                                      eventSlug={eventSlug}
                                      inviteableUsers={inviteableUsers}
                                      locale={locale}
                                      onInviteComplete={handleInviteComplete}
                                      onOpenChange={setActiveInviteControlId}
                                      preferAbove={preferInviteAbove}
                                      seat={seat}
                                    />
                                  ) : null}
                                  {seatRequests.length > 0 ? (
                                    <SeatRequestsControl
                                      align={overlayAlign}
                                      locale={locale}
                                      preferAbove={preferInviteAbove}
                                      requests={seatRequests}
                                    />
                                  ) : null}
                                </div>
                              ) : null}

                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center justify-center px-2",
                                  openCellCenterClass,
                                )}
                              >
                                {canClaim ? (
                                  <form className="pointer-events-auto">
                                    <ClaimSeatButton
                                      className={claimSeatButtonClass(seat.isOptional, "icon")}
                                      disabled={pendingSeatId !== null && pendingSeatId !== seat.id}
                                      isPending={pendingSeatId === seat.id}
                                      label={pick(locale, {
                                        en:
                                          !isOpen && allowClosedOptionalRequests && seat.isOptional
                                            ? "Request spot"
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
                                      onClick={() =>
                                        void handleClaimSeat({
                                          isRequestOnly:
                                            !isOpen &&
                                            allowClosedOptionalRequests &&
                                            seat.isOptional,
                                          seatId: seat.id,
                                        })
                                      }
                                    />
                                  </form>
                                ) : (
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-white/32">
                                    <UserPlus className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            </>
                          ) : seat.user ? (
                            <>
                              <div className="flex min-h-[1.5rem] items-start justify-between gap-1.5 px-0.5">
                                <div className="flex min-h-[1.5rem] items-center">
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      statusDotClass(seat.status, isSelfSeat),
                                    )}
                                  />
                                </div>
                                <div className="flex min-h-[1.5rem] items-center translate-x-[3px]">
                                  {canManage ? (
                                    <form>
                                      <button
                                        aria-label={pick(locale, {
                                          en: `Release ${seat.label}`,
                                          ru: `Освободить ${seat.label}`,
                                        })}
                                        className={cn(iconButtonClass(), pendingSeatId === seat.id && "cursor-wait")}
                                        data-tip={pick(locale, {
                                          en: "Release",
                                          ru: "Освободить",
                                        })}
                                        disabled={pendingSeatId !== null}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          void handleReleaseSeat(seat.id);
                                        }}
                                        title={pick(locale, {
                                          en: `Release ${seat.label}`,
                                          ru: `Освободить ${seat.label}`,
                                        })}
                                        type="button"
                                      >
                                        {pendingSeatId === seat.id ? (
                                          <Loader className="text-current" />
                                        ) : (
                                          <LogOut className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </form>
                                  ) : (
                                    <span className="h-6 w-6 shrink-0" />
                                  )}
                                </div>
                              </div>

                              {getTelegramProfileUrl(seat.user) ? (
                                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center px-4">
                                  <a
                                    className="max-w-full truncate text-center text-[10px] font-semibold leading-[1.05rem] text-sand transition hover:text-white hover:underline"
                                    href={getTelegramProfileUrl(seat.user) ?? undefined}
                                    rel="noreferrer"
                                    target="_blank"
                                    title={formatPersonLabel(seat.user, locale)}
                                  >
                                    {formatPersonLabel(seat.user, locale)}
                                  </a>
                                </div>
                              ) : (
                                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center px-4">
                                  <span
                                    className="max-w-full truncate text-center text-[10px] font-semibold leading-[1.05rem] text-sand"
                                    title={formatPersonLabel(seat.user, locale)}
                                  >
                                    {formatPersonLabel(seat.user, locale)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex min-h-[1.5rem] items-start justify-between gap-1.5 px-0.5">
                                <div className="flex min-h-[1.5rem] items-center">
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      statusDotClass(seat.status, isSelfSeat),
                                    )}
                                  />
                                </div>
                                <span className="h-6 w-6 shrink-0" />
                              </div>
                              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                                <span
                                  className="ui-tooltip ui-tooltip-bottom inline-flex h-5 w-5 items-center justify-center text-white/34"
                                  data-tip={pick(locale, { en: "Empty", ru: "Пусто" })}
                                >
                                  <Minus className="h-4 w-4" />
                                </span>
                              </div>
                            </>
                          )}
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
      </div>

      <div className="space-y-3 md:hidden">
          {currentTracks.map((track, index) => {
            const isHighlighted = activeHighlightTrackId === track.id;
            const readiness = getTrackReadinessState(track.seats);
          const activeTrackInfoLabels = getVisibleTrackInfoLabels({
            locale,
            track,
            trackInfoFields,
          });
          const preferInviteAbove = tracks.length > 1;
          const canManageTrack = Boolean(
            isOpen && user && (user.role === "ADMIN" || track.proposedById === user.id),
          );
          // Admins can edit a track at any time; proposers only while the board is open.
          const canEditTrack = Boolean(
            user && (user.role === "ADMIN" || (isOpen && track.proposedById === user.id)),
          );
          const missingRequiredSummary = getMissingRequiredSummary(track.seats, locale);

          return (
            <details
              className={cn(
                "brand-shell group rounded-xl border-white/10 shadow-card transition",
                readiness.isReady &&
                  "border-l-4 border-emerald-300 border-emerald-300/34 bg-emerald-500/[0.12] shadow-[inset_0_3px_0_rgba(110,231,183,0.5)]",
                isHighlighted && "border-gold/28 bg-[rgba(255,179,0,0.08)]",
              )}
              data-readiness={readiness.isReady ? "ready" : undefined}
              id={`track-${track.id}`}
              key={track.id}
            >
              <summary className="list-none cursor-pointer px-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-white/48">
                        {trackNumbers?.[track.id] ?? index + 1}.
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-display text-lg font-semibold text-sand">
                            {track.song.title}
                          </p>
                        </div>
                        <p className="text-[11px] text-white/60">
                          {track.song.artist.name} · {formatPersonLabel(track.proposedBy, locale)}
                        </p>
                        <a
                          aria-label={pick(locale, {
                            en: `Search on YouTube: ${getTrackFullTitle(track)}`,
                            ru: `Искать на YouTube: ${getTrackFullTitle(track)}`,
                          })}
                          className="mt-2 inline-flex items-center gap-1 rounded-sm border border-red/25 bg-red/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/84"
                          data-mobile-youtube-link={track.id}
                          href={getYoutubeSearchUrl(track)}
                          rel="noreferrer"
                          target="_blank"
                          title={getTrackFullTitle(track)}
                        >
                          <Youtube className="h-3 w-3 text-red" />
                          YouTube
                        </a>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                      {pick(locale, { en: "Details", ru: "Детали" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-white/62">
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                      {missingRequiredSummary}
                    </span>
                    {readiness.isReady ? (
                      <span className="rounded-full border border-emerald-300/24 bg-emerald-400/12 px-2.5 py-1 text-emerald-100">
                        {readiness.optionalOpen > 0
                          ? pick(locale, {
                              en: `${readiness.optionalOpen} optional left`,
                              ru: `${readiness.optionalOpen} optional осталось`,
                            })
                          : pick(locale, { en: "All required filled", ru: "Обязательные закрыты" })}
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
                {showPlaybackColumn ? (
                  <div className="inline-flex rounded-sm border border-gold/18 bg-gold/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                    {pick(locale, { en: "Playback", ru: "Плейбэк" })}:{" "}
                    {track.playbackRequired
                      ? pick(locale, { en: "yes", ru: "да" })
                      : pick(locale, { en: "no", ru: "нет" })}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {track.comment ? (
                    <TrackNotesControl comment={track.comment} layout="mobile" locale={locale} />
                  ) : null}
                  {canEditTrack && user ? (
                    <>
                      <TrackArrangementEditLauncher
                        action={updateTrackArrangementAction}
                        className={cn("list-none cursor-pointer text-white", iconButtonClass())}
                        currentUserId={user.id}
                        eventSlug={eventSlug}
                        inviteableUsers={inviteableUsers}
                        isAdmin={user.role === "ADMIN"}
                        lineupSlots={lineupSlots}
                        locale={locale}
                        track={track}
                        trackInfoFields={trackInfoFields}
                      />
                      {canManageTrack ? (
                        <form
                          action={cancelTrackAction}
                          onSubmit={(event) => {
                            if (
                              !window.confirm(
                                pick(locale, {
                                  en: `Delete "${track.song.title}" from the setlist?`,
                                  ru: `Удалить "${track.song.title}" из сетлиста?`,
                                }),
                              )
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input name="trackId" type="hidden" value={track.id} />
                          <input name="eventSlug" type="hidden" value={eventSlug} />
                          <button
                            aria-label={pick(locale, {
                              en: `Delete ${track.song.title}`,
                              ru: `Удалить ${track.song.title}`,
                            })}
                            className={cn(
                              iconButtonClass(),
                              "border-red/35 bg-red/10 text-red hover:border-red/60 hover:bg-red/20 hover:text-white",
                            )}
                            data-tip={pick(locale, { en: "Delete", ru: "Удалить" })}
                            type="submit"
                          >
                            <X className="h-4 w-4 stroke-[3]" />
                          </button>
                        </form>
                      ) : null}
                    </>
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
                        (user.role === "ADMIN" || seat.userId === user.id),
                    );
                    const canInvite = Boolean(
                      user &&
                        seat.status === TrackSeatStatus.OPEN &&
                        (isOpen || (allowClosedOptionalRequests && seat.isOptional)),
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
                          getSeatCellClass(seat.status, seat.isOptional, isSelfSeat),
                          cellFrameClass(),
                        )}
                        key={seat.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                statusDotClass(seat.status, isSelfSeat),
                              )}
                            />
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
                            ) : (
                              <span className="text-[10px] font-semibold text-sand">
                                {getMobileSeatDisplayLabel(seat, locale)}
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
                            <form>
                              <ClaimSeatButton
                                className={claimSeatButtonClass(seat.isOptional, "text")}
                                disabled={pendingSeatId !== null && pendingSeatId !== seat.id}
                                isPending={pendingSeatId === seat.id}
                                label={
                                  !isOpen && allowClosedOptionalRequests && seat.isOptional
                                    ? pick(locale, { en: "Request spot", ru: "Запросить место" })
                                    : pick(locale, { en: "Join", ru: "Вписаться" })
                                }
                                title={pick(locale, {
                                  en:
                                    !isOpen && allowClosedOptionalRequests && seat.isOptional
                                      ? `Ask proposer to add you to ${seat.label}`
                                      : `Join ${seat.label}`,
                                  ru:
                                    !isOpen && allowClosedOptionalRequests && seat.isOptional
                                      ? `Попросить автора трека добавить тебя на ${seat.label}`
                                      : `Вписаться на ${seat.label}`,
                                })}
                                onClick={() =>
                                  void handleClaimSeat({
                                    isRequestOnly:
                                      !isOpen &&
                                      allowClosedOptionalRequests &&
                                      seat.isOptional,
                                    seatId: seat.id,
                                  })
                                }
                                variant="text"
                              />
                            </form>
                          ) : null}

                          {canInvite ? (
                            <div className="inline-flex items-center gap-1 rounded-sm border border-white/16 bg-white/8 px-1.5 py-1">
                              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/78">
                                {pick(locale, { en: "Invite", ru: "Позвать" })}
                              </span>
                              <InviteControl
                                activeInviteControlId={activeInviteControlId}
                                allowClosedOptionalRequests={allowClosedOptionalRequests}
                                controlId={`mobile-${seat.id}`}
                                eventSlug={eventSlug}
                                inviteableUsers={inviteableUsers}
                                locale={locale}
                                onInviteComplete={handleInviteComplete}
                                onOpenChange={setActiveInviteControlId}
                                preferAbove={preferInviteAbove}
                                seat={seat}
                              />
                            </div>
                          ) : null}

                          {canManage && seat.status === TrackSeatStatus.CLAIMED ? (
                            <form>
                              <button
                                aria-label={pick(locale, {
                                  en: `Release ${seat.label}`,
                                  ru: `Освободить ${seat.label}`,
                                })}
                                className="inline-flex items-center gap-1 rounded-sm border border-white/16 bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/14 disabled:opacity-70"
                                disabled={pendingSeatId !== null}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void handleReleaseSeat(seat.id);
                                }}
                                type="button"
                              >
                                {pendingSeatId === seat.id ? (
                                  <>
                                    <Loader className="text-current" />
                                    <span>
                                      {isSelfSeat
                                        ? pick(locale, { en: "Leaving", ru: "Выписываем" })
                                        : pick(locale, { en: "Releasing", ru: "Освобождаем" })}
                                    </span>
                                  </>
                                ) : (
                                  isSelfSeat
                                    ? pick(locale, { en: "Leave", ru: "Выписаться" })
                                    : pick(locale, { en: "Release", ru: "Освободить" })
                                )}
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
