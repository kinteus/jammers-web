import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/utils";
import { getHomePageData } from "@/server/query-data";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { events, publishedEvents } = await getHomePageData();
  const user = await getCurrentUser();

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <Card className="overflow-hidden bg-ink text-sand">
          <div className="space-y-6">
            <Badge className="bg-white/10 text-sand">Public Concert Workspace</Badge>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight lg:text-6xl">
                Build the next setlist with the whole band, not in a spreadsheet.
              </h1>
              <p className="max-w-2xl text-base text-sand/80">
                Propose songs, claim stage positions, invite collaborators through Telegram and hand admins an explainable selection flow with backlog control.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={events[0] ? `/events/${events[0].slug}` : "/admin"}>
                <Button variant="accent">Open active event</Button>
              </Link>
              <Link href={user ? "/profile" : "/profile"}>
                <Button variant="secondary">Open my workspace</Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">
            What ships in this version
          </p>
          <ul className="space-y-3 text-sm text-ink/80">
            <li>Telegram authentication and invite delivery integration point</li>
            <li>Per-event rules for set duration, slot limits, lineup and playback</li>
            <li>Admin curation with lock ownership, backlog and publication flow</li>
            <li>Coverage-first setlist algorithm with previous-gig filtering</li>
          </ul>
        </Card>
      </section>

      <section className="grid gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">
              Events
            </p>
            <h2 className="font-display text-3xl font-semibold">Current concert boards</h2>
          </div>
          {user?.role === "ADMIN" ? (
            <Link href="/admin">
              <Button variant="secondary">Admin workspace</Button>
            </Link>
          ) : null}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="space-y-5">
              <div className="space-y-2">
                <Badge>{event.effectiveStatus}</Badge>
                <h3 className="font-display text-2xl font-semibold">{event.title}</h3>
                <p className="text-sm text-ink/70">
                  {formatDateTime(event.startsAt)} at {event.venueName ?? "Venue TBD"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-ink/50">Tracks</p>
                  <p className="text-2xl font-semibold">{event.trackCount}</p>
                </div>
                <div>
                  <p className="text-ink/50">Participants</p>
                  <p className="text-2xl font-semibold">{event.participantCount}</p>
                </div>
                <div>
                  <p className="text-ink/50">Set limit</p>
                  <p className="text-2xl font-semibold">{event.maxSetDurationMinutes}m</p>
                </div>
              </div>
              <Link href={`/events/${event.slug}`}>
                <Button>Open board</Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">
            Published
          </p>
          <h2 className="font-display text-3xl font-semibold">Recent released setlists</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {publishedEvents.map((event) => (
            <Card key={event.id}>
              <p className="text-sm uppercase tracking-[0.2em] text-moss">Published event</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">{event.title}</h3>
              <p className="mt-3 text-sm text-ink/70">
                {event.setlistItems.length} main-set tracks released on {formatDateTime(event.startsAt)}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
