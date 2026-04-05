import { Flame, Music2, Radio, Users2 } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import type { ArchiveStatsSummary } from "@/lib/domain/archive-stats";

import { AnimatedNumber } from "@/components/animated-number";
import { Card } from "@/components/ui/card";

function maxValue(items: Array<{ value: number }>) {
  return items.reduce((best, item) => Math.max(best, item.value), 1);
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

  const headline = [
    {
      label: pick(locale, { en: "Gigs in archive", ru: "Гигов в архиве" }),
      value: stats.totalGigs,
      icon: Radio,
    },
    {
      label: pick(locale, { en: "Tracks performed", ru: "Сыгранных треков" }),
      value: stats.totalTracks,
      icon: Music2,
    },
    {
      label: pick(locale, { en: "Musicians on stage", ru: "Музыкантов на сцене" }),
      value: stats.totalMusicians,
      icon: Users2,
    },
    {
      label: pick(locale, { en: "Unique songs", ru: "Уникальных песен" }),
      value: stats.uniqueSongs,
      icon: Flame,
    },
  ];

  const topMusiciansMax = maxValue(stats.topMusicians);
  const topArtistsMax = maxValue(stats.topArtists);
  const topOriginatorsMax = maxValue(stats.topOriginators);
  const topSongsMax = maxValue(stats.topSongs);

  return (
    <section className="space-y-4 border-t border-white/8 pt-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
          {pick(locale, { en: "Community stats", ru: "Статистика коммьюнити" })}
        </p>
        <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
          {pick(locale, {
            en: "What the archive says about The Jammers",
            ru: "Что архив говорит о The Jammers",
          })}
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {headline.map((item, index) => (
          <Card
            className="stats-card-animate brand-shell rounded-[1.4rem] border-white/10 p-5"
            key={item.label}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                <p className="font-display text-4xl font-semibold uppercase tracking-[0.03em] text-sand">
                  <AnimatedNumber value={item.value} />
                </p>
              </div>
              <div className="rounded-sm border border-gold/18 bg-gold/10 p-3 text-gold">
                <item.icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="brand-shell rounded-[1.5rem] border-white/10 p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Most active musicians", ru: "Самые активные музыканты" })}
              </p>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, { en: "Stage mileage", ru: "Сценический пробег" })}
              </h3>
            </div>
            <div className="space-y-3">
              {stats.topMusicians.map((item, index) => (
                <div className="space-y-2" key={item.id}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-sm font-semibold text-sand">{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/52">
                      {item.value}
                      {item.hint
                        ? ` · ${item.hint} ${pick(locale, { en: "gigs", ru: "гигов" })}`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="stats-bar-fill h-full rounded-full bg-brand-wave"
                      style={{
                        width: `${(item.value / topMusiciansMax) * 100}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="brand-shell rounded-[1.5rem] border-white/10 p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Most played artists", ru: "Самые играемые артисты" })}
              </p>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, { en: "Archive favourites", ru: "Любимчики архива" })}
              </h3>
            </div>
            <div className="space-y-3">
              {stats.topArtists.map((item, index) => (
                <div className="space-y-2" key={item.id}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-sm font-semibold text-sand">{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/52">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="stats-bar-fill h-full rounded-full bg-gold"
                      style={{
                        width: `${(item.value / topArtistsMax) * 100}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="brand-stage rounded-[1.5rem] border-white/10 p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Archive pulse", ru: "Пульс архива" })}
              </p>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {stats.busiestGig
                  ? pick(locale, { en: "Biggest night", ru: "Самый большой гиг" })
                  : pick(locale, { en: "Yearly pulse", ru: "Пульс по годам" })}
              </h3>
            </div>
            {stats.busiestGig ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-sand">{stats.busiestGig.title}</p>
                <p className="text-sm leading-6 text-white/72">
                  {pick(locale, {
                    en: `A marathon night: ${stats.busiestGig.tracks} tracks made the final set.`,
                    ru: `Настоящий марафон: ${stats.busiestGig.tracks} треков дошли до финального сета.`,
                  })}
                </p>
              </div>
            ) : null}
            <div className="space-y-3">
              {stats.timeline.map((item, index) => (
                <div className="space-y-1.5" key={item.year}>
                  <div className="flex items-end justify-between gap-3 text-sm">
                    <span className="font-semibold text-sand">{item.year}</span>
                    <span className="text-white/60">
                      {pick(locale, {
                        en: `${item.gigs} gigs · ${item.tracks} tracks`,
                        ru: `${item.gigs} гигов · ${item.tracks} треков`,
                      })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="stats-bar-fill h-full rounded-full bg-brand-wave"
                      style={{
                        width: `${(item.tracks / Math.max(...stats.timeline.map((entry) => entry.tracks), 1)) * 100}%`,
                        animationDelay: `${index * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="brand-shell rounded-[1.5rem] border-white/10 p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Top originators", ru: "Главные инициаторы" })}
              </p>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, { en: "Who brings songs in", ru: "Кто приносит песни" })}
              </h3>
            </div>
            <div className="space-y-3">
              {stats.topOriginators.map((item, index) => (
                <div className="space-y-2" key={item.id}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-sm font-semibold text-sand">{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/52">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="stats-bar-fill h-full rounded-full bg-red"
                      style={{
                        width: `${(item.value / topOriginatorsMax) * 100}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="brand-shell rounded-[1.5rem] border-white/10 p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Songs that keep coming back", ru: "Песни, которые возвращаются" })}
              </p>
              <h3 className="font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, { en: "Repeated crowd magnets", ru: "Повторяющиеся магниты" })}
              </h3>
            </div>
            <div className="space-y-3">
              {stats.topSongs.map((item, index) => (
                <div className="space-y-2" key={item.id}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-sm font-semibold text-sand">{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/52">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="stats-bar-fill h-full rounded-full bg-brand-wave"
                      style={{
                        width: `${(item.value / topSongsMax) * 100}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
