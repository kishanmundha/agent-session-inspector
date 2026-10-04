"use client";

import { useMemo, useState } from "react";
import { niceCeil } from "@/components/home/usage-charts";
import { costTimeline } from "@/lib/cost-timeline";
import { firstLine, formatCost } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "./types";

/**
 * Where the cost built up: a bar per turn for what the turn cost, under a line
 * for the session's running total. The caption doubles as the readout, and a
 * bar opens its prompt in the timeline.
 */
export function CostByTurn({
  events,
  partial,
  onOpenEvent,
}: {
  events: AgentEvent[];
  /** Some usage has no price, so every total is a floor. */
  partial: boolean;
  onOpenEvent: (eventId: string) => void;
}) {
  const { turns, totalUSD } = useMemo(() => costTimeline(events), [events]);
  const [hovered, setHovered] = useState<number | null>(null);
  // One turn has no shape to show.
  if (turns.length < 2 || totalUSD <= 0) return null;

  const active = hovered !== null && hovered < turns.length ? hovered : null;
  const turnMax = niceCeil(Math.max(...turns.map((t) => t.costUSD)));
  const totalMax = niceCeil(totalUSD);
  const dearest = turns.reduce((a, b) => (b.costUSD > a.costUSD ? b : a));
  const share = (usd: number) => `${Math.round((usd / totalUSD) * 100)}%`;
  const name = (turn: number) => (turn === 0 ? "Before the first prompt" : `Turn ${turn}`);
  const middle = Math.floor((turns.length - 1) / 2);
  const shown = active === null ? null : turns[active];

  // Drawn in a box one unit wide per turn, so each step lands on its bar.
  const line =
    turns.reduce(
      (path, turn, i) => `${path} H${i + 0.5} V${100 - (turn.totalUSD / totalMax) * 100}`,
      "M0,100",
    ) + ` H${turns.length}`;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Cost by turn
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            a turn is one prompt and everything the agent did to answer it
          </span>
        </h2>
      </div>

      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-emerald-700 dark:text-emerald-400">
          <span>{formatCost(turnMax)}</span>
          <span>{formatCost(turnMax / 2)}</span>
          <span>$0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "relative flex h-40 items-end border-b border-border",
              turns.length > 80 ? "gap-0" : "gap-[2px]",
            )}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            {turns.map((turn, i) => (
              // The full-height button is the hover target, so short bars are easy to hit.
              <button
                key={turn.eventId}
                type="button"
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                onClick={() => onOpenEvent(turn.eventId)}
                aria-label={`${name(turn.turn)}: ${formatCost(turn.costUSD)}, ${formatCost(turn.totalUSD)} so far. Open in the timeline.`}
                className={cn(
                  "relative flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end focus-visible:outline-2 focus-visible:outline-ring",
                  active !== null && active !== i && "opacity-50",
                )}
              >
                {turn.compacted && (
                  <span
                    className="absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rotate-45 bg-amber-500"
                    aria-hidden
                  />
                )}
                <span
                  className="w-full rounded-t-[3px] bg-emerald-500/60 dark:bg-emerald-500/50"
                  style={{
                    height: `${(turn.costUSD / turnMax) * 100}%`,
                    minHeight: turn.costUSD > 0 ? 2 : 0,
                  }}
                />
              </button>
            ))}
            <svg
              className="pointer-events-none absolute inset-0 size-full overflow-visible text-foreground"
              viewBox={`0 0 ${turns.length} 100`}
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{name(turns[0].turn)}</span>
            {turns.length > 4 && <span>{turns[middle].turn}</span>}
            <span>{turns[turns.length - 1].turn}</span>
          </div>
        </div>
        <div className="flex h-40 flex-col justify-between text-[10px] leading-none tabular-nums text-muted-foreground">
          <span>{formatCost(totalMax)}</span>
          <span>{formatCost(totalMax / 2)}</span>
          <span>$0</span>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-medium tabular-nums">
            {shown ? name(shown.turn) : "Whole session"} ·{" "}
            {formatCost(shown ? shown.costUSD : totalUSD)}
            {!shown && partial && "+"}
          </span>
          {shown ? (
            <span className="tabular-nums text-muted-foreground">
              {share(shown.costUSD)} of the session · {shown.requests}{" "}
              {shown.requests === 1 ? "request" : "requests"} ·{" "}
              {formatCost(shown.totalUSD)} so far
              {shown.compacted && " · context compacted"}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px] bg-emerald-500/60" aria-hidden />
                cost of the turn (left axis)
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-3 border-t-2 border-foreground" aria-hidden />
                running total (right axis)
              </span>
              {turns.some((t) => t.compacted) && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rotate-45 bg-amber-500" aria-hidden />
                  context compacted
                </span>
              )}
            </>
          )}
        </div>
        <p className="truncate text-muted-foreground">
          {shown
            ? (firstLine(shown.prompt) ?? "Requests made before the first prompt.")
            : `${name(dearest.turn)} cost the most: ${formatCost(dearest.costUSD)}, ${share(dearest.costUSD)} of the session. Click a bar to open its turn in the timeline.`}
        </p>
      </div>
    </section>
  );
}
