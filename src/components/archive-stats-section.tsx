import { Flame, Music2, Radio, Users2 } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import type { ArchiveRankingItem, ArchiveStatsSummary } from "@/lib/domain/archive-stats";

import { AnimatedNumber } from "@/components/animated-number";
import { Card } from "@/components/ui/card";

const HOMEPAGE_PREVIEW_COUNT = 3;

function maxValue(items: Array<{ value: number }>) {
  return items.reduce((best, item) => Math.max(best, item.value), 1);
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="rounded-sm border border-gold/18 bg-gold/10 p-2 text-gold">
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</p>
          <p className="font-display text-2xl font-semibold text-sand">
            <AnimatedNumber value={value} />
          </p>
        </div>
      </div>
    </div>
  );
}

function RankingRow({
  accentClassName,
  index,
  item,
  locale,
  max,
}: {
  accentClassName: string;
  index: number;
  item: ArchiveRankingItem;
  locale: Locale;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/68">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sand">{item.label}</p>
          {item.hint ? (
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">
              {item.hint} {pick(locale, { en: "gigs", ru: "гигов" })}
            </p>
          ) : null}
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/78">
          {item.value}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${accentClassName}`}
          style={{ width: `${(item.value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

function RankingPanel({
  accentClassName,
  items,
  locale,
  title,
}: {
  accentClassName: string;
  items: ArchiveRankingItem[];
  locale: Locale;
  title: string;
}) {
  const previewItems = items.slice(0, HOMEPAGE_PREVIEW_COUNT);
  const max = maxValue(items);

  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.02] p-4">
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-sand">{title}</h3>
        <div className="space-y-3">
          {previewItems.map((item, index) => (
            <RankingRow
              accentClassName={accentClassName}
              index={index}
              item={item}
              key={item.id}
              locale={locale}
              max={max}
            />
          ))}
        </div>
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

  const metricTiles = [
    {
      label: pick(locale, { en: "Gigs played", ru: "Сыгранных гигов" }),
      value: stats.totalGigs,
      icon: Radio,
    },
    {
      label: pick(locale, { en: "Tracks performed", ru: "Сыгранных треков" }),
      value: stats.totalTracks,
      icon: Music2,
    },
    {
      label: pick(locale, { en: "Unique songs", ru: "Уникальных песен" }),
      value: stats.uniqueSongs,
      icon: Flame,
    },
    {
      label: pick(locale, { en: "Musicians on stage", ru: "Музыкантов на сцене" }),
      value: stats.totalMusicians,
      icon: Users2,
    },
  ];

  const peakYear =
    stats.timeline.reduce(
      (best, entry) => (entry.tracks > best.tracks ? entry : best),
      stats.timeline[0],
    ) ?? null;
  const timelineMax = Math.max(...stats.timeline.map((entry) => entry.tracks), 1);

  return (
    <section className="space-y-5 border-t border-white/8 pt-8">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold text-sand">
          {pick(locale, {
            en: "The Scene, Measured",
            ru: "Сцена в цифрах",
          })}
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricTiles.map((item) => (
          <MetricTile icon={item.icon} key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="brand-shell rounded-[1.55rem] border-white/10 p-5 sm:p-6">
          <div className="flex h-full flex-col gap-5">
            <div className="space-y-1.5">
              <h3 className="font-display text-2xl font-semibold text-sand">
                {pick(locale, {
                  en: "Pulse",
                  ru: "Пульс",
                })}
              </h3>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.96fr)_minmax(300px,1.04fr)]">
              <div className="space-y-4">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/18 p-4 sm:p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    {pick(locale, {
                      en: "Biggest released gig",
                      ru: "Самый большой опубликованный гиг",
                    })}
                  </p>
                  <h4 className="mt-2 font-display text-2xl font-semibold text-sand">
                    {stats.busiestGig?.title ??
                      pick(locale, { en: "The archive keeps growing", ru: "Архив продолжает расти" })}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-white/72">
                    {stats.busiestGig
                      ? pick(locale, {
                          en: `${stats.busiestGig.tracks} tracks reached the final set that night — the biggest published line-up so far.`,
                          ru: `${stats.busiestGig.tracks} треков дошли до финального сета в тот вечер — это самый большой опубликованный лайнап на сегодня.`,
                        })
                      : pick(locale, {
                          en: "Even in its current shape, the scene already shows an upward line in both output and continuity.",
                          ru: "Даже в текущем виде сцена уже показывает рост и по объёму, и по устойчивости.",
                        })}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      {pick(locale, { en: "Peak year", ru: "Пиковый год" })}
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-sand">
                      {peakYear?.year ?? "—"}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/52">
                      {peakYear
                        ? pick(locale, {
                            en: `${peakYear.tracks} tracks released`,
                            ru: `${peakYear.tracks} треков в релизе`,
                          })
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      {pick(locale, { en: "Years in motion", ru: "Лет в движении" })}
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-sand">
                      <AnimatedNumber value={stats.timeline.length} />
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/52">
                      {pick(locale, {
                        en: "Visible release rhythm",
                        ru: "Видимый ритм релизов",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    {pick(locale, { en: "By year", ru: "По годам" })}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {stats.timeline.map((item) => (
                    <div className="space-y-1.5" key={item.year}>
                      <div className="flex items-end justify-between gap-3 text-sm">
                        <span className="font-semibold text-sand">{item.year}</span>
                        <span className="text-white/60">
                          {pick(locale, {
                            en: `${item.tracks} tracks · ${item.gigs} gigs`,
                            ru: `${item.tracks} треков · ${item.gigs} гигов`,
                          })}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-brand-wave"
                          style={{ width: `${(item.tracks / timelineMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="brand-shell rounded-[1.55rem] border-white/10 p-5 sm:p-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h3 className="font-display text-2xl font-semibold text-sand">
                {pick(locale, {
                  en: "People, songs, momentum",
                  ru: "Люди, песни, инерция",
                })}
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <RankingPanel
                accentClassName="bg-brand-wave"
                items={stats.topMusicians}
                locale={locale}
                title={pick(locale, { en: "Stage mileage", ru: "Сценический пробег" })}
              />

              <RankingPanel
                accentClassName="bg-red"
                items={stats.topOriginators}
                locale={locale}
                title={pick(locale, { en: "Who brings songs in", ru: "Кто приносит песни" })}
              />

              <RankingPanel
                accentClassName="bg-gold"
                items={stats.topArtists}
                locale={locale}
                title={pick(locale, { en: "Scene favourites", ru: "Любимчики сцены" })}
              />

              <RankingPanel
                accentClassName="bg-brand-wave"
                items={stats.topSongs}
                locale={locale}
                title={pick(locale, { en: "Repeated crowd magnets", ru: "Повторяющиеся магниты" })}
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
