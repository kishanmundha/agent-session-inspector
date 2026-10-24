"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/client";
import { formatCost, formatNumber, formatPercent, formatTokens } from "@/lib/format";
import { CHARS_PER_TOKEN, mcpServerOf, toolCostUSD, toolLabel } from "@/lib/tool-names";
import type { ToolOutputRow } from "@/lib/providers/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const COLUMNS = ["results", "input", "output", "avg", "largest", "carried", "cost"] as const;

/** Columns left out on a narrow screen; the results page still shows them. */
const NARROW_HIDDEN: Partial<Record<(typeof COLUMNS)[number], string>> = {
  avg: "hidden md:table-cell",
  largest: "hidden md:table-cell",
};

/** Header tooltips for the columns whose meaning is not obvious from the name. */
const TITLES = { input: "inputTitle", carried: "carriedTitle", cost: "costTitle" } as const;

/** Breakdown rows shown under an expanded tool before the rest are counted. */
const CHILD_LIMIT = 10;

const estimate = (chars: number) =>
  formatTokens(Math.round(chars / CHARS_PER_TOKEN)) ?? "0";

type Row = Omit<ToolOutputRow, "commands"> & {
  sessions?: number;
  /** A shell tool's commands. */
  commands?: (ToolOutputRow & { sessions?: number })[];
  /** An MCP server's tools. */
  tools?: (ToolOutputRow & { sessions?: number })[];
};

/** What an expanded row breaks down into: a shell tool's commands, a server's tools. */
const childrenOf = (row: Row) => row.commands ?? row.tools ?? [];

/**
 * What each tool returned to the model and what re-sending it cost, one row
 * per tool or MCP server, with a bar for its share of everything re-sent. A
 * shell tool expands into its commands and an MCP server into its tools.
 */
