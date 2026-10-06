"use client";

import React, { useEffect, useRef, useState } from "react";
import { MessageCircleMore } from "lucide-react";

import { getSafeReturnTo } from "@/lib/return-to";

import { Button } from "@/components/ui/button";
import { pick, type Locale } from "@/lib/i18n";

function getTelegramAuthUrl(authRequest: string) {
  const origin =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : window.location.origin;
  const url = new URL("/api/auth/telegram", origin);
  url.searchParams.set("authState", authRequest);

  return url.toString();
}

function decodeTelegramAuthResult(value: string) {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded)) as Record<string, string>;
  } catch {
    return null;
  }
}

function getTelegramAuthResultFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const match = window.location.href.match(/[#?&]tgAuthResult=([A-Za-z0-9\-_]*)$/);
  if (!match) {
    return null;
  }

  return decodeTelegramAuthResult(match[1] ?? "");
}

function removeTelegramAuthResultFromLocation() {
  if (typeof window === "undefined") {
    return;
  }

  const cleanUrl = window.location.href.replace(/[#?&]tgAuthResult=[A-Za-z0-9\-_]*$/, "");
  window.history.replaceState(null, "", cleanUrl || "/profile");
}

function getDirectTelegramAuthUrl(botId: string, state: string) {
  const origin =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : window.location.origin;
  const returnTo =
    typeof window === "undefined"
      ? `${origin}/profile`
      : window.location.href.replace(/[#?&]tgAuthResult=[A-Za-z0-9\-_]*$/, "");
  const url = new URL("https://oauth.telegram.org/auth");
  url.searchParams.set("bot_id", botId);
  url.searchParams.set("origin", origin ?? "");
  url.searchParams.set("request_access", "write");
  const callback = new URL(returnTo);
  callback.searchParams.set("authState", state);
  url.searchParams.set("return_to", callback.toString());

  return url.toString();
}

export function TelegramLoginWidget({
  botId,
  botUsername,
  locale,
}: {
  botId?: string;
  botUsername?: string;
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loginState, setLoginState] = useState<string | null>(null);
  const [directAuthUrl, setDirectAuthUrl] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"idle" | "pending" | "failed">("idle");

  useEffect(() => {
    if (getTelegramAuthResultFromLocation()) return;
    let cancelled = false;
    void fetch("/api/auth/telegram/state", { method: "POST" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((result: { state: string }) => { if (!cancelled) setLoginState(result.state); })
      .catch(() => { if (!cancelled) setAuthState("failed"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!botId || !loginState) {
      setDirectAuthUrl(null);
      return;
    }

    setDirectAuthUrl(getDirectTelegramAuthUrl(botId, loginState));
  }, [botId, loginState]);

  useEffect(() => {
    const payload = getTelegramAuthResultFromLocation();
    if (!payload) {
      return;
    }

    let cancelled = false;
    removeTelegramAuthResultFromLocation();
    setAuthState("pending");

    void fetch("/api/auth/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ payload, state: new URL(window.location.href).searchParams.get("authState") }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          cacheBuster?: number;
          ok?: boolean;
          redirectTo?: string;
        };
        if (!response.ok || result.ok === false) {
          throw new Error("Telegram authentication failed.");
        }
        if (cancelled) {
          return;
        }

        const redirectUrl = new URL(getSafeReturnTo(result.redirectTo, "/"), window.location.origin);
        redirectUrl.searchParams.set("auth", String(result.cacheBuster ?? Date.now()));
        window.location.assign(redirectUrl.toString());
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !botUsername || botId || !loginState) {
      return;
    }

    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-auth-url", getTelegramAuthUrl(loginState));
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);
  }, [botId, botUsername, loginState]);

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
            en: "Telegram handles identity confirmation in its own secure flow. After approval, this page will refresh automatically and open the nearest open gig, or the home page if none is open.",
            ru: "Telegram подтверждает личность в собственном защищённом сценарии. После одобрения страница автоматически обновится и откроет ближайший открытый гиг или главную страницу.",
          })}
        </p>
      </div>
      {authState === "failed" ? (
        <p className="rounded-md bg-ember/10 p-3 text-sm text-ember">
          {pick(locale, {
            en: "Telegram sign-in did not finish. Please try again.",
            ru: "Вход через Telegram не завершился. Попробуй ещё раз.",
          })}
        </p>
      ) : null}
      {directAuthUrl ? (
        <Button
          aria-busy={authState === "pending"}
          asChild
          className="w-full sm:w-auto"
          size="md"
        >
          <a data-telegram-direct-auth="true" href={directAuthUrl}>
            {authState === "pending"
              ? pick(locale, { en: "Signing in...", ru: "Входим..." })
              : pick(locale, { en: "Log in with Telegram", ru: "Войти через Telegram" })}
          </a>
        </Button>
      ) : (
        <div className="telegram-login-widget-frame" ref={containerRef} />
      )}
    </div>
  );
}
