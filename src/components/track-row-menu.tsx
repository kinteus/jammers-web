"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 176;

export function getDeleteTrackConfirmMessage(
  songTitle: string,
  claimedSeatCount: number,
  locale: Locale,
) {
  if (claimedSeatCount === 0) {
    return pick(locale, {
      en: `Delete "${songTitle}" from the board?`,
      ru: `Удалить "${songTitle}" из таблицы?`,
    });
  }

  return pick(locale, {
    en: `Delete "${songTitle}" from the board? ${claimedSeatCount} ${
      claimedSeatCount === 1
        ? "participant loses their seat"
        : "participants lose their seats"
    }.`,
    ru: `Удалить "${songTitle}" из таблицы? Участников, которые потеряют место: ${claimedSeatCount}.`,
  });
}

// Keeps destructive track actions out of the row until the user asks for them.
export function TrackRowMenu({
  action,
  claimedSeatCount,
  eventSlug,
  locale,
  songTitle,
  trackId,
  triggerClassName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  claimedSeatCount: number;
  eventSlug: string;
  locale: Locale;
  songTitle: string;
  trackId: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The board table clips overflow, so the menu is portalled and positioned against the trigger.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 44;
      const left = Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      );
      const fitsBelow = rect.bottom + 4 + menuHeight <= window.innerHeight - 8;
      const top = fitsBelow
        ? rect.bottom + 4
        : Math.max(8, rect.top - 4 - menuHeight);
      setPosition({ left, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const menuLabel = pick(locale, {
    en: `More actions for ${songTitle}`,
    ru: `Ещё действия: ${songTitle}`,
  });

  return (
    <div>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={menuLabel}
        className={triggerClassName}
        data-tip={pick(locale, { en: "More", ru: "Ещё" })}
        data-track-row-menu={trackId}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        title={menuLabel}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90] rounded-md border border-white/12 bg-[#151515] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
              ref={menuRef}
              role="menu"
              style={{
                left: position?.left ?? -9999,
                top: position?.top ?? -9999,
                width: MENU_WIDTH,
              }}
            >
              <form
                action={action}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      getDeleteTrackConfirmMessage(
                        songTitle,
                        claimedSeatCount,
                        locale,
                      ),
                    )
                  ) {
                    event.preventDefault();
                    return;
                  }
                  setOpen(false);
                }}
              >
                <input name="trackId" type="hidden" value={trackId} />
                <input name="eventSlug" type="hidden" value={eventSlug} />
                <button
                  aria-label={pick(locale, {
                    en: `Delete ${songTitle}`,
                    ru: `Удалить ${songTitle}`,
                  })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs font-semibold text-red",
                    "hover:bg-red/12 hover:text-white focus-visible:bg-red/12 focus-visible:text-white focus-visible:outline-none",
                  )}
                  role="menuitem"
                  type="submit"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {pick(locale, { en: "Delete song…", ru: "Удалить песню…" })}
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
