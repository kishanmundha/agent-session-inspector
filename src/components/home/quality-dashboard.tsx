"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, HeartPulse } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { GradeBadge } from "@/components/common/grade-badge";
import { OptionSelect } from "@/components/common/option-select";
import { Panel } from "@/components/common/panel";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/common/skeleton";
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
import { RANGES, modelsOf, type AnalyticsFilter } from "@/lib/analytics";
import { downloadCsv } from "@/lib/download";
import {
  GRADES,
  GRADE_STYLES,
  OUTCOMES,
  OUTCOME_BARS,
  OUTCOME_LABELS,
  SIGNAL_INFO,
} from "@/lib/health";
import { gradeOf } from "@/lib/providers/health";
import { PROVIDER_ORDER, providerStyle } from "@/lib/provider-meta";
import {
  computeQuality,
  qualityToCsv,
  qualityWeeks,
  type QualityGroup,
  type QualityPeriod,
  type QualitySession,
} from "@/lib/quality";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { cn } from "@/lib/utils";

/** Above this many days the trend groups by week, so bars stay wide enough to read. */
const MAX_DAILY_BARS = 92;

/** How many of the lowest-scoring sessions the attention list shows. */
const ATTENTION_LIMIT = 10;

const GROUP_COLUMNS = ["Sessions", "Avg score", "Completed", "Failures/session"];

type GroupKey = "agent" | "project";

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "project", label: "Project" },
];

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

const shortDate = (date: Date) =>
  date.toLocaleDateString([], { month: "short", day: "numeric" });