export function ToolOutputTable({
  rows,
  limit,
  sessions,
  hrefFor,
}: {
  rows: Row[];
  limit?: number;
  /** Adds a sessions column, for ranges that span many sessions. */
  sessions?: boolean;
  /** Makes each tool, server and command name a link to the results behind it. */
  hrefFor?: (target: { tool: string; command?: string }) => string;
}) {
  const t = useT();
  const shown = limit ? rows.slice(0, limit) : rows;
  const carried = rows.reduce((sum, r) => sum + r.carriedTokens, 0);
  const columns = sessions ? (["sessions", ...COLUMNS] as const) : COLUMNS;
  // The heaviest tool starts open when it has a breakdown, so the depth is visible.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    rows[0] && childrenOf(rows[0]).length > 0 ? new Set([rows[0].name]) : new Set(),
  );
  const toggle = (name: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  // A name opens its results when the table offers that, and is plain text otherwise.
  const name = (
    text: string,
    target: { tool: string; command?: string },
    className: string,
    full = text,
  ) =>
    hrefFor ? (
      // Styled like the Requests table's links: the arrow shows on row hover.
      <Link
        href={hrefFor(target)}
        title={t("toolOutput.drill.open", { tool: full })}
        className={cn(
          className,
          "inline-flex min-w-0 items-center gap-1 rounded-sm underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-ring",
        )}
      >
        <span className="truncate">{text}</span>
        <ArrowUpRight
          className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        />
      </Link>
    ) : (
      <span className={cn(className, "truncate")} title={full}>
        {text}
      </span>
    );

  const cells = (row: Row | ToolOutputRow, share: number, child: boolean) => (
    <>
      {sessions && (
        <TableCell className="text-right">
          {"sessions" in row && row.sessions !== undefined ? formatNumber(row.sessions) : "—"}
        </TableCell>
      )}
      <TableCell className="text-right">{formatNumber(row.results)}</TableCell>
      <TableCell className="text-right">{estimate(row.inputChars)}</TableCell>
      <TableCell className="text-right">{estimate(row.chars)}</TableCell>
      <TableCell className={cn("text-right", NARROW_HIDDEN.avg)}>
        {row.results > 0 ? estimate(row.chars / row.results) : "—"}
      </TableCell>
      <TableCell className={cn("text-right", NARROW_HIDDEN.largest)}>
        {estimate(row.largest)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right",
          !child && "font-medium",
          share >= 0.25 && "text-amber-700 dark:text-amber-400",
        )}
      >
        {formatTokens(row.carriedTokens) ?? "—"}
      </TableCell>
      <TableCell className="text-right">
        {toolCostUSD(row) === null ? "—" : formatCost(toolCostUSD(row)!)}
      </TableCell>
    </>
  );

  const shareBar = (share: number, child: boolean) => (
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" title={formatPercent(share)}>
      <div
        className={cn(
          "h-full rounded-full",
          child ? "bg-amber-300/70 dark:bg-amber-600/70" : "bg-amber-400 dark:bg-amber-500",
        )}
        style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%` }}
      />
    </div>
  );

  return (
    <Table className="min-w-[560px]">
      <TableHeader>
        <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
          <TableHead className="text-muted-foreground">
            {t("toolOutput.columns.tool")}
          </TableHead>
          {columns.map((column) => (
            <TableHead
              key={column}
              className={cn(
                "text-right text-muted-foreground",
                column !== "sessions" && NARROW_HIDDEN[column],
              )}
              title={column in TITLES ? t(`toolOutput.${TITLES[column as keyof typeof TITLES]}`) : undefined}
            >
              {t(`toolOutput.columns.${column}`)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {shown.map((row) => {
          const share = carried > 0 ? row.carriedTokens / carried : 0;
          const label = toolLabel(row.name);
          const children = childrenOf(row);
          const open = expanded.has(row.name);
          return (
            <Fragment key={row.name}>
              <TableRow className="group">
                <TableCell className="max-w-64">
                  <div className="flex items-center gap-1.5">
                    {children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggle(row.name)}
                        aria-expanded={open}
                        aria-label={t(open ? "toolOutput.collapse" : "toolOutput.expand", {
                          tool: label,
                        })}
                        className="-ml-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight
                          className={cn("size-3.5 transition-transform", open && "rotate-90")}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <span className="w-3.5 shrink-0" aria-hidden />
                    )}
                    {name(label, { tool: row.name }, "font-mono text-xs")}
                    {mcpServerOf(row.name) !== null && (
                      <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] font-medium uppercase text-muted-foreground">
                        MCP
                      </span>
                    )}
                  </div>
                  <div className="pl-5">{shareBar(share, false)}</div>
                </TableCell>
                {cells(row, share, false)}
              </TableRow>

              {open &&
                children.slice(0, CHILD_LIMIT).map((child) => {
                  const childShare = carried > 0 ? child.carriedTokens / carried : 0;
                  // An MCP tool drops its server, which the parent row names.
                  const isTool = mcpServerOf(child.name) !== null;
                  const childLabel = isTool ? child.name.slice(`${row.name}__`.length) : child.name;
                  const target = isTool
                    ? { tool: child.name }
                    : { tool: row.name, command: child.name };
                  return (
                    <TableRow key={`${row.name}\n${child.name}`} className="group bg-muted/30 text-xs">
                      <TableCell className="max-w-64 py-1.5 pl-9">
                        <span className="flex min-w-0 font-mono text-muted-foreground">
                          {name(childLabel, target, "", `${label} › ${childLabel}`)}
                        </span>
                        {shareBar(childShare, true)}
                      </TableCell>
                      {cells(child, childShare, true)}
                    </TableRow>
                  );
                })}
              {open && children.length > CHILD_LIMIT && (
                <TableRow className="bg-muted/30 text-xs hover:bg-muted/30">
                  <TableCell colSpan={columns.length + 1} className="py-1.5 pl-9 text-muted-foreground">
                    {t("common.more", { count: children.length - CHILD_LIMIT })}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
