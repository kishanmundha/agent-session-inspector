"use client";

import { useEffect, useRef } from "react";

/**
 * Single-key shortcuts, keyed by `KeyboardEvent.key` (so "E" is Shift+e and
 * "?" needs no modifier handling). They stay out of the way while the user is
 * typing, holding a modifier, or looking at a dialog.
 */
export function useHotkeys(bindings: Record<string, (() => void) | undefined>) {
  const latest = useRef(bindings);
  useEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      const run = latest.current[e.key];
      if (!run) return;
      e.preventDefault();
      run();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
