import { TrackSeatStatus } from "@prisma/client";
import {
  AudioLines,
  Drum,
  Guitar,
  MicVocal,
  Piano,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey, type RoleFamilyKey } from "@/lib/role-families";
import { formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PublishedSetlistEvent = {
  id: string;
  title: string;
  startsAt: Date | string;
  setlistItems: Array<{
    track: {
      seats: Array<{
        label: string;
        status: TrackSeatStatus;
        user: {
          telegramUsername: string | null;
          fullName: string | null;
        } | null;
      }>;
    };
  }>;
};

const PUBLISHED_LINEUP_FAMILY_ORDER: RoleFamilyKey[] = [
  "rhythm",
  "guitars",
  "bass",
  "vocals",
  "keys",
  "extras",
];

const PUBLISHED_LINEUP_ICONS: Record<RoleFamilyKey, LucideIcon> = {
  rhythm: Drum,
  guitars: Guitar,
  bass: AudioLines,
  vocals: MicVocal,
  keys: Piano,
  extras: Shapes,
};

function formatPublishedPlayerLabel(
  user: {
    telegramUsername: string | null;
    fullName: string | null;
  },
  locale: Locale,
) {
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }

  return user.fullName ?? pick(locale, { en: "Assigned player", ru: "Назначенный музыкант" });
}

function buildPublishedLineupSummary(event: PublishedSetlistEvent, locale: Locale) {
  const familyMap = new Map<
    RoleFamilyKey,
    {
      family: RoleFamilyKey;
      label: string;
      occupiedSeats: number;
      players: string[];
    }
  >();

  for (const item of event.setlistItems) {
    for (const seat of item.track.seats) {
      if (seat.status !== TrackSeatStatus.CLAIMED || !seat.user) {
        continue;
      }

      const family = getRoleFamilyKey(seat.label);
      const entry = familyMap.get(family) ?? {
        family,
        label: getRoleFamilyLabel(family, locale),
        occupiedSeats: 0,
        players: [],
      };

      entry.occupiedSeats += 1;
      const playerLabel = formatPublishedPlayerLabel(seat.user, locale);
      if (!entry.players.includes(playerLabel)) {
        entry.players.push(playerLabel);
      }

      familyMap.set(family, entry);
    }
  }

  return PUBLISHED_LINEUP_FAMILY_ORDER.map((family) => familyMap.get(family)).filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );
}

function formatPublishedLineupMeta(players: string[], locale: Locale) {
  if (players.length === 0) {
    return pick(locale, { en: "Assigned players", ru: "Назначенные музыканты" });
  }

  const visiblePlayers = players.slice(0, 2);
  const remainingPlayers = players.length - visiblePlayers.length;

  return visiblePlayers.join(", ").concat(
    remainingPlayers > 0
      ? pick(locale, {
          en: ` +${remainingPlayers} more`,
          ru: ` +${remainingPlayers} ещё`,
        })
      : "",
  );
}

export function PublishedSetlistsSection({
  events,
  locale,
}: {
  events: PublishedSetlistEvent[];
  locale: Locale;
}) {
  return (
    <section className="space-y-4 border-t border-white/8 pt-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
          {pick(locale, { en: "Archive", ru: "Архив" })}
        </p>
        <h1 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
          {pick(locale, { en: "Published setlists", ru: "Опубликованные сетлисты" })}
        </h1>
      </div>
      <div className="space-y-3">
        {events.length > 0 ? (
          events.map((event) => {
            const lineupSummary = buildPublishedLineupSummary(event, locale);

            return (
              <Card className="brand-shell rounded-[1.25rem] border-white/10 px-5 py-4" key={event.id}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1.5">
                      <h2 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-sand">
                        {event.title}
                      </h2>
                      <div className="flex flex-wrap gap-3 text-sm text-white/66">
                        <span>
                          {event.setlistItems.length}{" "}
                          {pick(locale, { en: "main-set tracks", ru: "треков мейн-сета" })}
                        </span>
                        <span>{formatDateTime(event.startsAt, locale)}</span>
                      </div>
                    </div>
                    <Button asChild variant="secondary">
                      <Link href={`/events/${event.id}`}>
                        {pick(locale, { en: "Open setlist", ru: "Открыть сетлист" })}
                      </Link>
                    </Button>
                  </div>
                  {lineupSummary.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {lineupSummary.map((entry) => {
                        const Icon = PUBLISHED_LINEUP_ICONS[entry.family];

                        return (
                          <div
                            className="rounded-xl border border-white/10 bg-black/24 px-3 py-3"
                            key={`${event.id}-${entry.family}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/18 bg-gold/10 text-gold">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-sand">{entry.label}</p>
                                <p className="text-[11px] text-white/56">
                                  {formatPublishedLineupMeta(entry.players, locale)}
                                </p>
                              </div>
                              <span className="ml-auto rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] font-semibold text-white/82">
                                {entry.occupiedSeats}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="brand-shell rounded-[1.25rem] border-white/10 px-5 py-4 text-sm text-white/66">
            {pick(locale, {
              en: "No published setlists yet.",
              ru: "Опубликованных сетлистов пока нет.",
            })}
          </Card>
        )}
      </div>
    </section>
  );
}
