"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Wallet } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
import { Panel } from "@/components/common/panel";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/common/skeleton";
import { UnpricedNotice } from "@/components/common/unpriced-notice";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RANGES } from "@/lib/analytics";
import { downloadCsv } from "@/lib/download";
import { formatCost, formatTokens } from "@/lib/format";
import { PROVIDER_ORDER, providerStyle } from "@/lib/provider-meta";
import {
  DIMENSIONS,
  DIMENSION_LABELS,
  computeUsage,
  toWeeks,
  usageModelsOf,
  usageToCsv,
  type Dimension,
  type Unit,
  type UsageFilter,
} from "@/lib/usage";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { cn } from "@/lib/utils";
import {
  OTHER,
  OTHER_COLOR,
  SERIES_COLORS,
  StackedBars,
  Treemap,
  formatUnit,
  type Series,
} from "./usage-charts";

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "costUSD", label: "Cost" },
  { value: "tokens", label: "Tokens" },
];

const DIMENSION_OPTIONS = DIMENSIONS.map((value) => ({ value, label: DIMENSION_LABELS[value] }));

/** Above this many days the chart groups by week, so bars stay wide enough to read. */
const MAX_DAILY_BARS = 92;

const SESSION_COLUMNS = ["Session", "Input", "Cached", "Output", "Cost"];

const tokens = (n: number) => formatTokens(n) ?? "0";

