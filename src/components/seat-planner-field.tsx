"use client";

import { useMemo, useState } from "react";
import { Circle, Minus, Sparkles, UserPlus } from "lucide-react";

import { expandSeatColumns, type LineupSlotLite } from "@/lib/event-board";
import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey } from "@/lib/role-families";
import { cn } from "@/lib/utils";

type SeatMode = "claim" | "open" | "optional" | "skip";

function buildPresetModes(
  seatKeys: string[],
  allowedMatchers: Array<(seatKey: string) => boolean>,
): Record<string, SeatMode> {
  return Object.fromEntries(
    seatKeys.map((seatKey) => [
      seatKey,
      allowedMatchers.some((matcher) => matcher(seatKey)) ? "open" : "skip",
    ]),
  );
}

export function SeatPlannerField({
  lineupSlots,
  locale,
}: {
  lineupSlots: LineupSlotLite[];
  locale: Locale;
}) {
  const seatColumns = useMemo(() => expandSeatColumns(lineupSlots), [lineupSlots]);
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, typeof lineupSlots>();
    for (const slot of lineupSlots) {
      const family = getRoleFamilyKey(slot.label, slot.key);
      const existing = groups.get(family) ?? [];
      existing.push(slot);
      groups.set(family, existing);
    }
    return [...groups.entries()].map(([family, slots]) => ({ family, slots }));
  }, [lineupSlots]);
  const presets = useMemo(() => {
    const seatKeys = seatColumns.map((seat) => seat.seatKey);
    return [
      {
        id: "full-band",
        label: pick(locale, { en: "Full band", ru: "Полный состав" }),
        description: pick(locale, { en: "All roles open", ru: "Все роли открыты" }),
        modes: Object.fromEntries(seatKeys.map((seatKey) => [seatKey, "open" as const])),
      },
      {
        id: "power-trio",
        label: pick(locale, { en: "Power trio", ru: "Пауэр-трио" }),
        description: pick(locale, {
          en: "Drums, bass, guitar, vocal",
          ru: "Барабаны, бас, гитара, вокал",
        }),
        modes: buildPresetModes(seatKeys, [
          (seatKey) => seatKey.startsWith("Drums"),
          (seatKey) => seatKey.startsWith("Bass"),
          (seatKey) => seatKey.startsWith("Guitar 1"),
          (seatKey) => seatKey.startsWith("Vocals 1"),
          (seatKey) => seatKey.startsWith("Vocals:1"),
        ]),
      },
      {
        id: "acoustic",
        label: pick(locale, { en: "Acoustic", ru: "Акустика" }),
        description: pick(locale, { en: "Vocal, guitar, keys", ru: "Вокал, гитара, клавиши" }),
        modes: buildPresetModes(seatKeys, [
          (seatKey) => seatKey.startsWith("Vocals 1"),
          (seatKey) => seatKey.startsWith("Vocals:1"),
          (seatKey) => seatKey.startsWith("Guitar 1"),
          (seatKey) => seatKey.startsWith("Keys"),
        ]),
      },
    ];
  }, [locale, seatColumns]);
  const [modes, setModes] = useState<Record<string, SeatMode>>({});
  const arrangementSummary = useMemo(() => {
    return seatColumns.reduce(
      (summary, seat) => {
        const currentMode = modes[seat.seatKey] ?? "open";
        if (currentMode === "claim") {
          summary.claimed += 1;
        } else if (currentMode === "optional") {
          summary.optional += 1;
        } else if (currentMode === "skip") {
          summary.skipped += 1;
        } else {
          summary.open += 1;
        }
        return summary;
      },
      { claimed: 0, open: 0, optional: 0, skipped: 0 },
    );
  }, [modes, seatColumns]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-sand">
          {pick(locale, { en: "Set the arrangement", ru: "Собери аранжировку" })}
        </p>
        <p className="text-xs text-white/55">
          {pick(locale, {
            en: "Use icons: you, required seat, optional seat, or not used in this arrangement.",
            ru: "Используй иконки: ты, обязательное место, optional место или не используется в этой аранжировке.",
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="brand-shell-soft rounded-lg px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {pick(locale, { en: "You're in", ru: "Ты в составе" })}
          </p>
          <p className="mt-2 text-xl font-semibold text-sand">{arrangementSummary.claimed}</p>
        </div>
        <div className="brand-shell-soft rounded-lg px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {pick(locale, { en: "Required", ru: "Обязательные" })}
          </p>
          <p className="mt-2 text-xl font-semibold text-sand">{arrangementSummary.open}</p>
        </div>
        <div className="brand-shell-soft rounded-lg px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {pick(locale, { en: "Optional", ru: "Optional" })}
          </p>
          <p className="mt-2 text-xl font-semibold text-sand">{arrangementSummary.optional}</p>
        </div>
        <div className="brand-shell-soft rounded-lg px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {pick(locale, { en: "Not used", ru: "Не используется" })}
          </p>
          <p className="mt-2 text-xl font-semibold text-sand">{arrangementSummary.skipped}</p>
        </div>
      </div>

      {arrangementSummary.claimed === 0 ? (
        <div className="rounded-md border border-blue/22 bg-blue/10 px-4 py-3 text-sm leading-6 text-white/78">
          {pick(locale, {
            en: "Tip: claim your own seat here if you are definitely part of the song.",
            ru: "Подсказка: отметь здесь своё место, если точно участвуешь в этой песне.",
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            className="rounded-md border border-white/10 bg-white/6 px-3 py-2 text-left transition hover:border-blue/30 hover:bg-white/10"
            key={preset.id}
            onClick={(event) => {
              event.preventDefault();
              setModes(preset.modes);
            }}
            type="button"
          >
            <span className="block text-sm font-semibold text-sand">{preset.label}</span>
            <span className="block text-xs text-white/55">{preset.description}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {groupedSlots.map((group) => (
          <div className="space-y-2" key={group.family}>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">
                {getRoleFamilyLabel(group.family as ReturnType<typeof getRoleFamilyKey>, locale)}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {group.slots.flatMap((slot) =>
                Array.from({ length: slot.seatCount }).map((_, index) => {
                  const seatIndex = index + 1;
                  const label =
                    slot.seatCount === 1 ? slot.label : `${slot.label} ${seatIndex}`;
                  const seatKey = `${label}:${seatIndex}`;
                  const current = modes[seatKey] ?? "open";

                  return (
                    <div className="brand-shell-soft rounded-md border border-white/10 px-3 py-3" key={seatKey}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sand">{label}</p>
                          <p className="text-xs text-white/45">
                            {slot.allowOptional
                              ? pick(locale, { en: "Can be optional", ru: "Можно сделать optional" })
                              : pick(locale, {
                                  en: "Must be required or off",
                                  ru: "Только required или выключено",
                                })}
                          </p>
                        </div>
                        <span className="rounded-sm bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                          {current === "claim"
                            ? pick(locale, { en: "You", ru: "Ты" })
                            : current === "optional"
                              ? pick(locale, { en: "Optional", ru: "Optional" })
                              : current === "skip"
                                ? pick(locale, { en: "Off", ru: "Выкл" })
                                : pick(locale, { en: "Required", ru: "Required" })}
                        </span>
                      </div>
                      <div className={cn("mt-3 grid gap-1 rounded-md bg-white/6 p-1", slot.allowOptional ? "grid-cols-4" : "grid-cols-3")}>
                        {[
                          {
                            mode: "claim" as const,
                            label: pick(locale, { en: "I’m in", ru: "Я в составе" }),
                            icon: UserPlus,
                          },
                          {
                            mode: "open" as const,
                            label: pick(locale, { en: "Required seat", ru: "Обязательное место" }),
                            icon: Circle,
                          },
                          ...(slot.allowOptional
                            ? [
                                {
                                  mode: "optional" as const,
                                  label: pick(locale, {
                                    en: "Optional seat",
                                    ru: "Optional место",
                                  }),
                                  icon: Sparkles,
                                },
                              ]
                            : []),
                          {
                            mode: "skip" as const,
                            label: pick(locale, { en: "Not used", ru: "Не используется" }),
                            icon: Minus,
                          },
                        ].map((option) => (
                          <button
                            aria-label={option.label}
                            title={option.label}
                            data-tip={option.label}
                            className={cn(
                              "ui-tooltip ui-tooltip-bottom inline-flex items-center justify-center rounded-sm px-3 py-2 text-xs font-semibold transition",
                              current === option.mode
                                ? option.mode === "claim"
                                  ? "bg-red text-white"
                                  : option.mode === "optional"
                                    ? "bg-blue text-stage"
                                  : option.mode === "skip"
                                    ? "bg-ink text-white"
                                    : "bg-white text-stage shadow-sm"
                                : "text-white/65 hover:bg-white/12 hover:-translate-y-0.5",
                            )}
                            key={option.mode}
                            onClick={(event) => {
                              event.preventDefault();
                              setModes((currentModes) => ({
                                ...currentModes,
                                [seatKey]: option.mode,
                              }));
                            }}
                            type="button"
                          >
                            <option.icon className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        ))}
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
        .filter((seat) => (modes[seat.seatKey] ?? "open") === "optional")
        .map((seat) => (
          <input
            key={`optional-hidden-${seat.seatKey}`}
            name="optionalSeatKeys"
            type="hidden"
            value={seat.seatKey}
          />
        ))}
    </div>
  );
}
