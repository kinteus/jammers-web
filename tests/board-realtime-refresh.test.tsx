/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBoardUpdateMessage } from "@/server/board-realtime";
import { BoardRealtimeRefresh } from "@/components/board-realtime-refresh";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  sendMessage(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BoardRealtimeRefresh", () => {
  it("reconnects when the board websocket closes before an update arrives", () => {
    render(<BoardRealtimeRefresh eventId="event-1" />);

    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => {
      FakeWebSocket.instances[0]?.drop();
      vi.advanceTimersByTime(1_000);
    });

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("refreshes the route after a matching board websocket message", () => {
    render(<BoardRealtimeRefresh eventId="event-1" />);
    const listener = vi.fn();
    window.addEventListener("jammers:board-update", listener);

    act(() => {
      FakeWebSocket.instances[0]?.open();
      FakeWebSocket.instances[0]?.sendMessage(
        buildBoardUpdateMessage({ eventId: "event-1", reason: "seat-claimed" }),
      );
      vi.advanceTimersByTime(150);
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          eventId: "event-1",
          reason: "seat-claimed",
        }),
      }),
    );
  });

  it("periodically refreshes as a safety net when websocket messages are not delivered", () => {
    render(<BoardRealtimeRefresh eventId="event-1" />);

    act(() => {
      FakeWebSocket.instances[0]?.open();
      vi.advanceTimersByTime(15_000);
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
