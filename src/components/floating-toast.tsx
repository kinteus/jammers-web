"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const FLOATING_TOAST_SUCCESS_AUTO_HIDE_MS = 5000;
// Validation / error toasts often carry constraints the user must read and act on, so they
// stay on screen noticeably longer than transient success / board-update confirmations.
export const FLOATING_TOAST_ERROR_AUTO_HIDE_MS = 10000;

export function getFloatingToastAutoHideMs(tone: "error" | "success") {
  return tone === "error"
    ? FLOATING_TOAST_ERROR_AUTO_HIDE_MS
    : FLOATING_TOAST_SUCCESS_AUTO_HIDE_MS;
}

export function FloatingToast({
  autoHideMs,
  description,
  locale,
  title,
  tone,
}: {
  autoHideMs?: number;
  description: string;
  locale: Locale;
  title: string;
  tone: "error" | "success";
}) {
  const [visible, setVisible] = useState(true);
  const resolvedAutoHideMs = autoHideMs ?? getFloatingToastAutoHideMs(tone);

  useEffect(() => {
    setVisible(true);
  }, [description, title, tone]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timeoutId = window.setTimeout(() => setVisible(false), resolvedAutoHideMs);
    return () => window.clearTimeout(timeoutId);
  }, [resolvedAutoHideMs, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed right-4 top-24 z-[95] w-[min(calc(100vw-2rem),30rem)]">
      <div
        className={cn(
          "rounded-2xl border px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur",
          tone === "success"
            ? "border-blue/40 bg-blue/18 text-white"
            : "border-red/40 bg-red/16 text-white",
        )}
        role="status"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/74">
              {tone === "success"
                ? pick(locale, { en: "Update", ru: "Обновление" })
                : pick(locale, { en: "Heads up", ru: "Внимание" })}
            </p>
            <p className="mt-1 text-lg font-semibold text-sand">{title}</p>
            <p className="mt-1 text-[15px] leading-7 text-white/82">{description}</p>
          </div>
          <button
            aria-label={pick(locale, { en: "Close message", ru: "Закрыть сообщение" })}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/18 text-white/72 transition hover:bg-black/28 hover:text-white"
            onClick={() => setVisible(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
