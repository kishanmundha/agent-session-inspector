import type { AnalyticsSession, ProviderId } from "@/lib/providers/types";

/**
 * Cross-session aggregation for the analytics dashboard. It runs in the
 * browser so days and hours follow the viewer's time zone, and so changing a
 * filter never needs another request.
 */

export const METRICS = ["messages", "sessions", "outputTokens", "costUSD"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  messages: "Messages",
  sessions: "Sessions",
  outputTokens: "Output tokens",
  costUSD: "Cost",
};

/** Date ranges offered by the analytics and usage filters. */
export const RANGES: { value: string; label: string; days: number | null }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last year", days: 365 },
  { value: "all", label: "All time", days: null },
];

export interface AnalyticsFilter {
  /** How many days back from today to include; null for all time. */
  days: number | null;
  provider: string;
  model: string;
}

export interface Counts {
  sessions: number;
  messages: number;
  toolCalls: number;
  outputTokens: number;
  activeMs: number;
  /** Estimated list-price cost; a floor when some models have no price. */
  costUSD: number;
}

export interface DayRow extends Counts {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  date: Date;
}

export interface WeekRow extends Counts {
  /** The Sunday the week starts on. */
  start: Date;
}

export interface SessionRow extends Omit<Counts, "sessions"> {
  provider: ProviderId;
  id: string;
  label: string;
  project: string;
}

export interface ProjectRow {
  name: string;
  sessions: number;
  messages: number;
  costUSD: number;
}

export interface AgentRow extends Counts {
  provider: ProviderId;
  topTools: string[];
}

export interface Analytics {
  totals: Counts & { projects: number; activeDays: number };
  messagesPerSession: { mean: number; median: number; p90: number };
  /** Every day in the range, oldest first, including days with no activity. */
  days: DayRow[];
  /** Every week in the range, oldest first. */
  weeks: WeekRow[];
  /** `hourly[metric][weekday][hour]`, weekday 0 = Sunday. */
  hourly: Record<Metric, number[][]>;
  sessions: SessionRow[];
  projects: ProjectRow[];
  tools: { name: string; value: number }[];
  agents: AgentRow[];
  /** Models left out of every cost figure because they have no price. */
  unpricedModels: string[];
}

