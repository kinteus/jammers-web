"use client";

import { useState } from "react";
import { CheckSquare, Disc3, Music2 } from "lucide-react";

import type { LineupSlotLite } from "@/lib/event-board";
import { pick, type Locale } from "@/lib/i18n";
import type { TrackInfoField } from "@/lib/track-info-flags";

import { SeatPlannerField } from "@/components/seat-planner-field";
import {
  SongSearchField,
  type SongSearchSelection,
} from "@/components/song-search-field";

export function TrackProposalComposer({
  trackInfoFields,
  lineupSlots,
  locale,
}: {
  trackInfoFields: TrackInfoField[];
  lineupSlots: LineupSlotLite[];
  locale: Locale;
}) {
  const [selectedSong, setSelectedSong] = useState<SongSearchSelection | null>(null);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-blue" />
          <h3 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, { en: "Song", ru: "Песня" })}
          </h3>
        </div>
        <SongSearchField locale={locale} onSelectedChange={setSelectedSong} selected={selectedSong} />
      </div>

      {selectedSong ? (
        <>
          <div className="section-rule" />
          <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr]">
            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-sand">
                  {pick(locale, { en: "Notes", ru: "Заметки" })}
                </span>
                <textarea
                  className="min-h-24 w-full px-4 py-3"
                  name="comment"
                  placeholder={pick(locale, {
                    en: "Mood, arrangement hints, key changes, who should jump in...",
                    ru: "Настроение, подсказки по аранжировке, смены тональности, кто должен подключиться...",
                  })}
                />
              </label>

              {trackInfoFields.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-gold" />
                    <h3 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
                      {pick(locale, { en: "Extra details", ru: "Доп. детали" })}
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {trackInfoFields.map((field) => (
                      <label
                        className="flex items-center gap-3 rounded-md border border-white/10 bg-white/6 px-4 py-3 text-sm text-sand"
                        key={field.key}
                      >
                        <input name="trackInfoFlagKeys" type="checkbox" value={field.key} />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Disc3 className="h-4 w-4 text-red" />
                <h3 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
                  {pick(locale, { en: "Arrangement", ru: "Аранжировка" })}
                </h3>
              </div>
              <p className="text-sm leading-6 text-white/62">
                {pick(locale, {
                  en: "Mark the must-have players as required. Optional parts can still be joined later, but they no longer block the track from counting as assembled.",
                  ru: "Отметь must-have музыкантов как обязательных. В optional-партии всё ещё можно вписаться позже, но они уже не мешают треку считаться собранным.",
                })}
              </p>
              <SeatPlannerField lineupSlots={lineupSlots} locale={locale} />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-white/62">
          {pick(locale, {
            en: "Choose the song first. Arrangement, notes and extra details will appear right after that.",
            ru: "Сначала выбери песню. Аранжировка, заметки и дополнительные детали появятся сразу после этого.",
          })}
        </div>
      )}
    </div>
  );
}
