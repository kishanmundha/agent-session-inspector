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
import { GRADES, GRADE_STYLES, OUTCOMES, OUTCOME_BARS } from "@/lib/health";
import { gradeOf } from "@/lib/providers/health";
import { PROVIDER_ORDER, providerStyle, supportedAgents } from "@/lib/provider-meta";
import { fixed, formatNumber, formatPercent } from "@/lib/format";
import { formatLocale } from "@/i18n/current";
import { useLocale, useT } from "@/i18n/client";
import {
  computeQuality,
  qualityToCsv,
  qualityWeeks,
  type QualityGroup,
  type QualityPeriod,
  type QualitySession,
} from "@/lib/quality";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { anyValue, oneOf, useStoredState } from "@/lib/use-stored-state";
import { cn } from "@/lib/utils";

/** Above this many days the trend groups by week, so bars stay wide enough to read. */
const MAX_DAILY_BARS = 92;

/** How many of the lowest-scoring sessions the attention list shows. */
const ATTENTION_LIMIT = 10;

const GROUP_COLUMNS = ["sessions", "avgScore", "completed", "failuresPerSession"] as const;

type GroupKey = "agent" | "project";

const GROUP_KEYS: GroupKey[] = ["agent", "project"];

const percent = (part: number, whole: number) =>
  whole > 0 ? formatPercent(part / whole) : "—";

const shortDate = (date: Date) =>
  date.toLocaleDateString(formatLocale(), { month: "short", day: "numeric" });

function SessionLink({ session: s }: { session: QualitySession }) {
  const t = useT();
  const locale = useLocale();
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
              t(`health.outcomes.${s.health.outcome}`),
              ...s.health.signals
                .filter((signal) => signal.id !== "outcome")
                .map((signal) => t(`health.signals.${signal.id}.label`)),
            ]
              .map((label) => label.toLocaleLowerCase(locale))
              .join(t("common.listSeparator"))}
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
  const t = useT();
  const [readout, setReadout] = useState<string | null>(null);
  return (
    <div>
      <div
        role="img"
        aria-label={t(weekly ? "quality.trendLabelWeekly" : "quality.trendLabelDaily", {
          count: periods.length,
        })}
        className="flex h-24 items-end gap-[2px] border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {periods.map((period) => {
          const when = weekly
            ? t("usage.weekOf", { date: shortDate(period.start) })
            : shortDate(period.start);
          const text =
            period.avgScore === null
              ? t("quality.trendEmpty", { when })
              : t("quality.trendPoint", {
                  when,
                  score: Math.round(period.avgScore),
                  count: period.sessions,
                });
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
          {readout ?? t("quality.trendHint")}
        </span>
        <span className="shrink-0">
          {periods.length > 1 && shortDate(periods[periods.length - 1].start)}
        </span>
      </div>
    </div>
  );
}

