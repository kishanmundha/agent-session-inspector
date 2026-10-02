"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keeps the selected tab in `?tab=`, so a refresh, the back button or a shared
 * link reopens it. The fallback tab is left out of the URL, and an unknown
 * value falls back too. Switching tabs replaces the history entry rather than
 * adding one. The caller must render under a Suspense boundary, as with any
 * use of `useSearchParams`.
 */
export function useTabParam<T extends string>(
  tabs: readonly T[],
  fallback: T,
): [T, (tab: T) => void] {
  const raw = useSearchParams().get("tab");
  const tab = tabs.includes(raw as T) ? (raw as T) : fallback;

  const setTab = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      if (next === fallback) url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    },
    [fallback],
  );

  return [tab, setTab];
}
