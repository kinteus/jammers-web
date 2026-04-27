"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircleMore } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";

function getTelegramAuthUrl(returnTo: string) {
  const params = new URLSearchParams({
    returnTo,
  });

  return `/api/auth/telegram?${params.toString()}`;
}

export function TelegramLoginWidget({
  botUsername,
  locale,
  returnTo: returnToOverride,
}: {
  botUsername?: string;
  locale: Locale;
  returnTo?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const returnTo = useMemo(() => {
    if (returnToOverride) {
      return returnToOverride;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("authError");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, returnToOverride, searchParams]);

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
    script.setAttribute("data-auth-url", getTelegramAuthUrl(returnTo));
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);
  }, [botUsername, returnTo]);

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
