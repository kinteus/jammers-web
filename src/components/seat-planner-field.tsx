"use client";

import { useMemo, useState } from "react";
import { Ban, CircleDashed, CircleDot, UserCheck } from "lucide-react";

import { expandSeatColumns, type LineupSlotLite } from "@/lib/event-board";
import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey } from "@/lib/role-families";
import { cn } from "@/lib/utils";
import { UserInvitePicker, type InviteableUserOption } from "@/components/user-invite-picker";

type SeatMode = "claim" | "open" | "optional" | "skip" | "taken";

export type ExistingSeatState = {
  status: "OPEN" | "CLAIMED" | "UNAVAILABLE";
  isOptional: boolean;
  occupantLabel: string | null;
  isOwn: boolean;
};

function getModeLabel(mode: SeatMode, locale: Locale) {
  if (mode === "claim") {
    return pick(locale, { en: "You", ru: "Ты" });
  }
  if (mode === "optional") {
    return pick(locale, { en: "Optional", ru: "Optional" });
  }
  if (mode === "skip") {
    return pick(locale, { en: "Off", ru: "Выкл" });
  }
  if (mode === "taken") {
    return pick(locale, { en: "Taken", ru: "Занято" });
  }
  return pick(locale, { en: "Required", ru: "Обязательная" });
}