function SessionLink({ session: s }: { session: QualitySession }) {
  return (
    <Link
      href={`/sessions/${s.provider}/${s.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <GradeBadge grade={s.health.grade} score={s.health.score} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{s.label}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", providerStyle(s.provider).dotCls)}
            aria-hidden
          />
          <span className="truncate">
            {providerStyle(s.provider).shortLabel} · {s.project} ·{" "}
            {[
              OUTCOME_LABELS[s.health.outcome].toLowerCase(),
              ...s.health.signals
                .filter((signal) => signal.id !== "outcome")
                .map((signal) => SIGNAL_INFO[signal.id].label.toLowerCase()),
            ].join(", ")}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Rows of labelled bars that share one total, such as grades or outcomes. */
function Distribution({
  rows,
}: {
  rows: { key: string; label: React.ReactNode; value: number; bar: string }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2.5 text-xs">
          <div className="w-24 shrink-0 text-muted-foreground">{row.label}</div>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
            {row.value > 0 && (
              <div
                className={cn("h-full rounded-sm", row.bar)}
                style={{ width: `${Math.max((row.value / total) * 100, 2)}%` }}
              />
            )}
          </div>
          <div className="w-8 shrink-0 text-right font-medium tabular-nums">{row.value}</div>
          <div className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
            {percent(row.value, total)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Average score per period; each bar takes the colour of its grade. */
function ScoreTrend({ periods, weekly }: { periods: QualityPeriod[]; weekly: boolean }) {
  const [readout, setReadout] = useState<string | null>(null);
  return (
    <div>
      <div
        role="img"
        aria-label={`Average health score per ${weekly ? "week" : "day"} over ${periods.length} ${weekly ? "weeks" : "days"}`}
        className="flex h-24 items-end gap-[2px] border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {periods.map((period) => {
          const when = `${weekly ? "Week of " : ""}${shortDate(period.start)}`;
          const text =
            period.avgScore === null
              ? `${when} · no sessions`
              : `${when} · average ${Math.round(period.avgScore)} over ${period.sessions} session${period.sessions === 1 ? "" : "s"}`;
          return (
            // The full-height wrapper is the hover target, so short bars are easy to hit.
            <div
              key={period.start.getTime()}
              title={text}
              onMouseEnter={() => setReadout(text)}
              className="group flex h-full min-w-0 max-w-10 flex-1 items-end"
            >
              {period.avgScore !== null && (
                <div
                  className={cn(
                    "w-full rounded-t group-hover:opacity-75",
                    GRADE_STYLES[gradeOf(Math.round(period.avgScore))].bar,
                  )}
                  style={{ height: `max(2px, ${period.avgScore}%)` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[10px] text-muted-foreground">
        <span className="shrink-0">{periods.length > 0 && shortDate(periods[0].start)}</span>
        <span className={cn("truncate text-xs", readout && "text-foreground")} aria-live="polite">
          {readout ?? "bar height is the average score, colour its grade"}
        </span>
        <span className="shrink-0">
          {periods.length > 1 && shortDate(periods[periods.length - 1].start)}
        </span>
      </div>
    </div>
  );
}

function GroupTable({ rows, groupKey }: { rows: QualityGroup[]; groupKey: GroupKey }) {
  return (
    <Table className="min-w-[520px]">
      <TableHeader>
        <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
          <TableHead className="text-muted-foreground">
            {groupKey === "agent" ? "Agent" : "Project"}
          </TableHead>
          {GROUP_COLUMNS.map((label) => (
            <TableHead key={label} className="text-right text-muted-foreground">
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="max-w-0 w-full">
              <span className="flex items-center gap-2 font-medium">
                {groupKey === "agent" && (
                  <span
                    className={cn("size-2 shrink-0 rounded-full", providerStyle(row.name).dotCls)}
                    aria-hidden
                  />
                )}
                <span className="truncate">
                  {groupKey === "agent" ? providerStyle(row.name).shortLabel : row.name}
                </span>
              </span>
            </TableCell>
            <TableCell className="text-right">{row.sessions.toLocaleString()}</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-center gap-2">
                {Math.round(row.avgScore)}
                <GradeBadge grade={gradeOf(Math.round(row.avgScore))} />
              </span>
            </TableCell>
            <TableCell className="text-right">{Math.round(row.completed * 100)}%</TableCell>
            <TableCell className="text-right">{row.avgFailures.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Session health across sessions: grades, outcomes and recurring problems. */
export function QualityDashboard({
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
  const [range, setRange] = useState("90");
  const [provider, setProvider] = useState("all");
  const [model, setModel] = useState("all");
  const [groupKey, setGroupKey] = useState<GroupKey>("agent");

  const filter: AnalyticsFilter = useMemo(
    () => ({
      days: RANGES.find((r) => r.value === range)?.days ?? null,
      project,
      provider,
      model,
    }),
    [range, project, provider, model],
  );

  const data = useMemo(
    () => (sessions ? computeQuality(sessions, filter) : null),
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
      ...modelsOf(sessions ?? []).map((m) => ({ value: m, label: m })),
    ],
    [sessions],
  );

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">Could not load session health. Use refresh to try again.</p>
      </div>
    );
  }

  if (!sessions || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
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
        icon={HeartPulse}
        title="No sessions to score yet"
        description="Health scores appear once Copilot, Claude Code or Codex writes a transcript to your home directory."
      />
    );
  }

  const weekly = data.days.length > MAX_DAILY_BARS;
  const periods = weekly ? qualityWeeks(data.days) : data.days;
  const unfinished = data.outcomes.abandoned + data.outcomes.errored;
  const withFailures = data.patterns.find((p) => p.id === "tool_failures")?.sessions ?? 0;
  const lowGrades = data.grades.D + data.grades.F;
  const attention = data.sessions
    .filter((s) => s.health.signals.length > 0)
    .slice(0, ATTENTION_LIMIT);

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
        <Button
          variant="outline"
          className="ml-auto"
          disabled={data.scored === 0}
          onClick={() => downloadCsv(`agent-quality-${range}.csv`, qualityToCsv(data.sessions))}
        >
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>

      {data.scored === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No scored sessions for these filters"
          description="Try a longer date range, or clear the project, agent and model filters."
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label="Avg score"
              value={`${Math.round(data.avgScore)}`}
              sub={`grade ${data.grade}`}
              accent
            />
            <StatCard
              label="Scored"
              value={data.scored.toLocaleString()}
              sub={data.unscored > 0 ? `${data.unscored} with no agent activity` : "sessions"}
            />
            <StatCard
              label="Completed"
              value={percent(data.outcomes.completed, data.scored)}
              sub={`${data.outcomes.completed.toLocaleString()} sessions`}
            />
            <StatCard
              label="Unfinished"
              value={unfinished.toLocaleString()}
              sub={`${data.outcomes.abandoned} abandoned · ${data.outcomes.errored} errored`}
            />
            <StatCard
              label="Tool failures"
              value={percent(withFailures, data.scored)}
              sub={`${withFailures.toLocaleString()} sessions affected`}
            />
            <StatCard
              label="Failure rate"
              value={
                data.toolResults > 0
                  ? `${((data.toolFailures / data.toolResults) * 100).toFixed(1)}%`
                  : "—"
              }
              sub={`${data.toolFailures.toLocaleString()} of ${data.toolResults.toLocaleString()} results`}
            />
            <StatCard
              label="Low grades"
              value={lowGrades.toLocaleString()}
              sub="sessions graded D or F"
            />
          </StatCardGrid>

          <Panel title="Recurring problems" note="rule-based, from the transcripts">
            {data.patterns.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                <p className="text-sm">No session in this range lost any points.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.patterns.map((pattern) => {
                  const info = SIGNAL_INFO[pattern.id];
                  return (
                    <li key={pattern.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <h3 className="text-sm font-medium">{info.label}</h3>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {pattern.sessions} of {data.scored} sessions (
                          {percent(pattern.sessions, data.scored)})
                          {pattern.id !== "outcome" &&
                            ` · ${pattern.count.toLocaleString()} in total`}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {info.advice}
                      </p>
                      <ol className="-mx-2 mt-1.5">
                        {pattern.examples.map((s) => (
                          <li key={`${s.provider}:${s.id}`}>
                            <SessionLink session={s} />
                          </li>
                        ))}
                      </ol>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Grades" note={`${data.scored} scored`}>
              <Distribution
                rows={GRADES.map((grade) => ({
                  key: grade,
                  label: <GradeBadge grade={grade} />,
                  value: data.grades[grade],
                  bar: GRADE_STYLES[grade].bar,
                }))}
              />
            </Panel>
            <Panel title="Outcomes">
              <Distribution
                rows={OUTCOMES.filter(
                  (outcome) => outcome !== "in_progress" || data.outcomes.in_progress > 0,
                ).map((outcome) => ({
                  key: outcome,
                  label: OUTCOME_LABELS[outcome],
                  value: data.outcomes[outcome],
                  bar: OUTCOME_BARS[outcome],
                }))}
              />
            </Panel>
          </div>

          {periods.length > 1 && (
            <Panel title="Health trend" note={weekly ? "per week" : "per day"}>
              <ScoreTrend periods={periods} weekly={weekly} />
            </Panel>
          )}

          <Panel
            title="Comparison"
            action={
              <Segmented
                label="Compare by"
                value={groupKey}
                onChange={setGroupKey}
                options={GROUP_OPTIONS}
              />
            }
          >
            <GroupTable
              rows={groupKey === "agent" ? data.agents : data.projects}
              groupKey={groupKey}
            />
          </Panel>

          {attention.length > 0 && (
            <Panel title="Lowest scores" note="worst first">
              <ol className="-mx-2">
                {attention.map((s) => (
                  <li key={`${s.provider}:${s.id}`}>
                    <SessionLink session={s} />
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
