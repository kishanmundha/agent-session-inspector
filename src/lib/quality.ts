import { addDays, dayKey, startOfDay, type AnalyticsFilter } from "@/lib/analytics";
import { gradeOf } from "@/lib/providers/health";
import type {
  AnalyticsSession,
  HealthGrade,
  HealthSignalId,
  ProviderId,
  SessionHealth,
  SessionOutcome,
} from "@/lib/providers/types";
import { HEALTH_SIGNALS } from "@/lib/providers/types";

/**
 * Session health across sessions, for the quality tab. Like the analytics
 * aggregation it runs in the browser, on the same data and filters.
 */

export interface QualitySession {
  provider: ProviderId;
  id: string;
  label: string;
  project: string;
  health: SessionHealth;
  /** Last activity inside the range, epoch milliseconds. */
  lastActive: number;
}

/** One signal across every session it fired in. */
export interface QualityPattern {
  id: HealthSignalId;
  sessions: number;
  /** Occurrences summed over those sessions. */
  count: number;
  /** The sessions it cost the most, worst first. */
  examples: QualitySession[];
}

export interface QualityGroup {
  name: string;
  sessions: number;
  avgScore: number;
  /** Share of sessions that completed, 0 to 1. */
  completed: number;
  /** Tool failures per session. */
  avgFailures: number;
}

export interface QualityPeriod {
  start: Date;
  sessions: number;
  /** Null when no scored session was last active in the period. */
  avgScore: number | null;
}

export interface Quality {
  scored: number;
  /** Sessions in range where the agent never acted, so there is no score. */
  unscored: number;
  avgScore: number;
  grade: HealthGrade;
  grades: Record<HealthGrade, number>;
  outcomes: Record<SessionOutcome, number>;
  toolResults: number;
  toolFailures: number;
  patterns: QualityPattern[];
  /** Every day in the range, oldest first; a session counts on its last active day. */
  days: QualityPeriod[];
  agents: QualityGroup[];
  projects: QualityGroup[];
  /** Scored sessions, lowest score first. */
  sessions: QualitySession[];
}

const EXAMPLES = 3;

interface Tally {
  sessions: number;
  score: number;
  completed: number;
  failures: number;
}

function addTo(groups: Map<string, Tally>, name: string, health: SessionHealth) {
  const tally = groups.get(name) ?? { sessions: 0, score: 0, completed: 0, failures: 0 };
  tally.sessions++;
  tally.score += health.score;
  if (health.outcome === "completed") tally.completed++;
  tally.failures += health.toolFailures;
  groups.set(name, tally);
}

