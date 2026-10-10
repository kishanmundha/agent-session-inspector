"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostByTurn } from "./cost-by-turn";
import { CostDialog } from "./cost-dialog";
import { RequestTable } from "./request-table";
import { formatCost, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentEvent, CostSummary } from "./types";

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

/** What the session cost and where that built up: by class, by turn, by request. */
export function SessionCost({
  cost,
  events,
  onOpenEvent,
}: {
  cost: CostSummary;
  events: AgentEvent[];
  onOpenEvent: (eventId: string) => void;
}) {
  if (cost.byModel.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
        This session recorded no token usage, so there is nothing to price.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <CostSection cost={cost} />
      <CostByTurn
        events={events}
        partial={cost.unpricedModels.length > 0}
        onOpenEvent={onOpenEvent}
      />
      <RequestTable events={events} onOpenEvent={onOpenEvent} />
    </div>
  );
}
