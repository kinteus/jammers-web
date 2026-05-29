"use client";

import dynamic from "next/dynamic";
import { Settings2 } from "lucide-react";
import { useState } from "react";

import type { LineupSlotLite } from "@/lib/event-board";
import { pick, type Locale } from "@/lib/i18n";
import type { TrackInfoField } from "@/lib/track-info-flags";

import type { EditFormTrack } from "@/components/track-arrangement-edit-form";
import { TrackProposalDialog } from "@/components/track-proposal-dialog";

const LazyTrackArrangementEditForm = dynamic(
  () =>
    import("@/components/track-arrangement-edit-form").then(
      (module) => module.TrackArrangementEditForm,
    ),
  {
    loading: () => (
      <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-white/62">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold" />
        <span className="h-2 w-28 animate-pulse rounded-full bg-white/16" />
      </div>
    ),
  },
);

export function TrackArrangementEditLauncher({
  action,
  className,
  currentUserId,
  eventSlug,
  inviteableUsers,
  isAdmin,
  lineupSlots,
  locale,
  track,
  trackInfoFields,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  currentUserId: string;
  eventSlug: string;
  inviteableUsers: Array<{
    id: string;
    telegramUsername: string | null;
    fullName: string | null;
  }>;
  isAdmin: boolean;
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  track: EditFormTrack;
  trackInfoFields: TrackInfoField[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <TrackProposalDialog
      description={pick(locale, {
        en: isAdmin
          ? "Adjust the song, the arrangement and every position. Releasing a claimed seat removes that player."
          : "Adjust the arrangement and your own positions. Seats other players hold stay locked.",
        ru: isAdmin
          ? "Меняй песню, аранжировку и любые позиции. Освобождение занятой позиции снимает с неё участника."
          : "Меняй аранжировку и свои позиции. Места, занятые другими участниками, остаются заблокированными.",
      })}
      eyebrow={pick(locale, { en: "Edit track", ru: "Редактировать трек" })}
      locale={locale}
      onOpenChange={setOpen}
      open={open}
      title={`${track.song.artist.name} — ${track.song.title}`}
      trigger={
        <button
          aria-label={pick(locale, { en: "Edit track", ru: "Редактировать трек" })}
          className={className}
          data-tip={pick(locale, { en: "Edit track", ru: "Редактировать трек" })}
          title={pick(locale, { en: "Edit track", ru: "Редактировать трек" })}
          type="button"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      }
    >
      {open ? (
        <LazyTrackArrangementEditForm
          action={action}
          currentUserId={currentUserId}
          eventSlug={eventSlug}
          inviteableUsers={inviteableUsers}
          isAdmin={isAdmin}
          lineupSlots={lineupSlots}
          locale={locale}
          track={track}
          trackInfoFields={trackInfoFields}
        />
      ) : null}
    </TrackProposalDialog>
  );
}
