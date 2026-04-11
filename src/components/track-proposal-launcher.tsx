"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { LineupSlotLite } from "@/lib/event-board";
import { type Locale } from "@/lib/i18n";
import type { TrackInfoField } from "@/lib/track-info-flags";

import { TrackProposalDialog } from "@/components/track-proposal-dialog";

const LazyTrackProposalForm = dynamic(
  () => import("@/components/track-proposal-form").then((module) => module.TrackProposalForm),
  {
    loading: () => (
      <div className="rounded-md border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-white/62">
        Loading composer...
      </div>
    ),
  },
);

export function TrackProposalLauncher({
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
  const [open, setOpen] = useState(false);

  return (
    <TrackProposalDialog locale={locale} onOpenChange={setOpen} open={open}>
      {open ? (
        <LazyTrackProposalForm
          createTrackAction={createTrackAction}
          eventId={eventId}
          eventSlug={eventSlug}
          lineupSlots={lineupSlots}
          locale={locale}
          trackInfoFields={trackInfoFields}
        />
      ) : null}
    </TrackProposalDialog>
  );
}
