"use client";

import { useState } from "react";

import type { LineupSlotLite } from "@/lib/event-board";
import { pick, type Locale } from "@/lib/i18n";
import type { TrackInfoField } from "@/lib/track-info-flags";

import { TrackProposalComposer } from "@/components/track-proposal-composer";
import type { SongSearchSelection } from "@/components/song-search-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function TrackProposalForm({
  createTrackAction,
  eventId,
  eventSlug,
  inviteableUsers,
  lineupSlots,
  locale,
  trackInfoFields,
}: {
  createTrackAction: (formData: FormData) => void | Promise<void>;
  eventId: string;
  eventSlug: string;
  inviteableUsers: Array<{
    id: string;
    telegramUsername: string | null;
    fullName: string | null;
  }>;
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  trackInfoFields: TrackInfoField[];
}) {
  const [selectedSong, setSelectedSong] = useState<SongSearchSelection | null>(null);

  return (
    <form action={createTrackAction} className="space-y-5">
      <input name="eventId" type="hidden" value={eventId} />
      <input name="eventSlug" type="hidden" value={eventSlug} />
      <TrackProposalComposer
        inviteableUsers={inviteableUsers}
        lineupSlots={lineupSlots}
        locale={locale}
        onSelectedChange={setSelectedSong}
        selectedSong={selectedSong}
        trackInfoFields={trackInfoFields}
      />
      <div className="flex justify-end">
        <SubmitButton
          className="min-w-[220px]"
          disabled={!selectedSong}
          pendingLabel={pick(locale, { en: "Adding track...", ru: "Добавляем трек..." })}
          type="submit"
        >
          {pick(locale, { en: "Publish proposal to board", ru: "Опубликовать трек в сетлист" })}
        </SubmitButton>
      </div>
    </form>
  );
}
