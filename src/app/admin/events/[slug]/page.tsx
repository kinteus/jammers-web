import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TrackSeatStatus } from "@prisma/client";

import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import { getEffectiveMaxSetTrackCount } from "@/lib/domain/setlist-limit";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
} from "@/lib/track-info-flags";
import {
  acquireCurationLockAction,
  adminAssignSeatAction,
  adminClearSeatAction,
  cancelTrackAction,
  deleteEventAction,
  publishSetlistAction,
  runSelectionAction,
  sortSetlistByDrummerAction,
  updateEventAction,
  updateEventStatusAction,
} from "@/server/actions";
import { isDatabaseAvailable } from "@/server/database-health";
import { requireAdmin } from "@/server/auth-guards";
import { getEventWorkspace } from "@/server/query-data";

import { AdminSetlistStack } from "@/components/admin-setlist-stack";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
};

function buildLineupSummary(
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
        `${seat.label}: @${seat.user?.telegramUsername ?? seat.user?.fullName ?? "unknown"}`,
    );

  return occupied.length > 0 ? occupied.join(", ") : "No players assigned yet.";
}

export default async function AdminEventPage({ params }: AdminEventPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

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
        <p className="text-sm text-ember">Admin access required.</p>
      </Card>
    );
  }

  let event;

  try {
    event = await getEventWorkspace(slug);
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
    })),
    null,
    2,
  );
  const trackInfoFields = formatTrackInfoFieldsForTextarea(
    getEventTrackInfoFields(event.trackInfoFieldsJson, event.allowPlayback),
  );
  const effectiveStatus = getEffectiveEventStatus(event);
  const mainSetItems = event.setlistItems
    .filter((item) => item.section === "MAIN")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => ({
      id: item.id,
      orderIndex: item.orderIndex,
      title: item.track.song.title,
      artistName: item.track.song.artist.name,
      lineupSummary: buildLineupSummary(item.track.seats),
    }));
  const backlogItems = event.setlistItems
    .filter((item) => item.section === "BACKLOG")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((item) => ({
      id: item.id,
      orderIndex: item.orderIndex,
      title: item.track.song.title,
      artistName: item.track.song.artist.name,
      lineupSummary: buildLineupSummary(item.track.seats),
    }));

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <Card className="space-y-4">
          <Badge>Event settings</Badge>
          <h1 className="font-display text-4xl font-semibold">{event.title}</h1>
          <form action={updateEventAction} className="grid gap-4 md:grid-cols-2">
            <input name="eventId" type="hidden" value={event.id} />
            <input name="eventSlug" type="hidden" value={event.id} />
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
                required
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Registration opens at</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.registrationOpensAt?.toISOString().slice(0, 16) ?? ""}
                name="registrationOpensAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Registration closes at</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={event.registrationClosesAt?.toISOString().slice(0, 16) ?? ""}
                name="registrationClosesAt"
                required
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
              <span>Max main-set songs</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={getEffectiveMaxSetTrackCount(event.maxSetDurationMinutes)}
                min={1}
                name="maxSetTrackCount"
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
            <SubmitButton className="md:col-span-2" pendingLabel="Saving event..." type="submit">
              Save event settings
            </SubmitButton>
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
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel="Refreshing lock..." type="submit" variant="secondary">
                Acquire or refresh lock
              </SubmitButton>
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
                  <input name="eventSlug" type="hidden" value={event.id} />
                  <input name="status" type="hidden" value={status} />
                  <SubmitButton
                    pendingLabel="Updating..."
                    size="sm"
                    type="submit"
                    variant={event.status === status ? "primary" : "secondary"}
                  >
                    {status}
                  </SubmitButton>
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
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel="Running selection..." type="submit">
                Run selection algorithm
              </SubmitButton>
            </form>
            <form action={sortSetlistByDrummerAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel="Sorting..." type="submit" variant="secondary">
                Sort main set by drummer
              </SubmitButton>
            </form>
            <form action={publishSetlistAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton pendingLabel="Publishing..." type="submit" variant="accent">
                Publish setlist
              </SubmitButton>
            </form>
          </Card>

          <Card className="space-y-4 border-red/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%),radial-gradient(circle_at_top_right,rgba(185,0,22,0.18),transparent_24%),#171717]">
            <Badge>Danger zone</Badge>
            <div className="space-y-2">
              <p className="font-display text-2xl font-semibold text-sand">Delete this gig</p>
              <p className="text-sm leading-6 text-white/66">
                This removes the public board, setlist, seats, invites and admin workspace for this event.
              </p>
            </div>
            <form action={deleteEventAction}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="eventSlug" type="hidden" value={event.id} />
              <SubmitButton
                className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
                pendingLabel="Deleting gig..."
                type="submit"
                variant="secondary"
              >
                Delete gig
              </SubmitButton>
            </form>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Badge>Main set</Badge>
          <AdminSetlistStack
            emptyLabel="Run the selection algorithm to generate the main set."
            eventId={event.id}
            eventSlug={event.id}
            items={mainSetItems}
            moveLabel="Send to backlog"
            section="MAIN"
            targetSection="BACKLOG"
            title="Drag to reorder the running set"
          />
        </Card>

        <Card className="space-y-4">
          <Badge>Backlog</Badge>
          <AdminSetlistStack
            emptyLabel="No backlog tracks yet."
            eventId={event.id}
            eventSlug={event.id}
            items={backlogItems}
            moveLabel="Move to main set"
            section="BACKLOG"
            targetSection="MAIN"
            title="Backlog order"
          />
        </Card>
      </section>

      <section className="space-y-4">
        <Badge>Track administration</Badge>
        <div className="space-y-3">
          {event.tracks.map((track) => {
            const completion = getTrackCompletionSummary(track.seats);
            const claimedCount = track.seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).length;
            const occupiedLineup = buildLineupSummary(track.seats);

            return (
              <details className="brand-shell overflow-hidden rounded-2xl border-white/10" key={track.id}>
                <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Proposed by @{track.proposedBy.telegramUsername}
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-sand">
                      {track.song.artist.name} - {track.song.title}
                    </h2>
                    <p className="text-sm leading-6 text-white/62">
                      {claimedCount} filled · {completion.requiredOpen} required open · {track.seats.length} total seats
                    </p>
                  </div>
                  <div className="max-w-[520px] text-sm leading-6 text-white/56">
                    {occupiedLineup}
                  </div>
                </summary>

                <div className="space-y-3 border-t border-white/10 px-5 py-5">
                  <div className="flex flex-wrap justify-end gap-3">
                    <form action={cancelTrackAction}>
                      <input name="trackId" type="hidden" value={track.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <SubmitButton pendingLabel="Canceling..." type="submit" variant="ghost">
                        Cancel track
                      </SubmitButton>
                    </form>
                  </div>

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
                            {seat.user ? `@${seat.user.telegramUsername ?? seat.user.fullName}` : "Open"}
                          </p>
                        </div>

                        {seat.status !== TrackSeatStatus.CLAIMED ? (
                          <form action={adminAssignSeatAction} className="flex flex-wrap items-center gap-2">
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventSlug" type="hidden" value={event.id} />
                            <input
                              className="w-[180px] px-3 py-2 text-sm"
                              name="telegramUsername"
                              placeholder="username"
                            />
                            <SubmitButton pendingLabel="Assigning..." size="sm" type="submit" variant="secondary">
                              Assign
                            </SubmitButton>
                          </form>
                        ) : (
                          <form action={adminClearSeatAction}>
                            <input name="seatId" type="hidden" value={seat.id} />
                            <input name="eventId" type="hidden" value={event.id} />
                            <input name="eventSlug" type="hidden" value={event.id} />
                            <SubmitButton pendingLabel="Clearing..." size="sm" type="submit" variant="secondary">
                              Clear seat
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
