"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/common/option-select";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/common/skeleton";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import { ToolArguments, ToolResultView } from "@/components/session/EventsTimeline";
import { useT } from "@/i18n/client";
import { RANGES, addDays, startOfDay, type RangeValue } from "@/lib/analytics";
import { formatCost, formatDateTime, formatNumber, formatTokens } from "@/lib/format";
import { providerStyle } from "@/lib/provider-meta";
import { CHARS_PER_TOKEN, mcpServerOf, toolCostUSD, toolLabel } from "@/lib/tool-names";
import { DEFAULT_RANGE } from "@/lib/home-filters";
import { useQueryParam } from "@/lib/use-tab-param";
import type {
  AgentEvent,
  ProviderId,
  ToolResult,
  ToolResultSession,
  ToolResultsResponse,
} from "@/lib/providers/types";
import { cn } from "@/lib/utils";

/** The row a page was opened from: a tool, an MCP server, or one command. */
export interface ToolResultsTarget {
  tool: string;
  command?: string;
}

/** The dashboard filters a Tool output row was counted under. */
export interface ToolResultsFilters {
  range: string;
  project: string;
  provider: string;
  model: string;
}

/** Where the page for one Tool output row lives, carrying the dashboard's filters. */
export function toolResultsHref(target: ToolResultsTarget, filters: ToolResultsFilters): string {
  const params = new URLSearchParams({ tool: target.tool });
  if (target.command !== undefined) params.set("command", target.command);
  if (filters.range !== DEFAULT_RANGE) params.set("range", filters.range);
  if (filters.project !== "all") params.set("project", filters.project);
  if (filters.provider !== "all") params.set("agent", filters.provider);
  if (filters.model !== "all") params.set("model", filters.model);
  return `/tool-output?${params}`;
}

/** Back to Analytics with the same filters, which the home tabs read from the same names. */
function backHref(filters: ToolResultsFilters): string {
  const params = new URLSearchParams({ tab: "analytics" });
  if (filters.range !== DEFAULT_RANGE) params.set("range", filters.range);
  if (filters.project !== "all") params.set("project", filters.project);
  if (filters.provider !== "all") params.set("agent", filters.provider);
  if (filters.model !== "all") params.set("model", filters.model);
  return `/?${params}`;
}

type View = "results" | "sessions";

const VIEWS: View[] = ["results", "sessions"];


/** How many results a list shows; the totals cover every one. */
const RESULT_LIMIT = 200;

const estimate = (chars: number) => formatTokens(Math.round(chars / CHARS_PER_TOKEN)) ?? "0";
/** Re-sending plus writing the input, as the Tool output table counts cost. */
const totalCost = (row: { carriedUSD: number | null; inputUSD: number | null }) => {
  const usd = toolCostUSD(row);
  return usd === null ? "—" : formatCost(usd);
};
const eventHref = (provider: string, id: string, eventId: string) =>
  `/sessions/${provider}/${encodeURIComponent(id)}?event=${encodeURIComponent(eventId)}`;
const sessionKey = (provider: string, id: string) => `${provider}\n${id}`;

/** Columns left out on a phone, so re-sent and cost stay in view. */
const NARROW_HIDDEN: Partial<Record<string, string>> = {
  input: "hidden sm:table-cell",
  output: "hidden sm:table-cell",
  results: "hidden sm:table-cell",
};

/** An MCP tool without its server, which the page's title already names. */
const shortTool = (key: string) => {
  const server = mcpServerOf(key);
  return server === null ? key : key.slice(`mcp__${server}__`.length) || server;
};

/** Fetches JSON for as long as `url` is the one asked for; null on failure. */
function useJson<T>(url: string | null): { data: T | null; loading: boolean } {
  const [loaded, setLoaded] = useState<{ url: string; data: T | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setLoaded({ url, data });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = loaded?.url === url ? loaded : null;
  return { data: current?.data ?? null, loading: url !== null && !current };
}

/**
 * Rows opened in place, remembered for this browser tab under the page's own
 * address, so coming back from a session finds them as they were left.
 */
function useOpenRows(scope: string): [Set<string>, (key: string) => void] {
  const storageKey = `asv-tool-output-open:${scope}`;
  const [state, setState] = useState<{ scope: string; open: Set<string> }>(() => ({
    scope,
    open: readOpen(storageKey),
  }));
  // A different row or filter starts from what was left open there.
  const open = state.scope === scope ? state.open : readOpen(storageKey);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      setState({ scope, open: next });
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* storage unavailable: rows stay open until the page is left */
      }
    },
    [open, scope, storageKey],
  );
  return [open, toggle];
}

