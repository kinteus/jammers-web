import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import {
  devSignInAction,
  respondToInviteAction,
  updateProfileAction,
} from "@/server/actions";
import { getProfileWorkspace } from "@/server/query-data";

import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const instruments = await db.instrument.findMany({
    orderBy: { name: "asc" },
  });

  if (!user) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5">
          <Badge>Telegram auth</Badge>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-semibold">
              Sign in with Telegram to join the board
            </h1>
            <p className="text-sm text-ink/70">
              Telegram username is the primary identity for invites, published lineups and private collaboration.
            </p>
          </div>
          {params.authError ? (
            <p className="rounded-2xl bg-ember/10 p-3 text-sm text-ember">
              {params.authError}
            </p>
          ) : null}
          <TelegramLoginWidget />
        </Card>

        {env.ENABLE_DEV_AUTH && env.NODE_ENV !== "production" ? (
          <Card className="space-y-5">
            <Badge>Dev fallback</Badge>
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-semibold">Local development sign-in</h2>
              <p className="text-sm text-ink/70">
                Enabled only for local development and tests. Production should rely on Telegram auth.
              </p>
            </div>
            <form action={devSignInAction} className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span>Telegram username</span>
                <input
                  className="w-full px-4 py-3"
                  defaultValue="anna_drums"
                  name="telegramUsername"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Role</span>
                <select className="w-full px-4 py-3" defaultValue="USER" name="role">
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <Button type="submit">Continue locally</Button>
            </form>
          </Card>
        ) : null}
      </div>
    );
  }

  const profile = await getProfileWorkspace(user.id);
  if (!profile) {
    redirect("/");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
      <Card className="space-y-6">
        <div className="space-y-2">
          <Badge>Profile</Badge>
          <h1 className="font-display text-4xl font-semibold">Your musician card</h1>
          <p className="text-sm text-ink/70">
            This information drives instrument suggestions, invites and public setlist visibility.
          </p>
        </div>

        <form action={updateProfileAction} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm md:col-span-2">
            <span>Telegram username</span>
            <input
              className="w-full px-4 py-3"
              defaultValue={profile.telegramUsername ?? ""}
              name="telegramUsername"
              readOnly={Boolean(profile.telegramId)}
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Full name</span>
            <input className="w-full px-4 py-3" defaultValue={profile.fullName ?? ""} name="fullName" />
          </label>
          <label className="space-y-2 text-sm">
            <span>Phone</span>
            <input className="w-full px-4 py-3" defaultValue={profile.phone ?? ""} name="phone" />
          </label>
          <label className="space-y-2 text-sm">
            <span>Email</span>
            <input className="w-full px-4 py-3" defaultValue={profile.email ?? ""} name="email" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span>Bio</span>
            <textarea className="min-h-28 w-full px-4 py-3" defaultValue={profile.bio ?? ""} name="bio" />
          </label>
          <fieldset className="space-y-3 md:col-span-2">
            <legend className="text-sm font-medium">Primary instruments</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {instruments.map((instrument) => (
                <label
                  key={instrument.id}
                  className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand/60 px-4 py-3 text-sm"
                >
                  <input
                    defaultChecked={profile.instruments.some(
                      (entry) => entry.instrumentId === instrument.id,
                    )}
                    name="instrumentIds"
                    type="checkbox"
                    value={instrument.id}
                  />
                  {instrument.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Button className="md:col-span-2" type="submit">
            Save profile
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-4">
          <Badge>Invitations</Badge>
          <h2 className="font-display text-2xl font-semibold">Pending seat invites</h2>
          <div className="space-y-4">
            {profile.invitations.length === 0 ? (
              <p className="text-sm text-ink/60">No pending invites right now.</p>
            ) : (
              profile.invitations.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-ink/10 p-4">
                  <p className="font-semibold">
                    {invite.track.song.artist.name} - {invite.track.song.title}
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    {invite.seat.label} for {invite.track.event.title}, invited by @
                    {invite.sender.telegramUsername}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <form action={respondToInviteAction}>
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <input name="decision" type="hidden" value="accept" />
                      <input name="eventSlug" type="hidden" value={invite.track.event.slug} />
                      <Button size="sm" type="submit">
                        Accept
                      </Button>
                    </form>
                    <form action={respondToInviteAction}>
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <input name="decision" type="hidden" value="decline" />
                      <input name="eventSlug" type="hidden" value={invite.track.event.slug} />
                      <Button size="sm" type="submit" variant="secondary">
                        Decline
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <Badge>My tracks</Badge>
          <h2 className="font-display text-2xl font-semibold">Where you are playing</h2>
          <div className="space-y-4">
            {profile.trackSeats.length === 0 ? (
              <p className="text-sm text-ink/60">You are not assigned to any song yet.</p>
            ) : (
              profile.trackSeats.map((seat) => (
                <div key={seat.id} className="rounded-2xl border border-ink/10 p-4">
                  <p className="font-semibold">
                    {seat.track.song.artist.name} - {seat.track.song.title}
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    {seat.label} on {formatDateTime(seat.track.event.startsAt)}
                  </p>
                  <p className="mt-2 text-sm text-ink/70">
                    Line-up:{" "}
                    {seat.track.seats
                      .filter((entry) => entry.user)
                      .map(
                        (entry) =>
                          `${entry.label}: @${entry.user?.telegramUsername ?? entry.user?.fullName}`,
                      )
                      .join(", ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
