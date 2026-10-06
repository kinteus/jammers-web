import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";

import { getAllowedNextEventStatuses, getEffectiveEventStatus } from "@/lib/domain/event-status";
import { formatDateTimeLocalInput } from "@/lib/domain/local-datetime";
import { formatEventTime } from "@/lib/utils";
import { getEffectiveMaxSetTrackCount } from "@/lib/domain/setlist-limit";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getEventStatusLabel, pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
} from "@/lib/track-info-flags";
import {
  acquireCurationLockAction,
  deleteEventAction,
  publishSetlistAction,
  runSelectionAction,
  sortSetlistByDrummerAction,
  updateEventAction,
  updateEventStatusAction,
} from "@/server/actions";
import { isDatabaseAvailable } from "@/server/database-health";
import { requireAdmin } from "@/server/auth-guards";
import { getEventWorkspace, getInviteableUsers } from "@/server/query-data";
import { db } from "@/lib/db";

import { AdminTrackEditor } from "@/components/admin-track-editor";
import { AdminSongWorkspace } from "@/components/admin-song-workspace";
import { AdminSetlistStack } from "@/components/admin-setlist-stack";
import { AdminTimezoneOffsetField } from "@/components/admin-timezone-offset-field";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { DeleteGigForm } from "@/components/delete-gig-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Event",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminEventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildLineupSummary(
  locale: Awaited<ReturnType<typeof getLocale>>,
  seats: {
    isOptional: boolean;
    label: string;
    user: { fullName: string | null; telegramUsername: string | null } | null;
  }[],
) {
  const occupied = seats
    .filter((seat) => seat.user)
    .map(
      (seat) =>
        `${seat.label}: @${seat.user?.telegramUsername ?? seat.user?.fullName ?? pick(locale, {
          en: "unknown",
          ru: "неизвестно",
        })}`,
    );

  return occupied.length > 0
    ? occupied.join(", ")
    : pick(locale, {
        en: "No participants assigned yet.",
        ru: "Пока никто не назначен.",
      });
}

function buildDrummerLabel(
  locale: Awaited<ReturnType<typeof getLocale>>,
  seats: {
    label: string;
    lineupSlot: { key: string; label: string };
    status: TrackSeatStatus;
    user: { fullName: string | null; telegramUsername: string | null } | null;
  }[],
) {
  const drummerSeat = seats.find(
    (seat) =>
      seat.user &&
      seat.status === TrackSeatStatus.CLAIMED &&
      (seat.lineupSlot.key === "drums" || seat.lineupSlot.label.toLowerCase() === "drums"),
  );
  const drummerName = drummerSeat?.user
    ? `@${drummerSeat.user.telegramUsername ?? drummerSeat.user.fullName ?? pick(locale, {
        en: "unknown",
        ru: "неизвестно",
      })}`
    : pick(locale, { en: "unassigned", ru: "не назначен" });

  return `${pick(locale, { en: "Drums", ru: "Барабаны" })}: ${drummerName}`;
}

function buildUserLabel(
  locale: Awaited<ReturnType<typeof getLocale>>,
  user: { fullName: string | null; telegramUsername: string | null } | null,
) {
  if (!user) {
    return pick(locale, { en: "unknown", ru: "неизвестно" });
  }
  return user.telegramUsername ? `@${user.telegramUsername}` : (user.fullName ?? pick(locale, {
    en: "unknown",
    ru: "неизвестно",
  }));
}

function countUniqueClaimedUsers(
  seats: Array<{ status: TrackSeatStatus; userId: string | null }>,
) {
  return new Set(
    seats
      .filter((seat) => seat.status === TrackSeatStatus.CLAIMED && seat.userId)
      .map((seat) => seat.userId),
  ).size;
}

function countUniqueClaimedUsersInTracks(
  tracks: Array<{ seats: Array<{ status: TrackSeatStatus; userId: string | null }> }>,
) {
  return countUniqueClaimedUsers(tracks.flatMap((track) => track.seats));
}

