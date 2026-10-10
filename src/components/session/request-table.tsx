"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { costTimeline, type CostRequest } from "@/lib/cost-timeline";
import { firstLine, formatCost, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "./types";

/** Sessions with more requests than this open with their turns collapsed. */
const OPEN_BY_DEFAULT = 60;

const COLUMNS = ["Context", "Uncached input", "Cache write", "Cache read", "Output", "Cost"];

interface Totals {
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  /** Null when nothing summed had a price. */
  costUSD: number | null;
}

function sum(requests: CostRequest[]): Totals {
  const totals: Totals = {
    inputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    costUSD: null,
  };
  for (const r of requests) {
    totals.inputTokens += r.inputTokens;
    totals.cacheWriteTokens += r.cacheWriteTokens;
    totals.cacheReadTokens += r.cacheReadTokens;
    totals.outputTokens += r.outputTokens;
    if (r.costUSD !== null) totals.costUSD = (totals.costUSD ?? 0) + r.costUSD;
  }
  return totals;
}

function Tokens({ value }: { value: number }) {
  return (
    <TableCell className="py-1.5 pr-0 pl-3 text-right" title={value.toLocaleString()}>
      {formatTokens(value) ?? "—"}
    </TableCell>
  );
}

/** The context a request sent, over a bar scaled to the session's largest. */
function Context({ value, max }: { value: number; max: number }) {
  return (
    <TableCell className="py-1.5 pr-0 pl-3 text-right" title={value.toLocaleString()}>
      {formatTokens(value) ?? "—"}
      <span className="mt-0.5 block h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-emerald-500/70"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </span>
    </TableCell>
  );
}

function Cost({ value, className }: { value: number | null; className?: string }) {
  return (
    <TableCell className={cn("py-1.5 pr-0 pl-3 text-right text-foreground", className)}>
      {value === null ? (
        <span className="font-sans font-normal text-muted-foreground">no price</span>
      ) : (
        formatCost(value)
      )}
    </TableCell>
  );
}

/**
 * Every model request in the session, grouped by turn. A turn row adds up its
 * requests; the request rows show the context growing from one to the next,
 * which is what the turn totals hide.
 */
export function RequestTable({
  events,
  onOpenEvent,
}: {
  events: AgentEvent[];
  onOpenEvent: (eventId: string) => void;
}) {
  const { requests, turns } = useMemo(() => costTimeline(events), [events]);
  // null follows the default; a turn in `flipped` is the opposite of the rest.
  const [view, setView] = useState<{ allOpen: boolean | null; flipped: Set<number> }>({
    allOpen: null,
    flipped: new Set(),
  });

  const groups = useMemo(() => {
    const byTurn = new Map<number, CostRequest[]>();
    for (const request of requests) {
      const group = byTurn.get(request.turn);
      if (group) group.push(request);
      else byTurn.set(request.turn, [request]);
    }
    const prompts = new Map(turns.map((t) => [t.turn, t.prompt]));
    return [...byTurn].map(([turn, rows]) => ({
      turn,
      rows,
      prompt: prompts.get(turn),
      totals: sum(rows),
    }));
  }, [requests, turns]);

  // A provider that reports one total for the session has no requests to list.
  if (requests.length < 2) return null;

  const allOpen = view.allOpen ?? requests.length <= OPEN_BY_DEFAULT;
  const isOpen = (turn: number) => allOpen !== view.flipped.has(turn);
  const toggle = (turn: number) =>
    setView(({ allOpen, flipped }) => {
      const next = new Set(flipped);
      if (!next.delete(turn)) next.add(turn);
      return { allOpen, flipped: next };
    });

  const peak = Math.max(...requests.map((r) => r.contextTokens));
  const session = sum(requests);
  const severalModels = new Set(requests.flatMap((r) => r.models)).size > 1;
  const cached = session.cacheReadTokens > 0;
  const anyOpen = groups.some((g) => isOpen(g.turn));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Requests
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            every call to the model, grouped by turn
          </span>
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView({ allOpen: !anyOpen, flipped: new Set() })}
        >
          {anyOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Each tool round is its own request, and every request sends the whole conversation again.{" "}
        <span className="text-foreground">Context</span> is what one request sent: cache read
        (already stored), cache write (new since the last request, stored for the next) and uncached
        input. A turn row adds up its requests, so its cache read is the context multiplied by the
        number of requests, not the size of the context.
      </p>

      <Table className="min-w-[46rem] table-fixed text-xs">
        <colgroup>
          <col />
          {COLUMNS.map((label) => (
            <col key={label} className={label === "Cost" ? "w-20" : "w-24"} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 px-0 text-muted-foreground">Turn / request</TableHead>
            {COLUMNS.map((label) => (
              <TableHead key={label} className="h-8 pr-0 pl-3 text-right text-muted-foreground">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="font-mono tabular-nums">
          {groups.map(({ turn, rows, prompt, totals }) => {
            const open = isOpen(turn);
            const last = rows[rows.length - 1];
            return (
              <Fragment key={turn}>
                <TableRow className="border-border/60 bg-muted/40 font-semibold hover:bg-muted/60">
                  <TableCell className="truncate px-0 py-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => toggle(turn)}
                      aria-expanded={open}
                      className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <ChevronRight
                        className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
                        aria-hidden
                      />
                      <span className="shrink-0">
                        {turn === 0 ? "Before the first prompt" : `Turn ${turn}`}
                      </span>
                      <span className="shrink-0 font-normal tabular-nums text-muted-foreground">
                        {rows.length} {rows.length === 1 ? "request" : "requests"}
                      </span>
                      <span className="min-w-0 truncate font-normal text-muted-foreground">
                        {firstLine(prompt)}
                      </span>
                    </button>
                  </TableCell>
                  {/* Where the context stood when the turn ended; the rest are sums. */}
                  <Context value={last.contextTokens} max={peak} />
                  <Tokens value={totals.inputTokens} />
                  <Tokens value={totals.cacheWriteTokens} />
                  <Tokens value={totals.cacheReadTokens} />
                  <Tokens value={totals.outputTokens} />
                  <Cost value={totals.costUSD} />
                </TableRow>
                {open &&
                  rows.map((r) => {
                    const previous = requests[r.n - 2];
                    // Most of the context was sent fresh though an earlier request had stored it.
                    const missed =
                      cached &&
                      previous !== undefined &&
                      r.cacheReadTokens < previous.contextTokens / 2 &&
                      r.inputTokens + r.cacheWriteTokens > r.cacheReadTokens;
                    return (
                      <TableRow key={r.eventId} className="group border-border/60 text-muted-foreground">
                        <TableCell className="truncate py-1.5 pr-0 pl-5">
                          {/* Only the number navigates, so the row stays free to select and copy. */}
                          <button
                            type="button"
                            onClick={() => onOpenEvent(r.eventId)}
                            aria-label={`Request ${r.n}: open in the timeline`}
                            title="Open in the timeline"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-foreground underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            #{r.n}
                            <ArrowUpRight
                              className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                              aria-hidden
                            />
                          </button>
                          {severalModels && <span className="ml-2">{r.models.join(", ")}</span>}
                          {missed && (
                            <span
                              className="ml-2 rounded-sm bg-amber-500/15 px-1.5 py-0.5 font-sans text-[10px] text-amber-700 dark:text-amber-400"
                              title="Little of the context came from the cache, so it was sent and stored again at the higher rate. This follows a compaction, a change to the early context, or a pause longer than the cache lifetime."
                            >
                              cache miss
                            </span>
                          )}
                        </TableCell>
                        <Context value={r.contextTokens} max={peak} />
                        <Tokens value={r.inputTokens} />
                        <Tokens value={r.cacheWriteTokens} />
                        <Tokens value={r.cacheReadTokens} />
                        <Tokens value={r.outputTokens} />
                        <Cost value={r.costUSD} />
                      </TableRow>
                    );
                  })}
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter className="bg-transparent font-mono tabular-nums">
          <TableRow className="hover:bg-transparent">
            <TableCell className="truncate px-0 py-1.5 font-sans text-foreground">
              Whole session
              <span className="ml-1.5 font-normal text-muted-foreground">
                {requests.length} requests, context peaked at {formatTokens(peak)}
              </span>
            </TableCell>
            <TableCell className="py-1.5 pr-0 pl-3" />
            <Tokens value={session.inputTokens} />
            <Tokens value={session.cacheWriteTokens} />
            <Tokens value={session.cacheReadTokens} />
            <Tokens value={session.outputTokens} />
            <Cost value={session.costUSD} className="font-semibold" />
          </TableRow>
        </TableFooter>
      </Table>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a request number to open it in the timeline. Hover a value for the exact count.
      </p>
    </section>
  );
}
