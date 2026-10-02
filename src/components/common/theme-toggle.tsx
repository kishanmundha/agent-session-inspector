"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { PALETTES, PALETTE_STORAGE_KEY } from "./palette-picker";
import { Segmented } from "./segmented";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "cv-theme";

/**
 * Runs before first paint (see layout.tsx) so the resolved theme and the
 * chosen palette are on <html> ahead of hydration and the page never flashes
 * the wrong colours.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    var palette = localStorage.getItem("${PALETTE_STORAGE_KEY}");
    if (${JSON.stringify(PALETTES.slice(1).map((p) => p.value))}.indexOf(palette) !== -1) {
      document.documentElement.dataset.palette = palette;
    }
  } catch (e) {}
})();
`;

/**
 * The stored preference is external state (localStorage + the OS media query),
 * so it is read through a store rather than mirrored into an effect.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    // Only "system" tracks the OS, but re-applying is cheap and idempotent.
    applyTheme(readTheme());
    onChange();
  };
  mq.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* storage unavailable — fall through to system */
  }
  return "system";
}

/** The server has no preference to read; render the neutral default. */
function readServerTheme(): Theme {
  return "system";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore — the class still applies for this page view */
  }
  applyTheme(theme);
  emit();
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, readServerTheme);

  return (
    <Segmented
      label="Color theme"
      size="default"
      value={theme}
      onChange={setTheme}
      options={OPTIONS}
      className={className}
    />
  );
}
