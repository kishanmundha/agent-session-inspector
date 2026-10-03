"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarList } from "@/components/common/bar-list";
import { CostDialog } from "./cost-dialog";
import { formatCost, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CostSummary,
  SessionStats,
  TokenAnalysis,
  TokenHint,
} from "./types";

const SEVERITY = {
  high: {
    label: "High impact",
    Icon: TriangleAlert,
    card: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    icon: "text-red-600 dark:text-red-400",
  },
  medium: {
    label: "Medium impact",
    Icon: TriangleAlert,
    card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    icon: "text-amber-600 dark:text-amber-400",
  },
  low: {
    label: "Info",
    Icon: Info,
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

const SEVERITY_ORDER = ["high", "medium", "low"] as const;

/** Where the money went: by token class, then by model. */
function CostSection({ cost }: { cost: CostSummary }) {
  const [detailOpen, setDetailOpen] = useState(false);
  if (cost.byModel.length === 0) return null;

  const classes = [
    {
      label: "Output",
      note: "replies + reasoning",
      usd: cost.breakdown.output,
      bar: "bg-sky-400 dark:bg-sky-500",
    },
    {
      label: "Cache writes",
      note: "new context stored",
      usd: cost.breakdown.cacheWrite,
      bar: "bg-amber-400 dark:bg-amber-500",
    },
    {
      label: "Cache reads",
      note: "context re-sent each turn",
      usd: cost.breakdown.cacheRead,
      bar: "bg-emerald-400 dark:bg-emerald-500",
    },
    {
      label: "Uncached input",
      usd: cost.breakdown.input,
      bar: "bg-red-400 dark:bg-red-500",
    },
  ].filter((c) => c.usd > 0);

  const cacheRead = cost.byModel.reduce((sum, m) => sum + m.cacheReadTokens, 0);
  const allInput = cost.byModel.reduce(
    (sum, m) => sum + m.inputTokens + m.cacheWriteTokens + m.cacheReadTokens,
    0,
  );
  const partial = cost.unpricedModels.length > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">Estimated cost</h2>
        <span className="font-mono text-lg font-bold tabular-nums text-foreground">
          {formatCost(cost.totalUSD)}
          {partial && "+"}
        </span>
      </div>

      {cost.totalUSD > 0 && (
        <>
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {classes.map(({ label, usd, bar }) => (
              <div
                key={label}
                className={bar}
                style={{ width: `${(usd / cost.totalUSD) * 100}%` }}
              />
            ))}
          </div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {classes.map(({ label, note, usd, bar }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className={cn("size-2 shrink-0 rounded-full", bar)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {label}
                  {note && (
                    <span className="ml-1 hidden text-muted-foreground sm:inline">
                      ({note})
                    </span>
                  )}
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCost(usd)}
                </span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">
                  {Math.round((usd / cost.totalUSD) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-border pt-1.5">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Model", "Input", "Cache write", "Cache read", "Output", "Cost"].map(
                (label, i) => (
                  <TableHead
                    key={label}
                    className={cn("h-8 px-0 text-muted-foreground", i > 0 && "pl-3 text-right")}
                  >
                    {label}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono tabular-nums">
            {cost.byModel.map((m) => (
              <TableRow key={m.model} className="border-border/60">
                <TableCell className="px-0 py-1.5 text-foreground">{m.model}</TableCell>
                <TableCell className="py-1.5 pr-0 pl-3 text-right">
                  {formatTokens(m.inputTokens) ?? "—"}
                </TableCell>
                <TableCell className="py-1.5 pr-0 pl-3 text-right">
                  {formatTokens(m.cacheWriteTokens) ?? "—"}
                </TableCell>
                <TableCell className="py-1.5 pr-0 pl-3 text-right">
                  {formatTokens(m.cacheReadTokens) ?? "—"}
                </TableCell>
                <TableCell className="py-1.5 pr-0 pl-3 text-right">
                  {formatTokens(m.outputTokens) ?? "—"}
                </TableCell>
                <TableCell className="py-1.5 pr-0 pl-3 text-right font-semibold text-foreground">
                  {m.costUSD === null ? (
                    <span className="font-sans font-normal text-muted-foreground">
                      no price
                    </span>
                  ) : (
                    formatCost(m.costUSD)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {allInput > 0 && cacheRead > 0 && (
          <>
            {Math.round((cacheRead / allInput) * 100)}% of input was served from
            cache.{" "}
          </>
        )}
        API-equivalent estimate at list prices on the day of each request, not a
        bill: subscription and request-based plans charge differently.{" "}
        <Button
          variant="link"
          onClick={() => setDetailOpen(true)}
          aria-haspopup="dialog"
          className="inline h-auto rounded-sm p-0 text-xs text-foreground underline underline-offset-2 hover:text-brand"
        >
          See the rates and arithmetic
        </Button>
        {partial && (
          <>
            {" "}
            No price is known for {cost.unpricedModels.join(", ")}, so the total
            leaves {cost.unpricedModels.length > 1 ? "them" : "it"} out; add one in{" "}
            <code className="font-mono">~/.agent-session-inspector/pricing.json</code>.
          </>
        )}
      </p>
      <CostDialog cost={cost} open={detailOpen} onOpenChange={setDetailOpen} />
    </section>
  );
}

export function TokenOptimizer({
  analysis,
  stats,
  cost,
  eventTypeCounts,
  onFocusHint,
}: {
  analysis: TokenAnalysis;
  stats: SessionStats;
  cost: CostSummary;
  eventTypeCounts: { name: string; value: number }[];
  onFocusHint: (focus: NonNullable<TokenHint["focus"]>) => void;
}) {
  const breakdown = [
    {
      label: "System context",
      note: "agent managed",
      chars: analysis.systemContextChars,
      bar: "bg-red-400 dark:bg-red-500",
      text: "text-red-700 dark:text-red-400",
    },
    {
      label: "Tool results",
      chars: analysis.toolResultChars,
      bar: "bg-amber-400 dark:bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
    },
    {
      label: "Assistant replies",
      chars: analysis.assistantChars,
      bar: "bg-sky-400 dark:bg-sky-500",
      text: "text-sky-700 dark:text-sky-400",
    },
  ];
  const totalChars = breakdown.reduce((sum, b) => sum + b.chars, 0);

  const sortedHints = SEVERITY_ORDER.flatMap((sev) =>
    analysis.hints.filter((h) => h.severity === sev),
  );

  return (
    <div className="space-y-6">
      <CostSection cost={cost} />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Context usage breakdown
        </h2>

        {totalChars === 0 ? (
          <p className="text-xs text-muted-foreground">
            No measurable context recorded for this session.
          </p>
        ) : (
          <>
            {/* Single stacked bar gives the at-a-glance split... */}
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {breakdown.map(({ label, chars, bar }) => (
                <div
                  key={label}
                  className={bar}
                  style={{ width: `${(chars / totalChars) * 100}%` }}
                />
              ))}
            </div>

            {/* ...the rows carry the exact numbers. */}
            <div className="space-y-2.5">
              {breakdown.map(({ label, note, chars, bar, text }) => {
                const pct = Math.round((chars / totalChars) * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2 sm:w-60">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", bar)}
                        aria-hidden
                      />
                      <span className="truncate text-xs text-foreground">
                        {label}
                        {note && (
                          <span className="ml-1 hidden text-muted-foreground sm:inline">
                            ({note})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-20 text-right font-mono text-xs font-semibold tabular-nums",
                        text,
                      )}
                    >
                      {(chars / 1000).toFixed(0)}K chars
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          {[
            {
              label: "Output tokens",
              value:
                stats.totalOutputTokens > 0
                  ? `${(stats.totalOutputTokens / 1000).toFixed(1)}K`
                  : "—",
            },
            {
              label: "Input tokens",
              value:
                stats.totalInputTokens > 0
                  ? `${(stats.totalInputTokens / 1000).toFixed(1)}K`
                  : "N/A (active)",
            },
            { label: "Compactions", value: String(analysis.compactionCount) },
            { label: "Hook events", value: String(analysis.hookEventCount) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-base font-bold tabular-nums text-foreground">
                {value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Tool usage</h3>
          <BarList
            items={analysis.topToolsByCount.map(({ name, count }) => ({
              name,
              value: count,
            }))}
            color="bg-chart-3"
            emptyLabel="No tool calls recorded."
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Event types</h3>
          <BarList
            items={eventTypeCounts}
            color="bg-brand-2"
            limit={10}
            emptyLabel="No events recorded."
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb className="size-4 text-brand" aria-hidden />
          Optimization hints
          {sortedHints.length > 0 && (
            <span className="rounded-sm bg-muted px-1.5 text-xs font-normal tabular-nums text-muted-foreground">
              {sortedHints.length}
            </span>
          )}
        </h2>

        {sortedHints.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-foreground">
              No issues detected in this session&rsquo;s context usage.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedHints.map((hint) => {
              const cfg = SEVERITY[hint.severity];
              return (
                <article
                  key={`${hint.category}-${hint.title}`}
                  className={cn("rounded-xl border p-4", cfg.card)}
                >
                  <div className="flex items-start gap-3">
                    <cfg.Icon
                      className={cn("mt-0.5 size-4 shrink-0", cfg.icon)}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {hint.category}
                        </span>
                        <span className="sr-only">{cfg.label}</span>
                        {hint.saving && (
                          <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                            save ~{hint.saving}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {hint.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {hint.description}
                      </p>
                      {hint.focus && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => hint.focus && onFocusHint(hint.focus)}
                          className="mt-2.5"
                        >
                          View related events
                          <ArrowRight data-icon="inline-end" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
