"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { pick, type Locale } from "@/lib/i18n";

function formatTimeLeft(targetMs: number, locale: Locale) {
  const totalSeconds = Math.max(0, Math.floor(targetMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      locale === "ru" ? `${days} д` : `${days}d`,
      locale === "ru" ? `${hours} ч` : `${hours}h`,
      locale === "ru" ? `${minutes} мин` : `${minutes}m`,
    );
    return parts.join(" ");
  }

  if (hours > 0) {
    parts.push(
      locale === "ru" ? `${hours} ч` : `${hours}h`,
      locale === "ru" ? `${minutes} мин` : `${minutes}m`,
    );
    return parts.join(" ");
  }

  parts.push(
    locale === "ru" ? `${minutes} мин` : `${minutes}m`,
    locale === "ru" ? `${seconds} сек` : `${seconds}s`,
  );
  return parts.join(" ");
}

export function EventRegistrationCountdown({
  initialNowMs,
  locale,
  onCompleteLabel,
  refreshOnComplete = false,
  target,
}: {
  initialNowMs?: number;
  locale: Locale;
  onCompleteLabel?: string;
  refreshOnComplete?: boolean;
  target: Date | string;
}) {
  const router = useRouter();
  const targetMs = new Date(target).getTime();
  const [nowMs, setNowMs] = useState<number | null>(initialNowMs ?? null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!refreshOnComplete || Number.isNaN(targetMs)) {
      return;
    }

    const remainingMs = targetMs - Date.now();
    if (remainingMs <= 0) {
      router.refresh();
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
    }, Math.min(remainingMs + 250, 2_147_483_647));

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshOnComplete, router, targetMs]);

  if (Number.isNaN(targetMs)) {
    return null;
  }

  if (nowMs === null) {
    return <span className="font-semibold text-sand">...</span>;
  }

  const remainingMs = targetMs - nowMs;

  return (
    <span className="font-semibold text-sand">
      {remainingMs > 0
        ? formatTimeLeft(remainingMs, locale)
        : onCompleteLabel ?? pick(locale, { en: "Registration is open now", ru: "Регистрация уже открыта" })}
    </span>
  );
}
