import type { Metadata } from "next";
import Link from "next/link";

import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { getArchivePageData } from "@/server/query-data";

import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { Button } from "@/components/ui/button";

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

function formatArchiveDate(value: Date | string, locale: Awaited<ReturnType<typeof getLocale>>) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatArchiveTime(value: Date | string, locale: Awaited<ReturnType<typeof getLocale>>) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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
  const years = [...new Set(data.publishedEvents.map((event) => String(new Date(event.startsAt).getFullYear())))];
  const events = data.publishedEvents.filter((event) => {
    const yearMatches = !selectedYear || String(new Date(event.startsAt).getFullYear()) === selectedYear;
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
                en: "Every published line-up. Filter, search and re-open the energy.",
                ru: "Каждый опубликованный лайнап. Ищи, фильтруй и открывай энергию заново.",
              })}
            </p>
          </div>
        </div>

        {stats ? (
          <div className="reference-section grid gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [pick(locale, { en: "Gigs in archive", ru: "Гигов в архиве" }), stats.totalGigs],
              [pick(locale, { en: "Tracks performed", ru: "Сыграно треков" }), stats.totalTracks],
              [pick(locale, { en: "Unique songs", ru: "Уникальных песен" }), stats.uniqueSongs],
              [pick(locale, { en: "Musicians on stage", ru: "Музыкантов на сцене" }), stats.totalMusicians],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sand/48">{label}</p>
                <p className="mt-2 font-display text-3xl text-sand">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
        <input
          className="min-h-12 w-full rounded-md border-white/12 bg-transparent px-4 text-sm"
          defaultValue={typeof params.q === "string" ? params.q : ""}
          name="q"
          placeholder={pick(locale, {
            en: "Search song, artist or musician...",
            ru: "Поиск по песне, артисту или музыканту...",
          })}
        />
        <select
          className="min-h-12 rounded-md border-white/12 bg-transparent px-4 text-sm"
          defaultValue={selectedYear}
          name="year"
        >
          <option value="">{pick(locale, { en: "All years", ru: "Все годы" })}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <Button className="min-h-12 px-5" type="submit" variant="secondary">
          {pick(locale, { en: "Apply", ru: "Применить" })}
        </Button>
      </form>

      <section className="reference-section overflow-hidden">
        {events.length > 0 ? (
          <div className="divide-y divide-white/10">
            {events.map((event) => (
              <Link
                className="grid gap-3 px-5 py-5 transition hover:bg-white/[0.035] md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-center"
                href={`/events/${event.id}`}
                key={event.id}
              >
                <div className="font-display text-xl text-sand">
                  {formatArchiveDate(event.startsAt, locale)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-body text-base font-bold text-sand">
                    {event.venueName ?? event.title}
                  </h2>
                  <p className="mt-1 text-sm text-sand/52">
                    {formatArchiveTime(event.startsAt, locale)}
                    {event.venueName && event.title !== event.venueName ? ` · ${event.title}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-[11px] font-bold uppercase tracking-[0.22em] text-sand/68">
                  <span>
                    {event.setlistItems.length} {pick(locale, { en: "tracks", ru: "треков" })}
                  </span>
                  <span aria-hidden="true" className="text-xl text-sand/42">›</span>
                </div>
              </Link>
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
