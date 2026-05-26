import type { Metadata } from "next";

import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { getArchivePageData } from "@/server/query-data";

import { ArchiveStatsSection } from "@/components/archive-stats-section";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { PublishedSetlistsSection } from "@/components/published-setlists-section";

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

export default async function ArchivePage() {
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

  return (
    <div className="space-y-8">
      <ArchiveStatsSection locale={locale} stats={data.archiveStats} />
      <PublishedSetlistsSection events={data.publishedEvents} locale={locale} />
    </div>
  );
}
