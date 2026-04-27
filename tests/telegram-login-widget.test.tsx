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

describe("TelegramLoginWidget", () => {
  it("uses the redirect-based Telegram auth flow without inline eval callbacks", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TelegramLoginWidget
          botUsername="the_jammers_bot"
          locale="en"
          returnTo="/events/spring-jam-night?view=mine#songs"
        />,
      );
    });

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-widget.js?22"]',
    );

    expect(script).not.toBeNull();
    expect(script?.getAttribute("data-telegram-login")).toBe("the_jammers_bot");
    expect(script?.hasAttribute("data-onauth")).toBe(false);
    expect(script?.getAttribute("data-auth-url")).toBe(
      "/api/auth/telegram?returnTo=%2Fevents%2Fspring-jam-night%3Fview%3Dmine%23songs",
    );
  });
});
