"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { type RoleFamilyKey } from "@/lib/role-families";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ViewKey = "all" | "open" | "mine";

function buildQueryString({
  search,
  roles,
  view,
  participant,
}: {
  search: string;
  roles: RoleFamilyKey[];
  view: ViewKey;
  participant: string;
}) {
  const params = new URLSearchParams();

  if (view !== "all") {
    params.set("view", view);
  }
  if (search.trim()) {
    params.set("q", search.trim());
  }
  if (roles.length > 0) {
    params.set("roles", roles.join(","));
  }

  if (participant) params.set("participant", participant);
  return params.toString();
}

export function TrackBoardFilters({
  activeView: serverView,
  locale,
  roleOptions,
  searchQuery,
  selectedRoles: serverRoles,
  selectedParticipant = "",
  participants = [],
  showMineView,
  visibleCount,
}: {
  activeView: ViewKey;
  locale: Locale;
  roleOptions: RoleFamilyKey[];
  searchQuery: string;
  selectedRoles: RoleFamilyKey[];
  selectedParticipant?: string;
  participants?: { id: string; label: string }[];
  showMineView: boolean;
  visibleCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(searchQuery);
  const [activeView, setActiveView] = useState(serverView);
  const [selectedRoles, setSelectedRoles] = useState(serverRoles);
  const [participant, setParticipant] = useState(selectedParticipant);
  const dirty = useRef(false);
  const issuedQueries = useRef(new Set<string>());
  const lastRequested = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverState = buildQueryString({ search: searchQuery, roles: serverRoles, view: serverView, participant: selectedParticipant });
  const draftState = buildQueryString({ search: query, roles: selectedRoles, view: activeView, participant });

  const replace = useCallback(
    (next: { search: string; roles: RoleFamilyKey[]; view: ViewKey; participant?: string }) => {
      if (timer.current) clearTimeout(timer.current);
      dirty.current = true;
      setQuery(next.search);
      setSelectedRoles(next.roles);
      setActiveView(next.view);
      setParticipant(next.participant ?? participant);
      const queryString = buildQueryString({ ...next, participant: next.participant ?? participant });
      issuedQueries.current.add(queryString);
      lastRequested.current = queryString;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [participant, pathname, router],
  );

  useEffect(() => {
    // An RSC response may belong to an earlier keystroke. Only acknowledge the
    // latest draft; never replace newer local input with that response.
    if (dirty.current && (
      serverState !== draftState ||
      (lastRequested.current !== null && lastRequested.current !== draftState)
    )) return;
    if (serverState !== draftState && issuedQueries.current.has(serverState)) return;
    dirty.current = false;
    if (serverState === draftState) return;
    lastRequested.current = null;
    issuedQueries.current.clear();
    setQuery(searchQuery);
    setSelectedRoles(serverRoles);
    setActiveView(serverView);
    setParticipant(selectedParticipant);
  }, [serverState, draftState, searchQuery, serverRoles, serverView, selectedParticipant]);

  useEffect(() => {
    const onPopState = () => {
      if (timer.current) clearTimeout(timer.current);
      dirty.current = true;
      issuedQueries.current.clear();
      lastRequested.current = null;
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setSelectedRoles((params.get("roles")?.split(",") ?? []).filter((role): role is RoleFamilyKey => roleOptions.includes(role as RoleFamilyKey)));
      setActiveView(params.get("view") === "open" ? "open" : params.get("view") === "mine" && showMineView ? "mine" : "all");
      setParticipant(params.get("participant") ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [roleOptions, showMineView]);

  useEffect(() => {
    if (!dirty.current || lastRequested.current === draftState) return;
    timer.current = setTimeout(() => {
      issuedQueries.current.add(draftState);
      lastRequested.current = draftState;
      router.replace(draftState ? `${pathname}?${draftState}` : pathname, { scroll: false });
    }, 240);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draftState, serverState, pathname, router]);

  function toggleRole(role: RoleFamilyKey) {
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((item) => item !== role)
      : [...selectedRoles, role];

    replace({ search: query, roles: nextRoles, view: activeView });
  }

  const filterTabs = [
    {
      id: "all" as const,
      label: pick(locale, { en: "All songs", ru: "Все песни" }),
    },
    {
      id: "open" as const,
      label: pick(locale, { en: "Need players", ru: "Нужны люди" }),
    },
    ...(showMineView
      ? [{ id: "mine" as const, label: pick(locale, { en: "My songs", ru: "Мои песни" }) }]
      : []),
  ];

  const hasExtraFilters = query.trim().length > 0 || selectedRoles.length > 0 || activeView !== "all" || Boolean(participant);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => replace({ search: query, roles: selectedRoles, view: tab.id })}
              size="sm"
              type="button"
              variant={tab.id === activeView ? "accent" : "secondary"}
            >
              {tab.label}
            </Button>
          ))}
          <Badge className="border-gold/24 bg-gold/10 text-white">
            {visibleCount} {pick(locale, { en: "visible", ru: "видно" })}
          </Badge>
        </div>

        <form
          className="flex min-w-0 flex-col gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            replace({ search: query, roles: selectedRoles, view: activeView });
          }}
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:min-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/32" />
              <input
                aria-label={pick(locale, {
                  en: "Search songs, artists, or proposers",
                  ru: "Искать песни, артистов или авторов",
                })}
                className="w-full border-white/12 bg-stage py-2.5 pl-10 pr-4"
                name="q"
                onChange={(event) => { dirty.current = true; setQuery(event.target.value); }}
                placeholder={pick(locale, {
                  en: "Search by song, artist or proposer",
                  ru: "Поиск по песне, артисту или автору",
                })}
                value={query}
              />
            </div>
            <select
              aria-label={pick(locale, { en: "Filter by musician", ru: "Фильтр по музыканту" })}
              value={participant}
              onChange={(event) => replace({ search: query, roles: selectedRoles, view: activeView, participant: event.target.value })}
              className="border-white/12 bg-stage text-sm"
            >
              <option value="">{pick(locale, { en: "All musicians", ru: "Все музыканты" })}</option>
              {participants.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
            </select>
            {hasExtraFilters ? (
              <Button
                onClick={() => {
                  replace({ search: "", roles: [], view: "all", participant: "" });
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {pick(locale, { en: "Clear", ru: "Сбросить" })}
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            {pick(locale, {
              en: "Search updates automatically as you type",
              ru: "Поиск обновляется автоматически по мере ввода",
            })}
          </p>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/52">
          <SlidersHorizontal className="h-3.5 w-3.5 text-gold" />
          {pick(locale, { en: "Open role filters", ru: "Фильтр по открытым ролям" })}
        </span>
        {roleOptions.map((role) => (
          <button
            aria-pressed={selectedRoles.includes(role)}
            className={selectedRoles.includes(role)
              ? "rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold/16"
              : "rounded-full border border-white/10 bg-stage px-3 py-1.5 text-xs font-semibold text-white/72 transition hover:border-gold/18 hover:text-white"
            }
            key={role}
            onClick={() => toggleRole(role)}
            type="button"
          >
            {getRoleFamilyLabel(role, locale)}
          </button>
        ))}
      </div>

      {selectedRoles.length > 0 ? (
        <p className="text-xs leading-5 text-white/58">
          {pick(locale, {
            en: "Showing songs that still have open seats in every selected role family.",
            ru: "Показываются песни, где ещё открыты места во всех выбранных классах ролей.",
          })}
        </p>
      ) : null}
    </div>
  );
}
