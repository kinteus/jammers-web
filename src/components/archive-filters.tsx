"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { pick, type Locale } from "@/lib/i18n";

import { Button } from "@/components/ui/button";

export function buildArchiveQueryString({ query, year }: { query: string; year: string }) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (year) {
    params.set("year", year);
  }
  return params.toString();
}

// Filters update as you type (debounced), like the board search. Without JavaScript the
// form still works through the <noscript> Apply button.
export function ArchiveFilters({
  initialQuery,
  initialYear,
  locale,
  years,
}: {
  initialQuery: string;
  initialYear: string;
  locale: Locale;
  years: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    if (query.trim() === initialQuery.trim() && year === initialYear) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const queryString = buildArchiveQueryString({ query, year });
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, year === initialYear ? 240 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialQuery, initialYear, pathname, query, router, year]);

  return (
    <form
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]"
      onSubmit={(event) => event.preventDefault()}
      role="search"
    >
      <input
        aria-label={pick(locale, { en: "Search setlists", ru: "Поиск по сетлистам" })}
        className="min-h-12 w-full rounded-md border-white/12 bg-transparent px-4 text-sm"
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={pick(locale, {
          en: "Search song, artist or participant...",
          ru: "Поиск по песне, артисту или участнику...",
        })}
        type="search"
        value={query}
      />
      <select
        aria-label={pick(locale, { en: "Year", ru: "Год" })}
        className="min-h-12 rounded-md border-white/12 bg-transparent px-4 text-sm"
        name="year"
        onChange={(event) => setYear(event.target.value)}
        value={year}
      >
        <option value="">{pick(locale, { en: "All years", ru: "Все годы" })}</option>
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <noscript>
        <Button className="min-h-12 px-5" type="submit" variant="secondary">
          {pick(locale, { en: "Apply", ru: "Применить" })}
        </Button>
      </noscript>
    </form>
  );
}
