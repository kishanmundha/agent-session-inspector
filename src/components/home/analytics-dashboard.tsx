"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Download } from "lucide-react";
import { BarList } from "@/components/common/bar-list";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/common/skeleton";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import {
  METRICS,
  METRIC_LABELS,
  computeAnalytics,
  daysToCsv,
  modelsOf,
  type AnalyticsFilter,
  type Metric,
  type SessionRow,
} from "@/lib/analytics";
import { formatCost, formatCount, formatDuration, formatTokens } from "@/lib/format";
import { PROVIDER_ORDER, providerStyle } from "@/lib/provider-meta";
import type { AnalyticsSession } from "@/lib/providers/types";
import { cn } from "@/lib/utils";
import { CalendarHeatmap, HourHeatmap, Segmented, WeeklyBars } from "./analytics-charts";

const RANGES: { value: string; label: string; days: number | null }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last year", days: 365 },
  { value: "all", label: "All time", days: null },
];

const METRIC_OPTIONS = METRICS.map((value) => ({ value, label: METRIC_LABELS[value] }));

type TopKey = "messages" | "activeMs" | "outputTokens" | "costUSD";

const TOP_OPTIONS: { value: TopKey; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "activeMs", label: "Active time" },
  { value: "outputTokens", label: "Output tokens" },
  { value: "costUSD", label: "Cost" },
];

type ProjectKey = "messages" | "costUSD";

const PROJECT_OPTIONS: { value: ProjectKey; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "costUSD", label: "Cost" },
];

function formatTop(key: TopKey, session: SessionRow): string {
  if (key === "costUSD") return formatCost(session.costUSD);
  if (key === "activeMs") return formatDuration(session.activeMs);
  if (key === "outputTokens") return formatTokens(session.outputTokens) ?? "0";
  return session.messages.toLocaleString();
}

const selectCls =
  "h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40";

