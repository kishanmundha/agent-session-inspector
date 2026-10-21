"use client";

import { Fragment, useMemo, useState } from "react";
import { niceCeil } from "@/components/home/usage-charts";
import { costTimeline } from "@/lib/cost-timeline";
import { firstLine, formatCost, formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { COST_KINDS, formatRate } from "./cost-dialog";
import type { AgentEvent } from "./types";

/** Receipt order: what was sent, then what came back. */
const KINDS: string[] = COST_KINDS;

/**
 * Where the cost built up: a bar per turn for what the turn cost, under a line
 * for the session's running total. A bar shows the turn's receipt while it is
 * hovered, and opens its prompt in the timeline.
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
  const t = useT();
  const { turns, totalUSD, inheritedUSD } = useMemo(() => costTimeline(events), [events]);
  const [hovered, setHovered] = useState<number | null>(null);
  // One turn has no shape to show.
  if (turns.length < 2 || totalUSD <= 0) return null;

  const active = hovered !== null && hovered < turns.length ? hovered : null;
  const turnMax = niceCeil(Math.max(...turns.map((turn) => turn.costUSD)));
  const totalMax = niceCeil(totalUSD);
  const dearest = turns.reduce((a, b) => (b.costUSD > a.costUSD ? b : a));
  const share = (usd: number) => formatPercent(usd / totalUSD);
  const name = (turn: number) =>
    turn === 0 ? t("costByTurn.beforeFirst") : t("costByTurn.turn", { turn });
  const middle = Math.floor((turns.length - 1) / 2);
  const shown = active === null ? null : turns[active];
  const models = shown ? [...new Set(shown.lines.map((l) => l.model))] : [];
  // Where the hovered bar sits, 0 to 100, to hang its receipt under it.
  const at = active === null ? 0 : ((active + 0.5) / turns.length) * 100;

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
          {t("costByTurn.title")}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("costByTurn.subtitle")}
          </span>
        </h2>
      </div>

      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-emerald-700 dark:text-emerald-400">
          <span>{formatCost(turnMax)}</span>
          <span>{formatCost(turnMax / 2)}</span>
          <span>{formatCost(0)}</span>
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
                aria-label={t("costByTurn.barLabel", {
                  name: name(turn.turn),
                  cost: formatCost(turn.costUSD),
                  total: formatCost(turn.totalUSD),
                })}
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
            {shown && (
              // Shifted left by as much as it is pushed right, so it never leaves the plot.
              <div
                role="status"
                className="pointer-events-none absolute top-full z-20 mt-2 w-80 max-w-full rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
                style={{ left: `${at}%`, transform: `translateX(-${at}%)` }}
              >
                <div className="flex items-baseline justify-between gap-3 tabular-nums">
                  <span className="font-semibold">
                    {name(shown.turn)} · {formatCost(shown.costUSD)}
                  </span>
                  <span className="text-muted-foreground">
                    {t("costByTurn.ofSession", { percent: share(shown.costUSD) })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-muted-foreground">
                  {firstLine(shown.prompt) ?? t("costByTurn.beforeFirstDetail")}
                </p>
                <table className="mt-2 w-full border-t border-border tabular-nums">
                  <thead>
                    <tr className="text-[10px] text-muted-foreground">
                      <th className="pt-1.5 pb-0.5 text-left font-normal">
                        {t("cost.tokenType")}
                      </th>
                      <th className="pt-1.5 pb-0.5 text-right font-normal">
                        {t("usage.units.tokens")}
                      </th>
                      <th className="pt-1.5 pb-0.5 text-right font-normal">
                        {t("cost.ratePerMillion")}
                      </th>
                      <th className="pt-1.5 pb-0.5 text-right font-normal">
                        {t("usage.units.costUSD")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <Fragment key={model}>
                        {models.length > 1 && (
                          <tr>
                            <th
                              colSpan={4}
                              scope="rowgroup"
                              className="max-w-0 truncate pt-1.5 text-left font-mono font-semibold"
                            >
                              {model}
                            </th>
                          </tr>
                        )}
                        {shown.lines
                          .filter((line) => line.model === model)
                          .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
                          .map((line) => (
                            <tr key={`${line.kind}-${line.rate}`}>
                              <td className="py-0.5">{t(`cost.classes.${line.kind}`)}</td>
                              <td className="py-0.5 pl-2 text-right font-mono">
                                {formatNumber(line.tokens)}
                              </td>
                              <td className="py-0.5 pl-2 text-right font-mono text-muted-foreground">
                                {line.rate === null ? "—" : formatRate(line.rate)}
                              </td>
                              <td className="py-0.5 pl-2 text-right font-mono">
                                {line.usd === null ? (
                                  <span className="font-sans text-muted-foreground">
                                    {t("cost.noPrice")}
                                  </span>
                                ) : (
                                  formatCost(line.usd)
                                )}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 border-t border-border pt-1.5 tabular-nums text-muted-foreground">
                  {models.length === 1 && <span className="font-mono">{models[0]} · </span>}
                  {t("costByTurn.requests", { count: shown.requests })} ·{" "}
                  {t("costByTurn.soFar", { amount: formatCost(shown.totalUSD) })}
                  {shown.compacted && ` · ${t("costByTurn.compacted")}`}
                </p>
              </div>
            )}
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
          <span>{formatCost(0)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-medium tabular-nums">
            {t("costByTurn.wholeSession", { amount: formatCost(totalUSD) })}
            {partial && "+"}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-[3px] bg-emerald-500/60" aria-hidden />
            {t("costByTurn.legendTurn")}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 border-t-2 border-foreground" aria-hidden />
            {t("costByTurn.legendTotal")}
          </span>
          {turns.some((turn) => turn.compacted) && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rotate-45 bg-amber-500" aria-hidden />
              {t("costByTurn.compacted")}
            </span>
          )}
        </div>
        <p className="truncate text-muted-foreground">
          {t("costByTurn.dearest", {
            name: name(dearest.turn),
            amount: formatCost(dearest.costUSD),
            percent: share(dearest.costUSD),
          })}
        </p>
        {inheritedUSD > 0 && (
          <p className="text-muted-foreground">
            {t("costByTurn.notCharted", { amount: formatCost(inheritedUSD) })}
          </p>
        )}
      </div>
    </section>
  );
}
