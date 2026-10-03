import type {
  HealthGrade,
  HealthSignal,
  HealthSignalId,
  SessionHealth,
  SessionOutcome,
} from "@/lib/providers/types";

/**
 * Client-safe wording and colours for session health. The scoring itself
 * lives with the adapters, in `providers/health.ts`.
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

export const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  completed: "Completed",
  in_progress: "In progress",
  abandoned: "Abandoned",
  errored: "Errored",
};

export const OUTCOME_BARS: Record<SessionOutcome, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-sky-500",
  abandoned: "bg-amber-500",
  errored: "bg-red-500",
};

export const OUTCOME_NOTES: Record<SessionOutcome, string> = {
  completed: "The agent had the last word.",
  in_progress: "The agent is still writing to this session.",
  abandoned: "The session stops mid-work, or on a prompt the agent never answered.",
  errored: "The transcript ends on an API error.",
};

/** Timeline filters that show the events behind a signal. */
export interface HealthFocus {
  categories?: string[];
  subKeys?: string[];
  failures?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

interface SignalInfo {
  /** Heading for the pattern across sessions. */
  label: string;
  /** What happened in one session. */
  describe: (signal: HealthSignal, health: SessionHealth) => string;
  /** What to do about it. */
  advice: string;
  focus?: HealthFocus;
}

export const SIGNAL_INFO: Record<HealthSignalId, SignalInfo> = {
  outcome: {
    label: "Unfinished sessions",
    describe: (_, health) => OUTCOME_NOTES[health.outcome],
    advice:
      "Review errored and abandoned sessions first: they spent tokens without reaching an answer.",
  },
  tool_failures: {
    label: "Tool failures",
    describe: (signal, health) => {
      const total = Math.max(health.toolResults, signal.count);
      return `${signal.count.toLocaleString()} of ${plural(total, "tool result")} failed (${Math.round((signal.count / total) * 100)}%).`;
    },
    advice:
      "Open the failed calls and look for a recurring cause: wrong paths, missing dependencies, commands that need a flag.",
    focus: { failures: true },
  },
  retry_loops: {
    label: "Retry loops",
    describe: (signal) =>
      `The same tool failed three or more times in a row, ${plural(signal.count, "time")}.`,
    advice:
      "An agent repeating a failing call lacks the context to try something else. Put the working command in AGENTS.md or CLAUDE.md.",
    focus: { failures: true },
  },
  api_errors: {
    label: "API errors",
    describe: (signal) => `${plural(signal.count, "API error")} or retried request${signal.count === 1 ? "" : "s"}.`,
    advice:
      "Each retry re-sends the whole context. Frequent errors point at rate limits or an overloaded model.",
    focus: { categories: ["session"], subKeys: ["session.error"] },
  },
  aborted_turns: {
    label: "Interrupted turns",
    describe: (signal) => `${plural(signal.count, "turn")} interrupted before the agent finished.`,
    advice:
      "Interruptions usually mean the agent set off in the wrong direction. State the constraints and the success criteria up front.",
    focus: { categories: ["session"], subKeys: ["session.turn_aborted"] },
  },
  compactions: {
    label: "Context compactions",
    describe: (signal) => `Context was compacted ${plural(signal.count, "time")}.`,
    advice:
      "Split long tasks into separate sessions before the context fills up: compacting mid-task loses detail.",
    focus: { categories: ["session"], subKeys: ["session.compaction_start"] },
  },
};

/** "A · 96", for places with room for one short string. */
export function healthSummary(health: SessionHealth): string {
  return `${health.grade} · ${health.score}`;
}
