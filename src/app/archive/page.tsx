import type { Metadata } from "next";
import Link from "next/link";

import { COUNT_FORMS, formatCount, pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { formatEventDateShort, formatEventTime, formatEventYear } from "@/lib/utils";
import { getArchivePageData } from "@/server/query-data";

import { ArchiveFilters } from "@/components/archive-filters";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setlist Archive",
  description: "Published and archived setlists from The Jammers gigs.",
  alternates: {
    canonical: "/archive",
  },
  openGraph: {
    title: "The Jammers Setlist Archive",
    description: "Published and archived setlists from The Jammers gigs.",
    url: "/archive",
  },
};

type ArchivePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const params = await searchParams;
  let data;
  let locale;

  try {
    [data, locale] = await Promise.all([getArchivePageData(), getLocale()]);
  } catch (error) {
    locale = await getLocale();

    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return (
      <DatabaseUnavailableState
        locale={locale}
        title={pick(locale, { en: "Archive is warming up", ru: "Архив просыпается" })}
      />
    );
  }

  const query = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const selectedYear = typeof params.year === "string" ? params.year : "";
  const years = [...new Set(data.publishedEvents.map((event) => formatEventYear(event.startsAt)))];
  const events = data.publishedEvents.filter((event) => {
    const yearMatches = !selectedYear || formatEventYear(event.startsAt) === selectedYear;
    const queryMatches =
      !query ||
      [
        event.title,
        event.venueName,
        ...event.setlistItems.flatMap((item) => [
          item.track.song.title,
          item.track.song.artist.name,
          item.track.proposedBy.telegramUsername,
          item.track.proposedBy.fullName,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);

    return yearMatches && queryMatches;
  });
  const stats = data.archiveStats;
  const isFiltering = Boolean(query || selectedYear);
  const eventsByYear = [
    ...events.reduce((groups, event) => {
      const year = formatEventYear(event.startsAt);
      groups.set(year, [...(groups.get(year) ?? []), event]);
      return groups;
    }, new Map<string, typeof events>()),
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-7">
        <div className="space-y-4">
          <p className="reference-kicker">
            {pick(locale, { en: "Published archive", ru: "Опубликованный архив" })}
          </p>
          <div className="space-y-3">
            <h1 className="font-display text-5xl uppercase text-sand md:text-6xl">
              {pick(locale, { en: "Setlists", ru: "Сетлисты" })}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-sand/62">
              {pick(locale, {
                en: "Every published setlist. Filter, search and re-open the energy.",
                ru: "Каждый опубликованный сетлист. Ищи, фильтруй и открывай энергию заново.",
              })}
            </p>
          </div>
        </div>

        {stats ? (
          <div className="reference-section grid gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [pick(locale, { en: "Gigs in archive", ru: "Гигов в архиве" }), stats.totalGigs],
              [pick(locale, { en: "Performed songs", ru: "Песен из сетлиста" }), stats.totalTracks],
              [pick(locale, { en: "Unique songs", ru: "Уникальных песен" }), stats.uniqueSongs],
              [pick(locale, { en: "Participants on stage", ru: "Участников на сцене" }), stats.totalMusicians],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sand/48">{label}</p>
                <p className="mt-2 font-display text-3xl text-sand">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <ArchiveFilters
        initialQuery={typeof params.q === "string" ? params.q : ""}
        initialYear={selectedYear}
        locale={locale}
        years={years}
      />

      <section className="reference-section overflow-clip">
        {events.length > 0 ? (
          <div className="divide-y divide-white/10">
            {eventsByYear.map(([year, yearEvents], yearIndex) => (
              // Recent years start open; older ones collapse unless the visitor is filtering.
              // Year headers stick right under the sticky site header (125 / 109 / 76px tall).
              <details
                className="group"
                data-archive-year={year}
                key={year}
                open={isFiltering || yearIndex < 2}
              >
                <summary className="sticky top-[125px] z-10 md:top-[109px] lg:top-[76px] flex cursor-pointer list-none items-center justify-between border-b border-white/10 bg-[#141414]/95 px-5 py-3 backdrop-blur">
                  <span className="font-display text-2xl text-sand">{year}</span>
                  <span className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-sand/58">
                    {formatCount(locale, yearEvents.length, COUNT_FORMS.gigs)}
                    <span aria-hidden="true" className="text-base transition group-open:rotate-90">›</span>
                  </span>
                </summary>
                <div className="divide-y divide-white/10">
                  {yearEvents.map((event) => (
              <Link
                      className="grid gap-3 px-5 py-5 transition hover:bg-white/[0.035] md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-center"
                      href={`/events/${event.id}`}
                      key={event.id}
                    >
                      <div className="font-display text-xl text-sand">
                        {formatEventDateShort(event.startsAt, locale)}
                      </div>
                      {/* Same structure for every row: title, then venue and time. */}
                      <div className="min-w-0">
                        <h2 className="font-body text-base font-bold text-sand" data-archive-row-title>
                          {event.title}
                        </h2>
                        <p className="mt-1 text-sm text-sand/52" data-archive-row-meta>
                          {[event.venueName, formatEventTime(event.startsAt, locale)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 text-[11px] font-bold uppercase tracking-[0.22em] text-sand/68">
                        <span>{formatCount(locale, event.setlistItems.length, COUNT_FORMS.performedSongs)}</span>
                        <span aria-hidden="true" className="text-xl text-sand/42">›</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-sand/62">
            {pick(locale, { en: "No setlists match these filters.", ru: "Под эти фильтры сетлистов нет." })}
          </div>
        )}
      </section>
    </div>
  );
}
