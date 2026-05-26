/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventRegistrationCountdown } from "@/components/event-registration-countdown";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EventRegistrationCountdown", () => {
  it("hydrates without rendering a different first-second countdown on the client", async () => {
    const target = new Date("2026-05-25T20:01:05.000Z");
    const serverNow = new Date("2026-05-25T20:00:00.000Z").getTime();
    const clientNow = serverNow + 1000;
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(serverNow);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    document.body.innerHTML = `<div id="root">${renderToString(
      <EventRegistrationCountdown locale="ru" refreshOnComplete target={target} />,
    )}</div>`;

    dateNowSpy.mockReturnValue(clientNow);

    await act(async () => {
      hydrateRoot(
        document.getElementById("root")!,
        <EventRegistrationCountdown locale="ru" refreshOnComplete target={target} />,
      );
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Hydration failed because the server rendered text"),
      expect.anything(),
    );
  });
});
