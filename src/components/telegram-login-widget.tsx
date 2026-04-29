"use client";

import React, { useEffect, useRef } from "react";
import { MessageCircleMore } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";

function getTelegramAuthUrl(authRequest: string) {
  const origin =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : window.location.origin;
  const url = new URL("/api/auth/telegram", origin);
  url.searchParams.set("authRequest", authRequest);

  return url.toString();
}

export function TelegramLoginWidget({
  botUsername,
  locale,
}: {
  botUsername?: string;
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const authRequestRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!containerRef.current || !botUsername) {
      return;
    }

    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-auth-url", getTelegramAuthUrl(authRequestRef.current));
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);
  }, [botUsername]);

  if (!botUsername) {
    return (
      <p className="text-sm text-ink/70">
        {pick(locale, {
          en: "Add ",
          ru: "Добавь ",
        })}
        <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>
        {pick(locale, {
          en: " to enable the Telegram sign-in widget.",
          ru: ", чтобы включить Telegram-виджет входа.",
        })}
      </p>
    );
  }

  return (
    <div className="telegram-login-shell space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start gap-3 text-sm text-white/70">
        <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p>
          {pick(locale, {
            en: "Telegram handles identity confirmation in its own secure flow. After approval, this page will refresh automatically and open your profile.",
            ru: "Telegram подтверждает личность в собственном защищённом сценарии. После одобрения страница автоматически обновится и откроет твой профиль.",
          })}
        </p>
      </div>
      <div className="telegram-login-widget-frame" ref={containerRef} />
    </div>
  );
}
