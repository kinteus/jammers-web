import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";
import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import { getDefaultLineupInput } from "@/lib/domain/lineup";
import { DEFAULT_MAX_SET_TRACK_COUNT } from "@/lib/domain/setlist-limit";
import {
  DEFAULT_TRACK_INFO_FIELDS,
  formatTrackInfoFieldsForTextarea,
} from "@/lib/track-info-flags";
import { env } from "@/lib/env";
import { formatVideoUrlsForTextarea } from "@/lib/site-content";
import { isSuperAdminUser } from "@/lib/auth/admin-access";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  createCatalogSongAction,
  createEventAction,
  createKnownGroupAction,
  deleteEventAction,
  grantAdminRoleAction,
  revokeAdminRoleAction,
  setBanAction,
  setRatingAction,
  updateEventStatusAction,
  updateFaqContentAction,
} from "@/server/actions";
import { isDatabaseAvailable } from "@/server/database-health";
import { getAdminDashboardData, getFaqPageData } from "@/server/query-data";

import { AdminActionDialog } from "@/components/admin-action-dialog";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getQuickAction(event: {
  status: string;
  effectiveStatus?: string;
}) {
  const status = event.effectiveStatus ?? event.status;

  if (status === "DRAFT") {
    return { label: "Open gig", pendingLabel: "Opening...", status: "OPEN" as const };
  }
  if (status === "OPEN") {
    return { label: "Close gig", pendingLabel: "Closing...", status: "CLOSED" as const };
  }
  if (status === "CLOSED" || status === "CURATING") {
    return { label: "Publish setlist", pendingLabel: "Publishing...", status: "PUBLISHED" as const };
  }

  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user || user.role !== "ADMIN") {
    if (!(await isDatabaseAvailable())) {
      return (
        <DatabaseUnavailableState
          locale={locale}
          title={pick(locale, {
            en: "Admin data can't load right now",
            ru: "Сейчас админские данные не загружаются",
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

  let data;
  let faq;

  try {
    [data, faq] = await Promise.all([getAdminDashboardData(), getFaqPageData()]);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return (
      <DatabaseUnavailableState
        locale={locale}
        title={pick(locale, {
          en: "Admin data can't load right now",
          ru: "Сейчас админские данные не загружаются",
        })}
      />
    );
  }
  const defaultLineup = JSON.stringify(getDefaultLineupInput(), null, 2);
  const defaultTrackInfoFields = formatTrackInfoFieldsForTextarea(DEFAULT_TRACK_INFO_FIELDS);
  const notice = typeof params.notice === "string" ? params.notice : null;
  const canManageAdmins = isSuperAdminUser(user);
  const adminUsers = data.users
    .filter((member) => member.role === "ADMIN")
    .sort((left, right) => {
      const leftName = left.telegramUsername ?? left.fullName ?? "";
      const rightName = right.telegramUsername ?? right.fullName ?? "";
      return leftName.localeCompare(rightName);
    });
  const primaryAdminUsername = normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME);

  return (
    <div className="space-y-8 text-sand">
      {notice === "faq-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          FAQ обновлён. Публичная страница уже получила новую версию контента.
        </div>
      ) : null}

      {notice === "event-deleted" ? (
        <div className="rounded-xl border border-red/30 bg-red/12 px-4 py-3 text-sm text-white">
          Gig deleted. The public board and admin view have been removed.
        </div>
      ) : null}

      <section className="space-y-5">
        <div className="space-y-2">
          <Badge>Admin cockpit</Badge>
          <h1 className="font-display text-4xl font-semibold text-sand">Open only the tool you need</h1>
          <p className="max-w-3xl text-sm leading-6 text-white/70">
            The admin home now stays compact by default. Heavy workflows live behind focused pop-up panels instead of competing on the screen at once.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Events</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{data.events.length}</p>
          </div>
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Song requests</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{data.songRequests.length}</p>
          </div>
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Admins</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{adminUsers.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminActionDialog
            badge="Create event"
            description="Launch a new gig board without keeping the whole form open on the page."
            title="Launch a new gig board"
            triggerLabel="Create gig"
          >
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
                <span>Registration opens at</span>
                <input className="w-full px-4 py-3" name="registrationOpensAt" required type="datetime-local" />
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
                <span>Max main-set songs</span>
                <input
                  className="w-full px-4 py-3"
                  defaultValue={DEFAULT_MAX_SET_TRACK_COUNT}
                  min={1}
                  name="maxSetTrackCount"
                  type="number"
                />
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
                  One label per line. These flags appear on track proposals and inside the board as extra context only.
                </p>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>Lineup JSON</span>
                <textarea
                  className="min-h-48 w-full px-4 py-3 font-mono text-xs"
                  defaultValue={defaultLineup}
                  name="lineupJson"
                />
              </label>
              <SubmitButton className="md:col-span-2" pendingLabel="Creating gig..." type="submit">
                Create event
              </SubmitButton>
            </form>
          </AdminActionDialog>

          <AdminActionDialog
            badge="Song catalog"
            description="Keep controlled catalog edits out of the main admin canvas until you need them."
            title="Add songs to the controlled catalog"
            triggerLabel="Song catalog"
          >
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
              <SubmitButton className="md:col-span-2" pendingLabel="Saving song..." type="submit">
                Upsert song
              </SubmitButton>
            </form>
          </AdminActionDialog>

          <AdminActionDialog
            badge="Moderation"
            description="Ban and rate musicians only when you need those controls."
            title="Moderation"
            triggerLabel="Moderation"
          >
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
                <SubmitButton pendingLabel="Applying ban..." type="submit" variant="secondary">
                  Apply ban
                </SubmitButton>
              </form>

              <form action={setRatingAction} className="space-y-3">
                <h3 className="font-display text-2xl font-semibold text-sand">Rate musician</h3>
                <input className="w-full px-4 py-3" name="telegramUsername" placeholder="telegram username" required />
                <input className="w-full px-4 py-3" defaultValue={3} max={5} min={1} name="score" type="number" />
                <textarea className="min-h-24 w-full px-4 py-3" name="note" placeholder="internal note" />
                <SubmitButton pendingLabel="Saving rating..." type="submit">
                  Save rating
                </SubmitButton>
              </form>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge="Known groups"
            description="Manage recurring ensembles without keeping the full member list in view all the time."
            title="Known groups"
            triggerLabel={`Known groups (${data.groups.length})`}
          >
            <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
              <form action={createKnownGroupAction} className="space-y-3">
                <input className="w-full px-4 py-3" name="name" placeholder="Group name" required />
                <textarea className="min-h-24 w-full px-4 py-3" name="description" placeholder="Description" />
                <input
                  className="w-full px-4 py-3"
                  name="memberUsernames"
                  placeholder="comma-separated telegram usernames"
                  required
                />
                <SubmitButton pendingLabel="Creating group..." type="submit">
                  Create known group
                </SubmitButton>
              </form>
              <div className="grid gap-3">
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
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge="FAQ"
            description="Update public FAQ content without keeping the entire markdown editor always open."
            title="Public FAQ content"
            triggerLabel="FAQ content"
            triggerVariant="accent"
          >
            <div className="space-y-5">
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
              <div className="rounded-2xl border border-white/10 p-4 text-sm leading-6 text-white/72">
                FAQ feedback goes to the Telegram chat configured in <code>TELEGRAM_FEEDBACK_CHAT_ID</code>. If it is empty, visitors see a delivery error instead of a silent submit.
              </div>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge="Admin access"
            description="Review the current admin roster and update it only when necessary."
            title="Admin access"
            triggerLabel="Admin roster"
          >
            <div className="grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-semibold">Current admins</h2>
                <div className="grid gap-3">
                  {adminUsers.map((member) => {
                    const username = member.telegramUsername ?? member.fullName ?? "unknown";
                    const isPrimaryAdmin =
                      normalizeTelegramUsername(member.telegramUsername) === primaryAdminUsername;

                    return (
                      <div
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4"
                      >
                        <div>
                          <p className="font-semibold text-sand">@{username}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {isPrimaryAdmin ? "Primary admin" : "Admin"}
                          </p>
                        </div>
                        {canManageAdmins && !isPrimaryAdmin ? (
                          <form action={revokeAdminRoleAction}>
                            <input name="telegramUsername" type="hidden" value={username} />
                            <SubmitButton pendingLabel="Removing..." size="sm" type="submit" variant="ghost">
                              Remove admin
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-2xl font-semibold">Manage admin list</h3>
                {canManageAdmins ? (
                  <form action={grantAdminRoleAction} className="space-y-3">
                    <p className="text-sm text-white/60">
                      Only @{primaryAdminUsername} can promote or demote admins.
                    </p>
                    <input
                      className="w-full px-4 py-3"
                      name="telegramUsername"
                      placeholder="telegram username"
                      required
                    />
                    <SubmitButton pendingLabel="Granting access..." type="submit">
                      Grant admin access
                    </SubmitButton>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">
                    Admin list changes are reserved for the primary admin.
                  </div>
                )}
              </div>
            </div>
          </AdminActionDialog>
          <AdminActionDialog
            badge="Community queue"
            description="Inspect incoming requests and recent user state only when moderation context is needed."
            title="Song requests and recent users"
            triggerLabel="Queue overview"
          >
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-sand">Song requests</p>
                <div className="mt-3 grid gap-3">
                  {data.songRequests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                      No open song requests.
                    </div>
                  ) : (
                    data.songRequests.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-white/10 p-4 text-sm">
                        <p>
                          {request.artistName} - {request.trackTitle}
                        </p>
                        <p className="mt-1 text-white/60">
                          Requested by @{request.requestedBy.telegramUsername}
                        </p>
                      </div>
                    ))
                  )}
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
          </AdminActionDialog>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <Badge>Gig workspaces</Badge>
          <h2 className="font-display text-3xl font-semibold text-sand">All gigs, with fast next moves</h2>
          <p className="max-w-3xl text-sm leading-6 text-white/70">
            Keep the full list visible for quick operations. Each row gives you the next likely product action without forcing a trip into the event screen first.
          </p>
        </div>

        <div className="grid gap-3">
          {data.events.map((event) => {
            const effectiveStatus = getEffectiveEventStatus(event);
            const quickAction = getQuickAction({
              status: event.status,
              effectiveStatus,
            });

            return (
              <Card className="brand-shell rounded-[1.35rem] border-white/10 p-4" key={event.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-blue/24 bg-blue/16 text-white">{effectiveStatus}</Badge>
                      <span className="text-sm text-white/58">{event.tracks.length} active tracks</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sand">{event.title}</p>
                      {effectiveStatus !== event.status ? (
                        <p className="mt-1 text-xs text-white/45">Stored status: {event.status}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/events/${event.id}`}>
                      <Button size="sm" variant="secondary">Open event admin</Button>
                    </Link>

                    {quickAction ? (
                      <form action={updateEventStatusAction}>
                        <input name="eventId" type="hidden" value={event.id} />
                        <input name="eventSlug" type="hidden" value={event.id} />
                        <input name="status" type="hidden" value={quickAction.status} />
                        <SubmitButton pendingLabel={quickAction.pendingLabel} size="sm" type="submit">
                          {quickAction.label}
                        </SubmitButton>
                      </form>
                    ) : null}

                    <form action={deleteEventAction}>
                      <input name="eventId" type="hidden" value={event.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <SubmitButton
                        className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
                        pendingLabel="Deleting..."
                        size="sm"
                        type="submit"
                        variant="secondary"
                      >
                        Delete gig
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
