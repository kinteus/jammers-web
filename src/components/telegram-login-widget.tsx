"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircleMore } from "lucide-react";

import type { TelegramAuthPayload } from "@/lib/auth/telegram";

type TelegramAuthPayloadRecord = Record<
  string,
  TelegramAuthPayload[keyof TelegramAuthPayload]
>;

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayloadRecord) => Promise<void>;
  }
}

export function TelegramLoginWidget({ botUsername }: { botUsername?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("authError");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!containerRef.current || !botUsername) {
      return;
    }

    containerRef.current.innerHTML = "";

    window.onTelegramAuth = async (payload: TelegramAuthPayloadRecord) => {
      setStatus("loading");
      setMessage("Signing you in...");

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload,
            returnTo,
          }),
        });

        const result = (await response.json()) as {
          ok: boolean;
          error?: string;
          redirectTo?: string;
          cacheBuster?: number;
        };

        if (!response.ok || !result.ok || !result.redirectTo) {
          throw new Error(result.error ?? "Telegram authentication failed.");
        }

        setMessage("Signed in. Redirecting...");
        const redirectUrl = new URL(result.redirectTo, window.location.origin);
        if (result.cacheBuster) {
          redirectUrl.searchParams.set("auth", String(result.cacheBuster));
        }
        window.location.replace(redirectUrl.toString());
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "Telegram authentication failed.",
        );
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);

    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [botUsername, returnTo]);

  if (!botUsername) {
    return (
      <p className="text-sm text-ink/70">
        Add <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to enable the Telegram sign-in widget.
      </p>
    );
  }

  return (
    <div className="telegram-login-shell space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start gap-3 text-sm text-white/70">
        <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p>
          Telegram handles identity confirmation in its own secure flow. After approval, this page
          will refresh automatically and open your profile.
        </p>
      </div>
      <div className="telegram-login-widget-frame" ref={containerRef} />
      {status !== "idle" && message ? (
        <p
          className={
            status === "error"
              ? "text-sm text-ember"
              : "text-sm text-ink/70"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
