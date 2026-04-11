import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { parseClosedOptionalSeatRequestMeta } from "@/lib/track-invite-meta";
import { formatDateTime } from "@/lib/utils";
import {
  devSignInAction,
  respondToInviteAction,
  updateProfileAction,
} from "@/server/actions";
import { getProfileWorkspace } from "@/server/query-data";

import { ProfileArchiveStats } from "@/components/profile-archive-stats";
import { InstrumentToken } from "@/components/instrument-token";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Sign in with Telegram to manage your invites, instruments, and current songs.",
  alternates: {
    canonical: "/profile",
  },
  robots: {
    index: false,
    follow: false,
  },
};

type ProfileWorkspace = NonNullable<Awaited<ReturnType<typeof getProfileWorkspace>>>;
type ProfileTrackSeat = ProfileWorkspace["trackSeats"][number]["track"]["seats"][number];

function buildGroupedCurrentSongs(
  seats: ProfileWorkspace["trackSeats"],
) {
  const grouped = new Map<
    string,
    {
      track: (typeof seats)[number]["track"];
      positions: string[];
      latestClaimedAt: Date | null;
    }
  >();

  for (const seat of seats) {
    const existing = grouped.get(seat.track.id);
    if (existing) {
      if (!existing.positions.includes(seat.label)) {
        existing.positions.push(seat.label);
      }
      if (seat.claimedAt && (!existing.latestClaimedAt || seat.claimedAt > existing.latestClaimedAt)) {
        existing.latestClaimedAt = seat.claimedAt;
      }
      continue;
    }

    grouped.set(seat.track.id, {
      track: seat.track,
      positions: [seat.label],
      latestClaimedAt: seat.claimedAt,
    });
  }

  return [...grouped.values()].sort(
    (a, b) => (b.latestClaimedAt?.getTime() ?? 0) - (a.latestClaimedAt?.getTime() ?? 0),
  );
}

type ProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const instruments = await db.instrument.findMany({
    orderBy: { name: "asc" },
  });
  const authError = typeof params.authError === "string" ? params.authError : null;

  if (!user) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="brand-shell space-y-5">
          <Badge>Telegram auth</Badge>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.03em] text-sand">
              {pick(locale, {
                en: "Sign in to join songs and manage invites",
                ru: "Войди, чтобы вписываться в песни и управлять приглашениями",
              })}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/70">
              {pick(locale, {
                en: "Your Telegram account becomes your shared identity for invites, line-ups and musician coordination.",
                ru: "Твой Telegram-аккаунт становится общей точкой входа для приглашений, лайнапов и координации музыкантов.",
              })}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {pick(locale, {
              en: [
                "Take open seats from any live board.",
                "Accept or decline invites in one place.",
                "Keep your instruments current so bandmates can find you.",
              ],
              ru: [
                "Занимай открытые места на любом живом борде.",
                "Принимай и отклоняй приглашения в одном месте.",
                "Держи инструменты актуальными, чтобы тебя было проще найти.",
              ],
            }).map((item) => (
              <div className="brand-shell-soft rounded-xl px-4 py-4 text-sm leading-6 text-white/72" key={item}>
                {item}
              </div>
            ))}
          </div>
          {authError ? (
            <p className="rounded-md bg-ember/10 p-3 text-sm text-ember">
              {pick(locale, {
                en:
                  authError === "retry"
                    ? "Please complete sign-in from the Telegram button on this page and try again."
                    : "Telegram sign-in failed. Please try again.",
                ru:
                  authError === "retry"
                    ? "Заверши вход через кнопку Telegram на этой странице и попробуй ещё раз."
                    : "Не удалось войти через Telegram. Попробуй ещё раз.",
              })}
            </p>
          ) : null}
          <TelegramLoginWidget botUsername={env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME} />
          <Link href="/">
            <Button variant="secondary">
              {pick(locale, { en: "Browse gigs first", ru: "Сначала посмотреть гиги" })}
            </Button>
          </Link>
        </Card>

        {env.ENABLE_DEV_AUTH && env.NODE_ENV !== "production" ? (
          <Card className="brand-shell space-y-5">
            <Badge>Development only</Badge>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, {
                  en: "Local development sign-in",
                  ru: "Локальный вход для разработки",
                })}
              </h2>
              <p className="text-sm text-white/70">
                {pick(locale, {
                  en: "Enabled only for local development and tests. Production must rely on Telegram auth.",
                  ru: "Доступно только для локальной разработки и тестов. В бою должен использоваться Telegram-вход.",
                })}
              </p>
            </div>
            <form action={devSignInAction} className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span>{pick(locale, { en: "Telegram username", ru: "Telegram-ник" })}</span>
                <input
                  className="w-full px-4 py-3"
                  defaultValue="anna_drums"
                  name="telegramUsername"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>{pick(locale, { en: "Role", ru: "Роль" })}</span>
                <select className="w-full px-4 py-3" defaultValue="USER" name="role">
                  <option value="USER">{pick(locale, { en: "User", ru: "Пользователь" })}</option>
                  <option value="ADMIN">{pick(locale, { en: "Admin", ru: "Админ" })}</option>
                </select>
              </label>
              <SubmitButton pendingLabel={pick(locale, { en: "Signing in...", ru: "Входим..." })} type="submit">
                {pick(locale, { en: "Continue locally", ru: "Продолжить локально" })}
              </SubmitButton>
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
  const currentSongs = buildGroupedCurrentSongs(profile.trackSeats);
  const outgoingSeatRequests = profile.invitationsSent
    .map((invite) => ({
      invite,
      requestMeta: parseClosedOptionalSeatRequestMeta(invite.deliveryNote),
    }))
    .filter(
      (
        entry,
      ): entry is {
        invite: (typeof profile.invitationsSent)[number];
        requestMeta: NonNullable<ReturnType<typeof parseClosedOptionalSeatRequestMeta>>;
      } => Boolean(entry.requestMeta),
    );
  const hasNoCurrentActivity =
    profile.invitations.length === 0 &&
    outgoingSeatRequests.length === 0 &&
    currentSongs.length === 0;

  return (
    <div className="space-y-6 text-sand">
      <section className="space-y-4 border-b border-white/8 pb-6">
        <Badge>Profile</Badge>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, { en: "Your current activity", ru: "Твоя текущая активность" })}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/70">
            {pick(locale, {
              en: "Invites, current songs and your musician profile all stay here in one place.",
              ru: "Приглашения, текущие песни и твой музыкальный профиль собраны здесь в одном месте.",
            })}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="brand-shell-soft rounded-xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Pending invites", ru: "Ожидают ответа" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{profile.invitations.length}</p>
          </div>
          <div className="brand-shell-soft rounded-xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Requests sent", ru: "Запросов отправлено" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{outgoingSeatRequests.length}</p>
          </div>
          <div className="brand-shell-soft rounded-xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Current songs", ru: "Текущие песни" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{currentSongs.length}</p>
          </div>
          <div className="brand-shell-soft rounded-xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Primary instruments", ru: "Основные инструменты" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{profile.instruments.length}</p>
          </div>
        </div>
      </section>

      {hasNoCurrentActivity ? (
        <Card className="brand-stage space-y-4">
          <div className="space-y-2">
            <Badge>{pick(locale, { en: "Next step", ru: "Следующий шаг" })}</Badge>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
              {pick(locale, {
                en: "Your profile is ready. Join a live board next.",
                ru: "Профиль готов. Следующий шаг — зайти на живой борд.",
              })}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-white/74">
              {pick(locale, {
                en: "Open the current gig, cover an open seat you can genuinely play, and this page will start showing your songs, invites and approvals.",
                ru: "Открой текущий гиг, займи открытое место, которое реально можешь сыграть, и здесь сразу появятся твои песни, инвайты и согласования.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/">
              <Button>
                {pick(locale, { en: "Browse live gigs", ru: "Открыть живые гиги" })}
              </Button>
            </Link>
            <Link href="/faq">
              <Button variant="secondary">
                {pick(locale, { en: "Review the rules", ru: "Освежить правила" })}
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <ProfileArchiveStats locale={locale} stats={profile.archiveStats} />

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">
            {pick(locale, { en: "Invitations", ru: "Приглашения" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, {
              en: "Pending seat invites and approvals",
              ru: "Ожидающие приглашения и согласования",
            })}
          </h2>
        </div>
        <Card className="brand-shell space-y-4">
          {profile.invitations.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-white/60">
                {pick(locale, {
                  en: "No pending invites right now.",
                  ru: "Сейчас нет ожидающих приглашений.",
                })}
              </p>
              <Link href="/">
                <Button size="sm" variant="secondary">
                  {pick(locale, { en: "Open live gigs", ru: "Открыть живые гиги" })}
                </Button>
              </Link>
            </div>
          ) : (
            profile.invitations.map((invite) => {
              const requestMeta = parseClosedOptionalSeatRequestMeta(invite.deliveryNote);
              const senderLabel = invite.sender.telegramUsername
                ? `@${invite.sender.telegramUsername}`
                : invite.sender.fullName ?? pick(locale, { en: "a bandmate", ru: "кто-то из команды" });

              return (
                <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0" key={invite.id}>
                  <p className="font-semibold text-sand">
                    {invite.track.song.artist.name} - {invite.track.song.title}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    {requestMeta
                      ? requestMeta.mode === "self"
                        ? pick(locale, {
                            en: `${requestMeta.requesterLabel} wants to join the optional ${invite.seat.label} slot on ${invite.track.event.title}.`,
                            ru: `${requestMeta.requesterLabel} хочет вписаться на optional ${invite.seat.label} в ${invite.track.event.title}.`,
                          })
                        : pick(locale, {
                            en: `${requestMeta.requesterLabel} suggested ${requestMeta.targetLabel} for the optional ${invite.seat.label} slot on ${invite.track.event.title}.`,
                            ru: `${requestMeta.requesterLabel} предложил(а) ${requestMeta.targetLabel} на optional ${invite.seat.label} в ${invite.track.event.title}.`,
                          })
                      : pick(locale, {
                          en: `${invite.seat.label} for ${invite.track.event.title}, invited by ${senderLabel}.`,
                          ru: `${invite.seat.label} для ${invite.track.event.title}, пригласил(а) ${senderLabel}.`,
                        })}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={respondToInviteAction}>
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <input name="decision" type="hidden" value="accept" />
                      <input name="eventSlug" type="hidden" value={invite.track.event.slug} />
                      <SubmitButton pendingLabel={pick(locale, { en: "Saving...", ru: "Сохраняем..." })} size="sm" type="submit">
                        {requestMeta
                          ? pick(locale, { en: "Approve", ru: "Одобрить" })
                          : pick(locale, { en: "Accept", ru: "Принять" })}
                      </SubmitButton>
                    </form>
                    <form action={respondToInviteAction}>
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <input name="decision" type="hidden" value="decline" />
                      <input name="eventSlug" type="hidden" value={invite.track.event.slug} />
                      <SubmitButton pendingLabel={pick(locale, { en: "Saving...", ru: "Сохраняем..." })} size="sm" type="submit" variant="secondary">
                        {pick(locale, { en: "Decline", ru: "Отклонить" })}
                      </SubmitButton>
                    </form>
                    <Link href={`/events/${invite.track.event.slug}`}>
                      <Button size="sm" type="button" variant="ghost">
                        {pick(locale, { en: "Open board", ru: "Открыть борд" })}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">
            {pick(locale, { en: "Requests", ru: "Запросы" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, {
              en: "Optional seat requests you've sent",
              ru: "Отправленные тобой запросы на optional-места",
            })}
          </h2>
        </div>
        <Card className="brand-shell space-y-4">
          {outgoingSeatRequests.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-white/60">
                {pick(locale, {
                  en: "No outgoing optional-seat requests right now.",
                  ru: "Сейчас нет исходящих запросов на optional-места.",
                })}
              </p>
              <Link href="/">
                <Button size="sm" type="button" variant="secondary">
                  {pick(locale, { en: "Find a board to join", ru: "Найти борд" })}
                </Button>
              </Link>
            </div>
          ) : (
            outgoingSeatRequests.map(({ invite, requestMeta }) => {
              const recipientLabel = invite.recipient.telegramUsername
                ? `@${invite.recipient.telegramUsername}`
                : invite.recipient.fullName ?? pick(locale, { en: "track proposer", ru: "автор трека" });
              const modeLabel =
                requestMeta.mode === "self"
                  ? pick(locale, {
                      en: "you asked to join",
                      ru: "ты запросил(а) место",
                    })
                  : pick(locale, {
                      en: `${requestMeta.targetLabel} was suggested by you`,
                      ru: `ты предложил(а) ${requestMeta.targetLabel}`,
                    });

              return (
                <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0" key={invite.id}>
                  <p className="font-semibold text-sand">
                    {invite.track.song.artist.name} - {invite.track.song.title}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    {modeLabel} · {invite.seat.label} · {invite.track.event.title}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    {pick(locale, {
                      en: `Waiting for approval from ${recipientLabel}.`,
                      ru: `Ожидает одобрения от ${recipientLabel}.`,
                    })}
                  </p>
                  <div className="mt-4">
                    <Link href={`/events/${invite.track.event.slug}#track-board`}>
                      <Button size="sm" type="button" variant="ghost">
                        {pick(locale, { en: "Open board", ru: "Открыть борд" })}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">
            {pick(locale, { en: "Current songs", ru: "Текущие песни" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, { en: "Where you're playing", ru: "Где ты играешь сейчас" })}
          </h2>
        </div>
        <Card className="brand-shell space-y-4">
          {currentSongs.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-white/60">
                {pick(locale, {
                  en: "You're not attached to any songs yet.",
                  ru: "Ты пока не вписан ни в одну песню.",
                })}
              </p>
              <Link href="/">
                <Button size="sm" variant="secondary">
                  {pick(locale, { en: "Join a live board", ru: "Войти в живой борд" })}
                </Button>
              </Link>
            </div>
          ) : (
            currentSongs.map((entry) => (
              <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0" key={entry.track.id}>
                <p className="font-semibold text-sand">
                  {entry.track.song.artist.name} - {entry.track.song.title}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {entry.positions.join(", ")} · {formatDateTime(entry.track.event.startsAt, locale)} ·{" "}
                  {entry.track.event.title}
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {pick(locale, { en: "Line-up", ru: "Лайнап" })}:{" "}
                    {entry.track.seats
                      .filter((seat: ProfileTrackSeat) => seat.user)
                      .map(
                        (seat: ProfileTrackSeat) =>
                          `${seat.label}: @${seat.user?.telegramUsername ?? seat.user?.fullName}`,
                      )
                    .join(", ")}
                </p>
                <div className="mt-4">
                  <Link href={`/events/${entry.track.event.slug}?view=mine#track-board`}>
                    <Button size="sm" variant="secondary">
                      {pick(locale, { en: "Open on board", ru: "Открыть на борде" })}
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      <section className="space-y-4 border-t border-white/8 pt-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">
            {pick(locale, { en: "Settings", ru: "Настройки" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, { en: "Musician profile", ru: "Профиль музыканта" })}
          </h2>
        </div>

        <Card className="brand-shell space-y-6">
          <p className="text-sm text-white/70">
            {pick(locale, {
              en: "Keep this profile current so people can find you, invite you and understand what you play.",
              ru: "Держи профиль актуальным, чтобы тебя было проще находить, звать в песни и понимать, что ты играешь.",
            })}
          </p>

          <form action={updateProfileAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Telegram username", ru: "Telegram-ник" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={profile.telegramUsername ?? ""}
                name="telegramUsername"
                readOnly={Boolean(profile.telegramId)}
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Full name", ru: "Имя" })}</span>
              <input className="w-full px-4 py-3" defaultValue={profile.fullName ?? ""} name="fullName" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Phone", ru: "Телефон" })}</span>
              <input className="w-full px-4 py-3" defaultValue={profile.phone ?? ""} name="phone" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Email", ru: "Email" })}</span>
              <input className="w-full px-4 py-3" defaultValue={profile.email ?? ""} name="email" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Bio", ru: "О себе" })}</span>
              <textarea className="min-h-28 w-full px-4 py-3" defaultValue={profile.bio ?? ""} name="bio" />
            </label>
            <fieldset className="space-y-3 md:col-span-2">
              <legend className="text-sm font-medium">
                {pick(locale, { en: "Primary instruments", ru: "Основные инструменты" })}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {instruments.map((instrument) => (
                  <label
                    key={instrument.id}
                    className="group relative cursor-pointer"
                  >
                    <input
                      className="peer sr-only"
                      defaultChecked={profile.instruments.some(
                        (entry) => entry.instrumentId === instrument.id,
                      )}
                      name="instrumentIds"
                      type="checkbox"
                      value={instrument.id}
                    />
                    <InstrumentToken
                      className="border-white/10 bg-white/[0.03] transition duration-200 group-hover:border-white/18 peer-checked:border-gold/30 peer-checked:bg-gold/[0.08]"
                      compact
                      label={instrument.name}
                      locale={locale}
                      meta={pick(locale, {
                        en: "Tap to include in your main kit",
                        ru: "Отметь, если это часть твоего основного набора",
                      })}
                    />
                    <span className="pointer-events-none absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/16 bg-black/18 text-[10px] font-semibold text-white/82 transition peer-checked:border-gold/40 peer-checked:bg-gold peer-checked:text-ink">
                      ✓
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton className="md:col-span-2" pendingLabel={pick(locale, { en: "Saving profile...", ru: "Сохраняем профиль..." })} type="submit">
              {pick(locale, { en: "Save profile", ru: "Сохранить профиль" })}
            </SubmitButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