function Panel({
  title,
  note,
  action,
  className,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {title}
          {note && <span className="ml-2 text-xs font-normal text-muted-foreground">{note}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Cross-session analytics: activity, top sessions, tools and agents. */
export function AnalyticsDashboard({ reloadToken }: { reloadToken: number }) {
  const [sessions, setSessions] = useState<AnalyticsSession[] | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState("90");
  const [provider, setProvider] = useState("all");
  const [model, setModel] = useState("all");
  const [calendarMetric, setCalendarMetric] = useState<Metric>("messages");
  const [hourMetric, setHourMetric] = useState<Metric>("messages");
  const [topKey, setTopKey] = useState<TopKey>("messages");
  const [projectKey, setProjectKey] = useState<ProjectKey>("messages");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/analytics");
        if (!res.ok) throw new Error("Request failed");
        const next = await res.json();
        if (cancelled) return;
        setSessions(next);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filter: AnalyticsFilter = useMemo(
    () => ({
      days: RANGES.find((r) => r.value === range)?.days ?? null,
      provider,
      model,
    }),
    [range, provider, model],
  );

  const data = useMemo(
    () => (sessions ? computeAnalytics(sessions, filter) : null),
    [sessions, filter],
  );

  const providers = useMemo(
    () => PROVIDER_ORDER.filter((id) => sessions?.some((s) => s.provider === id)),
    [sessions],
  );
  const models = useMemo(() => modelsOf(sessions ?? []), [sessions]);

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
        <p className="text-sm">Could not load analytics. Use refresh to try again.</p>
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
        title="Nothing to chart yet"
        description="Analytics appear once Copilot, Claude Code or Codex writes a transcript to your home directory."
      />
    );
  }

  const { totals, messagesPerSession } = data;
  const topProject = data.projects[0];
  const activeMinutes = (ms: number) => ms / 60_000;
  const perMinute = (count: number, ms: number) =>
    ms > 0 ? (count / activeMinutes(ms)).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          aria-label="Date range"
          className={selectCls}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {providers.length > 1 && (
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            aria-label="Agent"
            className={selectCls}
          >
            <option value="all">All agents</option>
            {providers.map((id) => (
              <option key={id} value={id}>
                {providerStyle(id).shortLabel}
              </option>
            ))}
          </select>
        )}
        {models.length > 1 && (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Model"
            className={cn(selectCls, "max-w-48")}
          >
            <option value="all">All models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => downloadCsv(`agent-activity-${range}.csv`, daysToCsv(data.days))}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <Download className="size-3.5" aria-hidden />
          Export CSV
        </button>
      </div>

      {totals.sessions === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No activity for these filters"
          description="Try a longer date range, or clear the agent and model filters."
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label="Est. cost"
              value={formatCost(totals.costUSD)}
              sub={
                data.unpricedModels.length > 0
                  ? `${data.unpricedModels.length} model${data.unpricedModels.length > 1 ? "s" : ""} unpriced`
                  : "at API list prices"
              }
              accent
            />
            <StatCard label="Sessions" value={totals.sessions.toLocaleString()} />
            <StatCard label="Messages" value={formatCount(totals.messages)} />
            <StatCard
              label="Msgs / session"
              value={messagesPerSession.mean.toFixed(1)}
              sub={`median ${messagesPerSession.median} · p90 ${messagesPerSession.p90}`}
            />
            <StatCard label="Tool calls" value={formatCount(totals.toolCalls)} />
            <StatCard label="Output tokens" value={formatTokens(totals.outputTokens) ?? "0"} />
            <StatCard
              label="Active time"
              value={formatDuration(totals.activeMs)}
              sub="excl. pauses > 5 min"
            />
            <StatCard
              label="Active days"
              value={totals.activeDays.toLocaleString()}
              sub={`of ${data.days.length}`}
            />
            <StatCard
              label="Projects"
              value={totals.projects.toLocaleString()}
              sub={
                topProject && totals.messages > 0
                  ? `${Math.round((topProject.messages / totals.messages) * 100)}% in ${topProject.name}`
                  : undefined
              }
            />
          </StatCardGrid>

          {data.unpricedModels.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                No price is known for{" "}
                <span className="font-mono text-foreground">
                  {data.unpricedModels.join(", ")}
                </span>
                , so cost figures leave {data.unpricedModels.length > 1 ? "them" : "it"} out.
                Add a price in your <span className="font-mono">pricing.json</span> override
                to include {data.unpricedModels.length > 1 ? "them" : "it"}.
              </span>
            </p>
          )}

          <Panel
            title="Activity"
            action={
              <Segmented
                label="Activity metric"
                value={calendarMetric}
                onChange={setCalendarMetric}
                options={METRIC_OPTIONS}
              />
            }
          >
            <CalendarHeatmap days={data.days} metric={calendarMetric} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="By weekday and hour"
              action={
                <Segmented
                  label="Weekday and hour metric"
                  value={hourMetric}
                  onChange={setHourMetric}
                  options={METRIC_OPTIONS}
                />
              }
            >
              <HourHeatmap grid={data.hourly[hourMetric]} metric={hourMetric} />
            </Panel>

            <Panel
              title="Top sessions"
              action={
                <Segmented
                  label="Rank sessions by"
                  value={topKey}
                  onChange={setTopKey}
                  options={TOP_OPTIONS}
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
              title="Projects"
              note={`${totals.projects} total`}
              action={
                <Segmented
                  label="Rank projects by"
                  value={projectKey}
                  onChange={setProjectKey}
                  options={PROJECT_OPTIONS}
                />
              }
            >
              <BarList
                items={data.projects.map((p) => ({ name: p.name, value: p[projectKey] }))}
                limit={10}
                format={projectKey === "costUSD" ? formatCost : undefined}
              />
            </Panel>

            <Panel title="Tool usage" note={`${totals.toolCalls.toLocaleString()} calls`}>
              <BarList items={data.tools} limit={8} emptyLabel="No tool calls" />
              {data.weeks.length > 1 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs uppercase tracking-wider text-muted-foreground">
                    Weekly trend
                  </h3>
                  <WeeklyBars weeks={data.weeks} />
                </>
              )}
            </Panel>
          </div>

          <Panel title="Agent comparison">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Agent</th>
                    <th className="px-3 py-2 text-right font-medium">Sessions</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Messages</th>
                    <th className="px-3 py-2 text-right font-medium">Tool calls</th>
                    <th className="px-3 py-2 text-right font-medium">Output</th>
                    <th className="px-3 py-2 text-right font-medium">Active</th>
                    <th className="px-3 py-2 text-right font-medium">Msgs/min</th>
                    <th className="px-3 py-2 text-right font-medium">Tools/min</th>
                    <th className="py-2 pl-3 font-medium">Top tools</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.agents.map((a) => (
                    <tr key={a.provider} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className={cn("size-2 rounded-full", providerStyle(a.provider).dotCls)}
                            aria-hidden
                          />
                          {providerStyle(a.provider).shortLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{a.sessions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{formatCost(a.costUSD)}</td>
                      <td className="px-3 py-2 text-right">{a.messages.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{a.toolCalls.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{formatTokens(a.outputTokens) ?? "0"}</td>
                      <td className="px-3 py-2 text-right">{formatDuration(a.activeMs)}</td>
                      <td className="px-3 py-2 text-right">{perMinute(a.messages, a.activeMs)}</td>
                      <td className="px-3 py-2 text-right">{perMinute(a.toolCalls, a.activeMs)}</td>
                      <td className="max-w-56 truncate py-2 pl-3 font-mono text-xs text-muted-foreground">
                        {a.topTools.join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
