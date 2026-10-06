"use client";

import { useEffect, useState } from "react";
import type { InviteableUserOption } from "@/components/user-invite-picker";

export function useMusicianSearch(query: string, enabled = true) {
  const normalized = query.trim().replace(/^@+/, "");
  const [result, setResult] = useState<{ query: string; users: InviteableUserOption[]; failed: boolean } | null>(null);
  const canSearch = enabled && normalized.length >= 3 && normalized.length <= 80;
  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/musician-search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json() as { users: InviteableUserOption[] };
        if (!controller.signal.aborted) setResult({ query: normalized, users: data.users, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ query: normalized, users: [], failed: true });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canSearch, normalized]);
  const current = canSearch && result?.query === normalized ? result : null;
  return { users: current?.users ?? [], loading: canSearch && !current, failed: current?.failed ?? false, canSearch };
}
