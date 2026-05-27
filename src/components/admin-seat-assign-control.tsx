"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader, Search, UserPlus } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { adminAssignSeatAction } from "@/server/actions";

type AssignableUser = {
  id: string;
  fullName: string | null;
  telegramUsername: string | null;
};

function getUserLabel(user: AssignableUser) {
  return user.telegramUsername ? `@${user.telegramUsername}` : user.fullName ?? "Unknown";
}

export function AdminSeatAssignControl({
  eventSlug,
  locale,
  seatId,
  users,
}: {
  eventSlug: string;
  locale: Locale;
  seatId: string;
  users: AssignableUser[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<"missing" | "failed" | "assigned" | null>(null);
  const [isPending, startTransition] = useTransition();
  const normalizedQuery = query.trim().toLowerCase().replace(/^@+/, "");
  const filteredUsers = useMemo(
    () =>
      users
        .filter((candidate) => {
          if (!normalizedQuery) {
            return true;
          }

          return [candidate.telegramUsername, candidate.fullName]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedQuery));
        })
        .slice(0, 8),
    [normalizedQuery, users],
  );

  function submitAssignment() {
    if (!selectedUser) {
      setFeedback("missing");
      return;
    }

    const formData = new FormData();
    formData.set("eventSlug", eventSlug);
    formData.set("seatId", seatId);
    formData.set("userId", selectedUser.id);
    setFeedback(null);

    startTransition(async () => {
      try {
        await adminAssignSeatAction(formData);
        setFeedback("assigned");
        setIsOpen(false);
        router.refresh();
      } catch {
        setFeedback("failed");
      }
    });
  }

  return (
    <div className="relative flex min-w-[260px] flex-wrap items-start gap-2">
      <div className="relative w-[220px]">
        <div className="flex items-center gap-2 rounded-sm border border-white/12 bg-black/24 px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-white/42" />
          <input
            aria-label={pick(locale, {
              en: "Search registered musicians",
              ru: "Поиск зарегистрированных музыкантов",
            })}
            className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm focus:ring-0"
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedUser(null);
              setFeedback(null);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={pick(locale, {
              en: "Name or @telegram",
              ru: "Имя или @telegram",
            })}
            value={selectedUser ? getUserLabel(selectedUser) : query}
          />
        </div>
        {isOpen ? (
          <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-stage shadow-card">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((candidate) => {
                const secondary =
                  candidate.telegramUsername && candidate.fullName ? candidate.fullName : null;

                return (
                  <button
                    className={cn(
                      "flex w-full flex-col px-3 py-2 text-left text-xs transition hover:bg-white/8",
                      selectedUser?.id === candidate.id && "bg-gold/12 text-sand",
                    )}
                    key={candidate.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSelectedUser(candidate);
                      setQuery("");
                      setFeedback(null);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="truncate font-semibold text-sand">{getUserLabel(candidate)}</span>
                    {secondary ? (
                      <span className="truncate text-[10px] text-white/54">{secondary}</span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-[11px] text-white/54">
                {pick(locale, {
                  en: "No registered musicians found.",
                  ru: "Зарегистрированные музыканты не найдены.",
                })}
              </p>
            )}
          </div>
        ) : null}
        {feedback ? (
          <p
            className={cn(
              "mt-1 text-[11px]",
              feedback === "assigned" ? "text-gold" : "text-red",
            )}
            role="status"
          >
            {feedback === "assigned"
              ? pick(locale, { en: "Assigned.", ru: "Назначено." })
              : feedback === "missing"
                ? pick(locale, { en: "Choose a musician first.", ru: "Сначала выбери музыканта." })
                : pick(locale, { en: "Could not assign.", ru: "Не получилось назначить." })}
          </p>
        ) : null}
      </div>
      <button
        className="inline-flex items-center justify-center gap-1 rounded-sm border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || !selectedUser}
        onClick={submitAssignment}
        type="button"
      >
        {isPending ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        {pick(locale, { en: "Assign", ru: "Назначить" })}
      </button>
    </div>
  );
}
