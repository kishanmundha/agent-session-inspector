"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BarList } from "@/components/common/bar-list";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
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
import { dayKey } from "@/lib/analytics";
import {
  activeDaysOf,
  computeDay,
  dayFromKey,
  type DayFilter,
  type DayShare,
  type DaySlot,
} from "@/lib/daily";
import { formatCost, formatDuration } from "@/lib/format";
import { PROVIDER_ORDER, providerStyle } from "@/lib/provider-meta";
import { ACTIVITY_SLOT_MS } from "@/lib/providers/types";
import { useAnalyticsSessions } from "@/lib/use-analytics-sessions";
import { cn } from "@/lib/utils";

type ShareKey = "activeMs" | "costUSD";

const SHARE_OPTIONS: { value: ShareKey; label: string }[] = [
  { value: "activeMs", label: "Agent time" },
  { value: "costUSD", label: "Cost" },
];

const SESSION_COLUMNS = ["Session", "Model", "Window", "Messages", "Tool calls", "Agent time", "Cost"];

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const minutes = (ms: number) => `${Math.round(ms / 60_000)}m`;

const shortDate = (date: Date) =>
  date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const longDate = (date: Date) =>
  date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** Sessions working at once, slot by slot across the day. */
function ConcurrencyChart({ slots, peak }: { slots: DaySlot[]; peak: number }) {
  const [readout, setReadout] = useState<string | null>(null);
  const max = Math.max(1, peak);
  const perHour = Math.round(3_600_000 / ACTIVITY_SLOT_MS);

  return (
    <div>
      <div
        role="img"
        aria-label={`Sessions working at once through the day, peaking at ${peak}`}
        className="flex h-28 items-end gap-px border-b border-border"
        onMouseLeave={() => setReadout(null)}
      >
        {slots.map((slot) => {
          const text = `${clock(slot.t)}–${clock(slot.t + ACTIVITY_SLOT_MS)} · ${slot.sessions} session${slot.sessions === 1 ? "" : "s"}${slot.sessions > 0 ? ` · ${formatDuration(slot.activeMs)} agent time` : ""}`;
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
          `${Math.round(ACTIVITY_SLOT_MS / 60_000)}-minute slots · times in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
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
}: {
  reloadToken: number;
  /** Shared by every tab on the page; "all" for no filter. */
  project: string;
  onProjectChange: (project: string) => void;
  projectOptions: { value: string; label: string }[];
}) {
  const { sessions, error } = useAnalyticsSessions(reloadToken);
  // Null follows today, so a page left open overnight moves on with the date.
  const [picked, setPicked] = useState<string | null>(null);
  const [provider, setProvider] = useState("all");
  const [shareKey, setShareKey] = useState<ShareKey>("activeMs");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const filter: DayFilter = useMemo(() => ({ project, provider }), [project, provider]);
  const today = dayKey(new Date());
  const key = picked ?? today;
  const day = useMemo(() => dayFromKey(key) ?? new Date(), [key]);

  const activeDays = useMemo(() => (sessions ? activeDaysOf(sessions, filter) : []), [sessions, filter]);
  const activeDates = useMemo(
    () => activeDays.flatMap((d) => dayFromKey(d) ?? []),
    [activeDays],
  );
  const data = useMemo(
    () => (sessions ? computeDay(sessions, day, filter) : null),
    [sessions, day, filter],
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

  if (error && !sessions) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm">Could not load activity. Use refresh to try again.</p>
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

  const previous = activeDays.findLast((d) => d < key);
  const next = activeDays.find((d) => d > key);
  const latest = activeDays[activeDays.length - 1];
  const { totals } = data;
  const shares = (rows: DayShare[], label: (row: DayShare) => string = (row) => row.name) =>
    rows.map((row) => ({ name: label(row), value: row[shareKey] })).filter((row) => row.value > 0);
  const formatShare = shareKey === "costUSD" ? formatCost : minutes;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={!previous}
            onClick={() => previous && setPicked(previous)}
            aria-label="Previous active day"
            title="Previous active day"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="min-w-36 justify-start font-normal tabular-nums">
                  <CalendarDays className="text-muted-foreground" aria-hidden />
                  {shortDate(day)}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={day}
                defaultMonth={day}
                disabled={{ after: new Date() }}
                // Days with any activity are marked, so the quiet ones are easy to skip.
                modifiers={{ active: activeDates }}
                modifiersClassNames={{ active: "[&>button]:font-semibold [&>button]:text-brand" }}
                onSelect={(date) => {
                  if (!date) return;
                  const picked = dayKey(date);
                  setPicked(picked === today ? null : picked);
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            disabled={!next}
            onClick={() => next && setPicked(next === today ? null : next)}
            aria-label="Next active day"
            title="Next active day"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {key !== today && (
          <Button variant="outline" onClick={() => setPicked(null)}>
            Today
          </Button>
        )}
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
        <span className="ml-auto text-xs text-muted-foreground">{longDate(day)}</span>
      </div>

      {totals.sessions === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={key === today ? "No activity yet today" : "No activity on this day"}
          description={
            latest
              ? "No agent wrote to a transcript on this day with these filters."
              : "No session matches these filters on any day."
          }
          action={
            latest ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPicked(latest === today ? null : latest)}
              >
                Go to latest active day
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label="Agent time"
              value={formatDuration(totals.activeMs)}
              sub="summed over sessions"
              accent
            />
            <StatCard
              label="Peak at once"
              value={totals.peak.toLocaleString()}
              sub={totals.peakAt !== null ? `at ${clock(totals.peakAt)}` : undefined}
            />
            <StatCard label="Sessions" value={totals.sessions.toLocaleString()} />
            <StatCard label="Projects" value={totals.projects.toLocaleString()} />
            <StatCard label="Messages" value={totals.messages.toLocaleString()} />
            <StatCard label="Tool calls" value={totals.toolCalls.toLocaleString()} />
            <StatCard label="Est. cost" value={formatCost(totals.costUSD)} sub="at API list prices" />
          </StatCardGrid>

          <Panel title="Concurrency" note={`peak ${totals.peak} at once`}>
            <ConcurrencyChart slots={data.slots} peak={totals.peak} />
          </Panel>

          <Panel title="Sessions" note={`${totals.sessions} total`}>
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                  {SESSION_COLUMNS.map((label, i) => (
                    <TableHead
                      key={label}
                      className={cn("text-muted-foreground", i > 2 && "text-right")}
                    >
                      {label}
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
                      {clock(s.start)}–{clock(s.end)}
                    </TableCell>
                    <TableCell className="text-right">{s.messages.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{s.toolCalls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatDuration(s.activeMs)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCost(s.costUSD)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel
            title="Breakdown"
            action={
              <Segmented
                label="Break down by"
                value={shareKey}
                onChange={setShareKey}
                options={SHARE_OPTIONS}
              />
            }
          >
            <div className="grid gap-5 lg:grid-cols-3">
              {(
                [
                  ["Project", shares(data.byProject)],
                  ["Model", shares(data.byModel)],
                  ["Agent", shares(data.byAgent, (row) => providerStyle(row.name).shortLabel)],
                ] as const
              ).map(([title, items]) => (
                <div key={title} className="min-w-0">
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {title}
                  </h3>
                  <BarList items={items} limit={6} format={formatShare} emptyLabel="Nothing recorded" />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
