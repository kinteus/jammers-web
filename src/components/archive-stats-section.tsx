import { CalendarDays, Mic2, Music2, Radio, Star, Trophy, Users2 } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import type { ArchiveRankingItem, ArchiveStatsSummary } from "@/lib/domain/archive-stats";

import { AnimatedNumber } from "@/components/animated-number";

function StatTile({
  hint,
  icon: Icon,
  label,
  value,
}: {
  hint?: string;
  icon: typeof Radio;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-h-32 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-4xl text-sand">
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </p>
          <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.28em] text-sand/52">{label}</p>
          {hint ? <p className="mt-1 text-xs text-sand/50">{hint}</p> : null}
        </div>
        <Icon className="h-4 w-4 text-sand/36" />
      </div>
    </div>
  );
}

function RankingList({
  icon: Icon,
  items,
  locale,
  title,
  valueLabel,
}: {
  icon: typeof Mic2;
  items: ArchiveRankingItem[];
  locale: Locale;
  title: string;
  valueLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gold" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.28em] text-sand/68">{title}</h3>
      </div>
      <div className="divide-y divide-white/8">
        {items.slice(0, 3).map((item, index) => (
          <div className="grid min-h-[68px] grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 py-3" key={item.id}>
            <span className="text-xs font-bold text-sand/42">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-sand">{item.label}</p>
              <p className="min-h-4 truncate text-xs text-sand/44">
                {item.hint ?? ""}
              </p>
            </div>
            <p className="text-sm font-bold text-sand/82">
              {item.value} {valueLabel}
            </p>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="py-3 text-sm text-sand/52">
            {pick(locale, { en: "Not enough archive data yet.", ru: "В архиве пока мало данных." })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ArchiveStatsSection({
  locale,
  stats,
}: {
  locale: Locale;
  stats: ArchiveStatsSummary | null;
}) {
  if (!stats || stats.totalGigs === 0) {
    return null;
  }

  const peakYear =
    stats.timeline.reduce(
      (best, entry) => (entry.tracks > best.tracks ? entry : best),
      stats.timeline[0],
    ) ?? null;

  return (
    <section className="reference-section space-y-8 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <h2 className="font-display text-4xl uppercase text-sand">
          {pick(locale, { en: "The scene", ru: "Сцена" })}
        </h2>
        <p className="text-sm text-sand/48">
          {pick(locale, { en: "All gigs since 2023", ru: "Все гиги с 2023" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Mic2} label={pick(locale, { en: "Gigs played", ru: "Сыгранных гигов" })} value={stats.totalGigs} />
        <StatTile icon={Music2} label={pick(locale, { en: "Tracks", ru: "Треков" })} value={stats.totalTracks} />
        <StatTile icon={Radio} label={pick(locale, { en: "Unique songs", ru: "Уникальных песен" })} value={stats.uniqueSongs} />
        <StatTile icon={Users2} label={pick(locale, { en: "Musicians", ru: "Музыкантов" })} value={stats.totalMusicians} />
        <StatTile
          hint={stats.busiestGig?.title ?? undefined}
          icon={Trophy}
          label={pick(locale, { en: "Largest set", ru: "Самый большой сет" })}
          value={stats.busiestGig?.tracks ?? 0}
        />
        <StatTile
          hint={peakYear ? pick(locale, { en: `${peakYear.tracks} tracks released`, ru: `${peakYear.tracks} треков` }) : undefined}
          icon={Star}
          label={pick(locale, { en: "Peak year", ru: "Пиковый год" })}
          value={peakYear?.year ?? "—"}
        />
        <StatTile icon={CalendarDays} label={pick(locale, { en: "Years on stage", ru: "Лет на сцене" })} value={stats.timeline.length} />
        <div className="min-h-32 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4">
          <div className="space-y-2">
            {stats.timeline.slice(-4).map((item) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={item.year}>
                <span className="font-bold text-sand/76">{`'${String(item.year).slice(-2)}`}</span>
                <span className="font-bold text-sand/76">{item.tracks}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-sand/52">
            {pick(locale, { en: "Tracks by year", ru: "Треки по годам" })}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <RankingList
          icon={Mic2}
          items={stats.topMusicians}
          locale={locale}
          title={pick(locale, { en: "Top musicians", ru: "Топ музыкантов" })}
          valueLabel={pick(locale, { en: "gigs", ru: "гигов" })}
        />
        <RankingList
          icon={Star}
          items={stats.topArtists}
          locale={locale}
          title={pick(locale, { en: "Top artists", ru: "Топ артистов" })}
          valueLabel={pick(locale, { en: "plays", ru: "раз" })}
        />
      </div>
    </section>
  );
}
