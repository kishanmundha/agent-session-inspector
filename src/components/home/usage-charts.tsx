"use client";

import { useState } from "react";
import { formatCost, formatTokens } from "@/lib/format";
import type { Amount, Unit, UsagePeriod } from "@/lib/usage";
import { cn } from "@/lib/utils";

/** One coloured group in the usage charts: a project, a model or an agent. */
export interface Series {
  /** Key into a period's breakdown; `OTHER` gathers everything past the top few. */
  name: string;
  label: string;
  color: string;
}

export const OTHER = "\u0000other";
export const OTHER_COLOR = "color-mix(in srgb, var(--muted-foreground) 45%, transparent)";

/** The theme's categorical colours, in their fixed order. */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function formatUnit(unit: Unit, value: number): string {
  return unit === "costUSD" ? formatCost(value) : (formatTokens(value) ?? "0");
}

/** The next round multiple of a power of ten, so the axis ticks land on round numbers. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

const shortDate = (date: Date) => date.toLocaleDateString([], { month: "short", day: "numeric" });

function periodLabel(period: UsagePeriod): string {
  if (period.days === 1) {
    return period.start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }
  return `Week of ${shortDate(period.start)}`;
}

/** A period's value for each series, with everything unlisted folded into `OTHER`. */
function split(breakdown: Record<string, Amount>, series: Series[], unit: Unit) {
  const named = new Set(series.map((s) => s.name));
  let other = 0;
  for (const [name, amount] of Object.entries(breakdown)) {
    if (!named.has(name)) other += amount[unit];
  }
  return series.map((s) => (s.name === OTHER ? other : (breakdown[s.name]?.[unit] ?? 0)));
}

/**
 * Usage per period as stacked bars. The legend doubles as the readout: it
 * shows range totals, or one period's split while the pointer is on its bar.
 */
export function StackedBars({
  periods,
  breakdownOf,
  series,
  unit,
}: {
  periods: UsagePeriod[];
  breakdownOf: (period: UsagePeriod) => Record<string, Amount>;
  series: Series[];
  unit: Unit;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceCeil(Math.max(0, ...periods.map((p) => p[unit])));
  const values = periods.map((p) => split(breakdownOf(p), series, unit));

  const active = hovered !== null && hovered < periods.length ? hovered : null;
  const totals = series.map((_, i) => values.reduce((sum, row) => sum + row[i], 0));
  const shown = active === null ? totals : values[active];
  const shownTotal = shown.reduce((sum, v) => sum + v, 0);
  const middle = Math.floor((periods.length - 1) / 2);

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-48 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-muted-foreground">
          <span>{formatUnit(unit, max)}</span>
          <span>{formatUnit(unit, max / 2)}</span>
          <span>{formatUnit(unit, 0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`${unit === "costUSD" ? "Cost" : "Tokens"} per ${periods[0]?.days === 1 ? "day" : "week"} over ${periods.length} bars`}
            className="relative flex h-48 items-end gap-[2px] border-b border-border"
            onMouseLeave={() => setHovered(null)}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            {periods.map((period, i) => (
              // The full-height wrapper is the hover target, so short bars are easy to hit.
              <div
                key={period.start.getTime()}
                onMouseEnter={() => setHovered(i)}
                className={cn(
                  "relative flex h-full min-w-0 max-w-12 flex-1 flex-col-reverse",
                  active !== null && active !== i && "opacity-50",
                )}
              >
                {series.map((s, j) =>
                  values[i][j] > 0 ? (
                    <div
                      key={s.name}
                      // The card-coloured top edge separates stacked segments.
                      className="w-full shrink-0 border-t-2 border-card first:border-t-0 last:rounded-t-[3px]"
                      style={{
                        height: `${(values[i][j] / max) * 100}%`,
                        minHeight: 2,
                        background: s.color,
                      }}
                    />
                  ) : null,
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{periods.length > 0 && shortDate(periods[0].start)}</span>
            {periods.length > 4 && <span>{shortDate(periods[middle].start)}</span>}
            <span>{periods.length > 1 && shortDate(periods[periods.length - 1].start)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" aria-live="polite">
        <span className="font-medium tabular-nums">
          {active === null ? "Whole range" : periodLabel(periods[active])} ·{" "}
          {formatUnit(unit, shownTotal)}
        </span>
        {series.map((s, i) => (
          <span key={s.name} className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="max-w-40 truncate" title={s.label}>
              {s.label}
            </span>
            <span className="tabular-nums text-foreground">{formatUnit(unit, shown[i])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Squarified treemap layout: fills rows along the shorter side while that
 * keeps tiles close to square. `values` must be sorted largest first.
 */
function squarify(values: number[], width: number, height: number): Rect[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return [];
  const areas = values.map((v) => (v / total) * width * height);
  const rects: Rect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let i = 0;

  while (i < areas.length) {
    const side = Math.min(w, h);
    // Worst aspect ratio in a row of the given sum, smallest and largest tile.
    const worst = (sum: number, min: number, largest: number) =>
      Math.max((side * side * largest) / (sum * sum), (sum * sum) / (side * side * min));
    let sum = areas[i];
    let end = i + 1;
    while (end < areas.length) {
      const next = sum + areas[end];
      if (worst(next, areas[end], areas[i]) > worst(sum, areas[end - 1], areas[i])) break;
      sum = next;
      end++;
    }

    const thickness = sum / side;
    let offset = 0;
    for (let j = i; j < end; j++) {
      const length = areas[j] / thickness;
      rects.push(
        w >= h
          ? { x, y: y + offset, w: thickness, h: length }
          : { x: x + offset, y, w: length, h: thickness },
      );
      offset += length;
    }
    if (w >= h) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    i = end;
  }
  return rects;
}

export interface TreemapItem {
  name: string;
  label: string;
  value: number;
  color: string;
}

// Layout space for the treemap; the tile positions are percentages of it.
const MAP_W = 100;
const MAP_H = 56;

/** Share of the total as nested tiles, largest first. */
export function Treemap({ items, unit }: { items: TreemapItem[]; unit: Unit }) {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const rects = squarify(
    sorted.map((item) => item.value),
    MAP_W,
    MAP_H,
  );

  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
      role="img"
      aria-label={`Share of ${unit === "costUSD" ? "cost" : "tokens"} across ${sorted.length} groups`}
    >
      {sorted.map((item, i) => {
        const rect = rects[i];
        const share = item.value / total;
        return (
          <div
            key={item.name}
            title={`${item.label}: ${formatUnit(unit, item.value)} (${(share * 100).toFixed(1)}%)`}
            className="absolute p-px"
            style={{
              left: `${(rect.x / MAP_W) * 100}%`,
              top: `${(rect.y / MAP_H) * 100}%`,
              width: `${(rect.w / MAP_W) * 100}%`,
              height: `${(rect.h / MAP_H) * 100}%`,
            }}
          >
            <div
              className="size-full overflow-hidden rounded-[4px] border-l-[3px] px-1.5 py-1 hover:ring-1 hover:ring-foreground/50"
              style={{
                // A tint of the series colour, so labels keep their normal ink.
                background: `color-mix(in srgb, ${item.color} 28%, var(--card))`,
                borderColor: item.color,
              }}
            >
              {/* Tiles too small for a label still carry it in the tooltip and the list. */}
              {rect.w > 14 && rect.h > 11 && (
                <>
                  <span className="block truncate text-xs font-medium">{item.label}</span>
                  <span className="block truncate text-[11px] tabular-nums text-muted-foreground">
                    {formatUnit(unit, item.value)} · {(share * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
