"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { pick, type Locale } from "@/lib/i18n";

type SongCatalog = Array<{ id: string; title: string; artist: { name: string } }>;
type AssignableUsers = Array<{ id: string; fullName: string | null; telegramUsername: string | null }>;
const SongCatalogContext = createContext<{ songCatalog: SongCatalog; assignableUsers: AssignableUsers }>({ songCatalog: [], assignableUsers: [] });
export function useAdminSongCatalog() { return useContext(SongCatalogContext); }

const SongSearchContext = createContext("");
export function useAdminSongSearch() {
  return useContext(SongSearchContext);
}

export function AdminSongWorkspace({ children, counts, locale, songCatalog = [], assignableUsers = [] }: {
  children: ReactNode;
  songCatalog?: SongCatalog;
  assignableUsers?: AssignableUsers;
  counts: { main: number; backlog: number; unselected: number };
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  return (
    <section id="songs" className="scroll-mt-48 sm:scroll-mt-28 space-y-6" aria-label={pick(locale, { en: "Song management", ru: "Управление песнями" })}>
      <div className="space-y-4">
        <h2 className="font-display text-3xl font-semibold text-sand">{pick(locale, { en: "Songs", ru: "Песни" })} <span className="text-white/60">{counts.main + counts.backlog + counts.unselected}</span></h2>
        <p className="text-sm text-white/70">{pick(locale, { en: "Arrange the set, then expand any song to edit its details and seats.", ru: "Настрой порядок и раскрой нужную песню, чтобы изменить её настройки и места." })}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <nav className="flex flex-wrap gap-2 text-sm text-sand" aria-label={pick(locale, { en: "Song sections", ru: "Разделы песен" })}>
            {([
              ["main", pick(locale, { en: "Main set", ru: "Мейн-сет" }), counts.main],
              ["backlog", pick(locale, { en: "Backlog", ru: "Бэклог" }), counts.backlog],
              ["unselected", pick(locale, { en: "Not selected", ru: "Вне сетлиста" }), counts.unselected],
            ] as const).map(([id, label, count]) => <a key={id} href={`#songs-${id}`} className="rounded-sm border border-white/20 px-3 py-2 hover:bg-white/10">{label} · {count}</a>)}
          </nav>
          <label className="w-full space-y-1 text-sm text-white/75 sm:w-80">
            <span>{pick(locale, { en: "Find a song or musician", ru: "Найти песню или музыканта" })}</span>
            <input type="search" className="w-full px-3 py-2" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {query.trim() ? <p className="text-sm text-white/70" role="status">{pick(locale, { en: "Clear search to reorder songs or drummer blocks. Section moves and editing remain available.", ru: "Очисти поиск, чтобы менять порядок песен и блоков барабанщиков. Перенос между разделами и редактирование доступны." })}</p> : null}
      </div>
      <SongCatalogContext.Provider value={{ songCatalog, assignableUsers }}>
        <SongSearchContext.Provider value={query.trim().toLocaleLowerCase()}>{children}</SongSearchContext.Provider>
      </SongCatalogContext.Provider>
    </section>
  );
}
