"use client";

import { useEffect, useRef } from "react";

export function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

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
    script.setAttribute("data-auth-url", `${window.location.origin}/api/auth/telegram`);
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);
  }, [botUsername]);

  if (!botUsername) {
    return (
      <p className="text-sm text-ink/70">
        Add <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to enable the Telegram sign-in widget.
      </p>
    );
  }

  return <div ref={containerRef} />;
}
