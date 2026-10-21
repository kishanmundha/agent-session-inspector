"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Wallet } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
import { RangeCostDialog } from "@/components/common/range-cost-dialog";
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
import { RANGES, addDays, startOfDay } from "@/lib/analytics";
import { downloadCsv } from "@/lib/download";
import { formatCost, formatNumber, formatPercent, formatTokens } from "@/lib/format";
import { PROVIDER_ORDER, providerStyle, supportedAgents } from "@/lib/provider-meta";
import { formatLocale } from "@/i18n/current";
import { useLocale, useT } from "@/i18n/client";
import {
  DIMENSIONS,
  computeUsage,
  toWeeks,
  usageModelsOf,
  usageToCsv,
  type Dimension,
  type Unit,
  type UsageFilter,
} from "@/lib/usage";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { anyValue, oneOf, useStoredState } from "@/lib/use-stored-state";
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

const UNITS: Unit[] = ["costUSD", "tokens"];

/** Above this many days the chart groups by week, so bars stay wide enough to read. */
const MAX_DAILY_BARS = 92;

const SESSION_COLUMNS = ["session", "input", "cached", "output", "cost"] as const;

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
  const t = useT();
  const locale = useLocale();
  const { sessions, error } = useAnalyticsSessions(reloadToken);
  const [costOpen, setCostOpen] = useState(false);
  const [range, setRange] = useStoredState<string>(
    "usage-range",
    "30",
    oneOf(RANGES.map((r) => r.value)),
  );
  const [storedProvider, setProvider] = useStoredState<string>("usage-provider", "all", anyValue);
  const [storedModel, setModel] = useStoredState<string>("usage-model", "all", anyValue);
  // A remembered agent or model with no sessions any more reads as "all".
  const provider =
    !sessions || sessions.some((s) => s.provider === storedProvider) ? storedProvider : "all";
  const model = !sessions || usageModelsOf(sessions).includes(storedModel) ? storedModel : "all";
  const [unit, setUnit] = useStoredState<Unit>(
    "usage-unit",
    "costUSD",
    oneOf(UNITS),
  );
  const [dimension, setDimension] = useStoredState<Dimension>("usage-dimension", "project", oneOf(DIMENSIONS));

  const filter: UsageFilter = useMemo(
    () => ({
      days: RANGES.find((r) => r.value === range)?.days ?? null,
      project,
      provider,
      model,
    }),
    [range, project, provider, model],
  );
  // Where the range starts, as the dashboard counts it; null for all time.
  const since =
    filter.days === null ? null : addDays(startOfDay(new Date()), 1 - filter.days).getTime();

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
      { value: "all", label: t("home.allAgents") },
      ...providers.map((id) => ({ value: id as string, label: providerStyle(id).shortLabel })),
    ],
    [providers, t],
  );
  const modelOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allModels") },
      ...usageModelsOf(sessions ?? []).map((m) => ({ value: m, label: m })),
    ],
    [sessions, t],
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
        <p className="text-sm">{t("usage.loadError")}</p>
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
        title={t("usage.emptyTitle")}
        description={t("usage.emptyDetail", { agents: supportedAgents(locale) })}
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
    series.push({
      name: OTHER,
      label: t("usage.other", { count: ranked.length - series.length }),
      color: OTHER_COLOR,
    });
  }
  const colorOf = (name: string) => series.find((s) => s.name === name)?.color ?? OTHER_COLOR;
  const rankedTotal = ranked.reduce((sum, row) => sum + row[unit], 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
          aria-label={t("filters.dateRange")}
        />
        {projectOptions.length > 2 && (
          <OptionSelect
            value={project}
            onChange={onProjectChange}
            options={projectOptions}
            aria-label={t("home.project")}
            className="max-w-56"
          />
        )}
        {providers.length > 1 && (
          <OptionSelect
            value={provider}
            onChange={setProvider}
            options={providerOptions}
            aria-label={t("filters.agent")}
          />
        )}
        {modelOptions.length > 2 && (
          <OptionSelect
            value={model}
            onChange={setModel}
            options={modelOptions}
            aria-label={t("filters.model")}
            className="max-w-56"
          />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label={t("usage.measure")}
            value={unit}
            onChange={setUnit}
            options={UNITS.map((value) => ({ value, label: t(`usage.units.${value}`) }))}
            size="default"
          />
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(`agent-usage-${range}-by-${dimension}.csv`, usageToCsv(data.days, dimension))
            }
          >
            <Download aria-hidden />
            {t("filters.exportCsv")}
          </Button>
        </div>
      </div>

      {totals.tokens === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("usage.noUsage")}
          description={t("analytics.noActivityDetail")}
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label={t("stats.estCost")}
              value={formatCost(totals.costUSD)}
              sub={
                unpriced.length > 0
                  ? t("stats.modelsUnpriced", { count: unpriced.length })
                  : t("stats.atListPrices")
              }
              accent
              onClick={() => setCostOpen(true)}
            />
            <StatCard
              label={t("usage.dailyBurn")}
              value={formatCost(totals.activeDays ? totals.costUSD / totals.activeDays : 0)}
              sub={t("usage.avgOverDays", { count: totals.activeDays })}
            />
            <StatCard
              label={t("usage.peakDay")}
              value={formatCost(peakDay?.costUSD ?? 0)}
              sub={peakDay?.start.toLocaleDateString(formatLocale(), {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            />
            <StatCard
              label={t("usage.inputTokens")}
              value={tokens(totals.inputTokens)}
              sub={t("usage.plusCached", { amount: tokens(totals.cacheReadTokens) })}
            />
            <StatCard
              label={t("stats.outputTokens")}
              value={tokens(totals.outputTokens)}
              sub={
                totals.cacheWriteTokens > 0
                  ? t("usage.cacheWrites", { amount: tokens(totals.cacheWriteTokens) })
                  : undefined
              }
            />
            <StatCard
              label={t("usage.cacheHit")}
              value={formatPercent(data.cacheHitRate, 1)}
              sub={t("usage.cacheHitSub")}
            />
            <StatCard
              label={t("stats.sessions")}
              value={formatNumber(totals.sessions)}
              sub={t("usage.avg", { amount: formatCost(totals.costUSD / totals.sessions) })}
            />
          </StatCardGrid>

          <RangeCostDialog
            sessions={sessions}
            keep={(session, slice) =>
              (provider === "all" || session.provider === provider) &&
              (project === "all" || session.project === project) &&
              (model === "all" || slice.model === model) &&
              (since === null || slice.t >= since)
            }
            scope={{
              sessions: totals.sessions,
              period: t(`rangePeriods.${range as (typeof RANGES)[number]["value"]}`),
            }}
            open={costOpen}
            onOpenChange={setCostOpen}
          />

          <UnpricedNotice models={unpriced} />

          <Panel
            title={t(`usage.overTime.${unit}`)}
            note={periods === data.days ? t("usage.perDay") : t("usage.perWeek")}
            action={
              <Segmented
                label={t("usage.breakDownBy")}
                value={dimension}
                onChange={setDimension}
                options={DIMENSIONS.map((value) => ({
                  value,
                  label: t(`usage.dimensions.${value}`),
                }))}
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
            title={t(`usage.by.${unit}.${dimension}`)}
            note={t("analytics.total", { count: ranked.length })}
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
                      {t("metrics.sessionsCount", { count: row.sessions })}
                    </span>
                    <span className="w-14 shrink-0 text-right font-medium tabular-nums">
                      {formatUnit(unit, row[unit])}
                    </span>
                    <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
                      {formatPercent(row[unit] / rankedTotal, 1)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel title={t(`usage.topSessions.${unit}`)}>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                  {SESSION_COLUMNS.map((column, i) => (
                    <TableHead
                      key={column}
                      className={cn("text-muted-foreground", i > 0 && "text-right")}
                    >
                      {t(`usage.columns.${column}`)}
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
