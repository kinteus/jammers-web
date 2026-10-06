"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAdminSongCatalog } from "@/components/admin-song-workspace";
import { TrackSeatStatus } from "@prisma/client";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { pick, type Locale } from "@/lib/i18n";
import { getEventTrackInfoFields, getTrackInfoKeys, getTrackInfoLabel } from "@/lib/track-info-flags";
import { adminClearSeatAction, adminReplaceTrackSongAction, cancelTrackAction, updateTrackSettingsAction } from "@/server/actions";
import type { getEventWorkspace } from "@/server/query-data";
import { AdminSeatAssignControl } from "@/components/admin-seat-assign-control";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/ui/submit-button";

type Workspace = NonNullable<Awaited<ReturnType<typeof getEventWorkspace>>>;

export function AdminTrackEditor({ track, event, locale }: {
  track: Workspace["tracks"][number];
  event: Pick<Workspace, "id" | "trackInfoFieldsJson" | "allowPlayback">;
  locale: Locale;
}) {
  const [hasOpened, setHasOpened] = useState(false);
  const { songCatalog, assignableUsers } = useAdminSongCatalog();
  const completion = getTrackCompletionSummary(track.seats);
  const claimedCount = track.seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).length;
  const activeTrackInfoKeys = new Set(getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired));
  return (
    <details className="group mt-3" data-track-editor={track.id} onToggle={(event) => { if (event.currentTarget.open) setHasOpened(true); }}>
      <summary className="flex cursor-pointer items-center gap-2 rounded-sm py-2 text-sm font-semibold text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
        {pick(locale, { en: "Edit song & seats", ru: "Песня и места" })}
      </summary>
      {hasOpened ? <>
      <p className="py-3 text-sm text-white/70">
        {pick(locale, { en: "Proposed by", ru: "Предложил(а)" })} {track.proposedBy.telegramUsername ? `@${track.proposedBy.telegramUsername}` : track.proposedBy.fullName}
        {" · "}{claimedCount} {pick(locale, { en: "filled", ru: "занято" })} · {completion.requiredOpen} {pick(locale, { en: "required open", ru: "обязательных открыто" })} · {track.seats.length} {pick(locale, { en: "total seats", ru: "мест всего" })}
      </p>
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap justify-end gap-3">
                    <form action={adminReplaceTrackSongAction} className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-64">
                      <input name="trackId" type="hidden" value={track.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <select aria-label={pick(locale, { en: "Replacement song", ru: "Песня для замены" })} className="w-full min-w-0 max-w-full px-3 py-2 text-sm" defaultValue={track.songId} name="songId">
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
                      <textarea className="min-h-20 w-full px-3 py-2" key={track.comment ?? ""} defaultValue={track.comment ?? ""} name="comment" />
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
      </> : null}
    </details>
  );
}