export function SeatPlannerField({
  inviteableUsers,
  lineupSlots,
  locale,
  existingSeats,
  canManageOccupied = false,
}: {
  inviteableUsers: InviteableUserOption[];
  lineupSlots: LineupSlotLite[];
  locale: Locale;
  existingSeats?: Record<string, ExistingSeatState>;
  canManageOccupied?: boolean;
}) {
  const seatColumns = useMemo(() => expandSeatColumns(lineupSlots), [lineupSlots]);
  const slotsById = useMemo(
    () => new Map(lineupSlots.map((slot) => [slot.id, slot])),
    [lineupSlots],
  );
  const [modes, setModes] = useState<Record<string, SeatMode>>(() => {
    const initial: Record<string, SeatMode> = {};
    for (const seat of seatColumns) {
      const existing = existingSeats?.[seat.seatKey];
      if (existing) {
        if (existing.status === "CLAIMED") {
          initial[seat.seatKey] = existing.isOwn ? "claim" : "taken";
        } else if (existing.status === "UNAVAILABLE") {
          initial[seat.seatKey] = "skip";
        } else {
          initial[seat.seatKey] = existing.isOptional ? "optional" : "open";
        }
        continue;
      }

      const slot = slotsById.get(seat.slotId);
      if (slot?.allowOptional && slot.defaultOptionalSeats?.includes(seat.seatIndex)) {
        initial[seat.seatKey] = "optional";
      }
    }
    return initial;
  });
  const [inviteRecipients, setInviteRecipients] = useState<Record<string, string>>({});
  const modeOptions = [
    {
      mode: "claim" as const,
      label: pick(locale, { en: "I’m in", ru: "Я играю" }),
      icon: UserCheck,
    },
    {
      mode: "open" as const,
      label: pick(locale, { en: "Required seat", ru: "Обязательная позиция" }),
      icon: CircleDot,
    },
    {
      mode: "optional" as const,
      label: pick(locale, { en: "Optional seat", ru: "Optional позиция" }),
      icon: CircleDashed,
    },
    {
      mode: "skip" as const,
      label: pick(locale, { en: "Not used", ru: "Не используется" }),
      icon: Ban,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-sand">
          {pick(locale, { en: "Set the arrangement", ru: "Собери аранжировку" })}
        </p>
        <p className="text-xs text-white/55">
          {pick(locale, {
            en: "Each role is one row: claim it yourself, keep it required, make it optional, switch it off, or invite someone right away.",
            ru: "Каждая роль в одну строку: впишись сам, оставь обязательной, сделай optional, выключи или сразу пригласи человека.",
          })}
        </p>
      </div>

      <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.03]">
        {seatColumns.map((seat) => {
          const current = modes[seat.seatKey] ?? "open";
          const roleFamily = getRoleFamilyKey(seat.label, seat.lineupKey);
          const seatAllowOptional = slotsById.get(seat.slotId)?.allowOptional ?? false;
          const existing = existingSeats?.[seat.seatKey];
          const occupiedByOther =
            existing?.status === "CLAIMED" && !existing.isOwn;
          // A position held by another participant is locked for proposers; only
          // an admin (canManageOccupied) may change it.
          const locked = occupiedByOther && !canManageOccupied;
          const enabledInvite = !locked && (current === "open" || current === "optional");

          if (locked) {
            return (
              <div
                className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={seat.seatKey}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sand">{seat.label}</p>
                    <span className="rounded-sm bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                      {getModeLabel("taken", locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {getRoleFamilyLabel(roleFamily, locale)}
                  </p>
                </div>
                <p className="text-xs text-white/60">
                  {pick(locale, {
                    en: `Held by ${existing?.occupantLabel ?? "another player"}`,
                    ru: `Занято: ${existing?.occupantLabel ?? "другой участник"}`,
                  })}
                </p>
              </div>
            );
          }

          return (
            <div
              className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(190px,260px)] md:items-center"
              key={seat.seatKey}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-sand">{seat.label}</p>
                  <span className="rounded-sm bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                    {getModeLabel(current, locale)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/45">
                  {getRoleFamilyLabel(roleFamily, locale)}
                  {occupiedByOther && existing?.occupantLabel
                    ? ` · ${pick(locale, {
                        en: `held by ${existing.occupantLabel}`,
                        ru: `занято: ${existing.occupantLabel}`,
                      })}`
                    : ""}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-md bg-white/6 p-1">
                {modeOptions
                  .filter((option) => option.mode !== "optional" || seatAllowOptional)
                  .map((option) => {
                    const active = current === option.mode;
                    return (
                      <button
                        aria-label={option.label}
                        className={cn(
                          "ui-tooltip ui-tooltip-bottom inline-flex h-9 w-9 items-center justify-center rounded-sm text-xs font-semibold transition",
                          active
                            ? option.mode === "claim"
                              ? "bg-red text-white"
                              : option.mode === "optional"
                                ? "bg-blue text-stage"
                                : option.mode === "skip"
                                  ? "bg-ink text-white"
                                  : "bg-white text-stage shadow-sm"
                            : "text-white/65 hover:-translate-y-0.5 hover:bg-white/12 hover:text-white",
                        )}
                        data-tip={option.label}
                        key={option.mode}
                        onClick={(event) => {
                          event.preventDefault();
                          setModes((currentModes) => {
                            const nextModes = { ...currentModes };
                            if (option.mode === "claim") {
                              for (const otherSeat of seatColumns) {
                                if (
                                  otherSeat.seatKey !== seat.seatKey &&
                                  getRoleFamilyKey(otherSeat.label, otherSeat.lineupKey) === roleFamily &&
                                  nextModes[otherSeat.seatKey] === "claim"
                                ) {
                                  nextModes[otherSeat.seatKey] = "open";
                                }
                              }
                            }
                            nextModes[seat.seatKey] = option.mode;
                            return nextModes;
                          });
                          if (option.mode === "claim" || option.mode === "skip") {
                            setInviteRecipients((currentRecipients) => {
                              const nextRecipients = { ...currentRecipients };
                              delete nextRecipients[seat.seatKey];
                              return nextRecipients;
                            });
                          }
                        }}
                        title={option.label}
                        type="button"
                      >
                        <option.icon className="h-4 w-4" />
                      </button>
                    );
                  })}
              </div>

              <div className="min-w-0 space-y-1 text-xs text-white/55">
                <span>{pick(locale, { en: "Invite", ru: "Пригласить" })}</span>
                <UserInvitePicker
                  ariaLabel={pick(locale, {
                    en: `Invite ${seat.label}`,
                    ru: `Пригласить на ${seat.label}`,
                  })}
                  disabled={!enabledInvite || inviteableUsers.length === 0}
                  locale={locale}
                  onSelectedUserIdChange={(userId) => {
                    setInviteRecipients((currentRecipients) => ({
                      ...currentRecipients,
                      [seat.seatKey]: userId,
                    }));
                  }}
                  selectedUserId={inviteRecipients[seat.seatKey] ?? ""}
                  users={inviteableUsers}
                />
              </div>
            </div>
          );
        })}
      </div>

      {seatColumns
        .filter((seat) => (modes[seat.seatKey] ?? "open") === "claim")
        .map((seat) => (
          <input
            key={`claim-hidden-${seat.seatKey}`}
            name="claimSeatKeys"
            type="hidden"
            value={seat.seatKey}
          />
        ))}
      {seatColumns
        .filter((seat) => (modes[seat.seatKey] ?? "open") === "skip")
        .map((seat) => (
          <input
            key={`skip-hidden-${seat.seatKey}`}
            name="unavailableSeatKeys"
            type="hidden"
            value={seat.seatKey}
          />
        ))}
      {seatColumns
        .filter((seat) => (modes[seat.seatKey] ?? "open") === "taken")
        .map((seat) => (
          <input
            key={`keep-hidden-${seat.seatKey}`}
            name="keepSeatKeys"
            type="hidden"
            value={seat.seatKey}
          />
        ))}
      {seatColumns
        .filter((seat) => (modes[seat.seatKey] ?? "open") === "optional")
        .map((seat) => (
          <input
            key={`optional-hidden-${seat.seatKey}`}
            name="optionalSeatKeys"
            type="hidden"
            value={seat.seatKey}
          />
        ))}
      {Object.entries(inviteRecipients)
        .filter(([, recipientId]) => recipientId)
        .map(([seatKey, recipientId]) => (
          <input
            key={`invite-hidden-${seatKey}`}
            name="inviteSeatRequests"
            type="hidden"
            value={`${seatKey}|${recipientId}`}
          />
        ))}
    </div>
  );
}