function toGroups(groups: Map<string, Tally>): QualityGroup[] {
  return [...groups.entries()]
    .map(([name, t]) => ({
      name,
      sessions: t.sessions,
      avgScore: t.score / t.sessions,
      completed: t.completed / t.sessions,
      avgFailures: t.failures / t.sessions,
    }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

export function computeQuality(
  all: AnalyticsSession[],
  filter: AnalyticsFilter,
  now: Date = new Date(),
): Quality {
  const today = startOfDay(now);
  const from = filter.days === null ? null : addDays(today, 1 - filter.days).getTime();

  const sessions: QualitySession[] = [];
  let unscored = 0;
  for (const session of all) {
    if (filter.provider !== "all" && session.provider !== filter.provider) continue;
    if (filter.project !== "all" && session.project !== filter.project) continue;
    if (filter.model !== "all" && session.model !== filter.model) continue;
    let lastActive = -Infinity;
    for (const slot of session.activity) {
      if (from === null || slot.t >= from) lastActive = Math.max(lastActive, slot.t);
    }
    if (lastActive === -Infinity) continue;
    if (!session.health) {
      unscored++;
      continue;
    }
    sessions.push({
      provider: session.provider,
      id: session.id,
      label: session.label,
      project: session.project,
      health: session.health,
      lastActive,
    });
  }

  const grades: Record<HealthGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const outcomes: Record<SessionOutcome, number> = {
    completed: 0,
    in_progress: 0,
    abandoned: 0,
    errored: 0,
  };
  const agents = new Map<string, Tally>();
  const projects = new Map<string, Tally>();
  const byDay = new Map<string, { sessions: number; score: number }>();
  const hit = new Map<HealthSignalId, { count: number; rows: { s: QualitySession; penalty: number }[] }>();
  let score = 0;
  let toolResults = 0;
  let toolFailures = 0;
  let earliest = today.getTime();

  for (const s of sessions) {
    const { health } = s;
    score += health.score;
    grades[health.grade]++;
    outcomes[health.outcome]++;
    toolResults += Math.max(health.toolResults, health.toolFailures);
    toolFailures += health.toolFailures;
    addTo(agents, s.provider, health);
    addTo(projects, s.project, health);

    const date = startOfDay(new Date(s.lastActive));
    earliest = Math.min(earliest, date.getTime());
    const day = byDay.get(dayKey(date)) ?? { sessions: 0, score: 0 };
    day.sessions++;
    day.score += health.score;
    byDay.set(dayKey(date), day);

    for (const signal of health.signals) {
      const entry = hit.get(signal.id) ?? { count: 0, rows: [] };
      entry.count += signal.count;
      entry.rows.push({ s, penalty: signal.penalty });
      hit.set(signal.id, entry);
    }
  }

  const days: QualityPeriod[] = [];
  const first = from === null ? new Date(earliest) : new Date(from);
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) {
    const day = byDay.get(dayKey(d));
    days.push({
      start: d,
      sessions: day?.sessions ?? 0,
      avgScore: day ? day.score / day.sessions : null,
    });
  }

  const avgScore = sessions.length ? score / sessions.length : 0;

  return {
    scored: sessions.length,
    unscored,
    avgScore,
    grade: gradeOf(Math.round(avgScore)),
    grades,
    outcomes,
    toolResults,
    toolFailures,
    patterns: HEALTH_SIGNALS.flatMap((id) => {
      const entry = hit.get(id);
      if (!entry) return [];
      return {
        id,
        sessions: entry.rows.length,
        count: entry.count,
        examples: entry.rows
          .sort((a, b) => b.penalty - a.penalty || a.s.health.score - b.s.health.score)
          .slice(0, EXAMPLES)
          .map((row) => row.s),
      };
    }).sort((a, b) => b.sessions - a.sessions),
    days,
    agents: toGroups(agents),
    projects: toGroups(projects),
    sessions: sessions.sort(
      (a, b) => a.health.score - b.health.score || b.lastActive - a.lastActive,
    ),
  };
}

/** Sunday-started weeks, averaged over their sessions rather than their days. */
export function qualityWeeks(days: QualityPeriod[]): QualityPeriod[] {
  const weeks: (QualityPeriod & { total: number })[] = [];
  for (const day of days) {
    const start = addDays(day.start, -day.start.getDay());
    let week = weeks[weeks.length - 1];
    if (!week || week.start.getTime() !== start.getTime()) {
      week = { start, sessions: 0, avgScore: null, total: 0 };
      weeks.push(week);
    }
    week.sessions += day.sessions;
    week.total += (day.avgScore ?? 0) * day.sessions;
    week.avgScore = week.sessions ? week.total / week.sessions : null;
  }
  return weeks.map(({ start, sessions, avgScore }) => ({ start, sessions, avgScore }));
}

/** One row per scored session, for spreadsheets. */
export function qualityToCsv(sessions: QualitySession[]): string {
  const header = [
    "agent",
    "session_id",
    "project",
    "last_active",
    "score",
    "grade",
    "outcome",
    "tool_results",
    "tool_failures",
    ...HEALTH_SIGNALS.filter((id) => id !== "outcome" && id !== "tool_failures"),
  ].join(",");
  const rows = sessions.map((s) => {
    const count = (id: HealthSignalId) => s.health.signals.find((x) => x.id === id)?.count ?? 0;
    return [
      s.provider,
      s.id,
      `"${s.project.replace(/"/g, '""')}"`,
      new Date(s.lastActive).toISOString(),
      s.health.score,
      s.health.grade,
      s.health.outcome,
      s.health.toolResults,
      s.health.toolFailures,
      count("retry_loops"),
      count("api_errors"),
      count("aborted_turns"),
      count("compactions"),
    ].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}
