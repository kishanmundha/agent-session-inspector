"use client";

import { useState } from "react";
import { formatCost, formatTokens } from "@/lib/format";
import { METRIC_LABELS, type DayRow, type Metric, type WeekRow } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** One hue, light to dark: empty, then four steps of the brand colour. */
const HEAT = ["bg-muted", "bg-brand/25", "bg-brand/50", "bg-brand/75", "bg-brand"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Square-root scale, so one huge day does not flatten every other day to the lowest step. */
function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.ceil(4 * Math.sqrt(value / max)));
}

export function formatMetric(metric: Metric, value: number): string {
  if (metric === "costUSD") return formatCost(value);
  const amount =
    metric === "outputTokens" ? (formatTokens(value) ?? "0") : value.toLocaleString();
  const unit = METRIC_LABELS[metric].toLowerCase();
  return `${amount} ${value === 1 ? unit.replace(/s$/, "") : unit}`;
}

/** The line under a heatmap: what the pointer is on, and what the shades mean. */
function HeatFooter({ readout, hint }: { readout: string | null; hint: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className={cn("truncate", readout && "text-foreground")} aria-live="polite">
        {readout ?? hint}
      </span>
      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        Less
        {HEAT.map((cls) => (
          <span key={cls} className={cn("size-3 rounded-[3px]", cls)} />
        ))}
        More
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fullDate = (date: Date) =>
  date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** GitHub-style calendar: one column per week, one cell per day. */
export function CalendarHeatmap({ days, metric }: { days: DayRow[]; metric: Metric }) {
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(0, ...days.map((d) => d[metric]));

  // Pad the first week so every column starts on Sunday.
  const cells: (DayRow | null)[] = [
    ...new Array<null>(days[0]?.date.getDay() ?? 0).fill(null),
    ...days,
  ];
  const columns: (DayRow | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  // Short ranges have few columns, so their cells can afford to be larger.
  const cell = columns.length <= 14 ? 20 : columns.length <= 27 ? 16 : 13;

  let lastMonth = -1;
  const monthLabels = columns.map((column) => {
    const first = column.find((d): d is DayRow => d !== null);
    if (!first || first.date.getMonth() === lastMonth) return "";
    lastMonth = first.date.getMonth();
    return first.date.toLocaleDateString([], { month: "short" });
  });

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`${METRIC_LABELS[metric]} per day over ${days.length} days`}
          className="inline-flex gap-[3px]"
          style={{ "--cell": `${cell}px` } as React.CSSProperties}
          onMouseLeave={() => setReadout(null)}
        >
          <div className="mr-1 flex flex-col gap-[3px] pt-[19px] text-[10px] leading-(--cell) text-muted-foreground">
            {WEEKDAYS.map((name, i) => (
              <span key={name} className="h-(--cell)">
                {i % 2 === 1 ? name : ""}
              </span>
            ))}
          </div>
          {columns.map((column, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              <span className="h-4 w-(--cell) overflow-visible whitespace-nowrap text-[10px] text-muted-foreground">
                {monthLabels[i]}
              </span>
              {column.map((day, j) =>
                day ? (
                  <span
                    key={day.day}
                    title={`${fullDate(day.date)}: ${formatMetric(metric, day[metric])}`}
                    onMouseEnter={() =>
                      setReadout(`${fullDate(day.date)} · ${formatMetric(metric, day[metric])}`)
                    }
                    className={cn(
                      "size-(--cell) rounded-[3px] hover:ring-1 hover:ring-foreground/50",
                      HEAT[heatLevel(day[metric], max)],
                    )}
                  />
                ) : (
                  <span key={j} className="size-(--cell)" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <HeatFooter readout={readout} hint="Hover a day for its count" />
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (hour: number) => String(hour % 24).padStart(2, "0");

/** Weekday by hour of day, in the viewer's time zone. */
export function HourHeatmap({ grid, metric }: { grid: number[][]; metric: Metric }) {
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(0, ...grid.flat());

  return (
    <div>
      <div
        role="img"
        aria-label={`${METRIC_LABELS[metric]} by weekday and hour of day`}
        className="grid grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-[3px]"
        onMouseLeave={() => setReadout(null)}
      >
        <span />
        {HOURS.map((hour) => (
          <span key={hour} className="text-center text-[10px] text-muted-foreground">
            {hour % 3 === 0 ? hour : ""}
          </span>
        ))}
        {grid.map((row, weekday) => (
          <div key={weekday} className="contents">
            <span className="pr-1.5 text-[10px] leading-5 text-muted-foreground">
              {WEEKDAYS[weekday]}
            </span>
            {row.map((value, hour) => {
              const text = `${WEEKDAYS[weekday]} ${pad(hour)}:00–${pad(hour + 1)}:00 · ${formatMetric(metric, value)}`;
              return (
                <span
                  key={hour}
                  title={text}
                  onMouseEnter={() => setReadout(text)}
                  className={cn(
                    "h-5 rounded-[3px] hover:ring-1 hover:ring-foreground/50",
                    HEAT[heatLevel(value, max)],
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <HeatFooter
        readout={readout}
        hint={`Times in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
      />
    </div>
  );
}

const shortDate = (date: Date) =>
  date.toLocaleDateString([], { month: "short", day: "numeric" });

/** Tool calls per week: a bar per week on a shared baseline. */
export function WeeklyBars({ weeks }: { weeks: WeekRow[] }) {
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.toolCalls));

  return (
    <div>
      <div
        role="img"
        aria-label={`Tool calls per week over ${weeks.length} weeks`}
        className="flex h-24 items-end gap-[2px] border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {weeks.map((week) => {
          const text = `Week of ${shortDate(week.start)} · ${week.toolCalls.toLocaleString()} tool calls`;
          return (
            // The full-height wrapper is the hover target, so short bars are easy to hit.
            <div
              key={week.start.getTime()}
              title={text}
              onMouseEnter={() => setReadout(text)}
              className="group flex h-full min-w-0 max-w-10 flex-1 items-end"
            >
              <div
                className="w-full rounded-t bg-brand group-hover:bg-brand/75"
                style={{
                  height: week.toolCalls > 0 ? `max(2px, ${(week.toolCalls / max) * 100}%)` : 0,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[10px] text-muted-foreground">
        <span className="shrink-0">{weeks.length > 0 && shortDate(weeks[0].start)}</span>
        <span className={cn("truncate text-xs", readout && "text-foreground")} aria-live="polite">
          {readout ?? `peak ${max.toLocaleString()} calls in a week`}
        </span>
        <span className="shrink-0">
          {weeks.length > 1 && shortDate(weeks[weeks.length - 1].start)}
        </span>
      </div>
    </div>
  );
}