const emptyCounts = (): Counts => ({
  sessions: 0,
  messages: 0,
  toolCalls: 0,
  outputTokens: 0,
  activeMs: 0,
  costUSD: 0,
});

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Calendar-day arithmetic, so a daylight-saving change cannot skip a day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function grid(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

export function modelsOf(sessions: AnalyticsSession[]): string[] {
  return [...new Set(sessions.map((s) => s.model).filter((m): m is string => !!m))].sort();
}

export function computeAnalytics(
  all: AnalyticsSession[],
  filter: AnalyticsFilter,
  now: Date = new Date(),
): Analytics {
  const today = startOfDay(now);
  const from = filter.days === null ? null : addDays(today, 1 - filter.days).getTime();

  const dayMap = new Map<string, DayRow>();
  const hourly = { messages: grid(), sessions: grid(), outputTokens: grid(), costUSD: grid() };
  const unpriced = new Set<string>();
  const sessions: SessionRow[] = [];
  const projects = new Map<string, ProjectRow>();
  const tools = new Map<string, number>();
  const agents = new Map<ProviderId, AgentRow & { tools: Map<string, number> }>();
  let earliest = today.getTime();

  for (const session of all) {
    if (filter.provider !== "all" && session.provider !== filter.provider) continue;
    if (filter.model !== "all" && session.model !== filter.model) continue;

    const row: SessionRow = {
      provider: session.provider,
      id: session.id,
      label: session.label,
      project: session.project,
      messages: 0,
      toolCalls: 0,
      outputTokens: 0,
      activeMs: 0,
      costUSD: 0,
    };
    let agent = agents.get(session.provider);
    if (!agent) {
      agent = { provider: session.provider, ...emptyCounts(), topTools: [], tools: new Map() };
      agents.set(session.provider, agent);
    }
    // A session counts once per day and once per weekday-hour it touched.
    const seenDays = new Set<string>();
    const seenHours = new Set<number>();
    let inRange = false;

    for (const slot of session.activity) {
      if (from !== null && slot.t < from) continue;
      inRange = true;
      const at = new Date(slot.t);
      const key = dayKey(at);
      let day = dayMap.get(key);
      if (!day) {
        day = { day: key, date: startOfDay(at), ...emptyCounts() };
        dayMap.set(key, day);
        earliest = Math.min(earliest, day.date.getTime());
      }
      const weekday = at.getDay();
      const hour = at.getHours();

      for (const target of [row, day, agent]) {
        target.messages += slot.messages;
        target.toolCalls += slot.toolCalls;
        target.outputTokens += slot.outputTokens;
        target.activeMs += slot.activeMs;
        target.costUSD += slot.costUSD ?? 0;
      }
      hourly.messages[weekday][hour] += slot.messages;
      hourly.outputTokens[weekday][hour] += slot.outputTokens;
      hourly.costUSD[weekday][hour] += slot.costUSD ?? 0;

      if (!seenDays.has(key)) {
        seenDays.add(key);
        day.sessions++;
      }
      const hourKey = weekday * 24 + hour;
      if (!seenHours.has(hourKey)) {
        seenHours.add(hourKey);
        hourly.sessions[weekday][hour]++;
      }
      for (const [name, count] of Object.entries(slot.tools ?? {})) {
        tools.set(name, (tools.get(name) ?? 0) + count);
        agent.tools.set(name, (agent.tools.get(name) ?? 0) + count);
      }
    }

    if (!inRange) continue;
    sessions.push(row);
    agent.sessions++;
    for (const name of session.unpricedModels ?? []) unpriced.add(name);
    const project = projects.get(row.project) ?? {
      name: row.project,
      sessions: 0,
      messages: 0,
      costUSD: 0,
    };
    project.sessions++;
    project.messages += row.messages;
    project.costUSD += row.costUSD;
    projects.set(row.project, project);
  }

  // Fill the range so charts show quiet days as gaps rather than skipping them.
  const first = from === null ? new Date(earliest) : new Date(from);
  const days: DayRow[] = [];
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) {
    const key = dayKey(d);
    days.push(dayMap.get(key) ?? { day: key, date: d, ...emptyCounts() });
  }

  const weeks: WeekRow[] = [];
  for (const day of days) {
    const start = addDays(day.date, -day.date.getDay());
    let week = weeks[weeks.length - 1];
    if (!week || week.start.getTime() !== start.getTime()) {
      week = { start, ...emptyCounts() };
      weeks.push(week);
    }
    week.sessions += day.sessions;
    week.messages += day.messages;
    week.toolCalls += day.toolCalls;
    week.outputTokens += day.outputTokens;
    week.activeMs += day.activeMs;
    week.costUSD += day.costUSD;
  }

  const totals = { ...emptyCounts(), sessions: sessions.length, projects: projects.size, activeDays: dayMap.size };
  for (const s of sessions) {
    totals.messages += s.messages;
    totals.toolCalls += s.toolCalls;
    totals.outputTokens += s.outputTokens;
    totals.activeMs += s.activeMs;
    totals.costUSD += s.costUSD;
  }

  const perSession = sessions.map((s) => s.messages).sort((a, b) => a - b);
  const byValue = (a: [string, number], b: [string, number]) => b[1] - a[1];

  return {
    totals,
    messagesPerSession: {
      mean: sessions.length ? totals.messages / sessions.length : 0,
      median: quantile(perSession, 0.5),
      p90: quantile(perSession, 0.9),
    },
    days,
    weeks,
    hourly,
    sessions,
    projects: [...projects.values()].sort((a, b) => b.messages - a.messages),
    tools: [...tools.entries()].sort(byValue).map(([name, value]) => ({ name, value })),
    agents: [...agents.values()]
      .filter((a) => a.sessions > 0)
      .sort((a, b) => b.messages - a.messages)
      .map(({ tools: agentTools, ...agent }) => ({
        ...agent,
        topTools: [...agentTools.entries()].sort(byValue).slice(0, 3).map(([name]) => name),
      })),
    unpricedModels: [...unpriced].sort(),
  };
}

/** One row per day in the range, for spreadsheets. */
export function daysToCsv(days: DayRow[]): string {
  const header = "date,sessions,messages,tool_calls,output_tokens,active_minutes,estimated_cost_usd";
  const rows = days.map((d) =>
    [
      d.day,
      d.sessions,
      d.messages,
      d.toolCalls,
      d.outputTokens,
      Math.round(d.activeMs / 60_000),
      d.costUSD.toFixed(2),
    ].join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}
