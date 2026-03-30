import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getDefaultLineupInput } from "@/lib/domain/lineup";
import {
  createCatalogSongAction,
  createEventAction,
  createKnownGroupAction,
  setBanAction,
  setRatingAction,
} from "@/server/actions";
import { getAdminDashboardData } from "@/server/query-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return (
      <Card>
        <p className="text-sm text-ember">Admin access required.</p>
      </Card>
    );
  }

  const data = await getAdminDashboardData();
  const defaultLineup = JSON.stringify(getDefaultLineupInput(), null, 2);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Badge>Create event</Badge>
          <h1 className="font-display text-3xl font-semibold">Launch a new concert board</h1>
          <form action={createEventAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Title</span>
              <input className="w-full px-4 py-3" name="title" required />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Description</span>
              <textarea className="min-h-24 w-full px-4 py-3" name="description" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Starts at</span>
              <input className="w-full px-4 py-3" name="startsAt" required type="datetime-local" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Registration closes at</span>
              <input className="w-full px-4 py-3" name="registrationClosesAt" required type="datetime-local" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Venue</span>
              <input className="w-full px-4 py-3" name="venueName" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Venue map URL</span>
              <input className="w-full px-4 py-3" name="venueMapUrl" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Max set duration (minutes)</span>
              <input className="w-full px-4 py-3" defaultValue={120} name="maxSetDurationMinutes" type="number" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Max tracks per user</span>
              <input className="w-full px-4 py-3" defaultValue={3} name="maxTracksPerUser" type="number" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Stage notes</span>
              <textarea className="min-h-24 w-full px-4 py-3" name="stageNotes" />
            </label>
            <label className="space-y-2 text-sm flex items-center gap-3 md:col-span-2">
              <input defaultChecked name="allowPlayback" type="checkbox" />
              Allow playback usage in proposals
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Lineup JSON</span>
              <textarea
                className="min-h-48 w-full px-4 py-3 font-mono text-xs"
                defaultValue={defaultLineup}
                name="lineupJson"
              />
            </label>
            <Button className="md:col-span-2" type="submit">
              Create event
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <Badge>Song catalog</Badge>
          <h2 className="font-display text-3xl font-semibold">Add songs to the controlled catalog</h2>
          <form action={createCatalogSongAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>Artist</span>
              <input className="w-full px-4 py-3" name="artistName" required />
            </label>
            <label className="space-y-2 text-sm">
              <span>Track</span>
              <input className="w-full px-4 py-3" name="trackTitle" required />
            </label>
            <label className="space-y-2 text-sm">
              <span>Duration (seconds)</span>
              <input className="w-full px-4 py-3" defaultValue={240} name="durationSeconds" type="number" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Tuning</span>
              <input className="w-full px-4 py-3" name="defaultTuning" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Notes</span>
              <textarea className="min-h-24 w-full px-4 py-3" name="notes" />
            </label>
            <Button className="md:col-span-2" type="submit">
              Upsert song
            </Button>
          </form>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Badge>Moderation</Badge>
          <div className="grid gap-6 md:grid-cols-2">
            <form action={setBanAction} className="space-y-3">
              <h3 className="font-display text-2xl font-semibold">Ban user</h3>
              <input className="w-full px-4 py-3" name="telegramUsername" placeholder="telegram username" required />
              <input className="w-full px-4 py-3" name="reason" placeholder="reason" />
              <input className="w-full px-4 py-3" defaultValue={7} name="durationDays" type="number" />
              <label className="flex items-center gap-3 text-sm">
                <input name="isPermanent" type="checkbox" />
                Permanent ban
              </label>
              <Button type="submit" variant="secondary">
                Apply ban
              </Button>
            </form>

            <form action={setRatingAction} className="space-y-3">
              <h3 className="font-display text-2xl font-semibold">Rate musician</h3>
              <input className="w-full px-4 py-3" name="telegramUsername" placeholder="telegram username" required />
              <input className="w-full px-4 py-3" defaultValue={3} max={5} min={1} name="score" type="number" />
              <textarea className="min-h-24 w-full px-4 py-3" name="note" placeholder="internal note" />
              <Button type="submit">Save rating</Button>
            </form>
          </div>
        </Card>

        <Card className="space-y-4">
          <Badge>Known groups</Badge>
          <form action={createKnownGroupAction} className="space-y-3">
            <input className="w-full px-4 py-3" name="name" placeholder="Group name" required />
            <textarea className="min-h-24 w-full px-4 py-3" name="description" placeholder="Description" />
            <input
              className="w-full px-4 py-3"
              name="memberUsernames"
              placeholder="comma-separated telegram usernames"
              required
            />
            <Button type="submit">Create known group</Button>
          </form>
          <div className="grid gap-3">
            {data.groups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-ink/10 p-4">
                <p className="font-semibold">{group.name}</p>
                <p className="mt-1 text-sm text-ink/70">
                  {group.members.map((member) => `@${member.user.telegramUsername}`).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-4">
          <Badge>Events</Badge>
          <div className="grid gap-3">
            {data.events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 p-4">
                <div>
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm text-ink/70">
                    {event.status} · {event.tracks.length} active tracks
                  </p>
                </div>
                <Link href={`/admin/events/${event.slug}`}>
                  <Button size="sm">Open event admin</Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <Badge>Queue</Badge>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">Song requests</p>
              <div className="mt-3 grid gap-3">
                {data.songRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-ink/10 p-4 text-sm">
                    <p>
                      {request.artistName} - {request.trackTitle}
                    </p>
                    <p className="mt-1 text-ink/60">
                      Requested by @{request.requestedBy.telegramUsername}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold">Users</p>
              <div className="mt-3 grid gap-3">
                {data.users.slice(0, 8).map((member) => (
                  <div key={member.id} className="rounded-2xl border border-ink/10 p-4 text-sm">
                    <p>@{member.telegramUsername ?? member.fullName}</p>
                    <p className="mt-1 text-ink/60">
                      {member.bans.length > 0 ? "Has active ban" : "Active"} · Ratings: {member.ratingsReceived.map((rating) => rating.score).join(", ") || "none"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
