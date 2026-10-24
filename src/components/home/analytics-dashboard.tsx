"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Download } from "lucide-react";
import { BarList } from "@/components/common/bar-list";
import { EmptyState } from "@/components/common/empty-state";
import { downloadCsv } from "@/lib/download";
import { OptionSelect } from "@/components/common/option-select";
import { RangeCostDialog } from "@/components/common/range-cost-dialog";
import { Panel } from "@/components/common/panel";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/common/skeleton";
import { UnpricedNotice } from "@/components/common/unpriced-notice";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import { ToolOutputTable } from "@/components/common/tool-output-table";
import { toolResultsHref } from "./tool-results-view";
import { toolCostUSD } from "@/lib/tool-names";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  METRICS,
  RANGES,
  addDays,
  computeAnalytics,
  daysToCsv,
  modelsOf,
  startOfDay,
  type AnalyticsFilter,
  type Metric,
  type SessionRow,
} from "@/lib/analytics";
import {
  fixed,
  formatCost,
  formatCount,
  formatDuration,
  formatNumber,
  formatTokens,
} from "@/lib/format";
import { PROVIDER_ORDER, providerStyle, supportedAgents } from "@/lib/provider-meta";
import { useLocale, useT } from "@/i18n/client";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { anyValue, oneOf, useStoredState } from "@/lib/use-stored-state";
import { cn } from "@/lib/utils";
import { CalendarHeatmap, HourHeatmap, WeeklyBars } from "./analytics-charts";

type TopKey = "messages" | "activeMs" | "outputTokens" | "costUSD";

const TOP_KEYS: TopKey[] = ["messages", "activeMs", "outputTokens", "costUSD"];

type McpKey = "servers" | "tools";

const MCP_KEYS: McpKey[] = ["servers", "tools"];

type ProjectKey = "messages" | "costUSD";

const PROJECT_KEYS: ProjectKey[] = ["messages", "costUSD"];

const AGENT_COLUMNS = [
  "agent",
  "sessions",
  "cost",
  "messages",
  "toolCalls",
  "output",
  "active",
  "msgsPerMin",
  "toolsPerMin",
  "topTools",
] as const;

function formatTop(key: TopKey, session: SessionRow): string {
  if (key === "costUSD") return formatCost(session.costUSD);
  if (key === "activeMs") return formatDuration(session.activeMs);
  if (key === "outputTokens") return formatTokens(session.outputTokens) ?? "0";
  return formatNumber(session.messages);
}

