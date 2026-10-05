"use client";

import { useSyncExternalStore } from "react";
import type { SessionMeta } from "@/lib/providers/types";

export type SortKey = "recent" | "oldest" | "cost" | "tokens" | "events" | "health" | "name";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "cost", label: "Highest cost" },
  { value: "tokens", label: "Most tokens" },
  { value: "events", label: "Most events" },
  { value: "health", label: "Lowest health" },
  { value: "name", label: "Name (A–Z)" },
];

const DEFAULT_SORT: SortKey = "recent";
const SORT_STORAGE_KEY = "asv-session-sort";

function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((o) => o.value === value);
}

function totalTokens(s: SessionMeta) {
  return (s.totalInputTokens ?? 0) + (s.totalOutputTokens ?? 0);
}

function sessionLabel(s: SessionMeta) {
  return (s.title ?? s.name ?? s.id).toLowerCase();
}

/** Orders sessions that arrive most recent first, as the API returns them. */
export function sortSessions<T extends SessionMeta>(sessions: T[], sort: SortKey): T[] {
  // The API already returns updated_at desc, so "recent" needs no re-sort.
  if (sort === "recent") return sessions;
  const sorted = [...sessions];
  switch (sort) {
    case "oldest":
      return sorted.reverse();
    case "cost":
      return sorted.sort((a, b) => (b.estimatedCostUSD ?? 0) - (a.estimatedCostUSD ?? 0));
    case "tokens":
      return sorted.sort((a, b) => totalTokens(b) - totalTokens(a));
    case "events":
      return sorted.sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0));
    case "health":
      // Unscored sessions have nothing to rank, so they go last.
      return sorted.sort((a, b) => (a.health?.score ?? 101) - (b.health?.score ?? 101));
    case "name":
      return sorted.sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b)));
  }
}

// The chosen order is shared by the home list and the session sidebar, and
// outlives navigation. localStorage is the source of truth, as with the theme
// and palette preferences.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSort(): SortKey {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (isSortKey(stored)) return stored;
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return DEFAULT_SORT;
}

function writeSort(sort: SortKey) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {
    /* private mode: the choice lasts until reload */
  }
  for (const l of listeners) l();
}

/** The session sort order, remembered across pages and reloads. */
export function useSessionSort(): [SortKey, (sort: SortKey) => void] {
  const sort = useSyncExternalStore(subscribe, readSort, () => DEFAULT_SORT);
  return [sort, writeSort];
}
