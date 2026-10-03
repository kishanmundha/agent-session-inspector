"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keeps one piece of view state in the query string, so a refresh, the back
 * button or a shared link restores it. The fallback value is left out of the
 * URL. Changing it replaces the history entry rather than adding one. The
 * caller must render under a Suspense boundary, as with any use of
 * `useSearchParams`.
 */
export function useQueryParam(
  name: string,
  fallback: string,
): [string, (value: string) => void] {
  const value = useSearchParams().get(name) ?? fallback;

  const setValue = useCallback(
    (next: string) => {
      const url = new URL(window.location.href);
      if (next === fallback) url.searchParams.delete(name);
      else url.searchParams.set(name, next);
      window.history.replaceState(null, "", url);
    },
    [name, fallback],
  );

  return [value, setValue];
}

/** The selected tab, kept in `?tab=`. An unknown value falls back. */
export function useTabParam<T extends string>(
  tabs: readonly T[],
  fallback: T,
): [T, (tab: T) => void] {
  const [raw, setTab] = useQueryParam("tab", fallback);
  const tab = tabs.includes(raw as T) ? (raw as T) : fallback;
  return [tab, setTab];
}