function readOpen(storageKey: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Every result behind one Tool output row, under the dashboard's filters: by
 * result or by session, each opening in place to show what the call asked
 * and what came back. Everything that picks what is shown lives in the URL.
 */
export function ToolResultsView() {
  const t = useT();
  const params = useSearchParams();
  const tool = params.get("tool") ?? "";
  const command = params.get("command") ?? undefined;
  const [range, setRange] = useQueryParam("range", DEFAULT_RANGE);
  const [project, setProject] = useQueryParam("project", "all");
  const [provider, setProvider] = useQueryParam("agent", "all");
  const [model, setModel] = useQueryParam("model", "all");
  const [viewParam, setView] = useQueryParam("view", "results");
  const view: View = viewParam === "sessions" ? "sessions" : "results";
  const rangeValue = (RANGES.some((r) => r.value === range) ? range : DEFAULT_RANGE) as RangeValue;
  const days = RANGES.find((r) => r.value === rangeValue)?.days ?? null;

  const query = useMemo(() => {
    if (!tool) return null;
    const since = days === null ? null : addDays(startOfDay(new Date()), 1 - days).getTime();
    return new URLSearchParams({
      tool,
      ...(command !== undefined ? { command } : {}),
      ...(since !== null ? { from: String(since) } : {}),
      provider,
      project,
      model,
    }).toString();
  }, [tool, command, days, provider, project, model]);
  const { data, loading } = useJson<ToolResultsResponse>(
    query ? `/api/tool-output?${query}&limit=${RESULT_LIMIT}` : null,
  );
  const [open, toggle] = useOpenRows(query ?? "");

  const label = command ? `${toolLabel(tool)} › ${command}` : toolLabel(tool);
  const filters = [
    { name: t("home.project"), value: project, clear: () => setProject("all") },
    {
      name: t("filters.agent"),
      value: provider === "all" ? provider : providerStyle(provider as ProviderId).shortLabel,
      clear: () => setProvider("all"),
    },
    { name: t("filters.model"), value: model, clear: () => setModel("all") },
  ].filter((f) => f.value !== "all");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href={backHref({ range: rangeValue, project, provider, model })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("toolOutput.drill.back")}
        </Link>
        <h1 className="break-all font-mono text-xl font-semibold">{label || "—"}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("toolOutput.drill.intro", {
            period: t(`rangePeriods.${rangeValue}`),
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect
          value={rangeValue}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
          aria-label={t("filters.dateRange")}
        />
        {filters.map((filter) => (
          <span
            key={filter.name}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card pl-2.5 pr-1 text-xs"
          >
            <span className="text-muted-foreground">{filter.name}</span>
            <span className="max-w-48 truncate font-medium">{filter.value}</span>
            <button
              type="button"
              onClick={filter.clear}
              aria-label={t("toolOutput.drill.clearFilter", { name: filter.name })}
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy>
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-[86px] rounded-xl" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-md" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t("toolOutput.drill.loadError")}</p>
      ) : data.total.results === 0 ? (
        <p className="text-sm text-muted-foreground">{t("toolOutput.drill.empty")}</p>
      ) : (
        <>
          <StatCardGrid>
            <StatCard label={t("toolOutput.columns.carried")} value={formatTokens(data.total.carriedTokens) ?? "0"} accent />
            <StatCard label={t("toolOutput.columns.cost")} value={totalCost(data.total)} />
            <StatCard label={t("toolOutput.columns.results")} value={formatNumber(data.total.results)} />
            <StatCard label={t("toolOutput.columns.sessions")} value={formatNumber(data.total.sessions)} />
            <StatCard label={t("toolOutput.columns.input")} value={estimate(data.total.inputChars)} />
            <StatCard label={t("toolOutput.columns.output")} value={estimate(data.total.chars)} />
          </StatCardGrid>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label={t("toolOutput.drill.view")}
                value={view}
                onChange={(next) => setView(next)}
                options={VIEWS.map((value) => ({ value, label: t(`toolOutput.drill.${value}`) }))}
              />
              {view === "results" && data.results.length < data.total.results && (
                <span className="text-xs text-muted-foreground">
                  {t("toolOutput.drill.showing", {
                    shown: formatNumber(data.results.length),
                    total: formatNumber(data.total.results),
                  })}
                </span>
              )}
            </div>
            {view === "results" ? (
              <ResultsTable
                results={data.results}
                sessions={data.sessions}
                open={open}
                toggle={toggle}
              />
            ) : (
              <SessionsTable data={data} query={query ?? ""} open={open} toggle={toggle} />
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t("toolOutput.drill.totalsNote")}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function SessionLine({
  provider,
  label,
  project,
  timestamp,
}: {
  provider: ProviderId;
  label?: string;
  project?: string;
  timestamp?: string;
}) {
  const parts = [label, project, timestamp ? formatDateTime(timestamp) : undefined].filter(Boolean);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={cn("size-2 shrink-0 rounded-full", providerStyle(provider).dotCls)}
        aria-hidden
      />
      <span className="min-w-0 truncate text-muted-foreground">{parts.join(" · ")}</span>
    </span>
  );
}

/** The chevron that opens a row in place. */
function Expander({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={t(open ? "toolOutput.drill.collapseRow" : "toolOutput.drill.expandRow", {
        name: label,
      })}
      className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden />
    </button>
  );
}

type ResultRow = ToolResultsResponse["results"][number];

function ResultsTable({
  results,
  sessions,
  open,
  toggle,
  nested,
}: {
  results: ResultRow[];
  sessions: ToolResultSession[];
  open: Set<string>;
  toggle: (key: string) => void;
  /** Inside a session's row, which already names the session. */
  nested?: boolean;
}) {
  const t = useT();
  const bySession = new Map(sessions.map((s) => [sessionKey(s.provider, s.id), s]));
  // An MCP server's results come from several tools; name each one's.
  const manyTools = new Set(results.map((r) => r.tool)).size > 1;
  const columns = ["input", "output", "carried", "cost"] as const;
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="uppercase tracking-wider hover:bg-transparent">
          <TableHead className="w-7" />
          <TableHead className="text-muted-foreground">{t("toolOutput.drill.detail")}</TableHead>
          {columns.map((column) => (
            <TableHead key={column} className={cn("text-right text-muted-foreground", NARROW_HIDDEN[column])}>
              {t(`toolOutput.columns.${column}`)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {results.map((result) => {
          const session = bySession.get(sessionKey(result.provider, result.sessionId));
          const key = `result\n${result.provider}\n${result.sessionId}\n${result.eventId}`;
          const isOpen = open.has(key);
          const text = result.detail ?? toolLabel(result.tool);
          return (
            <Fragment key={key}>
              <TableRow
                className={cn("cursor-pointer", isOpen && "bg-muted/40 hover:bg-muted/40")}
                onClick={(e) => {
                  // The chevron toggles on its own; anywhere else on the row does too.
                  if (!(e.target as HTMLElement).closest("button,a")) toggle(key);
                }}
              >
                <TableCell className="w-7 pr-0 align-top">
                  <Expander open={isOpen} onToggle={() => toggle(key)} label={text} />
                </TableCell>
                <TableCell className="w-full max-w-0">
                  <span className="block truncate font-mono text-foreground" title={result.detail}>
                    {manyTools && (
                      <span className="text-muted-foreground">{shortTool(result.tool)} · </span>
                    )}
                    {text}
                  </span>
                  <span className="mt-0.5 block">
                    <SessionLine
                      provider={result.provider}
                      label={nested ? undefined : session?.label}
                      project={nested ? undefined : session?.project}
                      timestamp={result.timestamp}
                    />
                  </span>
                </TableCell>
                <TableCell className={cn("text-right align-top", NARROW_HIDDEN.input)}>
                  {estimate(result.inputChars)}
                </TableCell>
                <TableCell className={cn("text-right align-top", NARROW_HIDDEN.output)}>
                  {estimate(result.chars)}
                </TableCell>
                <TableCell className="text-right align-top font-medium">
                  {formatTokens(result.carriedTokens) ?? "—"}
                </TableCell>
                <TableCell className="text-right align-top">{totalCost(result)}</TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell colSpan={columns.length + 1} className="max-w-0 whitespace-normal pb-4">
                    <ResultDetail result={result} />
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

/** What one call asked for and what came back, loaded when its row opens. */
function ResultDetail({ result }: { result: ResultRow }) {
  const t = useT();
  const { data, loading } = useJson<{ result: AgentEvent; call?: AgentEvent }>(
    `/api/tool-output/result?${new URLSearchParams({
      provider: result.provider,
      id: result.sessionId,
      event: result.eventId,
    })}`,
  );
  const args = data?.call?.data.arguments;
  const output = data?.result.data.result as ToolResult | undefined;
  return (
    <div className="space-y-3 pt-1">
      {loading ? (
        <Skeleton className="h-24 rounded-md" />
      ) : !data ? (
        <p className="text-xs text-muted-foreground">{t("toolOutput.drill.resultError")}</p>
      ) : (
        <>
          {args !== undefined && typeof args === "object" && args !== null && (
            <ToolArguments
              args={args as Record<string, unknown>}
              chars={data.call?.data.argumentChars as number | undefined}
            />
          )}
          {output && (
            <ToolResultView
              result={output}
              chars={data.result.data.resultChars as number | undefined}
              truncated={data.result.data.truncated === true}
            />
          )}
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href={eventHref(result.provider, result.sessionId, result.eventId)} />}
      >
        {t("toolOutput.drill.openInSession")}
        <ExternalLink data-icon="inline-end" aria-hidden />
      </Button>
    </div>
  );
}

function SessionsTable({
  data,
  query,
  open,
  toggle,
}: {
  data: ToolResultsResponse;
  query: string;
  open: Set<string>;
  toggle: (key: string) => void;
}) {
  const t = useT();
  const columns = ["carried", "cost", "results", "input", "output"] as const;
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="uppercase tracking-wider hover:bg-transparent">
          <TableHead className="w-7" />
          <TableHead className="text-muted-foreground">{t("toolOutput.drill.session")}</TableHead>
          {columns.map((column) => (
            <TableHead key={column} className={cn("text-right text-muted-foreground", NARROW_HIDDEN[column])}>
              {t(`toolOutput.columns.${column}`)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {data.sessions.map((session) => {
          const key = `session\n${sessionKey(session.provider, session.id)}`;
          const isOpen = open.has(key);
          return (
            <Fragment key={key}>
              <TableRow
                className={cn("cursor-pointer", isOpen && "bg-muted/40 hover:bg-muted/40")}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("button,a")) toggle(key);
                }}
              >
                <TableCell className="w-7 pr-0">
                  <Expander open={isOpen} onToggle={() => toggle(key)} label={session.label} />
                </TableCell>
                <TableCell className="w-full max-w-0">
                  <span className="block truncate text-foreground">{session.label}</span>
                  <span className="mt-0.5 block">
                    <SessionLine provider={session.provider} project={session.project} />
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatTokens(session.carriedTokens) ?? "—"}
                </TableCell>
                <TableCell className="text-right">{totalCost(session)}</TableCell>
                <TableCell className={cn("text-right", NARROW_HIDDEN.results)}>
                  {formatNumber(session.results)}
                </TableCell>
                <TableCell className={cn("text-right", NARROW_HIDDEN.input)}>
                  {estimate(session.inputChars)}
                </TableCell>
                <TableCell className={cn("text-right", NARROW_HIDDEN.output)}>
                  {estimate(session.chars)}
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell colSpan={columns.length + 1} className="max-w-0 whitespace-normal pb-4">
                    <SessionResults session={session} query={query} open={open} toggle={toggle} />
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

/** One session's results, loaded when its row opens, each one openable in turn. */
function SessionResults({
  session,
  query,
  open,
  toggle,
}: {
  session: ToolResultSession;
  query: string;
  open: Set<string>;
  toggle: (key: string) => void;
}) {
  const t = useT();
  const sessionParams = new URLSearchParams({ sessionProvider: session.provider, sessionId: session.id });
  const { data, loading } = useJson<ToolResultsResponse>(
    `/api/tool-output?${query}&${sessionParams}&limit=${RESULT_LIMIT}`,
  );
  if (loading) return <Skeleton className="h-24 rounded-md" />;
  if (!data) return <p className="text-xs text-muted-foreground">{t("toolOutput.drill.loadError")}</p>;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2">
      <ResultsTable results={data.results} sessions={data.sessions} open={open} toggle={toggle} nested />
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href={`/sessions/${session.provider}/${encodeURIComponent(session.id)}?tab=optimizer`} />}
      >
        {t("toolOutput.drill.openInSession")}
        <ExternalLink data-icon="inline-end" aria-hidden />
      </Button>
    </div>
  );
}
