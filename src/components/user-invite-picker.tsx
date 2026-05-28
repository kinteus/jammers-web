"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type InviteableUserOption = {
  id: string;
  fullName: string | null;
  telegramUsername: string | null;
};

export function getInviteableUserLabel(user: InviteableUserOption) {
  return user.telegramUsername ? `@${user.telegramUsername}` : user.fullName ?? "Unknown";
}

export function UserInvitePicker({
  ariaLabel,
  disabled = false,
  locale,
  onSelectedUserIdChange,
  selectedUserId,
  users,
}: {
  ariaLabel: string;
  disabled?: boolean;
  locale: Locale;
  onSelectedUserIdChange: (userId: string) => void;
  selectedUserId: string;
  users: InviteableUserOption[];
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedUser = useMemo(
    () => users.find((candidate) => candidate.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
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

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-sm border border-white/12 bg-black/24 px-2 transition",
          !disabled && "focus-within:border-gold/60",
          disabled && "cursor-not-allowed opacity-45",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-white/42" />
        <input
          aria-controls={listboxId}
          aria-expanded={isOpen && !disabled}
          aria-label={ariaLabel}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm focus:ring-0 disabled:cursor-not-allowed"
          disabled={disabled}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onSelectedUserIdChange("");
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={pick(locale, {
            en: "Name or @telegram",
            ru: "Имя или @telegram",
          })}
          role="combobox"
          value={selectedUser ? getInviteableUserLabel(selectedUser) : query}
        />
      </div>
      {isOpen && !disabled ? (
        <div
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-stage shadow-card"
          id={listboxId}
          role="listbox"
        >
          {filteredUsers.length > 0 ? (
            filteredUsers.map((candidate) => {
              const secondary =
                candidate.telegramUsername && candidate.fullName ? candidate.fullName : null;

              return (
                <button
                  aria-selected={selectedUserId === candidate.id}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-xs transition hover:bg-white/8",
                    selectedUserId === candidate.id && "bg-gold/12 text-sand",
                  )}
                  key={candidate.id}
                  onClick={() => {
                    onSelectedUserIdChange(candidate.id);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  role="option"
                  type="button"
                >
                  <span className="truncate font-semibold text-sand">
                    {getInviteableUserLabel(candidate)}
                  </span>
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
    </div>
  );
}
