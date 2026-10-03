import { addDays, dayKey, startOfDay, type AnalyticsFilter } from "@/lib/analytics";
import type { AnalyticsSession, ProviderId } from "@/lib/providers/types";

/**
 * Cost and token aggregation for the usage tab. Like the analytics module it
 * runs in the browser, so days follow the viewer's time zone and a filter
 * change never needs another request.
 */

export const DIMENSIONS = ["project", "model", "agent"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  project: "Project",
  model: "Model",
  agent: "Agent",
};

/** What the charts measure: dollars, or tokens of every class. */
export type Unit = "costUSD" | "tokens";

export interface UsageFilter extends AnalyticsFilter {
  project: string;
}

export interface Amount {
  /** Estimated list-price cost; a floor when some models have no price. */
  costUSD: number;
  /** Input, output, cache reads and cache writes together. */
  tokens: number;
}

export interface TokenCounts {
  /** Uncached input. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** A day or a week of usage, split along every dimension. */
export interface UsagePeriod extends Amount {
  start: Date;
  /** Days the period covers: 1, or up to 7 for a week. */
  days: number;
  by: Record<Dimension, Record<string, Amount>>;
}

export interface AttributionRow extends Amount {
  /** Project name, model id or provider id, depending on the dimension. */
  name: string;
  sessions: number;
}

export interface UsageSessionRow extends Amount, TokenCounts {
  provider: ProviderId;
  id: string;
  label: string;
  project: string;
}

export interface Usage {
  totals: Amount & TokenCounts & { sessions: number; activeDays: number };
  /** Share of input that was served from cache, 0 to 1. */
  cacheHitRate: number;
  /** Every day in the range, oldest first, including days with no usage. */
  days: UsagePeriod[];
  peakDay: UsagePeriod | null;
  attribution: Record<Dimension, AttributionRow[]>;
  sessions: UsageSessionRow[];
  /** Models left out of every cost figure because they have no price. */
  unpricedModels: string[];
}

const emptyBy = (): UsagePeriod["by"] => ({ project: {}, model: {}, agent: {} });

function addTo(target: Record<string, Amount>, name: string, costUSD: number, tokens: number) {
  const amount = (target[name] ??= { costUSD: 0, tokens: 0 });
  amount.costUSD += costUSD;
  amount.tokens += tokens;
}

export function projectsOf(sessions: AnalyticsSession[]): string[] {
  return [...new Set(sessions.map((s) => s.project))].sort((a, b) => a.localeCompare(b));
}

/** Every model that used tokens, not only each session's last one. */
export function usageModelsOf(sessions: AnalyticsSession[]): string[] {
  return [...new Set(sessions.flatMap((s) => s.usage.map((u) => u.model)))].sort();
}

export function computeUsage(
  all: AnalyticsSession[],
  filter: UsageFilter,
  now: Date = new Date(),
): Usage {
  const today = startOfDay(now);
  const from = filter.days === null ? null : addDays(today, 1 - filter.days).getTime();

  const dayMap = new Map<string, UsagePeriod>();
  const attribution = {
    project: new Map<string, AttributionRow>(),
    model: new Map<string, AttributionRow>(),
    agent: new Map<string, AttributionRow>(),
  };
  const sessions: UsageSessionRow[] = [];
  const unpriced = new Set<string>();
  let earliest = today.getTime();

  for (const session of all) {
    if (filter.provider !== "all" && session.provider !== filter.provider) continue;
    if (filter.project !== "all" && session.project !== filter.project) continue;

    const row: UsageSessionRow = {
      provider: session.provider,
      id: session.id,
      label: session.label,
      project: session.project,
      costUSD: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    const names = { project: session.project, model: "", agent: session.provider as string };
    // A session counts once towards each project, model and agent it touched.
    const touched = new Set<string>();

    for (const slice of session.usage) {
      // A session can switch models, so the model filter applies per slice.
      if (filter.model !== "all" && slice.model !== filter.model) continue;
      if (from !== null && slice.t < from) continue;
      const tokens =
        slice.inputTokens + slice.outputTokens + slice.cacheReadTokens + slice.cacheWriteTokens;
      if (tokens === 0) continue;
      const cost = slice.costUSD ?? 0;
      if (slice.costUSD === null) unpriced.add(slice.model);

      const at = new Date(slice.t);
      const key = dayKey(at);
      let day = dayMap.get(key);
      if (!day) {
        day = { start: startOfDay(at), days: 1, costUSD: 0, tokens: 0, by: emptyBy() };
        dayMap.set(key, day);
        earliest = Math.min(earliest, day.start.getTime());
      }
      day.costUSD += cost;
      day.tokens += tokens;

      row.costUSD += cost;
      row.tokens += tokens;
      row.inputTokens += slice.inputTokens;
      row.outputTokens += slice.outputTokens;
      row.cacheReadTokens += slice.cacheReadTokens;
      row.cacheWriteTokens += slice.cacheWriteTokens;

      names.model = slice.model;
      for (const dimension of DIMENSIONS) {
        const name = names[dimension];
        addTo(day.by[dimension], name, cost, tokens);
        let entry = attribution[dimension].get(name);
        if (!entry) {
          entry = { name, sessions: 0, costUSD: 0, tokens: 0 };
          attribution[dimension].set(name, entry);
        }
        entry.costUSD += cost;
        entry.tokens += tokens;
        const touchKey = `${dimension}|${name}`;
        if (!touched.has(touchKey)) {
          touched.add(touchKey);
          entry.sessions++;
        }
      }
    }

    if (row.tokens > 0) sessions.push(row);
  }

  // Fill the range so the chart shows quiet days as gaps rather than skipping them.
  const first = from === null ? new Date(earliest) : new Date(from);
  const days: UsagePeriod[] = [];
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) {
    days.push(
      dayMap.get(dayKey(d)) ?? { start: d, days: 1, costUSD: 0, tokens: 0, by: emptyBy() },
    );
  }

  const totals = {
    costUSD: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    sessions: sessions.length,
    activeDays: dayMap.size,
  };
  for (const s of sessions) {
    totals.costUSD += s.costUSD;
    totals.tokens += s.tokens;
    totals.inputTokens += s.inputTokens;
    totals.outputTokens += s.outputTokens;
    totals.cacheReadTokens += s.cacheReadTokens;
    totals.cacheWriteTokens += s.cacheWriteTokens;
  }
  const sent = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;

  let peakDay: UsagePeriod | null = null;
  for (const day of dayMap.values()) {
    if (!peakDay || day.costUSD > peakDay.costUSD) peakDay = day;
  }

  const rows = (dimension: Dimension) => [...attribution[dimension].values()];

  return {
    totals,
    cacheHitRate: sent > 0 ? totals.cacheReadTokens / sent : 0,
    days,
    peakDay,
    attribution: { project: rows("project"), model: rows("model"), agent: rows("agent") },
    sessions,
    unpricedModels: [...unpriced].sort(),
  };
}

/** Days merged into Sunday-based weeks, for ranges too long to chart by day. */
export function toWeeks(days: UsagePeriod[]): UsagePeriod[] {
  const weeks: UsagePeriod[] = [];
  for (const day of days) {
    const sunday = addDays(day.start, -day.start.getDay());
    let week = weeks[weeks.length - 1];
    if (!week || addDays(week.start, -week.start.getDay()).getTime() !== sunday.getTime()) {
      // A partial first week starts on its first day, not the Sunday before the range.
      week = { start: day.start, days: 0, costUSD: 0, tokens: 0, by: emptyBy() };
      weeks.push(week);
    }
    week.days++;
    week.costUSD += day.costUSD;
    week.tokens += day.tokens;
    for (const dimension of DIMENSIONS) {
      for (const [name, amount] of Object.entries(day.by[dimension])) {
        addTo(week.by[dimension], name, amount.costUSD, amount.tokens);
      }
    }
  }
  return weeks;
}

/** One row per day and series of the chosen dimension, for spreadsheets. */
export function usageToCsv(days: UsagePeriod[], dimension: Dimension): string {
  const rows = [`date,${dimension},tokens,estimated_cost_usd`];
  for (const day of days) {
    for (const [name, amount] of Object.entries(day.by[dimension])) {
      const quoted = /[",\n]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name;
      rows.push([dayKey(day.start), quoted, amount.tokens, amount.costUSD.toFixed(4)].join(","));
    }
  }
  return rows.join("\n") + "\n";
}
