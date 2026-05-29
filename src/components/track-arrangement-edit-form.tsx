"use client";

import { TrackSeatStatus } from "@prisma/client";
import { useMemo, useState } from "react";

import type { LineupSlotLite } from "@/lib/event-board";
import { pick, type Locale } from "@/lib/i18n";
import { getTrackInfoKeys, type TrackInfoField } from "@/lib/track-info-flags";

import type { ExistingSeatState } from "@/components/seat-planner-field";
import type { SongSearchSelection } from "@/components/song-search-field";
import { TrackProposalComposer } from "@/components/track-proposal-composer";
import { SubmitButton } from "@/components/ui/submit-button";

export type EditFormSeat = {
  seatIndex: number;
  label: string;
  status: TrackSeatStatus;
  isOptional: boolean;
  userId: string | null;
  user: {
    telegramUsername: string | null;
    fullName: string | null;
  } | null;
};

export type EditFormTrack = {
  id: string;
  comment: string | null;
  playbackRequired: boolean;
  trackInfoKeysJson: string | null;
  song: {
    id: string;
    title: string;
    artist: { name: string };
  };
  seats: EditFormSeat[];
};

function describeOccupant(
  user: EditFormSeat["user"],
  locale: Locale,
): string | null {
  if (!user) {
    return null;
  }
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }
  return user.fullName ?? pick(locale, { en: "someone", ru: "кто-то" });
}

export function TrackArrangementEditForm({
  action,
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
  const existingSeats = useMemo(() => {
    const map: Record<string, ExistingSeatState> = {};
    for (const seat of track.seats) {
      map[`${seat.label}:${seat.seatIndex}`] = {
        status: seat.status,
        isOptional: seat.isOptional,
        isOwn: Boolean(seat.userId && seat.userId === currentUserId),
        occupantLabel: describeOccupant(seat.user, locale),
      };
    }
    return map;
  }, [currentUserId, locale, track.seats]);

  const defaultFlagKeys = useMemo(
    () => getTrackInfoKeys(track.trackInfoKeysJson, track.playbackRequired),
    [track.playbackRequired, track.trackInfoKeysJson],
  );

  const initialSong: SongSearchSelection = useMemo(
    () => ({
      songId: track.song.id,
      externalId: "",
      trackTitle: track.song.title,
      artistName: track.song.artist.name,
      artworkUrl: null,
      collectionName: null,
      externalUrl: null,
      durationSeconds: null,
    }),
    [track.song.artist.name, track.song.id, track.song.title],
  );

  const [selectedSong, setSelectedSong] = useState<SongSearchSelection | null>(
    isAdmin ? initialSong : null,
  );

  return (
    <form action={action} className="space-y-5">
      <input name="trackId" type="hidden" value={track.id} />
      <input name="eventSlug" type="hidden" value={eventSlug} />
      <TrackProposalComposer
        canManageOccupied={isAdmin}
        defaultComment={track.comment}
        defaultFlagKeys={defaultFlagKeys}
        existingSeats={existingSeats}
        inviteableUsers={inviteableUsers}
        lineupSlots={lineupSlots}
        locale={locale}
        lockedSong={
          isAdmin
            ? null
            : { artistName: track.song.artist.name, trackTitle: track.song.title }
        }
        onSelectedChange={setSelectedSong}
        selectedSong={selectedSong}
        trackInfoFields={trackInfoFields}
      />
      <div className="flex justify-end">
        <SubmitButton
          className="min-w-[220px]"
          disabled={isAdmin && !selectedSong}
          pendingLabel={pick(locale, { en: "Saving changes...", ru: "Сохраняем..." })}
          type="submit"
        >
          {pick(locale, { en: "Save changes", ru: "Сохранить изменения" })}
        </SubmitButton>
      </div>
    </form>
  );
}
