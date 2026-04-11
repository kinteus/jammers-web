"use client";

import { useEffect, useState } from "react";

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
  locale,
  target,
}: {
  locale: Locale;
  target: Date | string;
}) {
  const targetMs = new Date(target).getTime();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (Number.isNaN(targetMs)) {
    return null;
  }

  const remainingMs = targetMs - nowMs;

  return (
    <span className="font-semibold text-sand">
      {remainingMs > 0
        ? formatTimeLeft(remainingMs, locale)
        : pick(locale, { en: "Registration is open now", ru: "Регистрация уже открыта" })}
    </span>
  );
}
