"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function FloatingToast({
  autoHideMs = 5000,
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

  useEffect(() => {
    setVisible(true);
  }, [description, title, tone]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timeoutId = window.setTimeout(() => setVisible(false), autoHideMs);
    return () => window.clearTimeout(timeoutId);
  }, [autoHideMs, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed right-4 top-24 z-[95] w-[min(calc(100vw-2rem),26rem)]">
      <div
        className={cn(
          "rounded-2xl border px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur",
          tone === "success"
            ? "border-blue/40 bg-blue/18 text-white"
            : "border-red/40 bg-red/16 text-white",
        )}
        role="status"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/74">
              {tone === "success"
                ? pick(locale, { en: "Update", ru: "Обновление" })
                : pick(locale, { en: "Heads up", ru: "Внимание" })}
            </p>
            <p className="mt-1 font-semibold text-sand">{title}</p>
            <p className="mt-1 text-sm leading-6 text-white/82">{description}</p>
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
