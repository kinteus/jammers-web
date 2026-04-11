import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";

import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import {
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
} from "@/lib/track-info-flags";
import {
  acquireCurationLockAction,
  adminAssignSeatAction,
  adminClearSeatAction,
  cancelTrackAction,
  moveSetlistItemAction,
  publishSetlistAction,
  runSelectionAction,
  sortSetlistByDrummerAction,
  updateEventAction,
  updateEventStatusAction,
} from "@/server/actions";
import { requireAdmin } from "@/server/auth-guards";
import { getEventWorkspace } from "@/server/query-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
};

export default async function AdminEventPage({ params }: AdminEventPageProps) {
  const { slug } = await params;
  await requireAdmin();
  const event = await getEventWorkspace(slug);

  if (!event) {
    notFound();
  }

  const activeLock = event.editLocks[0] ?? null;
  const lineupJson = JSON.stringify(
    event.lineupSlots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      seatCount: slot.seatCount,
      allowOptional: slot.allowOptional,
    })),
    null,
    2,
  );
  const trackInfoFields = formatTrackInfoFieldsForTextarea(
    getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback),
  );
  const effectiveStatus = getEffectiveEventStatus(event);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <Card className="space-y-4">
          <Badge>Event settings</Badge>
          <h1 className="font-display text-4xl font-semibold">{event.title}</h1>
          <form action={updateEventAction} className="grid gap-4 md:grid-cols-2">
            <input name="eventId" type="hidden" value={event.id} />
            <input name="eventSlug" type="hidden" value={event.slug} />
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Title</span>
              <input className="w-full px-4 py-3" defaultValue={event.title} name="title" required />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Description</span>
              <textarea className="min-h-24 w-full px-4 py-3" defaultValue={event.description ?? ""} name="description" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Starts at</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={new Date(event.startsAt).toISOString().slice(0, 16)}
                name="startsAt"
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Registration closes at</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.registrationClosesAt?.toISOString().slice(0, 16) ?? ""}
                name="registrationClosesAt"
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Venue</span>
              <input className="w-full px-4 py-3" defaultValue={event.venueName ?? ""} name="venueName" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Venue map URL</span>
              <input className="w-full px-4 py-3" defaultValue={event.venueMapUrl ?? ""} name="venueMapUrl" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Set duration</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.maxSetDurationMinutes}
                name="maxSetDurationMinutes"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Tracks per user</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.maxTracksPerUser}
                name="maxTracksPerUser"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Stage notes</span>
              <textarea className="min-h-24 w-full px-4 py-3" defaultValue={event.stageNotes ?? ""} name="stageNotes" />
            </label>
            <label className="space-y-2 text-sm flex items-center gap-3 md:col-span-2">
              <input defaultChecked={event.allowPlayback} name="allowPlayback" type="checkbox" />
              Allow playback
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Track info flags</span>
              <textarea
                className="min-h-24 w-full px-4 py-3"
                defaultValue={trackInfoFields}
                name="trackInfoFieldsInput"
              />
              <p className="text-xs leading-5 text-ink/55">
                One label per line. These checkboxes add context to a song, but never affect
                completeness or setlist selection.
              </p>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Lineup JSON</span>
              <textarea className="min-h-40 w-full px-4 py-3 font-mono text-xs" defaultValue={lineupJson} name="lineupJson" />
              <p className="text-xs leading-5 text-ink/55">
                Set <code>allowOptional</code> to <code>false</code> for lineup roles that cannot
                be treated as optional in track proposals.
              </p>
            </label>
            <Button className="md:col-span-2" type="submit">
              Save event settings
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <Badge>Lock</Badge>
            <p className="text-sm text-ink/70">
              {activeLock
                ? `Lock owned by @${activeLock.user.telegramUsername ?? activeLock.user.fullName} until ${new Date(activeLock.expiresAt).toLocaleTimeString()}.`
                : "No active curation lock. Acquire one before running the algorithm or publishing."}
            </p>
            <form action={acquireCurationLockAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.slug} />
              <Button type="submit" variant="secondary">
                Acquire or refresh lock
              </Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <Badge>Status</Badge>
            <div className="space-y-1 text-sm text-ink/70">
              <p>
                Effective status: <span className="font-semibold text-ink">{effectiveStatus}</span>
              </p>
              {effectiveStatus !== event.status ? (
                <p>
                  Stored status remains <span className="font-semibold text-ink">{event.status}</span>
                  , but registration timing currently makes the gig behave as{" "}
                  <span className="font-semibold text-ink">{effectiveStatus}</span>.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {["DRAFT", "OPEN", "CLOSED", "CURATING", "PUBLISHED"].map((status) => (
                <form action={updateEventStatusAction} key={status}>
                  <input name="eventId" type="hidden" value={event.id} />
                  <input name="eventSlug" type="hidden" value={event.slug} />
                  <input name="status" type="hidden" value={status} />
                  <Button
                    size="sm"
                    type="submit"
                    variant={event.status === status ? "primary" : "secondary"}
                  >
                    {status}
                  </Button>
                </form>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <Badge>Selection</Badge>
            <p className="text-sm text-ink/70">
              Run the coverage-first selection to populate the main set and backlog. Admins can then manually reorder or swap tracks.
            </p>
            <form action={runSelectionAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.slug} />
              <Button type="submit">Run selection algorithm</Button>
            </form>
            <form action={sortSetlistByDrummerAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.slug} />
              <Button type="submit" variant="secondary">
                Sort main set by drummer
              </Button>
            </form>
            <form action={publishSetlistAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.slug} />
              <Button type="submit" variant="accent">
                Publish setlist
              </Button>
            </form>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Badge>Main set</Badge>
          {event.setlistItems
            .filter((item) => item.section === "MAIN")
            .map((item) => (
              <div key={item.id} className="rounded-2xl border border-ink/10 p-4">
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
                <form action={moveSetlistItemAction} className="mt-4 grid gap-3 md:grid-cols-[1fr,120px,auto]">
                  <input name="eventId" type="hidden" value={event.id} />
                  <input name="eventSlug" type="hidden" value={event.slug} />
                  <input name="itemId" type="hidden" value={item.id} />
                  <select className="w-full px-4 py-3" defaultValue={item.section} name="section">
                    <option value="MAIN">MAIN</option>
                    <option value="BACKLOG">BACKLOG</option>
                  </select>
                  <input className="w-full px-4 py-3" defaultValue={item.orderIndex} name="orderIndex" type="number" />
                  <Button size="sm" type="submit" variant="secondary">
                    Move
                  </Button>
                </form>
              </div>
            ))}
        </Card>

        <Card className="space-y-4">
          <Badge>Backlog</Badge>
          {event.setlistItems
            .filter((item) => item.section === "BACKLOG")
            .map((item) => (
              <div key={item.id} className="rounded-2xl border border-ink/10 p-4">
                <p className="font-semibold">
                  {item.track.song.artist.name} - {item.track.song.title}
                </p>
                <form action={moveSetlistItemAction} className="mt-4 grid gap-3 md:grid-cols-[1fr,120px,auto]">
                  <input name="eventId" type="hidden" value={event.id} />
                  <input name="eventSlug" type="hidden" value={event.slug} />
                  <input name="itemId" type="hidden" value={item.id} />
                  <select className="w-full px-4 py-3" defaultValue={item.section} name="section">
                    <option value="BACKLOG">BACKLOG</option>
                    <option value="MAIN">MAIN</option>
                  </select>
                  <input className="w-full px-4 py-3" defaultValue={item.orderIndex} name="orderIndex" type="number" />
                  <Button size="sm" type="submit" variant="secondary">
                    Move
                  </Button>
                </form>
              </div>
            ))}
        </Card>
      </section>

      <section className="space-y-4">
        <Badge>Track administration</Badge>
        <div className="grid gap-5">
          {event.tracks.map((track) => (
            <Card key={track.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    {track.song.artist.name} - {track.song.title}
                  </h2>
                  <p className="text-sm text-ink/70">Proposed by @{track.proposedBy.telegramUsername}</p>
                </div>
                <form action={cancelTrackAction}>
                  <input name="trackId" type="hidden" value={track.id} />
                  <input name="eventSlug" type="hidden" value={event.slug} />
                  <Button type="submit" variant="ghost">
                    Cancel track
                  </Button>
                </form>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {track.seats.map((seat) => (
                  <div key={seat.id} className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{seat.label}</p>
                      <Badge>{seat.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink/70">
                      {seat.user ? `@${seat.user.telegramUsername}` : "Open"}
                    </p>
                    {seat.status !== TrackSeatStatus.CLAIMED ? (
                      <form action={adminAssignSeatAction} className="mt-4 space-y-2">
                        <input name="seatId" type="hidden" value={seat.id} />
                        <input name="eventSlug" type="hidden" value={event.slug} />
                        <input
                          className="w-full px-3 py-2 text-sm"
                          name="telegramUsername"
                          placeholder="username"
                        />
                        <Button size="sm" type="submit" variant="secondary">
                          Assign
                        </Button>
                      </form>
                    ) : (
                      <form action={adminClearSeatAction} className="mt-4">
                        <input name="seatId" type="hidden" value={seat.id} />
                        <input name="eventId" type="hidden" value={event.id} />
                        <input name="eventSlug" type="hidden" value={event.slug} />
                        <Button size="sm" type="submit" variant="secondary">
                          Clear seat
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
