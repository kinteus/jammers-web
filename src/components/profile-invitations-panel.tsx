"use client";

import Link from "next/link";
import { useState } from "react";

import { pick, type Locale } from "@/lib/i18n";
import { respondToInviteInlineAction } from "@/server/actions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type InvitationLineupSeat = {
  isOpen: boolean;
  label: string;
  occupantLabel: string | null;
};

type InvitationItem = {
  eventId: string;
  eventTitle: string;
  id: string;
  isApprovalRequest: boolean;
  lineup?: InvitationLineupSeat[];
  maxTracksPerUser: number;
  requestDescription: string | null;
  seatLabel: string;
  senderHref: string | null;
  senderLabel: string;
  songLabel: string;
};

type Feedback =
  | {
      message: string;
      tone: "error" | "success";
    }
  | null;

type InviteError =
  | "duplicate-role-family"
  | "event-locked"
  | "invite-stale"
  | "seat-occupied"
  | "seat-unavailable"
  | "track-limit"
  | "username-required";

function getInviteErrorMessage(error: InviteError, item: InvitationItem, locale: Locale) {
  if (error === "username-required") {
    return pick(locale, {
      en: "Set your Telegram username in your profile before accepting invites.",
      ru: "Укажи свой Telegram-ник в профиле, прежде чем принимать приглашения.",
    });
  }

  if (error === "track-limit") {
    return pick(locale, {
      en: `Could not accept this invite: the limit for ${item.eventTitle} is ${item.maxTracksPerUser} tracks per musician, and that limit is already reached. Leave one current song from this gig before accepting another invite.`,
      ru: `Не получилось принять приглашение: лимит на ${item.eventTitle} — ${item.maxTracksPerUser} трека на участника, и он уже достигнут. Чтобы принять инвайт, сначала нужно выписаться из одного из текущих треков этого гига.`,
    });
  }

  if (error === "duplicate-role-family") {
    return pick(locale, {
      en: "Could not accept this invite: you already have this instrument family on that song.",
      ru: "Не получилось принять приглашение: у тебя уже есть эта группа инструментов в этой песне.",
    });
  }

  if (error === "seat-occupied") {
    return pick(locale, {
      en: "Could not accept this invite: this seat has already been taken by someone else.",
      ru: "Не получилось принять приглашение: это место уже занял другой участник.",
    });
  }

  if (error === "seat-unavailable") {
    return pick(locale, {
      en: "Could not accept this invite: this seat is no longer available.",
      ru: "Не получилось принять приглашение: это место больше недоступно.",
    });
  }

  if (error === "event-locked") {
    return pick(locale, {
      en: "Could not accept this invite: changes for this gig are already closed.",
      ru: "Не получилось принять приглашение: изменения для этого гига уже закрыты.",
    });
  }

  return pick(locale, {
    en: "Could not process this invite: it may have already been answered or changed. Refresh the profile to see the current state.",
    ru: "Не получилось обработать приглашение: возможно, его уже обработали или оно изменилось. Обнови профиль, чтобы увидеть актуальное состояние.",
  });
}

export function ProfileInvitationsPanel({
  initialInvitations,
  locale,
}: {
  initialInvitations: InvitationItem[];
  locale: Locale;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [pending, setPending] = useState<{
    decision: "accept" | "decline";
    inviteId: string;
  } | null>(null);

  async function respond(item: InvitationItem, decision: "accept" | "decline") {
    setFeedback(null);
    setPending({ decision, inviteId: item.id });

    const formData = new FormData();
    formData.set("inviteId", item.id);
    formData.set("decision", decision);
    formData.set("eventSlug", item.eventId);

    try {
      const result = await respondToInviteInlineAction(formData);

      if (result.ok) {
        setInvitations((current) => current.filter((invite) => invite.id !== item.id));
        setFeedback({
          tone: "success",
          message:
            result.notice === "invite-declined"
              ? pick(locale, { en: "Invite declined.", ru: "Приглашение отклонено." })
              : pick(locale, { en: "Invite accepted.", ru: "Приглашение принято." }),
        });
        return;
      }

      setFeedback({
        tone: "error",
        message: getInviteErrorMessage(result.error, item, locale),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: pick(locale, {
          en: "Could not process this invite because the server did not respond. Try again in a moment.",
          ru: "Не получилось обработать приглашение: сервер не ответил. Попробуй ещё раз через минуту.",
        }),
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white"
              : "rounded-xl border border-red/30 bg-red/12 px-4 py-3 text-sm leading-6 text-white"
          }
          role="status"
        >
          {feedback.message}
        </div>
      ) : null}

      <Card className="brand-shell space-y-4">
        {invitations.length === 0 ? (
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
          invitations.map((invite) => {
            const isAcceptPending =
              pending?.inviteId === invite.id && pending.decision === "accept";
            const isDeclinePending =
              pending?.inviteId === invite.id && pending.decision === "decline";

            return (
              <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0" key={invite.id}>
                <p className="font-semibold text-sand">{invite.songLabel}</p>
                <p className="mt-1 text-sm text-white/70">
                  {invite.requestDescription ? (
                    invite.requestDescription
                  ) : (
                    <>
                      {pick(locale, {
                        en: `${invite.seatLabel} for ${invite.eventTitle}, invited by `,
                        ru: `${invite.seatLabel} для ${invite.eventTitle}, пригласил(а) `,
                      })}
                      {invite.senderHref ? (
                        <a
                          className="font-medium text-gold transition hover:text-white"
                          href={invite.senderHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {invite.senderLabel}
                        </a>
                      ) : (
                        invite.senderLabel
                      )}
                      .
                    </>
                  )}
                </p>
                {invite.lineup && invite.lineup.length > 0 ? (
                  <div className="mt-3 space-y-1 text-xs leading-5 text-white/65">
                    {invite.lineup.some((seat) => seat.occupantLabel) ? (
                      <p>
                        <span className="text-white/45">
                          {pick(locale, { en: "Seated: ", ru: "Вписаны: " })}
                        </span>
                        {invite.lineup
                          .filter((seat) => seat.occupantLabel)
                          .map((seat) => `${seat.label} — ${seat.occupantLabel}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {invite.lineup.some((seat) => seat.isOpen) ? (
                      <p>
                        <span className="text-white/45">
                          {pick(locale, { en: "Still open: ", ru: "Ещё свободно: " })}
                        </span>
                        {invite.lineup
                          .filter((seat) => seat.isOpen)
                          .map((seat) => seat.label)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    aria-busy={isAcceptPending}
                    disabled={pending !== null}
                    onClick={() => respond(invite, "accept")}
                    size="sm"
                    type="button"
                  >
                    {isAcceptPending
                      ? pick(locale, { en: "Saving...", ru: "Сохраняем..." })
                      : invite.isApprovalRequest
                        ? pick(locale, { en: "Approve", ru: "Одобрить" })
                        : pick(locale, { en: "Accept", ru: "Принять" })}
                  </Button>
                  <Button
                    aria-busy={isDeclinePending}
                    disabled={pending !== null}
                    onClick={() => respond(invite, "decline")}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {isDeclinePending
                      ? pick(locale, { en: "Saving...", ru: "Сохраняем..." })
                      : pick(locale, { en: "Decline", ru: "Отклонить" })}
                  </Button>
                  <Link href={`/events/${invite.eventId}`}>
                    <Button size="sm" type="button" variant="ghost">
                      {pick(locale, { en: "Open board", ru: "Открыть сетлист" })}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
