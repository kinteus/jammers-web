import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getDefaultLineupInput } from "@/lib/domain/lineup";
import { getFaqPageData } from "@/server/query-data";
import {
  DEFAULT_TRACK_INFO_FIELDS,
  formatTrackInfoFieldsForTextarea,
} from "@/lib/track-info-flags";
import {
  createCatalogSongAction,
  createEventAction,
  createKnownGroupAction,
  setBanAction,
  setRatingAction,
  updateFaqContentAction,
} from "@/server/actions";
import { formatVideoUrlsForTextarea } from "@/lib/site-content";
import { getAdminDashboardData } from "@/server/query-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return (
      <Card className="brand-shell">
        <p className="text-sm text-ember">Admin access required.</p>
      </Card>
    );
  }

  const [data, faq] = await Promise.all([getAdminDashboardData(), getFaqPageData()]);
  const defaultLineup = JSON.stringify(getDefaultLineupInput(), null, 2);
  const defaultTrackInfoFields = formatTrackInfoFieldsForTextarea(DEFAULT_TRACK_INFO_FIELDS);
  const notice = typeof params.notice === "string" ? params.notice : null;

  return (
    <div className="space-y-8 text-sand">
      {notice === "faq-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          FAQ обновлён. Публичная страница уже получила новую версию контента.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="brand-shell space-y-4">
          <Badge>Create event</Badge>
          <h1 className="font-display text-3xl font-semibold text-sand">Launch a new gig board</h1>
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
              <span>Track info flags</span>
              <textarea
                className="min-h-24 w-full px-4 py-3"
                defaultValue={defaultTrackInfoFields}
                name="trackInfoFieldsInput"
              />
              <p className="text-xs leading-5 text-white/55">
                One label per line. These flags appear on track proposals and inside the board as
                extra context only. They never affect whether a track counts as assembled.
              </p>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Lineup JSON</span>
              <textarea
                className="min-h-48 w-full px-4 py-3 font-mono text-xs"
                defaultValue={defaultLineup}
                name="lineupJson"
              />
              <p className="text-xs leading-5 text-white/55">
                Each slot can include <code>allowOptional</code>. Use <code>false</code> for roles
                that must never be marked optional.
              </p>
            </label>
            <Button className="md:col-span-2" type="submit">
              Create event
            </Button>
          </form>
        </Card>

        <Card className="brand-shell space-y-4">
          <Badge>Song catalog</Badge>
          <h2 className="font-display text-3xl font-semibold text-sand">Add songs to the controlled catalog</h2>
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
        <Card className="brand-shell space-y-4">
          <Badge>Moderation</Badge>
          <div className="grid gap-6 md:grid-cols-2">
            <form action={setBanAction} className="space-y-3">
              <h3 className="font-display text-2xl font-semibold text-sand">Ban user</h3>
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
              <h3 className="font-display text-2xl font-semibold text-sand">Rate musician</h3>
              <input className="w-full px-4 py-3" name="telegramUsername" placeholder="telegram username" required />
              <input className="w-full px-4 py-3" defaultValue={3} max={5} min={1} name="score" type="number" />
              <textarea className="min-h-24 w-full px-4 py-3" name="note" placeholder="internal note" />
              <Button type="submit">Save rating</Button>
            </form>
          </div>
        </Card>

        <Card className="brand-shell space-y-4">
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
            <p className="text-xs uppercase tracking-[0.16em] text-white/50">
              {data.groups.length} saved group{data.groups.length === 1 ? "" : "s"}
            </p>
            {data.groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                No known groups yet.
              </div>
            ) : (
              data.groups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-white/10 p-4">
                  <p className="font-semibold text-sand">{group.name}</p>
                  <p className="mt-1 text-sm text-white/70">
                    {group.members.map((member) => `@${member.user.telegramUsername}`).join(", ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="brand-shell space-y-4" id="faq-content">
          <Badge>FAQ</Badge>
          <h2 className="font-display text-3xl font-semibold text-sand">Public FAQ content</h2>
          <form action={updateFaqContentAction} className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span>Participation rules (Markdown)</span>
              <textarea
                className="min-h-56 w-full px-4 py-3"
                defaultValue={faq.participationRulesMarkdown}
                name="participationRulesMarkdown"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Line-up technical details (Markdown)</span>
              <textarea
                className="min-h-56 w-full px-4 py-3"
                defaultValue={faq.lineupDetailsMarkdown}
                name="lineupDetailsMarkdown"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>YouTube video links</span>
              <textarea
                className="min-h-32 w-full px-4 py-3"
                defaultValue={formatVideoUrlsForTextarea(faq.lineupVideoUrls)}
                name="lineupVideoUrlsInput"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-xs leading-5 text-white/55">
                One YouTube link per line. Videos appear in the technical line-up section.
              </p>
            </label>
            <div className="flex flex-wrap gap-3">
              <SubmitButton pendingLabel="Saving FAQ..." type="submit">
                Save FAQ
              </SubmitButton>
              <Link href="/faq">
                <Button type="button" variant="secondary">
                  Open public FAQ
                </Button>
              </Link>
            </div>
          </form>
        </Card>

        <Card className="brand-shell space-y-4">
          <Badge>Feedback route</Badge>
          <h2 className="font-display text-3xl font-semibold text-sand">Feedback form delivery</h2>
          <div className="space-y-3 text-sm text-white/72">
            <p>
              FAQ feedback goes to the Telegram chat configured in <code>TELEGRAM_FEEDBACK_CHAT_ID</code>.
            </p>
            <p>
              If the variable is empty, visitors will see a delivery error instead of a silent submit.
            </p>
            <p>
              Signed-in users are identified by their Telegram handle automatically; guests can leave
              their own contact details manually.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="brand-shell space-y-4">
          <Badge>Events</Badge>
          <div className="grid gap-3">
            {data.events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-4">
                <div>
                  <p className="font-semibold text-sand">{event.title}</p>
                  <p className="text-sm text-white/70">
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

        <Card className="brand-shell space-y-4">
          <Badge>Queue</Badge>
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-sand">Song requests</p>
              <div className="mt-3 grid gap-3">
                {data.songRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 p-4 text-sm">
                    <p>
                      {request.artistName} - {request.trackTitle}
                    </p>
                    <p className="mt-1 text-white/60">
                      Requested by @{request.requestedBy.telegramUsername}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-sand">Users</p>
              <div className="mt-3 grid gap-3">
                {data.users.slice(0, 8).map((member) => (
                  <div key={member.id} className="rounded-2xl border border-white/10 p-4 text-sm">
                    <p>@{member.telegramUsername ?? member.fullName}</p>
                    <p className="mt-1 text-white/60">
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
