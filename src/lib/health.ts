import type { Translator } from "@/i18n/client";
import type {
  HealthGrade,
  HealthSignal,
  HealthSignalId,
  SessionHealth,
  SessionOutcome,
} from "@/lib/providers/types";

/**
 * Client-safe wording and colours for session health. The scoring itself
 * lives with the adapters, in `providers/health.ts`. The words are the
 * `health.*` messages.
 */

export const GRADES: HealthGrade[] = ["A", "B", "C", "D", "F"];

export const GRADE_STYLES: Record<HealthGrade, { badge: string; bar: string }> = {
  A: {
    badge:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  B: {
    badge:
      "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  C: {
    badge:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  D: {
    badge:
      "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    bar: "bg-orange-500",
  },
  F: {
    badge:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    bar: "bg-red-500",
  },
};

export const OUTCOMES: SessionOutcome[] = ["completed", "in_progress", "abandoned", "errored"];

export const OUTCOME_BARS: Record<SessionOutcome, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-sky-500",
  abandoned: "bg-amber-500",
  errored: "bg-red-500",
};

/** Timeline filters that show the events behind a signal. */
export interface HealthFocus {
  categories?: string[];
  subKeys?: string[];
  failures?: boolean;
}

/** The timeline events behind each signal, for the "view related events" link. */
export const SIGNAL_FOCUS: Partial<Record<HealthSignalId, HealthFocus>> = {
  tool_failures: { failures: true },
  retry_loops: { failures: true },
  api_errors: { categories: ["session"], subKeys: ["session.error"] },
  aborted_turns: { categories: ["session"], subKeys: ["session.turn_aborted"] },
  compactions: { categories: ["session"], subKeys: ["session.compaction_start"] },
};

/** What happened in one session, for a signal. */
export function describeSignal(
  t: Translator,
  signal: HealthSignal,
  health: SessionHealth,
): string {
  if (signal.id === "outcome") return t(`health.outcomeNotes.${health.outcome}`);
  if (signal.id === "tool_failures") {
    const total = Math.max(health.toolResults, signal.count);
    return t("health.describe.tool_failures", {
      failed: signal.count,
      count: total,
      percent: Math.round((signal.count / total) * 100),
    });
  }
  return t(`health.describe.${signal.id}`, { count: signal.count });
}

/** "A · 96", for places with room for one short string. */
export function healthSummary(health: SessionHealth): string {
  return `${health.grade} · ${health.score}`;
}
