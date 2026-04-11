"use client";

import type { LineupSlotLite } from "@/lib/event-board";
import { pick, type Locale } from "@/lib/i18n";
import type { TrackInfoField } from "@/lib/track-info-flags";

import { TrackProposalComposer } from "@/components/track-proposal-composer";
import { SubmitButton } from "@/components/ui/submit-button";

export function TrackProposalForm({
  createTrackAction,
  eventId,
  eventSlug,
  lineupSlots,
  locale,
  trackInfoFields,
}: {
  createTrackAction: (formData: FormData) => void | Promise<void>;
  eventId: string;
  eventSlug: string;
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  trackInfoFields: TrackInfoField[];
}) {
  return (
    <form action={createTrackAction} className="space-y-5">
      <input name="eventId" type="hidden" value={eventId} />
      <input name="eventSlug" type="hidden" value={eventSlug} />
      <TrackProposalComposer
        lineupSlots={lineupSlots}
        locale={locale}
        trackInfoFields={trackInfoFields}
      />
      <div className="flex justify-end">
        <SubmitButton
          className="min-w-[220px]"
          pendingLabel={pick(locale, { en: "Adding track...", ru: "Добавляем трек..." })}
          type="submit"
        >
          {pick(locale, { en: "Publish proposal to board", ru: "Опубликовать трек на борде" })}
        </SubmitButton>
      </div>
    </form>
  );
}
