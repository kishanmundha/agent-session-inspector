import type {
  AgentEvent,
  HealthGrade,
  HealthSignal,
  HealthSignalId,
  SessionHealth,
  SessionOutcome,
} from "./types";
import { HEALTH_SIGNALS } from "./types";

/**
 * Points each signal takes off a score of 100. Per-occurrence signals are
 * capped, so one noisy signal cannot fail a session by itself.
 */
const PENALTY = {
  errored: 25,
  abandoned: 15,
  /** At a 100% failure rate; scaled down linearly, reaching the cap at 50%. */
  toolFailureRate: 50,
  toolFailureCap: 25,
  retryLoop: 6,
  retryLoopCap: 18,
  apiError: 2,
  apiErrorCap: 10,
  abortedTurn: 4,
  abortedTurnCap: 12,
  compaction: 3,
  compactionCap: 9,
};

/** The same tool failing this many times running counts as one retry loop. */
const RETRY_LOOP_LENGTH = 3;

/** A tool call the user declined is their choice, not a failure of the tool. */
const REJECTED = /^The user doesn't want to (proceed with this tool use|take this action)/;

export function gradeOf(score: number): HealthGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function build(
  outcome: SessionOutcome,
  toolResults: number,
  toolFailures: number,
  found: Partial<Record<HealthSignalId, HealthSignal>>,
): SessionHealth {
  const signals = HEALTH_SIGNALS.flatMap((id) => found[id] ?? []);
  const lost = signals.reduce((sum, s) => sum + s.penalty, 0);
  const score = Math.max(0, 100 - lost);
  return { score, grade: gradeOf(score), outcome, toolResults, toolFailures, signals };
}

function resultText(data: Record<string, unknown>): string {
  const content = (data.result as { content?: unknown } | undefined)?.content;
  return typeof content === "string" ? content : "";
}

/**
 * Scores how smoothly a session ran. Undefined when the agent never replied
 * or called a tool: there is nothing to judge.
 */
export function assessHealth(events: AgentEvent[]): SessionHealth | undefined {
  let toolResults = 0;
  let toolFailures = 0;
  let retryLoops = 0;
  let apiErrors = 0;
  let abortedTurns = 0;
  let compactions = 0;
  let agentActed = false;
  // What the transcript would end on if it stopped at the current event.
  let outcome: SessionOutcome = "abandoned";
  const failureStreaks = new Map<string, number>();

  for (const e of events) {
    const d = e.data;
    switch (e.type) {
      case "user.message":
        outcome = "abandoned";
        break;
      case "assistant.message":
        agentActed = true;
        // A message that only carries tool calls is not the last word.
        if (String(d.content ?? "").trim()) outcome = "completed";
        break;
      case "tool.execution_start":
      case "external_tool.requested":
        agentActed = true;
        outcome = "abandoned";
        break;
      case "tool.execution_complete":
      case "external_tool.completed": {
        outcome = "abandoned";
        toolResults++;
        const name = String(d.toolName ?? "tool");
        if (d.success !== false || REJECTED.test(resultText(d))) {
          failureStreaks.delete(name);
          break;
        }
        toolFailures++;
        const streak = (failureStreaks.get(name) ?? 0) + 1;
        failureStreaks.set(name, streak);
        if (streak === RETRY_LOOP_LENGTH) retryLoops++;
        break;
      }
      case "file.patch_applied":
        // The patch tool's own result always reads as a success.
        if (d.success === false) toolFailures++;
        break;
      case "session.error":
        apiErrors++;
        outcome = "errored";
        break;
      case "session.turn_aborted":
        abortedTurns++;
        outcome = "abandoned";
        break;
      case "session.compaction_start":
        compactions++;
        break;
    }
  }

  if (!agentActed) return undefined;

  const found: Partial<Record<HealthSignalId, HealthSignal>> = {};
  const per = (id: HealthSignalId, count: number, each: number, cap: number) => {
    if (count > 0) found[id] = { id, count, penalty: Math.min(cap, count * each) };
  };

  if (outcome === "errored" || outcome === "abandoned") {
    found.outcome = { id: "outcome", count: 1, penalty: PENALTY[outcome] };
  }
  if (toolFailures > 0) {
    const rate = toolFailures / Math.max(toolResults, toolFailures);
    found.tool_failures = {
      id: "tool_failures",
      count: toolFailures,
      penalty: Math.min(
        PENALTY.toolFailureCap,
        Math.max(1, Math.round(rate * PENALTY.toolFailureRate)),
      ),
    };
  }
  per("retry_loops", retryLoops, PENALTY.retryLoop, PENALTY.retryLoopCap);
  per("api_errors", apiErrors, PENALTY.apiError, PENALTY.apiErrorCap);
  per("aborted_turns", abortedTurns, PENALTY.abortedTurn, PENALTY.abortedTurnCap);
  per("compactions", compactions, PENALTY.compaction, PENALTY.compactionCap);

  return build(outcome, toolResults, toolFailures, found);
}

/**
 * A transcript that is still being written always looks cut off. While the
 * session runs, an unfinished ending is not held against it. Applied on each
 * read, never cached, so the verdict settles once the agent goes quiet.
 */
export function settleHealth(
  health: SessionHealth | undefined,
  running: boolean,
): SessionHealth | undefined {
  if (!health || !running || health.outcome === "completed") return health;
  const found: Partial<Record<HealthSignalId, HealthSignal>> = {};
  for (const signal of health.signals) {
    if (signal.id !== "outcome") found[signal.id] = signal;
  }
  return build("in_progress", health.toolResults, health.toolFailures, found);
}