function GroupTable({ rows, groupKey }: { rows: QualityGroup[]; groupKey: GroupKey }) {
  const t = useT();
  return (
    <Table className="min-w-[520px]">
      <TableHeader>
        <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
          <TableHead className="text-muted-foreground">
            {t(`quality.groups.${groupKey}`)}
          </TableHead>
          {GROUP_COLUMNS.map((column) => (
            <TableHead key={column} className="text-right text-muted-foreground">
              {t(`quality.columns.${column}`)}
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
            <TableCell className="text-right">{formatNumber(row.sessions)}</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-center gap-2">
                {Math.round(row.avgScore)}
                <GradeBadge grade={gradeOf(Math.round(row.avgScore))} />
              </span>
            </TableCell>
            <TableCell className="text-right">{formatPercent(row.completed)}</TableCell>
            <TableCell className="text-right">{fixed(row.avgFailures, 1)}</TableCell>
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
  const t = useT();
  const locale = useLocale();
  const { sessions, error } = useAnalyticsSessions(reloadToken);
  const [range, setRange] = useStoredState<string>(
    "quality-range",
    "90",
    oneOf(RANGES.map((r) => r.value)),
  );
  const [storedProvider, setProvider] = useStoredState<string>("quality-provider", "all", anyValue);
  const [storedModel, setModel] = useStoredState<string>("quality-model", "all", anyValue);
  // A remembered agent or model with no sessions any more reads as "all".
  const provider =
    !sessions || sessions.some((s) => s.provider === storedProvider) ? storedProvider : "all";
  const model = !sessions || modelsOf(sessions).includes(storedModel) ? storedModel : "all";
  const [groupKey, setGroupKey] = useStoredState<GroupKey>(
    "quality-group",
    "agent",
    oneOf(GROUP_KEYS),
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
      { value: "all", label: t("home.allAgents") },
      ...providers.map((id) => ({ value: id as string, label: providerStyle(id).shortLabel })),
    ],
    [providers, t],
  );
  const modelOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allModels") },
      ...modelsOf(sessions ?? []).map((m) => ({ value: m, label: m })),
    ],
    [sessions, t],
  );

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">{t("quality.loadError")}</p>
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
        title={t("quality.emptyTitle")}
        description={t("quality.emptyDetail", { agents: supportedAgents(locale) })}
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
        <Button
          variant="outline"
          className="ml-auto"
          disabled={data.scored === 0}
          onClick={() => downloadCsv(`agent-quality-${range}.csv`, qualityToCsv(data.sessions))}
        >
          <Download aria-hidden />
          {t("filters.exportCsv")}
        </Button>
      </div>

      {data.scored === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title={t("quality.noScored")}
          description={t("analytics.noActivityDetail")}
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label={t("quality.avgScore")}
              value={`${Math.round(data.avgScore)}`}
              sub={t("quality.grade", { grade: data.grade })}
              accent
            />
            <StatCard
              label={t("quality.scored")}
              value={formatNumber(data.scored)}
              sub={
                data.unscored > 0
                  ? t("quality.unscored", { count: data.unscored })
                  : t("quality.sessionsWord", { count: data.scored })
              }
            />
            <StatCard
              label={t("quality.completed")}
              value={percent(data.outcomes.completed, data.scored)}
              sub={t("metrics.sessionsCount", { count: data.outcomes.completed })}
            />
            <StatCard
              label={t("quality.unfinished")}
              value={formatNumber(unfinished)}
              sub={t("quality.unfinishedSub", {
                abandoned: data.outcomes.abandoned,
                errored: data.outcomes.errored,
              })}
            />
            <StatCard
              label={t("health.signals.tool_failures.label")}
              value={percent(withFailures, data.scored)}
              sub={t("quality.sessionsAffected", { count: withFailures })}
            />
            <StatCard
              label={t("quality.failureRate")}
              value={
                data.toolResults > 0 ? formatPercent(data.toolFailures / data.toolResults, 1) : "—"
              }
              sub={t("quality.ofResults", { failed: data.toolFailures, count: data.toolResults })}
            />
            <StatCard
              label={t("quality.lowGrades")}
              value={formatNumber(lowGrades)}
              sub={t("quality.lowGradesSub")}
            />
          </StatCardGrid>

          <Panel title={t("quality.recurring")} note={t("quality.recurringNote")}>
            {data.patterns.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                <p className="text-sm">{t("quality.noProblems")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.patterns.map((pattern) => {
                  return (
                    <li key={pattern.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <h3 className="text-sm font-medium">
                          {t(`health.signals.${pattern.id}.label`)}
                        </h3>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t("quality.patternShare", {
                            sessions: pattern.sessions,
                            count: data.scored,
                            percent: percent(pattern.sessions, data.scored),
                          })}
                          {pattern.id !== "outcome" &&
                            ` · ${t("quality.inTotal", { count: pattern.count })}`}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {t(`health.signals.${pattern.id}.advice`)}
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
            <Panel
              title={t("quality.grades")}
              note={t("quality.scoredNote", { count: data.scored })}
            >
              <Distribution
                rows={GRADES.map((grade) => ({
                  key: grade,
                  label: <GradeBadge grade={grade} />,
                  value: data.grades[grade],
                  bar: GRADE_STYLES[grade].bar,
                }))}
              />
            </Panel>
            <Panel title={t("quality.outcomes")}>
              <Distribution
                rows={OUTCOMES.filter(
                  (outcome) => outcome !== "in_progress" || data.outcomes.in_progress > 0,
                ).map((outcome) => ({
                  key: outcome,
                  label: t(`health.outcomes.${outcome}`),
                  value: data.outcomes[outcome],
                  bar: OUTCOME_BARS[outcome],
                }))}
              />
            </Panel>
          </div>

          {periods.length > 1 && (
            <Panel
              title={t("quality.trend")}
              note={weekly ? t("usage.perWeek") : t("usage.perDay")}
            >
              <ScoreTrend periods={periods} weekly={weekly} />
            </Panel>
          )}

          <Panel
            title={t("quality.comparison")}
            action={
              <Segmented
                label={t("quality.compareBy")}
                value={groupKey}
                onChange={setGroupKey}
                options={GROUP_KEYS.map((value) => ({ value, label: t(`quality.groups.${value}`) }))}
              />
            }
          >
            <GroupTable
              rows={groupKey === "agent" ? data.agents : data.projects}
              groupKey={groupKey}
            />
          </Panel>

          {attention.length > 0 && (
            <Panel title={t("quality.lowest")} note={t("quality.worstFirst")}>
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
