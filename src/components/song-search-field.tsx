"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SongSearchResult = {
  songId?: string | null;
  externalId: string;
  trackTitle: string;
  artistName: string;
  artworkUrl: string | null;
  collectionName: string | null;
  externalUrl: string | null;
  durationSeconds: number | null;
};

export type SongSearchSelection = SongSearchResult;

type SongSearchCacheEntry = {
  results: SongSearchResult[];
  hasMore: boolean;
};

const songSearchCache = new Map<string, SongSearchCacheEntry>();
const SONG_SEARCH_DEBOUNCE_MS = 400;

function getResultKey(result: SongSearchResult) {
  return result.songId ?? result.externalId;
}

function mergeResults(existing: SongSearchResult[], incoming: SongSearchResult[]) {
  const seen = new Set(existing.map(getResultKey));
  const merged = [...existing];
  for (const result of incoming) {
    const key = getResultKey(result);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(result);
  }
  return merged;
}

function Artwork({ src, alt, sizes }: { src: string | null; alt: string; sizes: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return null;
  }

  return (
    <Image
      alt={alt}
      className="object-cover"
      fill
      onError={() => setFailed(true)}
      sizes={sizes}
      src={src}
    />
  );
}

export function SongSearchField({
  locale,
  selected,
  onSelectedChange,
}: {
  locale: Locale;
  selected: SongSearchSelection | null;
  onSelectedChange: (value: SongSearchSelection | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const trimmedQuery = query.trim();
  const shouldSearch = debouncedQuery.length >= 2 && !selected;

  useEffect(() => {
    if (selected) {
      setDebouncedQuery("");
      return;
    }

    if (trimmedQuery.length < 2) {
      setDebouncedQuery("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, SONG_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [selected, trimmedQuery]);

  useEffect(() => {
    if (!shouldSearch) {
      setResults([]);
      setHasMore(false);
      setIsLoading(false);
      setSearchMessage(null);
      setHighlightedIndex(0);
      return;
    }

    const cacheKey = debouncedQuery.toLowerCase();
    const cachedResults = songSearchCache.get(cacheKey);

    if (cachedResults) {
      startTransition(() => {
        setResults(cachedResults.results);
        setHasMore(cachedResults.hasMore);
        setSearchMessage(null);
        setHighlightedIndex(0);
      });
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void fetch(`/api/song-search?query=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Song search provider failed.");
        }
        return response.json() as Promise<{
          results: SongSearchResult[];
          hasMore?: boolean;
          warning?: string;
        }>;
      })
      .then((payload) => {
        songSearchCache.set(cacheKey, {
          results: payload.results,
          hasMore: payload.hasMore ?? false,
        });
        startTransition(() => {
          setResults(payload.results);
          setHasMore(payload.hasMore ?? false);
          setSearchMessage(payload.warning ?? null);
          setHighlightedIndex(0);
        });
      })
      .catch(() => {
        startTransition(() => {
          setResults([]);
          setHasMore(false);
          setSearchMessage(
            pick(locale, {
              en: "Song search is temporarily unavailable. Try again in a moment or ask admins to add it.",
              ru: "Поиск песен временно недоступен. Попробуй ещё раз чуть позже или попроси админов добавить песню.",
            }),
          );
        });
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, locale, shouldSearch]);

  const loadMoreResults = useCallback(() => {
    if (!shouldSearch || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    const cacheKey = debouncedQuery.toLowerCase();
    const offset = results.length;
    setIsLoadingMore(true);

    void fetch(
      `/api/song-search?query=${encodeURIComponent(debouncedQuery)}&offset=${offset}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Song search provider failed.");
        }
        return response.json() as Promise<{ results: SongSearchResult[]; hasMore?: boolean }>;
      })
      .then((payload) => {
        startTransition(() => {
          setResults((current) => {
            const merged = mergeResults(current, payload.results);
            songSearchCache.set(cacheKey, {
              results: merged,
              hasMore: payload.hasMore ?? false,
            });
            return merged;
          });
          setHasMore(payload.hasMore ?? false);
        });
      })
      .catch(() => {
        setHasMore(false);
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, results.length, shouldSearch]);

  const handleListScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (remaining < 96) {
      loadMoreResults();
    }
  }, [loadMoreResults]);

  const dropdownVisible = useMemo(
    () => !selected && trimmedQuery.length >= 2,
    [selected, trimmedQuery],
  );
  const normalizedQuery = trimmedQuery.toLowerCase();

  function renderMatch(text: string) {
    if (!normalizedQuery) {
      return text;
    }

    const index = text.toLowerCase().indexOf(normalizedQuery);
    if (index < 0) {
      return text;
    }

    return (
      <>
        {text.slice(0, index)}
        <span className="text-blue">{text.slice(index, index + normalizedQuery.length)}</span>
        {text.slice(index + normalizedQuery.length)}
      </>
    );
  }

  function selectResult(result: SongSearchResult) {
    onSelectedChange(result);
    setQuery("");
    setResults([]);
    setSearchMessage(null);
    setHighlightedIndex(0);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-sand">
            {pick(locale, { en: "Find the song", ru: "Найди песню" })}
          </label>
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            iTunes search
          </span>
        </div>
        <input
          className="w-full rounded-[1.4rem] border-white/10 bg-white/6 px-5 py-4 text-base text-sand shadow-sm"
          onChange={(event) => {
            onSelectedChange(null);
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (!dropdownVisible || results.length === 0) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((current) => (current + 1) % results.length);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((current) => (current - 1 + results.length) % results.length);
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const result = results[highlightedIndex];
              if (result) {
                selectResult(result);
              }
            }

            if (event.key === "Escape") {
              setResults([]);
              setSearchMessage(null);
            }
          }}
          placeholder={pick(locale, {
            en: "Start typing a song title or artist",
            ru: "Начни вводить название песни или артиста",
          })}
          value={selected ? `${selected.artistName} — ${selected.trackTitle}` : query}
        />
        <p className="text-xs text-white/55">
          {pick(locale, {
            en: "Start with the song, then define the arrangement. The selection will be saved into the local catalog automatically.",
            ru: "Сначала выбери песню, потом собери аранжировку. Выбор автоматически сохранится в локальный каталог.",
          })}
        </p>
      </div>

      {selected ? (
        <>
          {selected.songId ? <input name="songId" type="hidden" value={selected.songId} /> : null}
          <input name="selectedExternalId" type="hidden" value={selected.externalId} />
          <input name="selectedTrackTitle" type="hidden" value={selected.trackTitle} />
          <input name="selectedArtistName" type="hidden" value={selected.artistName} />
          <input
            name="selectedDurationSeconds"
            type="hidden"
            value={selected.durationSeconds ?? ""}
          />
          <div className="brand-shell-soft flex items-center gap-4 rounded-[1.5rem] border border-white/10 px-4 py-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-white/6">
              <Artwork
                key={selected.artworkUrl}
                alt={`${selected.artistName} ${selected.trackTitle}`}
                sizes="56px"
                src={selected.artworkUrl}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sand">{selected.trackTitle}</p>
              <p className="truncate text-sm text-white/65">{selected.artistName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/56">
                {selected.collectionName ? <span>{selected.collectionName}</span> : null}
                {selected.durationSeconds ? (
                  <span>{Math.floor(selected.durationSeconds / 60)}:{String(selected.durationSeconds % 60).padStart(2, "0")}</span>
                ) : null}
              </div>
            </div>
            {selected.externalUrl ? (
              <Link
                className="hidden rounded-full border border-white/10 px-3 py-2 text-sm font-medium text-sand transition hover:bg-white/10 md:inline-flex"
                href={selected.externalUrl}
                rel="noreferrer"
                target="_blank"
              >
                {pick(locale, { en: "Preview", ru: "Послушать" })}
              </Link>
            ) : null}
            <button
              className="rounded-full border border-white/10 px-3 py-2 text-sm font-medium text-sand transition hover:bg-white/10"
              onClick={(event) => {
                event.preventDefault();
                onSelectedChange(null);
                setQuery("");
                setResults([]);
                setSearchMessage(null);
              }}
              type="button"
            >
              {pick(locale, { en: "Change", ru: "Сменить" })}
            </button>
          </div>
        </>
      ) : null}

      {dropdownVisible ? (
        <div className="brand-shell overflow-hidden rounded-[1.5rem] border-white/10 shadow-table-glow">
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-white/60">
              {pick(locale, { en: "Searching songs…", ru: "Ищем песни…" })}
            </div>
          ) : results.length > 0 ? (
            <ul
              className="max-h-80 divide-y divide-white/10 overflow-y-auto"
              onScroll={handleListScroll}
              ref={listRef}
            >
              {results.map((result, index) => (
                <li key={result.songId ?? result.externalId}>
                  <button
                    className={cn(
                      "flex w-full items-center gap-4 px-4 py-3 text-left transition",
                      index === highlightedIndex ? "bg-white/10" : "hover:bg-white/6",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      selectResult(result);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    type="button"
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-white/6">
                      <Artwork
                        key={result.artworkUrl}
                        alt={`${result.artistName} ${result.trackTitle}`}
                        sizes="48px"
                        src={result.artworkUrl}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sand">
                        {renderMatch(result.trackTitle)}
                      </p>
                      <p className="truncate text-sm text-white/65">
                        {renderMatch(result.artistName)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs uppercase tracking-[0.16em] text-white/52">
                        {pick(locale, { en: "choose", ru: "выбрать" })}
                      </span>
                      {result.durationSeconds ? (
                        <span className="text-xs text-white/45">
                          {Math.floor(result.durationSeconds / 60)}:{String(result.durationSeconds % 60).padStart(2, "0")}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
              {isLoadingMore ? (
                <li className="px-4 py-3 text-center text-xs text-white/55">
                  {pick(locale, { en: "Loading more…", ru: "Загружаем ещё…" })}
                </li>
              ) : hasMore ? (
                <li>
                  <button
                    className="w-full px-4 py-3 text-center text-xs uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/6 hover:text-white"
                    onClick={(event) => {
                      event.preventDefault();
                      loadMoreResults();
                    }}
                    type="button"
                  >
                    {pick(locale, { en: "Load more", ru: "Показать ещё" })}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="space-y-3 px-4 py-4 text-sm text-white/60">
              {searchMessage ? <p className="text-gold">{searchMessage}</p> : null}
              <p>
                {pick(locale, {
                  en: "No matches yet. Try another spelling.",
                  ru: "Совпадений пока нет. Попробуй другое написание.",
                })}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
