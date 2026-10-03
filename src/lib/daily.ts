import { ACTIVITY_SLOT_MS, type AnalyticsSession, type ProviderId } from "@/lib/providers/types";
import { addDays, dayKey, startOfDay } from "@/lib/analytics";

/**
 * One calendar day of activity across every session, for the activity tab.
 * Like the analytics, it runs in the browser so the day is the viewer's own.
 */

export interface DayFilter {
  /** Project name, or "all". */
  project: string;
  provider: string;
}

/** One slot of the day: how many sessions were working, and for how long. */
export interface DaySlot {
  /** Slot start, epoch milliseconds. */
  t: number;
  sessions: number;
  activeMs: number;
}

export interface DaySession {
  provider: ProviderId;
  id: string;
  label: string;
  project: string;
  model?: string;
  messages: number;
  toolCalls: number;
  /** Time spent working, the "agent time" of the session that day. */
  activeMs: number;
  costUSD: number;
  /** First and last slot the session touched, to the slot's resolution. */
  start: number;
  end: number;
}

export interface DayShare {
  name: string;
  activeMs: number;
  costUSD: number;
}

export interface DayActivity {
  /** Every slot of the day, oldest first. */
  slots: DaySlot[];
  /** Sessions active that day, earliest first. */
  sessions: DaySession[];
  totals: {
    sessions: number;
    projects: number;
    messages: number;
    toolCalls: number;
    /** Agent time: working time summed over sessions, so overlaps count twice. */
    activeMs: number;
    costUSD: number;
    /** Most sessions working in one slot, and the first slot that reached it. */
    peak: number;
    peakAt: number | null;
  };
  byProject: DayShare[];
  byModel: DayShare[];
  byAgent: (DayShare & { provider: ProviderId })[];
}

const matches = (session: AnalyticsSession, filter: DayFilter) =>
  (filter.provider === "all" || session.provider === filter.provider) &&
  (filter.project === "all" || session.project === filter.project);

/** Local days (YYYY-MM-DD) with any activity, oldest first. */
export function activeDaysOf(all: AnalyticsSession[], filter: DayFilter): string[] {
  const days = new Set<string>();
  for (const session of all) {
    if (!matches(session, filter)) continue;
    for (const slot of session.activity) days.add(dayKey(new Date(slot.t)));
  }
  return [...days].sort();
}

/** Parses a YYYY-MM-DD key as a local day; null when it is not one. */
export function dayFromKey(key: string): Date | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === key ? date : null;
}

function share<T extends DayShare>(rows: Map<string, T>, key: string, create: () => T): T {
  let row = rows.get(key);
  if (!row) rows.set(key, (row = create()));
  return row;
}

export function computeDay(all: AnalyticsSession[], day: Date, filter: DayFilter): DayActivity {
  const from = startOfDay(day).getTime();
  const to = addDays(day, 1).getTime();
  // A day is 23 or 25 hours long when the clocks change.
  const slots: DaySlot[] = Array.from({ length: Math.ceil((to - from) / ACTIVITY_SLOT_MS) }, (_, i) => ({
    t: from + i * ACTIVITY_SLOT_MS,
    sessions: 0,
    activeMs: 0,
  }));

  const sessions: DaySession[] = [];
  const projects = new Map<string, DayShare>();
  const models = new Map<string, DayShare>();
  const agents = new Map<string, DayShare & { provider: ProviderId }>();

  for (const session of all) {
    if (!matches(session, filter)) continue;
    let row: DaySession | null = null;

    for (const slot of session.activity) {
      if (slot.t < from || slot.t >= to) continue;
      row ??= {
        provider: session.provider,
        id: session.id,
        label: session.label,
        project: session.project,
        model: session.model,
        messages: 0,
        toolCalls: 0,
        activeMs: 0,
        costUSD: 0,
        start: slot.t,
        end: slot.t,
      };
      row.messages += slot.messages;
      row.toolCalls += slot.toolCalls;
      row.activeMs += slot.activeMs;
      row.costUSD += slot.costUSD ?? 0;
      row.start = Math.min(row.start, slot.t);
      row.end = Math.max(row.end, slot.t + ACTIVITY_SLOT_MS);

      const cell = slots[Math.floor((slot.t - from) / ACTIVITY_SLOT_MS)];
      if (cell) {
        cell.sessions++;
        cell.activeMs += slot.activeMs;
      }
    }
    if (!row) continue;
    sessions.push(row);

    const targets = [
      share(projects, row.project, () => ({ name: row.project, activeMs: 0, costUSD: 0 })),
      share(agents, row.provider, () => ({
        name: row.provider,
        provider: row.provider,
        activeMs: 0,
        costUSD: 0,
      })),
    ];
    for (const target of targets) {
      target.activeMs += row.activeMs;
      target.costUSD += row.costUSD;
    }
    // Cost goes to the model that was billed; time to the session's last model.
    for (const slice of session.usage) {
      if (slice.t < from || slice.t >= to) continue;
      share(models, slice.model, () => ({ name: slice.model, activeMs: 0, costUSD: 0 })).costUSD +=
        slice.costUSD ?? 0;
    }
    const model = row.model ?? "unknown";
    share(models, model, () => ({ name: model, activeMs: 0, costUSD: 0 })).activeMs += row.activeMs;
  }

  const totals: DayActivity["totals"] = {
    sessions: sessions.length,
    projects: projects.size,
    messages: 0,
    toolCalls: 0,
    activeMs: 0,
    costUSD: 0,
    peak: 0,
    peakAt: null,
  };
  for (const s of sessions) {
    totals.messages += s.messages;
    totals.toolCalls += s.toolCalls;
    totals.activeMs += s.activeMs;
    totals.costUSD += s.costUSD;
  }
  for (const slot of slots) {
    if (slot.sessions > totals.peak) {
      totals.peak = slot.sessions;
      totals.peakAt = slot.t;
    }
  }

  const ranked = <T extends DayShare>(rows: Map<string, T>) =>
    [...rows.values()].sort((a, b) => b.activeMs - a.activeMs || b.costUSD - a.costUSD);

  return {
    slots,
    sessions: sessions.sort((a, b) => a.start - b.start),
    totals,
    byProject: ranked(projects),
    byModel: ranked(models),
    byAgent: ranked(agents),
  };
}
