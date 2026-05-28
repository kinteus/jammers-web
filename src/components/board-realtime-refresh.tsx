"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { parseBoardUpdateMessage } from "@/server/board-realtime";

const reconnectBaseDelayMs = 1_000;
const reconnectMaxDelayMs = 10_000;
const refreshDebounceMs = 150;
const safetyRefreshMs = 15_000;

export function BoardRealtimeRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let closedByUnmount = false;
    let reconnectAttempt = 0;
    let socket: WebSocket | null = null;

    function refreshSoon(delay = refreshDebounceMs) {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
      }, delay);
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (closedByUnmount || reconnectTimerRef.current !== null) {
        return;
      }

      const delay = Math.min(
        reconnectMaxDelayMs,
        reconnectBaseDelayMs * 2 ** reconnectAttempt,
      );
      reconnectAttempt += 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    function handleMessage(event: MessageEvent) {
      if (typeof event.data !== "string") {
        return;
      }

      const message = parseBoardUpdateMessage(event.data);
      if (!message || message.eventId !== eventId) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent("jammers:board-update", {
          detail: message,
        }),
      );
      refreshSoon();
    }

    function connect() {
      if (closedByUnmount) {
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/board?eventId=${encodeURIComponent(eventId)}`,
      );

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
      });
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => {
        socket?.close();
      });
    }

    connect();

    const safetyRefreshTimer = window.setInterval(() => {
      router.refresh();
    }, safetyRefreshMs);

    return () => {
      closedByUnmount = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      clearReconnectTimer();
      window.clearInterval(safetyRefreshTimer);
      socket?.close();
    };
  }, [eventId, router]);

  return null;
}
