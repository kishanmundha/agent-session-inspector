"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BarList } from "@/components/common/bar-list";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
import { RangeCostDialog } from "@/components/common/range-cost-dialog";
import { Panel } from "@/components/common/panel";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/common/skeleton";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDays, dayKey } from "@/lib/analytics";
import {
  activeDaysOf,
  computeActivity,
  dayFromKey,
  daysBetween,
  type DayBar,
  type DayFilter,
  type DayShare,
  type DaySlot,
} from "@/lib/daily";
import {
  formatCost,
  formatDuration,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTokens,
} from "@/lib/format";
import { formatLocale } from "@/i18n/current";
import { useT } from "@/i18n/client";
import { PROVIDER_ORDER, providerStyle } from "@/lib/provider-meta";
import { ACTIVITY_SLOT_MS } from "@/lib/providers/types";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import type { HomeFilters } from "@/lib/home-filters";
import { anyValue, oneOf, useStoredState } from "@/lib/use-stored-state";
import { cn } from "@/lib/utils";

type ShareKey = "activeMs" | "costUSD";

const SHARE_KEYS: ShareKey[] = ["activeMs", "costUSD"];

const SESSION_COLUMNS = [
  "session",
  "model",
  "window",
  "messages",
  "toolCalls",
  "tokens",
  "agentTime",
  "cost",
] as const;

const tokens = (n: number) => formatTokens(n) ?? "0";

/** Picked days, inclusive, as YYYY-MM-DD keys. */
interface DayRange {
  from: string;
  to: string;
}

/**
 * The picked range lives in sessionStorage stamped with the day it was
 * picked, so it survives a tab switch or reload but a visit on a later day
 * opens on today again. Nothing stored means today.
 */
const RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})$/;

function parseRange(stored: string, today: string): DayRange | null {
  const match = stored.match(RANGE_PATTERN);
  if (!match || match[1] !== today) return null;
  const [from, to] = [match[2], match[3]];
  return dayFromKey(from) && dayFromKey(to) && from <= to && to <= today ? { from, to } : null;
}