/** Cross-session analytics: activity, top sessions, tools and agents. */
export function AnalyticsDashboard({
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
    "analytics-range",
    "90",
    oneOf(RANGES.map((r) => r.value)),
  );
  const [storedProvider, setProvider] = useStoredState<string>("analytics-provider", "all", anyValue);
  const [storedModel, setModel] = useStoredState<string>("analytics-model", "all", anyValue);
  // A remembered agent or model with no sessions any more reads as "all".
  const provider =
    !sessions || sessions.some((s) => s.provider === storedProvider) ? storedProvider : "all";
  const model = !sessions || modelsOf(sessions).includes(storedModel) ? storedModel : "all";
  const [calendarMetric, setCalendarMetric] = useStoredState<Metric>(
    "analytics-calendar-metric",
    "messages",
    oneOf(METRICS),
  );
  const [hourMetric, setHourMetric] = useStoredState<Metric>(
    "analytics-hour-metric",
    "messages",
    oneOf(METRICS),
  );
  const [topKey, setTopKey] = useStoredState<TopKey>(
    "analytics-top",
    "messages",
    oneOf(TOP_KEYS),
  );
  const [projectKey, setProjectKey] = useStoredState<ProjectKey>(
    "analytics-projects",
    "messages",
    oneOf(PROJECT_KEYS),
  );
  const [mcpKey, setMcpKey] = useStoredState<McpKey>(
    "analytics-mcp",
    "servers",
    oneOf(MCP_KEYS),
  );

  const filter: AnalyticsFilter = useMemo(
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
    () => (sessions ? computeAnalytics(sessions, filter) : null),
    [sessions, filter],
  );

  const providers = useMemo(
    () => PROVIDER_ORDER.filter((id) => sessions?.some((s) => s.provider === id)),
    [sessions],
  );
  const models = useMemo(() => modelsOf(sessions ?? []), [sessions]);

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
      ...models.map((m) => ({ value: m, label: m })),
    ],
    [models, t],
  );
  const metricOptions = METRICS.map((value) => ({ value, label: t(`metrics.${value}`) }));

  const topSessions = useMemo(
    () =>
      data
        ? [...data.sessions]
            .sort((a, b) => b[topKey] - a[topKey])
            .filter((s) => s[topKey] > 0)
            .slice(0, 10)
        : [],
    [data, topKey],
  );

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">{t("analytics.loadError")}</p>
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
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("analytics.emptyTitle")}
        description={t("analytics.emptyDetail", { agents: supportedAgents(locale) })}
      />
    );
  }

  const { totals, messagesPerSession } = data;
  const topProject = data.projects[0];
  const activeMinutes = (ms: number) => ms / 60_000;
  const skillCalls = data.skills.reduce((sum, s) => sum + s.value, 0);
  const mcpCalls = data.mcpServers.reduce((sum, s) => sum + s.value, 0);
  const mcpItems =
    mcpKey === "servers"
      ? data.mcpServers
      : data.mcpServers.flatMap((server) =>
          server.tools.map((tool) => ({ name: `${server.name} › ${tool.name}`, value: tool.value })),
        );
  const carriedTokens = data.toolOutput.reduce((sum, r) => sum + r.carriedTokens, 0);
  const carriedUSD = data.toolOutput.reduce((sum, r) => sum + (toolCostUSD(r) ?? 0), 0);
  const perMinute = (count: number, ms: number) =>
    ms > 0 ? fixed(count / activeMinutes(ms), 1) : "—";

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
        {models.length > 1 && (
          <OptionSelect
            value={model}
            onChange={setModel}
            options={modelOptions}
            aria-label={t("filters.model")}
            className="max-w-56"
          />
        )}
        <Button
          variant="outline"
          onClick={() => downloadCsv(`agent-activity-${range}.csv`, daysToCsv(data.days))}
          className="ml-auto"
        >
          <Download aria-hidden />
          {t("filters.exportCsv")}
        </Button>
      </div>

      {totals.sessions === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={t("analytics.noActivity")}
          description={t("analytics.noActivityDetail")}
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label={t("stats.estCost")}
              value={formatCost(totals.costUSD)}
              sub={
                data.unpricedModels.length > 0
                  ? t("stats.modelsUnpriced", { count: data.unpricedModels.length })
                  : t("stats.atListPrices")
              }
              accent
              onClick={() => setCostOpen(true)}
            />
            <StatCard label={t("stats.sessions")} value={formatNumber(totals.sessions)} />
            <StatCard label={t("stats.messages")} value={formatCount(totals.messages)} />
            <StatCard
              label={t("stats.msgsPerSession")}
              value={fixed(messagesPerSession.mean, 1)}
              sub={t("stats.medianP90", {
                median: messagesPerSession.median,
                p90: messagesPerSession.p90,
              })}
            />
            <StatCard label={t("stats.toolCalls")} value={formatCount(totals.toolCalls)} />
            <StatCard
              label={t("stats.outputTokens")}
              value={formatTokens(totals.outputTokens) ?? "0"}
            />
            <StatCard
              label={t("stats.activeTime")}
              value={formatDuration(totals.activeMs)}
              sub={t("stats.exclPauses")}
            />
            <StatCard
              label={t("stats.activeDays")}
              value={formatNumber(totals.activeDays)}
              sub={t("stats.ofTotal", { total: data.days.length })}
            />
            <StatCard
              label={t("stats.projects")}
              value={formatNumber(totals.projects)}
              sub={
                topProject && totals.messages > 0
                  ? t("stats.shareIn", {
                      percent: Math.round((topProject.messages / totals.messages) * 100),
                      name: topProject.name,
                    })
                  : undefined
              }
            />
          </StatCardGrid>

          <RangeCostDialog
            sessions={sessions}
            keep={(session, slice) =>
              // As in the analytics, the model filter is the session's model.
              (provider === "all" || session.provider === provider) &&
              (project === "all" || session.project === project) &&
              (model === "all" || session.model === model) &&
              (since === null || slice.t >= since)
            }
            scope={{
              sessions: totals.sessions,
              period: t(`rangePeriods.${range as (typeof RANGES)[number]["value"]}`),
            }}
            open={costOpen}
            onOpenChange={setCostOpen}
          />

          <UnpricedNotice models={data.unpricedModels} />

          <Panel
            title={t("analytics.activity")}
            action={
              <Segmented
                label={t("analytics.activityMetric")}
                value={calendarMetric}
                onChange={setCalendarMetric}
                options={metricOptions}
              />
            }
          >
            <CalendarHeatmap days={data.days} metric={calendarMetric} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("analytics.byWeekdayHour")}
              action={
                <Segmented
                  label={t("analytics.weekdayHourMetric")}
                  value={hourMetric}
                  onChange={setHourMetric}
                  options={metricOptions}
                />
              }
            >
              <HourHeatmap grid={data.hourly[hourMetric]} metric={hourMetric} />
            </Panel>

            <Panel
              title={t("analytics.topSessions")}
              action={
                <Segmented
                  label={t("analytics.rankSessionsBy")}
                  value={topKey}
                  onChange={setTopKey}
                  options={TOP_KEYS.map((value) => ({ value, label: t(`analytics.top.${value}`) }))}
                />
              }
            >
              <ol className="-mx-2">
                {topSessions.map((s, i) => (
                  <li key={`${s.provider}:${s.id}`}>
                    <Link
                      href={`/sessions/${s.provider}/${s.id}`}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{s.label}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn("size-1.5 rounded-full", providerStyle(s.provider).dotCls)}
                            aria-hidden
                          />
                          {providerStyle(s.provider).shortLabel} · {s.project}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatTop(topKey, s)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel
              title={t("stats.projects")}
              note={t("analytics.total", { count: totals.projects })}
              action={
                <Segmented
                  label={t("analytics.rankProjectsBy")}
                  value={projectKey}
                  onChange={setProjectKey}
                  options={PROJECT_KEYS.map((value) => ({
                    value,
                    label: t(`analytics.top.${value}`),
                  }))}
                />
              }
            >
              <BarList
                items={data.projects.map((p) => ({ name: p.name, value: p[projectKey] }))}
                limit={10}
                format={projectKey === "costUSD" ? formatCost : undefined}
              />
            </Panel>

            <Panel
              title={t("analytics.toolUsage")}
              note={t("analytics.calls", { count: totals.toolCalls })}
            >
              <BarList items={data.tools} limit={8} emptyLabel={t("analytics.noToolCalls")} />
              {data.weeks.length > 1 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs uppercase tracking-wider text-muted-foreground">
                    {t("analytics.weeklyTrend")}
                  </h3>
                  <WeeklyBars weeks={data.weeks} />
                </>
              )}
            </Panel>

            <Panel
              title={t("analytics.skills")}
              note={`${t("analytics.calls", { count: skillCalls })} · ${t("analytics.skillCount", { count: data.skills.length })}`}
            >
              <BarList items={data.skills} limit={8} emptyLabel={t("analytics.noSkills")} />
              {data.skills.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.rich(
                    "analytics.mostUsedSkill",
                    { m: (chunks) => <span className="font-mono text-foreground">{chunks}</span> },
                    { name: data.skills[0].name, count: data.skills[0].sessions },
                  )}
                </p>
              )}
            </Panel>

            <Panel
              title={t("analytics.mcpTools")}
              note={`${t("analytics.calls", { count: mcpCalls })} · ${t("analytics.serverCount", { count: data.mcpServers.length })}`}
              action={
                data.mcpServers.length > 0 ? (
                  <Segmented
                    label={t("analytics.groupMcpBy")}
                    value={mcpKey}
                    onChange={setMcpKey}
                    options={MCP_KEYS.map((value) => ({ value, label: t(`analytics.mcp.${value}`) }))}
                  />
                ) : undefined
              }
            >
              <BarList items={mcpItems} limit={8} emptyLabel={t("analytics.noMcp")} />
            </Panel>
          </div>

          <Panel
            title={t("toolOutput.title")}
            note={
              carriedTokens > 0
                ? t("toolOutput.note", {
                    tokens: formatTokens(carriedTokens) ?? "0",
                    cost: formatCost(carriedUSD),
                  })
                : undefined
            }
          >
            {data.toolOutput.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("toolOutput.empty")}</p>
            ) : (
              <>
                <ToolOutputTable
                  rows={data.toolOutput}
                  limit={12}
                  sessions
                  hrefFor={(target) =>
                    toolResultsHref(target, { range, project, provider, model })
                  }
                />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {t("toolOutput.footnote")}
                </p>
              </>
            )}
          </Panel>

          <Panel title={t("analytics.agentComparison")}>
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                  {AGENT_COLUMNS.map((column, i) => (
                    <TableHead
                      key={column}
                      className={cn(
                        "text-muted-foreground",
                        i > 0 && i < AGENT_COLUMNS.length - 1 && "text-right",
                      )}
                    >
                      {t(`analytics.columns.${column}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {data.agents.map((a) => (
                  <TableRow key={a.provider}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={cn("size-2 rounded-full", providerStyle(a.provider).dotCls)}
                          aria-hidden
                        />
                        {providerStyle(a.provider).shortLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(a.sessions)}</TableCell>
                    <TableCell className="text-right">{formatCost(a.costUSD)}</TableCell>
                    <TableCell className="text-right">{formatNumber(a.messages)}</TableCell>
                    <TableCell className="text-right">{formatNumber(a.toolCalls)}</TableCell>
                    <TableCell className="text-right">
                      {formatTokens(a.outputTokens) ?? "0"}
                    </TableCell>
                    <TableCell className="text-right">{formatDuration(a.activeMs)}</TableCell>
                    <TableCell className="text-right">
                      {perMinute(a.messages, a.activeMs)}
                    </TableCell>
                    <TableCell className="text-right">
                      {perMinute(a.toolCalls, a.activeMs)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs text-muted-foreground">
                      {a.topTools.join(", ") || "—"}
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
