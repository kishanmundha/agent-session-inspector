"use client";

import { useEffect, useState } from "react";
import type { AnalyticsSession } from "@/lib/providers/types";

/**
 * Loads the cross-session data behind the analytics and usage tabs. `sessions`
 * stays null until the first response; bump `reloadToken` to fetch again.
 */
export function useAnalyticsSessions(reloadToken: number) {
  const [sessions, setSessions] = useState<AnalyticsSession[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/analytics");
        if (!res.ok) throw new Error("Request failed");
        const next = await res.json();
        if (cancelled) return;
        setSessions(next);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { sessions, error };
}