/** Quick picks, each ending today or on a whole past period; labelled by `activity.presets.*`. */
const PRESETS = [
  { key: "today", range: (today: Date) => [today, today] },
  { key: "yesterday", range: (today: Date) => [addDays(today, -1), addDays(today, -1)] },
  { key: "last7", range: (today: Date) => [addDays(today, -6), today] },
  { key: "last30", range: (today: Date) => [addDays(today, -29), today] },
  {
    key: "thisMonth",
    range: (today: Date) => [new Date(today.getFullYear(), today.getMonth(), 1), today],
  },
  {
    key: "lastMonth",
    range: (today: Date) => [
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0),
    ],
  },
] as const satisfies readonly { key: string; range: (today: Date) => Date[] }[];

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(formatLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const percent = (part: number, whole: number) => formatPercent(part / whole);

/** A session's span over a multi-day range: dates only where they change. */
function spanLabel(start: number, end: number) {
  const a = new Date(start);
  const b = new Date(end - 1);
  return dayKey(a) === dayKey(b)
    ? `${monthDay(a)} ${clock(start)}–${clock(end)}`
    : `${monthDay(a)} ${clock(start)} – ${monthDay(b)} ${clock(end)}`;
}

const shortDate = (date: Date) =>
  date.toLocaleDateString(formatLocale(), { month: "short", day: "numeric", year: "numeric" });

const monthDay = (date: Date) =>
  date.toLocaleDateString(formatLocale(), { month: "short", day: "numeric" });

const longDate = (date: Date) =>
  date.toLocaleDateString(formatLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

function rangeLabel(from: Date, to: Date) {
  if (from.getTime() === to.getTime()) return shortDate(from);
  return from.getFullYear() === to.getFullYear()
    ? `${monthDay(from)} – ${shortDate(to)}`
    : `${shortDate(from)} – ${shortDate(to)}`;
}

/** Agent time and sessions day by day, for a range of more than one day. */
function DailyChart({ days, peak }: { days: DayBar[]; peak: number }) {
  const t = useT();
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(1, ...days.map((d) => d.activeMs));
  const every = Math.max(1, Math.ceil(days.length / 8));

  return (
    <div>
      <div
        role="img"
        aria-label={t("activity.dailyLabel", { count: days.length })}
        className="flex h-28 items-end gap-0.5 border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {days.map((day) => {
          const text = [
            shortDate(new Date(day.t)),
            t("metrics.sessionsCount", { count: day.sessions }),
            ...(day.activeMs > 0
              ? [
                  t("activity.agentTimeAmount", { amount: formatDuration(day.activeMs) }),
                  formatCost(day.costUSD),
                ]
              : []),
          ].join(" · ");
          return (
            <div
              key={day.t}
              title={text}
              onMouseEnter={() => setReadout(text)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[2px] bg-brand group-hover:bg-brand/75"
                style={{ height: day.activeMs > 0 ? `max(3px, ${(day.activeMs / max) * 100}%)` : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex text-[10px] text-muted-foreground" aria-hidden>
        {days.map((day, i) => (
          <span key={day.t} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? monthDay(new Date(day.t)) : ""}
          </span>
        ))}
      </div>
      <p
        className={cn("mt-2 truncate text-xs text-muted-foreground", readout && "text-foreground")}
        aria-live="polite"
      >
        {readout ?? t("activity.dailyHint", { count: peak })}
      </p>
    </div>
  );
}

/** Sessions working at once, slot by slot across the day. */
function ConcurrencyChart({ slots, peak }: { slots: DaySlot[]; peak: number }) {
  const t = useT();
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(1, peak);
  const perHour = Math.round(3_600_000 / ACTIVITY_SLOT_MS);

  return (
    <div>
      <div
        role="img"
        aria-label={t("activity.concurrencyLabel", { peak })}
        className="flex h-28 items-end gap-px border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {slots.map((slot) => {
          const text = [
            `${clock(slot.t)}–${clock(slot.t + ACTIVITY_SLOT_MS)}`,
            t("metrics.sessionsCount", { count: slot.sessions }),
            ...(slot.sessions > 0
              ? [t("activity.agentTimeAmount", { amount: formatDuration(slot.activeMs) })]
              : []),
          ].join(" · ");
          return (
            // The full-height wrapper is the hover target, so empty slots still read out.
            <div
              key={slot.t}
              title={text}
              onMouseEnter={() => setReadout(text)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[2px] bg-brand group-hover:bg-brand/75"
                style={{ height: slot.sessions > 0 ? `max(3px, ${(slot.sessions / max) * 100}%)` : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex text-[10px] text-muted-foreground" aria-hidden>
        {slots.map((slot, i) =>
          i % (perHour * 3) === 0 ? (
            <span key={slot.t} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
              {clock(slot.t)}
            </span>
          ) : (
            <span key={slot.t} className="min-w-0 flex-1" />
          ),
        )}
      </div>
      <p
        className={cn("mt-2 truncate text-xs text-muted-foreground", readout && "text-foreground")}
        aria-live="polite"
      >
        {readout ??
          t("activity.concurrencyHint", {
            minutes: Math.round(ACTIVITY_SLOT_MS / 60_000),
            zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
      </p>
    </div>
  );
}

/** One day at a time: who was working when, for how long, and at what cost. */
export function ActivityDashboard({
  reloadToken,
  project,
  onProjectChange,
  projectOptions,
  filters,
  onFiltersChange,
}: {
  reloadToken: number;
  /** Shared by every tab on the page; "all" for no filter. */
  project: string;
  onProjectChange: (project: string) => void;
  projectOptions: { value: string; label: string }[];
  /** Range, agent and model, shared by every tab on the page like the project. */
  filters: HomeFilters;
  onFiltersChange: (patch: Partial<HomeFilters>) => void;
}) {
  const t = useT();
  const { sessions, error } = useAnalyticsSessions(reloadToken);
  const today = dayKey(new Date());
  const [storedRange, setStoredRange] = useStoredState<string>("activity-range", "", anyValue, "session");
  const pickedProvider = filters.provider;
  const setProvider = (provider: string) => onFiltersChange({ provider });
  const [shareKey, setShareKey] = useStoredState<ShareKey>(
    "activity-share",
    "activeMs",
    oneOf(SHARE_KEYS),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  // The first day clicked in the calendar, while it waits for the second.
  const [anchor, setAnchor] = useState<string | null>(null);

  // No stored range follows today, so a page left open overnight moves on with the date.
  const [fromDay, toDay] = useMemo(() => {
    const picked = parseRange(storedRange, today) ?? { from: today, to: today };
    return [dayFromKey(picked.from) ?? new Date(), dayFromKey(picked.to) ?? new Date()];
  }, [storedRange, today]);
  const range: DayRange = { from: dayKey(fromDay), to: dayKey(toDay) };
  const single = range.from === range.to;
  const isToday = single && range.from === today;

  function pick(from: string, to: string) {
    setStoredRange(from === today && to === today ? "" : `${today}|${from}|${to}`);
  }

  // A stored agent with no sessions any more reads as all agents.
  const provider =
    !sessions || sessions.some((s) => s.provider === pickedProvider) ? pickedProvider : "all";
  const filter: DayFilter = useMemo(() => ({ project, provider }), [project, provider]);

  const activeDays = useMemo(() => (sessions ? activeDaysOf(sessions, filter) : []), [sessions, filter]);
  const activeDates = useMemo(
    () => activeDays.flatMap((d) => dayFromKey(d) ?? []),
    [activeDays],
  );
  const data = useMemo(
    () => (sessions ? computeActivity(sessions, fromDay, toDay, filter) : null),
    [sessions, fromDay, toDay, filter],
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

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">{t("activity.loadError")}</p>
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
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  // One day steps between active days; a range steps by its own length.
  const span = daysBetween(fromDay, toDay);
  const shift = (by: number) => {
    const to = addDays(toDay, by);
    const clamped = dayKey(to) > today ? new Date() : to;
    pick(dayKey(addDays(clamped, -(span - 1))), dayKey(clamped));
  };
  const previous = single ? activeDays.findLast((d) => d < range.from) : null;
  const next = single ? activeDays.find((d) => d > range.from) : null;
  const latest = activeDays[activeDays.length - 1];
  const { totals } = data;
  const allInput = totals.inputTokens + totals.cacheWriteTokens + totals.cacheReadTokens;
  const allTokens = allInput + totals.outputTokens;
  const shares = (rows: DayShare[], label: (row: DayShare) => string = (row) => row.name) =>
    rows.map((row) => ({ name: label(row), value: row[shareKey] })).filter((row) => row.value > 0);
  const formatShare = shareKey === "costUSD" ? formatCost : formatMinutes;
  const previousLabel = single
    ? t("activity.previousDay")
    : t("activity.previousDays", { count: span });
  const nextLabel = single ? t("activity.nextDay") : t("activity.nextDays", { count: span });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={single && !previous}
            onClick={() => (single ? previous && pick(previous, previous) : shift(-span))}
            aria-label={previousLabel}
            title={previousLabel}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Popover
            open={calendarOpen}
            onOpenChange={(open) => {
              setCalendarOpen(open);
              setAnchor(null);
            }}
          >
            <PopoverTrigger
              render={
                <Button variant="outline" className="min-w-36 justify-start font-normal tabular-nums">
                  <CalendarDays className="text-muted-foreground" aria-hidden />
                  {rangeLabel(fromDay, toDay)}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="flex flex-wrap gap-1 border-b border-border p-2 sm:w-32 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
                  {PRESETS.map((preset) => {
                    const [from, to] = preset.range(dayFromKey(today) ?? new Date()).map(dayKey);
                    return (
                      <Button
                        key={preset.key}
                        variant={from === range.from && to === range.to ? "secondary" : "ghost"}
                        size="sm"
                        className="justify-start font-normal"
                        onClick={() => {
                          pick(from, to);
                          setCalendarOpen(false);
                        }}
                      >
                        {t(`activity.presets.${preset.key}`)}
                      </Button>
                    );
                  })}
                </div>
                {/* As wide as the calendar: the hint wraps rather than widening it. */}
                <div className="w-min">
                  <Calendar
                    mode="range"
                    selected={{ from: fromDay, to: toDay }}
                    defaultMonth={toDay}
                    disabled={{ after: new Date() }}
                    // Days with any activity are marked, so the quiet ones are easy to skip.
                    modifiers={{ active: activeDates }}
                    // Days of the neighbouring months are dimmed, so the shown month reads clearly.
                    modifiersClassNames={{
                      active:
                        "[&>button]:font-semibold [&>button]:text-brand data-[outside=true]:[&>button]:text-brand/45",
                    }}
                    // The first click shows that day at once; a second click
                    // makes it a range and closes the picker.
                    onSelect={(_, date) => {
                      const clicked = dayKey(date);
                      if (anchor === null) {
                        pick(clicked, clicked);
                        setAnchor(clicked);
                        return;
                      }
                      pick(...((clicked < anchor ? [clicked, anchor] : [anchor, clicked]) as [string, string]));
                      setAnchor(null);
                      setCalendarOpen(false);
                    }}
                  />
                  <p className="px-3 pb-3 text-xs text-muted-foreground">
                    {anchor ? t("activity.pickSecond") : t("activity.pickFirst")}
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            disabled={single ? !next : range.to >= today}
            onClick={() => (single ? next && pick(next, next) : shift(span))}
            aria-label={nextLabel}
            title={nextLabel}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {!isToday && (
          <Button variant="outline" onClick={() => pick(today, today)}>
            {t("activity.presets.today")}
          </Button>
        )}
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
        <span className="ml-auto text-xs text-muted-foreground">
          {single ? longDate(fromDay) : t("activity.days", { count: span })}
        </span>
      </div>

      {totals.sessions === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            isToday
              ? t("activity.noneToday")
              : single
                ? t("activity.noneOnDay")
                : t("activity.noneInRange")
          }
          description={
            latest
              ? single
                ? t("activity.noneDetailDay")
                : t("activity.noneDetailRange")
              : t("activity.noneAnyDay")
          }
          action={
            latest ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pick(latest, latest)}
              >
                {t("activity.goToLatest")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label={t("activity.agentTime")}
              value={formatDuration(totals.activeMs)}
              sub={t("activity.summed")}
              accent
            />
            <StatCard
              label={t("activity.peakAtOnce")}
              value={formatNumber(totals.peak)}
              sub={
                totals.peakAt !== null
                  ? single
                    ? t("activity.atTime", { time: clock(totals.peakAt) })
                    : t("activity.onDayAtTime", {
                        day: monthDay(new Date(totals.peakAt)),
                        time: clock(totals.peakAt),
                      })
                  : undefined
              }
            />
            <StatCard label={t("stats.sessions")} value={formatNumber(totals.sessions)} />
            <StatCard label={t("stats.projects")} value={formatNumber(totals.projects)} />
            <StatCard label={t("stats.messages")} value={formatNumber(totals.messages)} />
            <StatCard label={t("stats.toolCalls")} value={formatNumber(totals.toolCalls)} />
            <StatCard
              label={t("stats.estCost")}
              value={formatCost(totals.costUSD)}
              sub={t("stats.atListPrices")}
              onClick={() => setCostOpen(true)}
            />
            {allTokens > 0 && (
              <>
                <StatCard
                  label={t("tokens.total")}
                  value={tokens(allTokens)}
                  sub={t("tokens.inOut", {
                    input: tokens(allInput),
                    output: tokens(totals.outputTokens),
                  })}
                  hint={t("tokens.totalHint")}
                />
                <StatCard
                  label={t("tokens.uncached")}
                  value={tokens(totals.inputTokens)}
                  sub={
                    allInput > 0
                      ? t("tokens.ofInput", { percent: percent(totals.inputTokens, allInput) })
                      : undefined
                  }
                  hint={t("tokens.uncachedHint")}
                />
                <StatCard
                  label={t("tokens.cacheWrites")}
                  value={tokens(totals.cacheWriteTokens)}
                  sub={
                    allInput > 0
                      ? t("tokens.ofInput", { percent: percent(totals.cacheWriteTokens, allInput) })
                      : undefined
                  }
                  hint={t("tokens.cacheWritesHint")}
                />
                <StatCard
                  label={t("tokens.cacheReads")}
                  value={tokens(totals.cacheReadTokens)}
                  sub={
                    allInput > 0
                      ? t("tokens.ofInput", { percent: percent(totals.cacheReadTokens, allInput) })
                      : undefined
                  }
                  hint={t("tokens.cacheReadsHint")}
                />
                <StatCard
                  label={t("tokens.output")}
                  value={tokens(totals.outputTokens)}
                  sub={t("tokens.generated")}
                  hint={t("tokens.outputHint")}
                />
              </>
            )}
          </StatCardGrid>

          {single ? (
            <Panel
              title={t("activity.concurrency")}
              note={t("activity.peakNote", { count: totals.peak })}
            >
              <ConcurrencyChart slots={data.slots} peak={totals.peak} />
            </Panel>
          ) : (
            <Panel
              title={t("activity.daily")}
              note={t("activity.daysActive", {
                active: data.days.filter((d) => d.sessions > 0).length,
                count: span,
              })}
            >
              <DailyChart days={data.days} peak={totals.peak} />
            </Panel>
          )}

          <RangeCostDialog
            sessions={sessions}
            keep={(session, slice) =>
              (provider === "all" || session.provider === provider) &&
              (project === "all" || session.project === project) &&
              slice.t >= fromDay.getTime() &&
              slice.t < addDays(toDay, 1).getTime()
            }
            scope={{ sessions: totals.sessions, period: rangeLabel(fromDay, toDay) }}
            open={costOpen}
            onOpenChange={setCostOpen}
          />

          <Panel
            title={t("stats.sessions")}
            note={t("analytics.total", { count: totals.sessions })}
          >
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                  {SESSION_COLUMNS.map((column, i) => (
                    <TableHead
                      key={column}
                      className={cn("text-muted-foreground", i > 2 && "text-right")}
                    >
                      {t(`activity.columns.${column}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {data.sessions.map((s) => (
                  <TableRow key={`${s.provider}:${s.id}`}>
                    <TableCell className="w-full max-w-0">
                      <Link
                        href={`/sessions/${s.provider}/${s.id}`}
                        className="block truncate rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {s.label}
                      </Link>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", providerStyle(s.provider).dotCls)}
                          aria-hidden
                        />
                        <span className="truncate">
                          {providerStyle(s.provider).shortLabel} · {s.project}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                      {s.model ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {single
                        ? `${clock(s.start)}–${clock(s.end)}`
                        : spanLabel(s.start, s.end)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(s.messages)}</TableCell>
                    <TableCell className="text-right">{formatNumber(s.toolCalls)}</TableCell>
                    <TableCell className="text-right">{tokens(s.tokens)}</TableCell>
                    <TableCell className="text-right">{formatDuration(s.activeMs)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCost(s.costUSD)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel
            title={t("activity.breakdown")}
            action={
              <Segmented
                label={t("usage.breakDownBy")}
                value={shareKey}
                onChange={setShareKey}
                options={SHARE_KEYS.map((value) => ({ value, label: t(`activity.share.${value}`) }))}
              />
            }
          >
            <div className="grid gap-5 lg:grid-cols-3">
              {(
                [
                  [t("usage.dimensions.project"), shares(data.byProject)],
                  [t("usage.dimensions.model"), shares(data.byModel)],
                  [
                    t("usage.dimensions.agent"),
                    shares(data.byAgent, (row) => providerStyle(row.name).shortLabel),
                  ],
                ] as const
              ).map(([title, items]) => (
                <div key={title} className="min-w-0">
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {title}
                  </h3>
                  <BarList
                    items={items}
                    limit={6}
                    format={formatShare}
                    emptyLabel={t("activity.nothingRecorded")}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
