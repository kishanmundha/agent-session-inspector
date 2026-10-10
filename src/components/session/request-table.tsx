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
import { Segmented } from "@/components/common/segmented";
import { costTimeline, type CostRequest, type RequestClass } from "@/lib/cost-timeline";
import { firstLine, formatCost, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "./types";

/** Sessions with more requests than this open with their turns collapsed. */
const OPEN_BY_DEFAULT = 60;

/** The billed classes, in the order a request spends them. */
const CLASSES: { key: RequestClass; label: string }[] = [
  { key: "input", label: "Uncached input" },
  { key: "cacheWrite", label: "Cache write" },
  { key: "cacheRead", label: "Cache read" },
  { key: "output", label: "Output" },
];

const COLUMNS = ["Context", ...CLASSES.map((c) => c.label), "Cost"];

/** What the class columns show: how many tokens, or what they cost. */
type Unit = "tokens" | "cost";

interface Totals {
  tokens: Record<RequestClass, number>;
  /** Null where nothing summed had a price. */
  usd: Record<RequestClass, number | null>;
  costUSD: number | null;
}

function tokensOf(r: CostRequest): Record<RequestClass, number> {
  return {
    input: r.inputTokens,
    cacheWrite: r.cacheWriteTokens,
    cacheRead: r.cacheReadTokens,
    output: r.outputTokens,
  };
}

function sum(requests: CostRequest[]): Totals {
  const totals: Totals = {
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
    usd: { input: null, cacheWrite: null, cacheRead: null, output: null },
    costUSD: null,
  };
  for (const r of requests) {
    const tokens = tokensOf(r);
    for (const { key } of CLASSES) {
      totals.tokens[key] += tokens[key];
      const usd = r.usd[key];
      if (usd !== null) totals.usd[key] = (totals.usd[key] ?? 0) + usd;
    }
    if (r.costUSD !== null) totals.costUSD = (totals.costUSD ?? 0) + r.costUSD;
  }
  return totals;
}

/** A single class of a single request is often a fraction of a cent. */
function formatFineCost(usd: number) {
  if (usd >= 0.01) return formatCost(usd);
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

/** One cell per billed class, as token counts or as what they cost. */
function Classes({
  tokens,
  usd,
  unit,
  sticky,
}: Pick<Totals, "tokens" | "usd"> & { unit: Unit; sticky?: string }) {
  return CLASSES.map(({ key, label }) => {
    const count = tokens[key];
    const cost = usd[key];
    const priced = cost === null ? "no price" : formatFineCost(cost);
    return (
      <TableCell
        key={key}
        className={cn("py-1.5 pr-0 pl-3 text-right", sticky)}
        title={count > 0 ? `${label}: ${count.toLocaleString()} tokens, ${priced}` : undefined}
      >
        {count === 0 ? (
          "—"
        ) : unit === "tokens" ? (
          formatTokens(count)
        ) : cost === null ? (
          <span className="font-sans">no price</span>
        ) : (
          formatFineCost(cost)
        )}
      </TableCell>
    );
  });
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

// Header and totals stay in view while the rows scroll. A border on a sticky
// cell scrolls away with the table, so the rule is drawn as a shadow.
const STICKY_TOP = "sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]";
const STICKY_BOTTOM = "sticky bottom-0 z-10 bg-card shadow-[inset_0_1px_0_var(--border)]";

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
  const [unit, setUnit] = useState<Unit>("tokens");

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
  const cached = session.tokens.cacheRead > 0;
  const anyOpen = groups.some((g) => isOpen(g.turn));
  const priced = session.costUSD !== null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Requests
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            every call to the model, grouped by turn
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {priced && (
            <Segmented
              label="Show each token class as"
              value={unit}
              onChange={setUnit}
              options={[
                { value: "tokens", label: "Tokens" },
                { value: "cost", label: "Cost" },
              ]}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView({ allOpen: !anyOpen, flipped: new Set() })}
          >
            {anyOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      </div>
      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Each tool round is its own request, and every request sends the whole conversation again.{" "}
        <span className="text-foreground">Context</span> is what one request sent: cache read
        (already stored), cache write (new since the last request, stored for the next) and uncached
        input. A turn row adds up its requests, so its cache read is the context multiplied by the
        number of requests, not the size of the context.
      </p>

      {/* The table scrolls sideways, so it needs its own vertical scroll for the header to stick. */}
      <div className="[&>[data-slot=table-container]]:max-h-[70vh] [&>[data-slot=table-container]]:overflow-y-auto">
        <Table className="min-w-[46rem] table-fixed text-xs">
          <colgroup>
            <col />
            {COLUMNS.map((label) => (
              <col key={label} className={label === "Cost" ? "w-20" : "w-24"} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn("h-8 px-0 text-muted-foreground", STICKY_TOP)}>
                Turn / request
              </TableHead>
              {COLUMNS.map((label) => (
                <TableHead
                  key={label}
                  className={cn("h-8 pr-0 pl-3 text-right text-muted-foreground", STICKY_TOP)}
                >
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
                    <Classes tokens={totals.tokens} usd={totals.usd} unit={unit} />
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
                          <Classes tokens={tokensOf(r)} usd={r.usd} unit={unit} />
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
              <TableCell className={cn("truncate px-0 py-1.5 font-sans text-foreground", STICKY_BOTTOM)}>
                Whole session
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {requests.length} requests, context peaked at {formatTokens(peak)}
                </span>
              </TableCell>
              <TableCell className={cn("py-1.5 pr-0 pl-3", STICKY_BOTTOM)} />
              <Classes tokens={session.tokens} usd={session.usd} unit={unit} sticky={STICKY_BOTTOM} />
              <Cost value={session.costUSD} className={cn("font-semibold", STICKY_BOTTOM)} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a request number to open it in the timeline. Hover a value for its exact token count
        and cost{priced && ", or switch the columns between tokens and cost"}.
      </p>
    </section>
  );
}
