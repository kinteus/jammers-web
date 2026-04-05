import { CalendarClock, Music2, Radio, Sparkles, Users2 } from "lucide-react";

import type { UserArchiveStatsSummary } from "@/lib/domain/archive-stats";
import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";

import { AnimatedNumber } from "@/components/animated-number";
import { Card } from "@/components/ui/card";

export function ProfileArchiveStats({
  locale,
  stats,
}: {
  locale: Locale;
  stats: UserArchiveStatsSummary | null;
}) {
  if (!stats || (stats.gigsPlayed === 0 && stats.songsOriginated === 0)) {
    return null;
  }

  const cards = [
    {
      label: pick(locale, { en: "Gigs played", ru: "Сыгранных гигов" }),
      value: stats.gigsPlayed,
      icon: Radio,
    },
    {
      label: pick(locale, { en: "Songs on stage", ru: "Песен на сцене" }),
      value: stats.songsPerformed,
      icon: Music2,
    },
    {
      label: pick(locale, { en: "Songs originated", ru: "Предложенных песен" }),
      value: stats.songsOriginated,
      icon: Sparkles,
    },
    {
      label: pick(locale, { en: "Role families", ru: "Классов ролей" }),
      value: stats.roleFamiliesCovered,
      icon: Users2,
    },
  ];

  return (
    <section className="space-y-4 border-t border-white/8 pt-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">
          {pick(locale, { en: "Stage history", ru: "История сцены" })}
        </p>
        <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
          {pick(locale, { en: "Your story on stage", ru: "Твой след в истории" })}
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item, index) => (
          <Card
            className="stats-card-animate brand-shell-soft rounded-xl px-5 py-4"
            key={item.label}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                <p className="text-3xl font-semibold text-sand">
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

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="brand-shell rounded-[1.4rem] border-white/10 p-5 xl:col-span-2">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-gold" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {pick(locale, { en: "Personal highlights", ru: "Личные акценты" })}
                </p>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-white/72">
                <li>
                  • {pick(locale, { en: "Signature role", ru: "Фирменная роль" })}:{" "}
                  <strong className="text-sand">
                    {stats.signatureRole
                      ? getRoleFamilyLabel(stats.signatureRole, locale)
                      : pick(locale, { en: "Still taking shape", ru: "Ещё формируется" })}
                  </strong>
                </li>
                <li>
                  • {pick(locale, { en: "Favourite artist", ru: "Любимый артист" })}:{" "}
                  <strong className="text-sand">
                    {stats.favoriteArtist ?? pick(locale, { en: "Still ahead", ru: "Ещё впереди" })}
                  </strong>
                </li>
                <li>
                  • {pick(locale, { en: "First gig", ru: "Первый гиг" })}:{" "}
                  <strong className="text-sand">
                    {stats.firstGig
                      ? `${stats.firstGig.title} · ${formatDateTime(stats.firstGig.startsAt, locale)}`
                      : pick(locale, { en: "Soon", ru: "Скоро" })}
                  </strong>
                </li>
                <li>
                  • {pick(locale, { en: "Latest gig", ru: "Последний гиг" })}:{" "}
                  <strong className="text-sand">
                    {stats.latestGig
                      ? `${stats.latestGig.title} · ${formatDateTime(stats.latestGig.startsAt, locale)}`
                      : pick(locale, { en: "Soon", ru: "Скоро" })}
                  </strong>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "Most frequent collaborators", ru: "Частые коллаборации" })}
              </p>
              {stats.topCollaborators.length === 0 ? (
                <p className="text-sm text-white/60">
                  {pick(locale, {
                    en: "As your archive grows, the people you keep sharing songs with will show up here.",
                    ru: "По мере роста истории здесь проявятся люди, с которыми ты чаще всего делишь песни.",
                  })}
                </p>
              ) : (
                stats.topCollaborators.map((item, index) => (
                  <div className="space-y-1.5" key={item.id}>
                    <div className="flex items-end justify-between gap-3 text-sm">
                      <span className="font-semibold text-sand">{item.label}</span>
                      <span className="text-white/60">
                        {item.value} {pick(locale, { en: "shared tracks", ru: "общих треков" })}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="stats-bar-fill h-full rounded-full bg-brand-wave"
                        style={{
                          width: `${(item.value / Math.max(...stats.topCollaborators.map((entry) => entry.value), 1)) * 100}%`,
                          animationDelay: `${index * 90}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card className="brand-stage rounded-[1.4rem] border-white/10 p-5 xl:col-span-2">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Year by year", ru: "По годам" })}
            </p>
            {stats.timeline.map((item, index) => (
              <div className="space-y-1.5" key={item.year}>
                <div className="flex items-end justify-between gap-3 text-sm">
                  <span className="font-semibold text-sand">{item.year}</span>
                  <span className="text-white/60">
                    {item.tracks} {pick(locale, { en: "tracks", ru: "треков" })}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="stats-bar-fill h-full rounded-full bg-gold"
                    style={{
                      width: `${(item.tracks / Math.max(...stats.timeline.map((entry) => entry.tracks), 1)) * 100}%`,
                      animationDelay: `${index * 90}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
