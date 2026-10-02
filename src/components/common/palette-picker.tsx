"use client";

import { useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PALETTE_STORAGE_KEY = "cv-palette";

/**
 * The colour palettes defined in globals.css. `swatch` is only for the picker;
 * the real colours live in the `[data-palette]` blocks there.
 */
export const PALETTES = [
  { value: "ocean", label: "Ocean", swatch: "#4a8fd0" },
  { value: "sage", label: "Sage", swatch: "#6b9c81" },
  { value: "plum", label: "Plum", swatch: "#9c7fae" },
  { value: "rose", label: "Rose", swatch: "#c4758c" },
  { value: "sand", label: "Sand", swatch: "#b0915a" },
  { value: "graphite", label: "Graphite", swatch: "#6b717c" },
  { value: "terracotta", label: "Terracotta", swatch: "#d97757" },
] as const;

export type Palette = (typeof PALETTES)[number]["value"];

export const DEFAULT_PALETTE: Palette = "ocean";

function isPalette(value: unknown): value is Palette {
  return PALETTES.some((p) => p.value === value);
}

/**
 * Same external-store shape as the light/dark preference in theme-toggle.tsx:
 * localStorage is the source of truth and <html data-palette> mirrors it.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed the palette — follow it.
  const onStorage = () => {
    applyPalette(readPalette());
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readPalette(): Palette {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isPalette(stored)) return stored;
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return DEFAULT_PALETTE;
}

function readServerPalette(): Palette {
  return DEFAULT_PALETTE;
}

function applyPalette(palette: Palette) {
  // The default palette is the bare `:root`/`.dark` rules, so it needs no attribute.
  if (palette === DEFAULT_PALETTE) {
    delete document.documentElement.dataset.palette;
  } else {
    document.documentElement.dataset.palette = palette;
  }
}

function setPalette(palette: Palette) {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    /* ignore — the attribute still applies for this page view */
  }
  applyPalette(palette);
  for (const l of listeners) l();
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full ring-1 ring-foreground/15"
      style={{ backgroundColor: color }}
    />
  );
}

export function PalettePicker({ className }: { className?: string }) {
  const palette = useSyncExternalStore(subscribe, readPalette, readServerPalette);
  const current = PALETTES.find((p) => p.value === palette) ?? PALETTES[0];

  return (
    <Select
      items={PALETTES}
      value={palette}
      onValueChange={(next) => {
        if (isPalette(next)) setPalette(next);
      }}
    >
      <SelectTrigger
        aria-label={`Color palette: ${current.label}`}
        className={cn("text-xs", className)}
      >
        <Swatch color={current.swatch} />
        <span className="hidden sm:inline">{current.label}</span>
      </SelectTrigger>
      <SelectContent align="end" className="w-auto min-w-36">
        <SelectGroup>
          {PALETTES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <Swatch color={p.swatch} />
              {p.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