export default async function AdminEventPage({ params, searchParams }: AdminEventPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = await getLocale();
  const notice =
    typeof resolvedSearchParams.notice === "string" ? resolvedSearchParams.notice : null;
  const error =
    typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const selectionTrackLimitParticipants =
    typeof resolvedSearchParams.participants === "string"
      ? resolvedSearchParams.participants
      : null;

  try {
    await requireAdmin();
  } catch {
    if (!(await isDatabaseAvailable())) {
      return (
        <DatabaseUnavailableState
          locale={locale}
          title={pick(locale, {
            en: "This gig admin view can't load right now",
            ru: "Сейчас админский экран гига не загружается",
          })}
        />
      );
    }

    return (
      <Card className="brand-shell">
        <p className="text-sm text-ember">
          {pick(locale, {
            en: "Admin access required.",
            ru: "Нужен доступ администратора.",
          })}
        </p>
      </Card>
    );
  }

  let event;
  let songCatalog: Array<{
    id: string;
    title: string;
    artist: { name: string };
  }> = [];
  let assignableUsers: Awaited<ReturnType<typeof getInviteableUsers>> = [];

  try {
    [event, songCatalog, assignableUsers] = await Promise.all([
      getEventWorkspace(slug),
      db.song.findMany({
        include: { artist: true },
        orderBy: [{ artist: { name: "asc" } }, { title: "asc" }],
      }),
      getInviteableUsers(),
    ]);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return (
      <DatabaseUnavailableState
        locale={locale}
        title={pick(locale, {
          en: "This gig admin view can't load right now",
          ru: "Сейчас админский экран гига не загружается",
        })}
      />
    );
  }

  if (!event) {
    notFound();
  }

  if (slug !== event.id) {
    redirect(`/admin/events/${event.id}`);
  }

  const activeLock = event.editLocks[0] ?? null;
  const lineupJson = JSON.stringify(
    event.lineupSlots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      seatCount: slot.seatCount,
      allowOptional: slot.allowOptional,
      defaultOptionalSeats: slot.defaultOptionalSeats,
    })),
    null,
    2,
  );
  const trackInfoFields = formatTrackInfoFieldsForTextarea(
    getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback),
  );
  const effectiveStatus = getEffectiveEventStatus(event);
  const nextStatuses = getAllowedNextEventStatuses(event.status);
  const editorEvent = { id: event.id, trackInfoFieldsJson: event.trackInfoFieldsJson, allowPlayback: event.allowPlayback };
  const editors = new Map(event.tracks.map((track) => [track.id, (
    <AdminTrackEditor key={track.id} track={track} event={editorEvent} locale={locale} />
  )]));
  const selectedTrackIds = new Set(event.setlistItems.map((item) => item.trackId));
  const unselectedItems = event.tracks.filter((track) => !selectedTrackIds.has(track.id)).map((track, index) => ({
    id: track.id,
    trackId: track.id,
    title: track.song.title,
    artistName: track.song.artist.name,
    lineupSummary: buildLineupSummary(locale, track.seats),
    originatorLabel: buildUserLabel(locale, track.proposedBy),
    orderIndex: index + 1,
    editor: editors.get(track.id),
  }));
  const mainSetItems = event.setlistItems
    .filter((item) => item.section === "MAIN")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => ({
      id: item.id,
      trackId: item.trackId,
      editor: editors.get(item.trackId),
      orderIndex: item.orderIndex,
      title: item.track.song.title,
      artistName: item.track.song.artist.name,
      comment: item.track.comment,
      lineupSummary: buildLineupSummary(locale, item.track.seats),
      drummerLabel: buildDrummerLabel(locale, item.track.seats),
      originatorLabel: buildUserLabel(locale, item.track.proposedBy),
      playbackRequired: item.track.playbackRequired,
      seats: item.track.seats.map((seat) => ({
        isOptional: seat.isOptional,
        label: seat.label,
        status: seat.status,
        user: seat.user,
      })),
    }));
  const backlogItems = event.setlistItems
    .filter((item) => item.section === "BACKLOG")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => {
      const completion = getTrackCompletionSummary(item.track.seats);
      const participantCount = new Set(
        item.track.seats
          .filter((seat) => seat.status === TrackSeatStatus.CLAIMED && seat.userId)
          .map((seat) => seat.userId),
      ).size;
      const moveDisabled =
        completion.requiredOpen > 0 || participantCount < event.minParticipantsPerTrack;

      return {
        id: item.id,
        trackId: item.trackId,
        editor: editors.get(item.trackId),
        orderIndex: item.orderIndex,
        title: item.track.song.title,
        artistName: item.track.song.artist.name,
        comment: item.track.comment,
        lineupSummary: buildLineupSummary(locale, item.track.seats),
        moveDisabled,
        moveDisabledLabel: moveDisabled
          ? pick(locale, {
              en: "Needs all required seats filled",
              ru: "Нужны все обязательные места",
            })
          : undefined,
        originatorLabel: buildUserLabel(locale, item.track.proposedBy),
        playbackRequired: item.track.playbackRequired,
        seats: item.track.seats.map((seat) => ({
          isOptional: seat.isOptional,
          label: seat.label,
          status: seat.status,
          user: seat.user,
        })),
      };
    });
  const mainSetParticipantCount = countUniqueClaimedUsers(
    event.setlistItems
      .filter((item) => item.section === "MAIN")
      .flatMap((item) => item.track.seats),
  );
  const readyBoardParticipantCount = countUniqueClaimedUsersInTracks(
    event.tracks.filter((track) => getTrackCompletionSummary(track.seats).isComplete),
  );

  return (
    <div className="space-y-8">
      {error === "selection-track-limit" ? (
        <div className="rounded-xl border border-red/35 bg-red/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Selection could not run because these participants exceed the gig's song limit:",
            ru: "Не удалось запустить отбор: эти участники превышают лимит песен для гига:",
          })}{" "}
          <strong>{selectionTrackLimitParticipants ?? pick(locale, { en: "unknown", ru: "неизвестно" })}</strong>
        </div>
      ) : null}
      {notice === "event-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Gig settings saved.",
            ru: "Настройки гига сохранены.",
          })}
        </div>
      ) : null}
      {notice === "publish-partial-notify" ? (
        <div className="rounded-xl border border-gold/30 bg-gold/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Some Telegram notifications failed after publish. The setlist is live, but at least one participant may need a manual heads-up.",
            ru: "После публикации часть уведомлений Telegram не дошла. Сетлист уже опубликован, но как минимум одному участнику может понадобиться ручное сообщение.",
          })}
        </div>
      ) : null}
      {notice === "status-partial-notify" ? (
        <div className="rounded-xl border border-gold/30 bg-gold/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "The status changed, but at least one Telegram notification failed.",
            ru: "Статус изменён, но как минимум одно Telegram-уведомление не дошло.",
          })}
        </div>
      ) : null}
      {notice === "selection-run" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Selection finished without changing the board status. The main set/backlog were refreshed.",
            ru: "Отбор завершён без изменения статуса таблицы. Мейн-сет и бэклог обновлены.",
          })}
        </div>
      ) : null}

      <nav aria-label={pick(locale, { en: "Event workspace", ru: "Разделы гига" })} className="flex flex-wrap gap-3 text-sm text-sand">
        <a className="rounded-sm border border-white/20 px-4 py-2 hover:bg-white/10" href="#songs">{pick(locale, { en: "Manage songs", ru: "Управление песнями" })} · {event.tracks.length}</a>
      </nav>
      <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <Card className="space-y-4">
          <Badge>{pick(locale, { en: "Gig settings", ru: "Настройки гига" })}</Badge>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.03em]">{event.title}</h1>
          <form action={updateEventAction} className="grid gap-4 md:grid-cols-2">
            <AdminTimezoneOffsetField />
            <input name="eventId" type="hidden" value={event.id} />
            <input name="eventSlug" type="hidden" value={event.id} />
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Title", ru: "Название" })}</span>
              <input className="w-full px-4 py-3" defaultValue={event.title} name="title" required />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Description", ru: "Описание" })}</span>
              <textarea className="min-h-24 w-full px-4 py-3" defaultValue={event.description ?? ""} name="description" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Starts at", ru: "Начало" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={formatDateTimeLocalInput(event.startsAt)}
                name="startsAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Registration opens at", ru: "Старт регистрации" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={
                  event.registrationOpensAt
                    ? formatDateTimeLocalInput(event.registrationOpensAt)
                    : ""
                }
                name="registrationOpensAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Registration closes at", ru: "Окончание регистрации" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={
                  event.registrationClosesAt
                    ? formatDateTimeLocalInput(event.registrationClosesAt)
                    : ""
                }
                name="registrationClosesAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Venue", ru: "Площадка" })}</span>
              <input className="w-full px-4 py-3" defaultValue={event.venueName ?? ""} name="venueName" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Venue map URL", ru: "Ссылка на карту площадки" })}</span>
              <input className="w-full px-4 py-3" defaultValue={event.venueMapUrl ?? ""} name="venueMapUrl" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Max main-set songs", ru: "Макс. песен в мейн-сете" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={getEffectiveMaxSetTrackCount(event.maxSetDurationMinutes)}
                min={1}
                name="maxSetTrackCount"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Songs per participant", ru: "Песен на участника" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.maxTracksPerUser}
                name="maxTracksPerUser"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Min participants per song", ru: "Мин. участников на песню" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.minParticipantsPerTrack}
                min={1}
                name="minParticipantsPerTrack"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Stage notes", ru: "Заметки по сцене" })}</span>
              <textarea className="min-h-24 w-full px-4 py-3" defaultValue={event.stageNotes ?? ""} name="stageNotes" />
            </label>
            <label className="space-y-2 text-sm flex items-center gap-3 md:col-span-2">
              <input defaultChecked={event.allowPlayback} name="allowPlayback" type="checkbox" />
              {pick(locale, { en: "Allow playback", ru: "Разрешить плейбэк" })}
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Song info flags", ru: "Флаги песни" })}</span>
              <textarea
                className="min-h-24 w-full px-4 py-3"
                defaultValue={trackInfoFields}
                name="trackInfoFieldsInput"
              />
              <p className="text-xs leading-5 text-white/55">
                {pick(locale, {
                  en: "One flag per line: Label|stable-key|English label|Russian label. Keep existing keys; flags never affect completeness or selection.",
                  ru: "Один флаг на строку: Подпись|ключ|English label|Русская подпись. Сохраняйте ключи; флаги не влияют на собранность или отбор.",
                })}
              </p>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Seat layout JSON", ru: "JSON схемы мест" })}</span>
              <textarea className="min-h-40 w-full px-4 py-3 font-mono text-xs" defaultValue={lineupJson} name="lineupJson" />
              <p className="text-xs leading-5 text-white/55">
                {pick(locale, {
                  en: "Set ",
                  ru: "Установи ",
                })}
                <code>allowOptional</code>
                {pick(locale, {
                  en: " to ",
                  ru: " в ",
                })}
                <code>false</code>
                {pick(locale, {
                  en: " for seats that cannot be treated as optional in song proposals.",
                  ru: " для мест, которые не могут быть опциональными в заявках на песни.",
                })}
              </p>
            </label>
            <SubmitButton className="md:col-span-2" pendingLabel={pick(locale, { en: "Saving gig...", ru: "Сохраняем гиг..." })} type="submit">
              {pick(locale, { en: "Save gig settings", ru: "Сохранить настройки гига" })}
            </SubmitButton>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <Badge>{pick(locale, { en: "Lock", ru: "Редактирование сетлиста" })}</Badge>
            <p className="text-sm text-white/70">
              {activeLock
                ? pick(locale, {
                    en: `Lock owned by @${activeLock.user.telegramUsername ?? activeLock.user.fullName} until ${formatEventTime(activeLock.expiresAt)}.`,
                    ru: `Право редактирования закреплено за ${buildUserLabel(locale, activeLock.user)} до ${formatEventTime(activeLock.expiresAt)}. Это защищает сетлист от одновременных правок других администраторов. Владелец может продлить этот режим на 15 минут кнопкой ниже.`,
                  })
                : pick(locale, {
                    en: "No active curation lock. Acquire one before running the algorithm or publishing.",
                    ru: "Перед отбором песен или публикацией закрепи редактирование за собой на 15 минут. Это защитит сетлист от одновременных правок других администраторов.",
                  })}
            </p>
            <form action={acquireCurationLockAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel={pick(locale, { en: "Refreshing lock...", ru: "Закрепляем редактирование..." })} type="submit" variant="secondary">
                {pick(locale, { en: "Acquire or refresh lock", ru: "Закрепить редактирование за мной" })}
              </SubmitButton>
            </form>
          </Card>

          <Card className="space-y-4">
            <Badge>{pick(locale, { en: "Status", ru: "Статус" })}</Badge>
            <div className="space-y-1 text-sm text-white/70">
              <p>
                {pick(locale, { en: "Effective status", ru: "Эффективный статус" })}:{" "}
                <span className="font-semibold text-sand">{getEventStatusLabel(effectiveStatus, locale)}</span>
              </p>
              {effectiveStatus !== event.status ? (
                <p>
                  {pick(locale, { en: "Stored status remains", ru: "Сохранённый статус остаётся" })}{" "}
                  <span className="font-semibold text-sand">{getEventStatusLabel(event.status, locale)}</span>
                  {pick(locale, {
                    en: ", but registration timing currently makes the gig behave as ",
                    ru: ", но по времени регистрации гиг сейчас ведёт себя как ",
                  })}
                  <span className="font-semibold text-sand">{getEventStatusLabel(effectiveStatus, locale)}</span>.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {nextStatuses.map((status) => (
                <form action={updateEventStatusAction} key={status}>
                  <input name="eventId" type="hidden" value={event.id} />
                  <input name="eventSlug" type="hidden" value={event.id} />
                  <input name="status" type="hidden" value={status} />
                  <SubmitButton
                    pendingLabel={pick(locale, { en: "Updating...", ru: "Обновляем..." })}
                    size="sm"
                    type="submit"
                    variant={event.status === status ? "primary" : "secondary"}
                  >
                    {getEventStatusLabel(status, locale)}
                  </SubmitButton>
                </form>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <Badge>{pick(locale, { en: "Selection", ru: "Отбор" })}</Badge>
            <p className="text-sm text-white/70">
              {pick(locale, {
                en: "Rank songs by participant history to populate the main set and backlog without changing the board status.",
                ru: "Ранжируй песни по истории участия, чтобы заполнить мейн-сет и бэклог без изменения статуса таблицы.",
              })}
            </p>
            <form action={runSelectionAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <ConfirmSubmitButton
                confirmMessage={pick(locale, {
                  en: "Run the selection algorithm now? This will rebuild the main set/backlog without closing the board.",
                  ru: "Запустить алгоритм отбора сейчас? Это пересоберёт мейн-сет/бэклог без закрытия таблицы.",
                })}
                pendingLabel={pick(locale, { en: "Running selection...", ru: "Запускаем отбор..." })}
                type="submit"
              >
                {pick(locale, { en: "Run selection algorithm", ru: "Запустить алгоритм отбора" })}
              </ConfirmSubmitButton>
            </form>
            <form action={sortSetlistByDrummerAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel={pick(locale, { en: "Sorting...", ru: "Сортируем..." })} type="submit" variant="secondary">
                {pick(locale, { en: "Sort main set by drummer", ru: "Отсортировать мейн-сет по барабанщику" })}
              </SubmitButton>
            </form>
            <form action={publishSetlistAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel={pick(locale, { en: "Publishing...", ru: "Публикуем..." })} type="submit" variant="accent">
                {pick(locale, { en: "Publish setlist", ru: "Опубликовать сетлист" })}
              </SubmitButton>
            </form>
          </Card>

          <Card className="space-y-4">
            <Badge>{pick(locale, { en: "Participants", ru: "Участники" })}</Badge>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/46">
                  {pick(locale, {
                    en: "Participants in main set",
                    ru: "Участников в мейн-сете",
                  })}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-sand">
                  {mainSetParticipantCount}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/46">
                  {pick(locale, {
                    en: "Participants in assembled board songs",
                    ru: "Участников в собранных песнях таблицы",
                  })}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-sand">
                  {readyBoardParticipantCount}
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 border-red/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%),radial-gradient(circle_at_top_right,rgba(185,0,22,0.18),transparent_24%),#171717]">
            <Badge>{pick(locale, { en: "Danger zone", ru: "Опасная зона" })}</Badge>
            <div className="space-y-2">
              <p className="font-display text-2xl font-semibold text-sand">
                {pick(locale, { en: "Delete this gig", ru: "Удалить этот гиг" })}
              </p>
              <p className="text-sm leading-6 text-white/66">
                {pick(locale, {
                  en: "This removes the public board, setlist, seats, invites and admin workspace for this gig.",
                  ru: "Это удалит публичную таблицу, сетлист, места, инвайты и админское рабочее пространство этого гига.",
                })}
              </p>
            </div>
            <DeleteGigForm
              action={deleteEventAction}
              eventId={event.id}
              eventTitle={event.title}
              locale={locale}
            />
          </Card>
        </div>
      </section>

      <AdminSongWorkspace locale={locale} songCatalog={songCatalog} assignableUsers={assignableUsers} counts={{ main: mainSetItems.length, backlog: backlogItems.length, unselected: unselectedItems.length }}>
        <Card className="scroll-mt-48 sm:scroll-mt-28 space-y-4" id="songs-main">
          <AdminSetlistStack
            locale={locale}
            deferOrderSave
            emptyLabel={pick(locale, {
              en: "Run the selection algorithm to generate the main set.",
              ru: "Запусти алгоритм отбора, чтобы собрать мейн-сет.",
            })}
            eventId={event.id}
            eventSlug={event.id}
            exportCsvLabel={pick(locale, { en: "Export CSV", ru: "Выгрузить CSV" })}
            items={mainSetItems}
            moveLabel={pick(locale, { en: "Send to backlog", ru: "Отправить в бэклог" })}
            movePendingLabel={pick(locale, { en: "Moving...", ru: "Перемещаем..." })}
            saveOrderLabel={pick(locale, { en: "Save order", ru: "Сохранить порядок" })}
            savingLabel={pick(locale, { en: "Saving order...", ru: "Сохраняем порядок..." })}
            section="MAIN"
            sectionLabel={pick(locale, { en: "Main", ru: "Мейн" })}
            clusterItemLabel={pick(locale, { en: "song", ru: "песня" })}
            clusterItemsLabel={pick(locale, { en: "songs", ru: "песен" })}
            targetSection="BACKLOG"
            title={pick(locale, { en: "Main set", ru: "Мейн-сет" })}
            unsavedOrderLabel={pick(locale, { en: "Unsaved order", ru: "Порядок не сохранён" })}
          />
        </Card>

        <Card className="scroll-mt-48 sm:scroll-mt-28 space-y-4" id="songs-backlog">
          <AdminSetlistStack
            locale={locale}
            emptyLabel={pick(locale, { en: "No backlog songs yet.", ru: "Пока нет песен в бэклоге." })}
            eventId={event.id}
            eventSlug={event.id}
            items={backlogItems}
            moveLabel={pick(locale, { en: "Move to main set", ru: "Перенести в мейн-сет" })}
            movePendingLabel={pick(locale, { en: "Moving...", ru: "Перемещаем..." })}
            savingLabel={pick(locale, { en: "Saving order...", ru: "Сохраняем порядок..." })}
            section="BACKLOG"
            sectionLabel={pick(locale, { en: "Backlog", ru: "Бэклог" })}
            targetSection="MAIN"
            title={pick(locale, { en: "Backlog order", ru: "Порядок бэклога" })}
          />
        </Card>
        <Card className="scroll-mt-48 sm:scroll-mt-28 space-y-4" id="songs-unselected">
          <AdminSetlistStack
            locale={locale}
            emptyLabel={pick(locale, { en: "All proposed songs are in the main set or backlog.", ru: "Все предложенные песни находятся в мейн-сете или бэклоге." })}
            eventId={event.id}
            eventSlug={event.id}
            items={unselectedItems}
            moveLabel=""
            movePendingLabel=""
            savingLabel=""
            section="UNSELECTED"
            sectionLabel={pick(locale, { en: "Not selected", ru: "Вне сетлиста" })}
            targetSection="MAIN"
            title={pick(locale, { en: "Not selected", ru: "Вне сетлиста" })}
          />
        </Card>
      </AdminSongWorkspace>

    </div>
  );
}
