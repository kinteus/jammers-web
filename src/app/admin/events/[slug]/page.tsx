import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";

import { getAllowedNextEventStatuses, getEffectiveEventStatus } from "@/lib/domain/event-status";
import { formatDateTimeLocalInput } from "@/lib/domain/local-datetime";
import { getEffectiveMaxSetTrackCount } from "@/lib/domain/setlist-limit";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { getEventStatusLabel, pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
  getTrackInfoKeys,
  getTrackInfoLabel,
} from "@/lib/track-info-flags";
import {
  acquireCurationLockAction,
  adminClearSeatAction,
  adminReplaceTrackSongAction,
  cancelTrackAction,
  deleteEventAction,
  publishSetlistAction,
  runSelectionAction,
  sortSetlistByDrummerAction,
  updateEventAction,
  updateEventStatusAction,
  updateTrackSettingsAction,
} from "@/server/actions";
import { isDatabaseAvailable } from "@/server/database-health";
import { requireAdmin } from "@/server/auth-guards";
import { getEventWorkspace, getInviteableUsers } from "@/server/query-data";
import { db } from "@/lib/db";

import { AdminSetlistStack } from "@/components/admin-setlist-stack";
import { AdminSeatAssignControl } from "@/components/admin-seat-assign-control";
import { AdminTimezoneOffsetField } from "@/components/admin-timezone-offset-field";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
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
        en: "No players assigned yet.",
        ru: "Пока никто не назначен.",
      });
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

  try {
    await requireAdmin();
  } catch {
    if (!(await isDatabaseAvailable())) {
      return (
        <DatabaseUnavailableState
          locale={locale}
          title={pick(locale, {
            en: "This admin event view can't load right now",
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
          en: "This admin event view can't load right now",
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
  const mainSetItems = event.setlistItems
    .filter((item) => item.section === "MAIN")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => ({
      id: item.id,
      orderIndex: item.orderIndex,
      title: item.track.song.title,
      artistName: item.track.song.artist.name,
      lineupSummary: buildLineupSummary(locale, item.track.seats),
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
        orderIndex: item.orderIndex,
        title: item.track.song.title,
        artistName: item.track.song.artist.name,
        lineupSummary: buildLineupSummary(locale, item.track.seats),
        moveDisabled,
        moveDisabledLabel: moveDisabled
          ? pick(locale, {
              en: "Needs full required line-up",
              ru: "Нужен полный обязательный состав",
            })
          : undefined,
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
      {notice === "event-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Event settings saved.",
            ru: "Настройки гига сохранены.",
          })}
        </div>
      ) : null}
      {notice === "publish-partial-notify" ? (
        <div className="rounded-xl border border-gold/30 bg-gold/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Some Telegram notifications failed after publish. The setlist is live, but at least one player may need a manual heads-up.",
            ru: "После публикации часть уведомлений Telegram не дошла. Сетлист уже опубликован, но как минимум одному музыканту может понадобиться ручное сообщение.",
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
            en: "Selection finished. The board status is now closed and the main set/backlog were refreshed.",
            ru: "Отбор завершён. Таблица теперь закрыта, мейн-сет и бэклог обновлены.",
          })}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <Card className="space-y-4">
          <Badge>{pick(locale, { en: "Event settings", ru: "Настройки гига" })}</Badge>
          <h1 className="font-display text-4xl font-semibold">{event.title}</h1>
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
              <span>{pick(locale, { en: "Tracks per user", ru: "Треков на человека" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.maxTracksPerUser}
                name="maxTracksPerUser"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Min players per song", ru: "Мин. людей на песню" })}</span>
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
              <span>{pick(locale, { en: "Track info flags", ru: "Флаги трека" })}</span>
              <textarea
                className="min-h-24 w-full px-4 py-3"
                defaultValue={trackInfoFields}
                name="trackInfoFieldsInput"
              />
              <p className="text-xs leading-5 text-white/55">
                {pick(locale, {
                  en: "One label per line. These checkboxes add context to a song, but never affect completeness or setlist selection.",
                  ru: "По одной подписи на строку. Эти чекбоксы добавляют контекст к песне, но никогда не влияют на собранность или отбор в сетлист.",
                })}
              </p>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Lineup JSON", ru: "JSON лайнапа" })}</span>
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
                  en: " for lineup roles that cannot be treated as optional in track proposals.",
                  ru: " для ролей лайнапа, которые не должны считаться optional в заявках на треки.",
                })}
              </p>
            </label>
            <SubmitButton className="md:col-span-2" pendingLabel={pick(locale, { en: "Saving event...", ru: "Сохраняем гиг..." })} type="submit">
              {pick(locale, { en: "Save event settings", ru: "Сохранить настройки гига" })}
            </SubmitButton>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <Badge>{pick(locale, { en: "Lock", ru: "Лок" })}</Badge>
            <p className="text-sm text-white/70">
              {activeLock
                ? pick(locale, {
                    en: `Lock owned by @${activeLock.user.telegramUsername ?? activeLock.user.fullName} until ${new Date(activeLock.expiresAt).toLocaleTimeString()}.`,
                    ru: `Лок у @${activeLock.user.telegramUsername ?? activeLock.user.fullName} до ${new Date(activeLock.expiresAt).toLocaleTimeString()}.`,
                  })
                : pick(locale, {
                    en: "No active curation lock. Acquire one before running the algorithm or publishing.",
                    ru: "Сейчас нет активного курационного лока. Возьми его перед запуском алгоритма или публикацией.",
                  })}
            </p>
            <form action={acquireCurationLockAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel={pick(locale, { en: "Refreshing lock...", ru: "Обновляем лок..." })} type="submit" variant="secondary">
                {pick(locale, { en: "Acquire or refresh lock", ru: "Взять или обновить лок" })}
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
                en: "Run the coverage-first selection to populate the main set and backlog. This closes the board if it is not closed yet.",
                ru: "Запусти coverage-first отбор, чтобы заполнить мейн-сет и бэклог. Если таблица ещё не закрыта, запуск её закроет.",
              })}
            </p>
            <form action={runSelectionAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <ConfirmSubmitButton
                confirmMessage={pick(locale, {
                  en: "Run the selection algorithm now? This will close the board and rebuild the main set/backlog.",
                  ru: "Запустить алгоритм отбора сейчас? Это закроет таблицу и пересоберёт мейн-сет/бэклог.",
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
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/46">
                  {pick(locale, {
                    en: "People in main set",
                    ru: "Участников в мейн-сете",
                  })}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-sand">
                  {mainSetParticipantCount}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/46">
                  {pick(locale, {
                    en: "People in assembled board songs",
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
                  en: "This removes the public board, setlist, seats, invites and admin workspace for this event.",
                  ru: "Это удалит публичный борд, сетлист, места, инвайты и админское рабочее пространство этого гига.",
                })}
              </p>
            </div>
            <form action={deleteEventAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton
                className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
                pendingLabel={pick(locale, { en: "Deleting gig...", ru: "Удаляем гиг..." })}
                type="submit"
                variant="secondary"
              >
                {pick(locale, { en: "Delete gig", ru: "Удалить гиг" })}
              </SubmitButton>
            </form>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Badge>{pick(locale, { en: "Main set", ru: "Мейн-сет" })}</Badge>
          <AdminSetlistStack
            emptyLabel={pick(locale, {
              en: "Run the selection algorithm to generate the main set.",
              ru: "Запусти алгоритм отбора, чтобы собрать мейн-сет.",
            })}
            eventId={event.id}
            eventSlug={event.id}
            items={mainSetItems}
            moveLabel={pick(locale, { en: "Send to backlog", ru: "Отправить в бэклог" })}
            movePendingLabel={pick(locale, { en: "Moving...", ru: "Перемещаем..." })}
            savingLabel={pick(locale, { en: "Saving order...", ru: "Сохраняем порядок..." })}
            section="MAIN"
            sectionLabel={pick(locale, { en: "Main", ru: "Мейн" })}
            targetSection="BACKLOG"
            title={pick(locale, { en: "Drag to reorder the running set", ru: "Перетаскивай для перестановки текущего сета" })}
          />
        </Card>

        <Card className="space-y-4">
          <Badge>{pick(locale, { en: "Backlog", ru: "Бэклог" })}</Badge>
          <AdminSetlistStack
            emptyLabel={pick(locale, { en: "No backlog tracks yet.", ru: "Пока нет треков в бэклоге." })}
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
      </section>

      <section className="space-y-4">
        <Badge>{pick(locale, { en: "Track administration", ru: "Администрирование треков" })}</Badge>
        <div className="space-y-3">
          {event.tracks.map((track) => {
            const completion = getTrackCompletionSummary(track.seats);
            const claimedCount = track.seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).length;
            const occupiedLineup = buildLineupSummary(locale, track.seats);
            const activeTrackInfoKeys = new Set(
              getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired),
            );

            return (
              <details className="brand-shell overflow-hidden rounded-2xl border-white/10" key={track.id}>
                <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      {pick(locale, { en: "Proposed by", ru: "Предложил(а)" })} @{track.proposedBy.telegramUsername}
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-sand">
                      {track.song.artist.name} - {track.song.title}
                    </h2>
                    <p className="text-sm leading-6 text-white/62">
                      {claimedCount} {pick(locale, { en: "filled", ru: "занято" })} · {completion.requiredOpen}{" "}
                      {pick(locale, { en: "required open", ru: "обязательных открыто" })} · {track.seats.length}{" "}
                      {pick(locale, { en: "total seats", ru: "мест всего" })}
                    </p>
                  </div>
                  <div className="max-w-[520px] text-sm leading-6 text-white/56">
                    {occupiedLineup}
                  </div>
                </summary>

                <div className="space-y-3 border-t border-white/10 px-5 py-5">
                  <div className="flex flex-wrap justify-end gap-3">
                    <form action={adminReplaceTrackSongAction} className="flex flex-wrap items-center gap-2">
                      <input name="trackId" type="hidden" value={track.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <select className="min-w-[260px] px-3 py-2 text-sm" defaultValue={track.songId} name="songId">
                        {songCatalog.map((song) => (
                          <option key={song.id} value={song.id}>
                            {song.artist.name} - {song.title}
                          </option>
                        ))}
                      </select>
                      <SubmitButton pendingLabel={pick(locale, { en: "Replacing...", ru: "Меняем..." })} type="submit" variant="secondary">
                        {pick(locale, { en: "Replace song", ru: "Заменить песню" })}
                      </SubmitButton>
                    </form>
                    <form action={cancelTrackAction}>
                      <input name="trackId" type="hidden" value={track.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <ConfirmSubmitButton
                        confirmMessage={pick(locale, {
                          en: `Delete "${track.song.title}" from the setlist?`,
                          ru: `Удалить "${track.song.title}" из сетлиста?`,
                        })}
                        pendingLabel={pick(locale, { en: "Deleting...", ru: "Удаляем..." })}
                        type="submit"
                        variant="ghost"
                      >
                        {pick(locale, { en: "Delete track", ru: "Удалить трек" })}
                      </ConfirmSubmitButton>
                    </form>
                  </div>

                  <form action={updateTrackSettingsAction} className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
                    <input name="trackId" type="hidden" value={track.id} />
                    <input name="eventSlug" type="hidden" value={event.id} />
                    <label className="space-y-2 text-sm md:col-span-2">
                      <span>{pick(locale, { en: "Track notes", ru: "Заметки трека" })}</span>
                      <textarea className="min-h-20 w-full px-3 py-2" defaultValue={track.comment ?? ""} name="comment" />
                    </label>
                    {getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback).map((field) => (
                      <label className="flex items-center gap-2 text-sm" key={field.key}>
                        <input
                          defaultChecked={activeTrackInfoKeys.has(field.key)}
                          name="trackInfoFlagKeys"
                          type="checkbox"
                          value={field.key}
                        />
                        {getTrackInfoLabel(field, locale)}
                      </label>
                    ))}
                    <div className="space-y-2 md:col-span-2">
                      <p className="text-sm font-semibold text-sand">
                        {pick(locale, { en: "Optional open positions", ru: "Опциональные открытые позиции" })}
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {track.seats
                          .filter((seat) => seat.status === TrackSeatStatus.OPEN)
                          .map((seat) => (
                            <label className="flex items-center gap-2 text-sm" key={seat.id}>
                              <input
                                defaultChecked={seat.isOptional}
                                name="optionalSeatIds"
                                type="checkbox"
                                value={seat.id}
                              />
                              {seat.label}
                            </label>
                          ))}
                      </div>
                    </div>
                    <SubmitButton className="md:col-span-2" pendingLabel={pick(locale, { en: "Saving track...", ru: "Сохраняем трек..." })} type="submit" variant="secondary">
                      {pick(locale, { en: "Save track settings", ru: "Сохранить настройки трека" })}
                    </SubmitButton>
                  </form>

                  <div className="space-y-2">
                    {track.seats.map((seat) => (
                      <div
                        className="brand-shell-soft flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-3"
                        key={seat.id}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sand">{seat.label}</p>
                            <Badge>{seat.status}</Badge>
                            {seat.isOptional ? <Badge className="border-blue/24 bg-blue/16 text-white">OPT</Badge> : null}
                          </div>
                          <p className="text-sm text-white/62">
                            {seat.user
                              ? `@${seat.user.telegramUsername ?? seat.user.fullName}`
                              : pick(locale, { en: "Open", ru: "Открыто" })}
                          </p>
                        </div>

                        {seat.status !== TrackSeatStatus.CLAIMED ? (
                          <AdminSeatAssignControl
                            eventSlug={event.id}
                            locale={locale}
                            seatId={seat.id}
                            users={assignableUsers}
                          />
                        ) : (
                          <form action={adminClearSeatAction}>
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventId" type="hidden" value={event.id} />
                            <input name="eventSlug" type="hidden" value={event.id} />
                            <SubmitButton pendingLabel={pick(locale, { en: "Clearing...", ru: "Очищаем..." })} size="sm" type="submit" variant="secondary">
                              {pick(locale, { en: "Clear seat", ru: "Очистить место" })}
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