/** Where the money and tokens went: over time, by project, model and agent. */
export function UsageDashboard({
  reloadToken,
  project,
  onProjectChange,
  projectOptions,
}: {
  reloadToken: number;
  /** Shared by every tab on the page; "all" for no filter. */
  project: string;
  onProjectChange: (project: string) => void;
  projectOptions: { value: string; label: string }[];
}) {
  const { sessions, error } = useAnalyticsSessions(reloadToken);
  const [range, setRange] = useState("30");
  const [provider, setProvider] = useState("all");
  const [model, setModel] = useState("all");
  const [unit, setUnit] = useState<Unit>("costUSD");
  const [dimension, setDimension] = useState<Dimension>("project");

  const filter: UsageFilter = useMemo(
    () => ({
      days: RANGES.find((r) => r.value === range)?.days ?? null,
      project,
      provider,
      model,
    }),
    [range, project, provider, model],
  );

  const data = useMemo(
    () => (sessions ? computeUsage(sessions, filter) : null),
    [sessions, filter],
  );

  const providers = useMemo(
    () => PROVIDER_ORDER.filter((id) => sessions?.some((s) => s.provider === id)),
    [sessions],
  );
  const providerOptions = useMemo(
    () => [
      { value: "all", label: "All agents" },
      ...providers.map((id) => ({ value: id as string, label: providerStyle(id).shortLabel })),
    ],
    [providers],
  );
  const modelOptions = useMemo(
    () => [
      { value: "all", label: "All models" },
      ...usageModelsOf(sessions ?? []).map((m) => ({ value: m, label: m })),
    ],
    [sessions],
  );

  const labelOf = (name: string) =>
    dimension === "agent" ? providerStyle(name).shortLabel : name;

  // Ranked once, so the chart, the treemap and the list agree on order and colour.
  const ranked = useMemo(
    () =>
      data
        ? [...data.attribution[dimension]]
            .filter((row) => row[unit] > 0)
            .sort((a, b) => b[unit] - a[unit])
        : [],
    [data, dimension, unit],
  );

  const topSessions = useMemo(
    () =>
      data
        ? [...data.sessions]
            .sort((a, b) => b[unit] - a[unit])
            .filter((s) => s[unit] > 0)
            .slice(0, 10)
        : [],
    [data, unit],
  );

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">Could not load usage. Use refresh to try again.</p>
      </div>
    );
  }

  if (!sessions || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No usage yet"
        description="Cost and token usage appear once Copilot, Claude Code or Codex writes a transcript to your home directory."
      />
    );
  }

  const { totals, peakDay } = data;
  const unpriced = data.unpricedModels;
  const periods = data.days.length > MAX_DAILY_BARS ? toWeeks(data.days) : data.days;

  const series: Series[] = ranked.slice(0, SERIES_COLORS.length).map((row, i) => ({
    name: row.name,
    label: labelOf(row.name),
    color: SERIES_COLORS[i],
  }));
  if (ranked.length > series.length) {
    series.push({ name: OTHER, label: `Other (${ranked.length - series.length})`, color: OTHER_COLOR });
  }
  const colorOf = (name: string) => series.find((s) => s.name === name)?.color ?? OTHER_COLOR;
  const rankedTotal = ranked.reduce((sum, row) => sum + row[unit], 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect value={range} onChange={setRange} options={RANGES} aria-label="Date range" />
        {projectOptions.length > 2 && (
          <OptionSelect
            value={project}
            onChange={onProjectChange}
            options={projectOptions}
            aria-label="Project"
            className="max-w-56"
          />
        )}
        {providers.length > 1 && (
          <OptionSelect
            value={provider}
            onChange={setProvider}
            options={providerOptions}
            aria-label="Agent"
          />
        )}
        {modelOptions.length > 2 && (
          <OptionSelect
            value={model}
            onChange={setModel}
            options={modelOptions}
            aria-label="Model"
            className="max-w-56"
          />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented label="Measure" value={unit} onChange={setUnit} options={UNIT_OPTIONS} size="default" />
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(`agent-usage-${range}-by-${dimension}.csv`, usageToCsv(data.days, dimension))
            }
          >
            <Download aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      {totals.tokens === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No usage for these filters"
          description="Try a longer date range, or clear the project, agent and model filters."
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label="Est. cost"
              value={formatCost(totals.costUSD)}
              sub={
                unpriced.length > 0
                  ? `${unpriced.length} model${unpriced.length > 1 ? "s" : ""} unpriced`
                  : "at API list prices"
              }
              accent
            />
            <StatCard
              label="Daily burn"
              value={formatCost(totals.activeDays ? totals.costUSD / totals.activeDays : 0)}
              sub={`avg over ${totals.activeDays} active day${totals.activeDays === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Peak day"
              value={formatCost(peakDay?.costUSD ?? 0)}
              sub={peakDay?.start.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            />
            <StatCard
              label="Input tokens"
              value={tokens(totals.inputTokens)}
              sub={`+${tokens(totals.cacheReadTokens)} cached`}
            />
            <StatCard
              label="Output tokens"
              value={tokens(totals.outputTokens)}
              sub={
                totals.cacheWriteTokens > 0
                  ? `${tokens(totals.cacheWriteTokens)} cache writes`
                  : undefined
              }
            />
            <StatCard
              label="Cache hit"
              value={`${(data.cacheHitRate * 100).toFixed(1)}%`}
              sub="of input read from cache"
            />
            <StatCard
              label="Sessions"
              value={totals.sessions.toLocaleString()}
              sub={`${formatCost(totals.costUSD / totals.sessions)} avg`}
            />
          </StatCardGrid>

          <UnpricedNotice models={unpriced} />

          <Panel
            title={unit === "costUSD" ? "Cost over time" : "Tokens over time"}
            note={periods === data.days ? "per day" : "per week"}
            action={
              <Segmented
                label="Break down by"
                value={dimension}
                onChange={setDimension}
                options={DIMENSION_OPTIONS}
              />
            }
          >
            <StackedBars
              periods={periods}
              breakdownOf={(period) => period.by[dimension]}
              series={series}
              unit={unit}
            />
          </Panel>

          <Panel
            title={`${unit === "costUSD" ? "Cost" : "Tokens"} by ${DIMENSION_LABELS[dimension].toLowerCase()}`}
            note={`${ranked.length} total`}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Treemap
                unit={unit}
                items={ranked.map((row) => ({
                  name: row.name,
                  label: labelOf(row.name),
                  value: row[unit],
                  color: colorOf(row.name),
                }))}
              />
              <ol className="max-h-72 space-y-1 overflow-y-auto pr-1 text-xs">
                {ranked.map((row, i) => (
                  <li key={row.name} className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: colorOf(row.name) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate" title={labelOf(row.name)}>
                      {labelOf(row.name)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.sessions} session{row.sessions === 1 ? "" : "s"}
                    </span>
                    <span className="w-14 shrink-0 text-right font-medium tabular-nums">
                      {formatUnit(unit, row[unit])}
                    </span>
                    <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
                      {((row[unit] / rankedTotal) * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel title={`Top sessions by ${unit === "costUSD" ? "cost" : "tokens"}`}>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                  {SESSION_COLUMNS.map((label, i) => (
                    <TableHead
                      key={label}
                      className={cn("text-muted-foreground", i > 0 && "text-right")}
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {topSessions.map((s) => (
                  <TableRow key={`${s.provider}:${s.id}`}>
                    <TableCell className="max-w-0 w-full">
                      <Link
                        href={`/sessions/${s.provider}/${s.id}`}
                        className="block truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {s.label}
                      </Link>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn("size-1.5 rounded-full", providerStyle(s.provider).dotCls)}
                          aria-hidden
                        />
                        {providerStyle(s.provider).shortLabel} · {s.project}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{tokens(s.inputTokens)}</TableCell>
                    <TableCell className="text-right">{tokens(s.cacheReadTokens)}</TableCell>
                    <TableCell className="text-right">{tokens(s.outputTokens)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCost(s.costUSD)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </>
      )}
    </div>
  );
}
