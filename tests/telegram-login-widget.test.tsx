/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TelegramLoginWidget } from "@/components/telegram-login-widget";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams("returnTo=%2F"),
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function encodeTelegramAuthResult(payload: Record<string, string>) {
  return window
    .btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("TelegramLoginWidget", () => {
  it("uses an absolute redirect-based Telegram auth flow without inline eval callbacks", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TelegramLoginWidget
          botUsername="the_jammers_bot"
          locale="en"
        />,
      );
    });

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-widget.js?22"]',
    );

    expect(script).not.toBeNull();
    expect(script?.getAttribute("data-telegram-login")).toBe("the_jammers_bot");
    expect(script?.hasAttribute("data-onauth")).toBe(false);
    const authUrl = new URL(script?.getAttribute("data-auth-url") ?? "");

    expect(authUrl.origin).toBe(window.location.origin);
    expect(authUrl.pathname).toBe("/api/auth/telegram");
    expect(authUrl.searchParams.has("returnTo")).toBe(false);
    expect(authUrl.searchParams.get("authRequest")).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it("offers a same-tab Telegram auth link when the bot id is available", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TelegramLoginWidget
          botId="8366922626"
          botUsername="the_jammers_bot"
          locale="en"
        />,
      );
    });

    const directLink = document.querySelector<HTMLAnchorElement>(
      'a[data-telegram-direct-auth="true"]',
    );
    const legacyScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-widget.js?22"]',
    );

    expect(legacyScript).toBeNull();
    expect(directLink).not.toBeNull();

    const url = new URL(directLink?.href ?? "");
    expect(url.origin).toBe("https://oauth.telegram.org");
    expect(url.pathname).toBe("/auth");
    expect(url.searchParams.get("bot_id")).toBe("8366922626");
    expect(url.searchParams.get("origin")).toBe(window.location.origin);
    expect(url.searchParams.get("request_access")).toBe("write");
    expect(url.searchParams.get("return_to")).toBe(window.location.href);
  });

  it("completes Telegram auth from a tgAuthResult return without reopening the popup", async () => {
    const payload = {
      auth_date: "1710000000",
      first_name: "Anna",
      hash: "hash",
      id: "tg-1",
      username: "anna",
    };
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(
      null,
      "",
      `/profile#tgAuthResult=${encodeTelegramAuthResult(payload)}`,
    );

    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TelegramLoginWidget
          botId="8366922626"
          botUsername="the_jammers_bot"
          locale="en"
        />,
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/telegram",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ payload }),
      }),
    );
  });
});
