import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import { formatDateTime } from "@/lib/utils";
import {
  cancelTrackAction,
  claimSeatAction,
  createTrackAction,
  inviteToSeatAction,
  markSeatUnavailableAction,
  releaseSeatAction,
  requestSongCatalogAction,
} from "@/server/actions";
import { getEventWorkspace } from "@/server/query-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const event = await getEventWorkspace(slug);
  const user = await getCurrentUser();
  const songs = await db.song.findMany({
    include: { artist: true },
    orderBy: [{ artist: { name: "asc" } }, { title: "asc" }],
  });

  if (!event) {
    notFound();
  }

  const effectiveStatus = getEffectiveEventStatus(event);
  const mineOnly = resolvedSearchParams.mine === "1";
  const visibleTracks = mineOnly && user
    ? event.tracks.filter((track) => track.seats.some((seat) => seat.userId === user.id))
    : event.tracks;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <Card className="space-y-5">
          <Badge>{effectiveStatus}</Badge>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-semibold">{event.title}</h1>
            <p className="text-sm text-ink/70">
              {formatDateTime(event.startsAt)} at {event.venueName ?? "Venue TBD"}
            </p>
            <p className="text-sm text-ink/70">{event.description}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-ink/70">
            <span>Registration closes: {event.registrationClosesAt ? formatDateTime(event.registrationClosesAt) : "manual"}</span>
            <span>Set limit: {event.maxSetDurationMinutes} minutes</span>
            <span>Track limit per user: {event.maxTracksPerUser}</span>
            <span>Playback: {event.allowPlayback ? "Allowed" : "Disabled"}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={mineOnly ? `/events/${slug}` : `/events/${slug}?mine=1`}>
              <Button variant={mineOnly ? "primary" : "secondary"}>
                {mineOnly ? "Show all tracks" : "My tracks only"}
              </Button>
            </Link>
            {effectiveStatus === "PUBLISHED" ? (
              <Badge className="bg-moss/15">Published line-up visible below</Badge>
            ) : null}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <Badge>Stage lineup</Badge>
            <div className="grid gap-3 text-sm">
              {event.lineupSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                  <span>{slot.label}</span>
                  <span className="font-semibold">{slot.seatCount}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <Badge>Missing from catalog</Badge>
            <form action={requestSongCatalogAction} className="space-y-3">
              <label className="block space-y-2 text-sm">
                <span>Artist</span>
                <input className="w-full px-4 py-3" name="artistName" required />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Track title</span>
                <input className="w-full px-4 py-3" name="trackTitle" required />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Comment</span>
                <textarea className="min-h-24 w-full px-4 py-3" name="comment" />
              </label>
              <Button type="submit" variant="secondary">
                Ask admins to add the song
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {user && effectiveStatus === "OPEN" ? (
        <Card className="space-y-5">
          <Badge>Propose a track</Badge>
          <form action={createTrackAction} className="grid gap-4 md:grid-cols-2">
            <input name="eventId" type="hidden" value={event.id} />
            <input name="eventSlug" type="hidden" value={event.slug} />
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Song from catalog</span>
              <select className="w-full px-4 py-3" name="songId" required>
                <option value="">Select a song</option>
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.artist.name} - {song.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Tuning</span>
              <input className="w-full px-4 py-3" name="tuning" />
            </label>
            <label className="space-y-2 text-sm flex items-center gap-3 self-end rounded-2xl border border-ink/10 px-4 py-3">
              <input name="playbackRequired" type="checkbox" />
              Playback required
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Comment</span>
              <textarea className="min-h-24 w-full px-4 py-3" name="comment" />
            </label>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Claim seats immediately</legend>
              <div className="grid gap-2">
                {event.lineupSlots.flatMap((slot) =>
                  Array.from({ length: slot.seatCount }).map((_, index) => {
                    const label =
                      slot.seatCount === 1 ? slot.label : `${slot.label} ${index + 1}`;
                    const value = `${label}:${index + 1}`;
                    return (
                      <label key={`claim-${value}`} className="flex items-center gap-3 text-sm">
                        <input name="claimSeatKeys" type="checkbox" value={value} />
                        {label}
                      </label>
                    );
                  }),
                )}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Mark seats as N/A</legend>
              <div className="grid gap-2">
                {event.lineupSlots.flatMap((slot) =>
                  Array.from({ length: slot.seatCount }).map((_, index) => {
                    const label =
                      slot.seatCount === 1 ? slot.label : `${slot.label} ${index + 1}`;
                    const value = `${label}:${index + 1}`;
                    return (
                      <label key={`na-${value}`} className="flex items-center gap-3 text-sm">
                        <input name="unavailableSeatKeys" type="checkbox" value={value} />
                        {label}
                      </label>
                    );
                  }),
                )}
              </div>
            </fieldset>
            <Button className="md:col-span-2" type="submit">
              Propose track
            </Button>
          </form>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">
              Tracks
            </p>
            <h2 className="font-display text-3xl font-semibold">
              {mineOnly ? "Your matching tracks" : "Current sign-up board"}
            </h2>
          </div>
          <Badge className="bg-clay/10 text-clay">{visibleTracks.length} tracks</Badge>
        </div>
        <div className="grid gap-5">
          {visibleTracks.map((track) => (
            <Card key={track.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-semibold">
                    {track.song.artist.name} - {track.song.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink/70">
                    Proposed by @{track.proposedBy.telegramUsername ?? track.proposedBy.fullName} · {track.tuning ?? "Tuning TBD"}
                  </p>
                </div>
                {(track.playbackRequired || track.comment) ? (
                  <div className="space-y-2 text-right">
                    {track.playbackRequired ? <Badge className="bg-ember/10 text-ember">Playback</Badge> : null}
                    {track.comment ? <p className="max-w-md text-sm text-ink/70">{track.comment}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {track.seats.map((seat) => {
                  const canClaim = user && effectiveStatus === "OPEN" && seat.status === TrackSeatStatus.OPEN;
                  const canManage =
                    user &&
                    (user.role === "ADMIN" || track.proposedById === user.id || seat.userId === user.id);

                  return (
                    <div key={seat.id} className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{seat.label}</p>
                        <Badge
                          className={
                            seat.status === TrackSeatStatus.CLAIMED
                              ? "bg-moss/15 text-moss"
                              : seat.status === TrackSeatStatus.UNAVAILABLE
                                ? "bg-ember/10 text-ember"
                                : "bg-ink/5 text-ink/70"
                          }
                        >
                          {seat.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-ink/70">
                        {seat.user
                          ? `@${seat.user.telegramUsername ?? seat.user.fullName}`
                          : seat.status === TrackSeatStatus.UNAVAILABLE
                            ? "Marked as not needed"
                            : "Still open"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canClaim ? (
                          <form action={claimSeatAction}>
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventSlug" type="hidden" value={event.slug} />
                            <Button size="sm" type="submit">
                              Join
                            </Button>
                          </form>
                        ) : null}
                        {canManage && seat.status === TrackSeatStatus.CLAIMED ? (
                          <form action={releaseSeatAction}>
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventSlug" type="hidden" value={event.slug} />
                            <Button size="sm" type="submit" variant="secondary">
                              Remove
                            </Button>
                          </form>
                        ) : null}
                        {canManage && seat.status === TrackSeatStatus.OPEN ? (
                          <form action={markSeatUnavailableAction}>
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventSlug" type="hidden" value={event.slug} />
                            <Button size="sm" type="submit" variant="ghost">
                              Mark N/A
                            </Button>
                          </form>
                        ) : null}
                      </div>

                      {user && (user.role === "ADMIN" || track.proposedById === user.id) && seat.status === TrackSeatStatus.OPEN ? (
                        <form action={inviteToSeatAction} className="mt-4 space-y-2">
                          <input name="seatId" type="hidden" value={seat.id} />
                          <input name="eventSlug" type="hidden" value={event.slug} />
                          <label className="block text-xs uppercase tracking-[0.2em] text-ink/50">
                            Invite by Telegram username
                          </label>
                          <div className="flex gap-2">
                            <input
                              className="min-w-0 flex-1 px-3 py-2 text-sm"
                              name="recipientUsername"
                              placeholder="username"
                            />
                            <Button size="sm" type="submit" variant="secondary">
                              Invite
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {seat.invites.length > 0 ? (
                        <p className="mt-3 text-xs text-ink/50">
                          Invites:{" "}
                          {seat.invites
                            .map(
                              (invite) =>
                                `@${invite.recipient.telegramUsername ?? invite.recipient.fullName} (${invite.status})`,
                            )
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {user && (user.role === "ADMIN" || track.proposedById === user.id) ? (
                <form action={cancelTrackAction}>
                  <input name="trackId" type="hidden" value={track.id} />
                  <input name="eventSlug" type="hidden" value={event.slug} />
                  <Button type="submit" variant="ghost">
                    Cancel track
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {effectiveStatus === "PUBLISHED" ? (
        <Card className="space-y-4">
          <Badge>Published setlist</Badge>
          <div className="grid gap-3">
            {event.setlistItems
              .filter((item) => item.section === "MAIN")
              .map((item) => (
                <div key={item.id} className="rounded-2xl bg-sand/60 px-4 py-3">
                  <p className="font-semibold">
                    {item.orderIndex}. {item.track.song.artist.name} - {item.track.song.title}
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    {item.track.seats
                      .filter((seat) => seat.user)
                      .map(
                        (seat) =>
                          `${seat.label}: @${seat.user?.telegramUsername ?? seat.user?.fullName}`,
                      )
                      .join(", ")}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
