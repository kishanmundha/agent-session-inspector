"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * View choices (a range, a filter, a chart toggle) remembered across tab
 * switches and reloads, as the session sort is. `localStorage` keeps them
 * for good; `sessionStorage` only for this browser tab, so a fresh visit
 * starts from the defaults.
 */
type Area = "local" | "session";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const storageOf = (area: Area) => (area === "local" ? localStorage : sessionStorage);

function read(area: Area, key: string): string | null {
  try {
    return storageOf(area).getItem(key);
  } catch {
    // Storage unavailable: the default applies.
    return null;
  }
}

function write(area: Area, key: string, value: string | null) {
  try {
    if (value === null) storageOf(area).removeItem(key);
    else storageOf(area).setItem(key, value);
  } catch {
    /* private mode: the choice lasts until the component unmounts */
  }
  for (const l of listeners) l();
}

/**
 * A string choice kept in browser storage under `asv-<key>`. A stored value
 * that `valid` rejects, such as an option that no longer exists, reads as
 * the fallback. Setting the fallback clears the entry.
 */
export function useStoredState<T extends string>(
  key: string,
  fallback: T,
  valid: (value: string) => boolean,
  area: Area = "local",
): [T, (value: T) => void] {
  const storageKey = `asv-${key}`;
  const value = useSyncExternalStore(
    subscribe,
    () => read(area, storageKey),
    () => null,
  );
  const set = useCallback(
    (next: T) => write(area, storageKey, next === fallback ? null : next),
    [area, storageKey, fallback],
  );
  return [value !== null && valid(value) ? (value as T) : fallback, set];
}

/** Validator for a choice from a fixed list. */
export const oneOf =
  (values: readonly string[]) =>
  (value: string): boolean =>
    values.includes(value);

/** Accepts any value; for lists that are only known once data loads. */
export const anyValue = () => true;
