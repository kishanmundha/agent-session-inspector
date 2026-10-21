import type {
  ActivitySlot,
  AgentEvent,
  ProviderId,
  SessionStats,
  TokenAnalysis,
  TokenHint,
} from "./types";
import { ACTIVITY_SLOT_MS } from "./types";
import { bucketUsage, isInherited } from "./pricing";
import { assessHealth } from "./health";

/**
 * Cumulative session totals an adapter can attach to any event (usually a
 * shutdown or usage-checkpoint record). When present, the latest one wins over
 * per-message summation.
 */
export interface SessionTotals {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  apiDurationMs?: number;
  premiumRequests?: number;
}

function totalsOf(event: AgentEvent): SessionTotals | null {
  const t = event.data.sessionTotals as SessionTotals | undefined;
  return t && typeof t === "object" ? t : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function computeSessionStats(events: AgentEvent[]): SessionStats {
  const stats: SessionStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalToolCalls: 0,
    totalUserMessages: 0,
    totalAssistantMessages: 0,
    totalApiDurationMs: 0,
    totalPremiumRequests: 0,
    eventCount: events.length,
  };

  let messageInput = 0;
  let messageOutput = 0;
  let messageCacheRead = 0;
  let latestTotals: SessionTotals | null = null;

  for (const e of events) {
    switch (e.type) {
      case "user.message":
        stats.totalUserMessages++;
        break;
      case "tool.execution_start":
      case "external_tool.requested":
        stats.totalToolCalls++;
        break;
      case "assistant.message":
        stats.totalAssistantMessages++;
        break;
    }
    // Per-message usage; adapters only set these on the record that owns them,
    // so streamed messages split across several records are not double counted.
    // History a fork inherited was the parent session's usage, not this one's.
    if (!isInherited(e)) {
      messageInput += num(e.data.inputTokens);
      messageOutput += num(e.data.outputTokens);
      messageCacheRead += num(e.data.cacheReadTokens);
    }

    const totals = totalsOf(e);
    if (totals) latestTotals = totals;
  }

  if (latestTotals) {
    // Some providers emit partial snapshots; keep whichever number is larger.
    stats.totalInputTokens = Math.max(num(latestTotals.inputTokens), messageInput);
    stats.totalOutputTokens = Math.max(num(latestTotals.outputTokens), messageOutput);
    stats.totalCacheReadTokens = Math.max(
      num(latestTotals.cacheReadTokens),
      messageCacheRead,
    );
    stats.totalApiDurationMs = num(latestTotals.apiDurationMs);
    stats.totalPremiumRequests = num(latestTotals.premiumRequests);
  } else {
    stats.totalInputTokens = messageInput;
    stats.totalOutputTokens = messageOutput;
    stats.totalCacheReadTokens = messageCacheRead;
  }

  return stats;
}

/** Cheap stats for the session list, without materializing every event. */
export function quickStatsFromEvents(events: AgentEvent[]) {
  const stats = computeSessionStats(events);
  const inheritedUsage = bucketUsage(events, true);
  return {
    eventCount: events.length,
    toolCallCount: stats.totalToolCalls,
    userMessageCount: stats.totalUserMessages,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
    usage: bucketUsage(events),
    inheritedUsage: inheritedUsage.length > 0 ? inheritedUsage : undefined,
    activity: summarizeActivity(events),
    health: assessHealth(events),
  };
}

const TOOL_NAME_KEYS = ["toolName", "name"] as const;

function toolNameOf(data: Record<string, unknown>): string | null {
  for (const key of TOOL_NAME_KEYS) {
    const v = data[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/** The skill a tool call loaded, when the call is the agent's skill tool. */
function skillOf(name: string, data: Record<string, unknown>): string | null {
  if (!/^skill$/i.test(name)) return null;
  const args = data.arguments as Record<string, unknown> | undefined;
  const skill = args?.skill ?? args?.name;
  return typeof skill === "string" && skill ? skill : null;
}

/**
 * `server__tool` for a call to an MCP server. Claude Code names these
 * `mcp__server__tool`; other agents are recognized by the event type.
 */
function mcpToolOf(type: string, name: string): string | null {
  if (name.startsWith("mcp__")) return name.slice("mcp__".length);
  if (type !== "external_tool.requested") return null;
  return name.includes("__") ? name : `other__${name}`;
}

/** A longer gap between events is time away from the session, not time in it. */
const IDLE_GAP_MS = 5 * 60_000;

/**
 * Collapses a session into short slots of activity: small enough to cache
 * with the session list, detailed enough to chart by day, hour and tool.
 */
export function summarizeActivity(events: AgentEvent[]): ActivitySlot[] {
  const slots = new Map<number, ActivitySlot>();
  // Output tokens reported as running totals, kept apart from per-message
  // usage so a provider that reports both is not counted twice.
  const fromTotals = new Map<number, number>();
  let messageOutput = 0;
  let totalsOutput = 0;
  let previous = NaN;

  for (const e of events) {
    // A fork's inherited history is already in its parent's activity.
    if (isInherited(e)) continue;
    const at = Date.parse(e.timestamp);
    if (Number.isNaN(at)) continue;
    const t = Math.floor(at / ACTIVITY_SLOT_MS) * ACTIVITY_SLOT_MS;
    let slot = slots.get(t);
    if (!slot) {
      slot = { t, messages: 0, toolCalls: 0, outputTokens: 0, activeMs: 0 };
      slots.set(t, slot);
    }

    switch (e.type) {
      case "user.message":
      case "assistant.message":
        slot.messages++;
        break;
      case "tool.execution_start":
      case "external_tool.requested": {
        const name = toolNameOf(e.data) ?? "unknown";
        slot.toolCalls++;
        slot.tools ??= {};
        slot.tools[name] = (slot.tools[name] ?? 0) + 1;
        const skill = skillOf(name, e.data);
        if (skill) {
          slot.skills ??= {};
          slot.skills[skill] = (slot.skills[skill] ?? 0) + 1;
        }
        const mcp = mcpToolOf(e.type, name);
        if (mcp) {
          slot.mcp ??= {};
          slot.mcp[mcp] = (slot.mcp[mcp] ?? 0) + 1;
        }
        break;
      }
    }

    const output = num(e.data.outputTokens);
    slot.outputTokens += output;
    messageOutput += output;

    const runningOutput = num(totalsOf(e)?.outputTokens);
    if (runningOutput > totalsOutput) {
      fromTotals.set(t, (fromTotals.get(t) ?? 0) + runningOutput - totalsOutput);
      totalsOutput = runningOutput;
    }

    if (at > previous && at - previous <= IDLE_GAP_MS) slot.activeMs += at - previous;
    if (!(at < previous)) previous = at;
  }

  // Same rule as computeSessionStats: whichever accounting saw more wins.
  if (totalsOutput > messageOutput) {
    for (const slot of slots.values()) slot.outputTokens = fromTotals.get(slot.t) ?? 0;
  }

  return [...slots.values()].sort((a, b) => a.t - b.t);
}

/** Rough char→token ratio used only for order-of-magnitude hints. */
const CHARS_PER_TOKEN = 4;

/**
 * Provider-agnostic context-cost review. Hints are heuristics: they point at
 * where the tokens went, not at a guaranteed saving.
 */
export function analyzeTokenUsage(
  events: AgentEvent[],
  provider: ProviderId,
): TokenAnalysis {
  const toolCallCounts: Record<string, number> = {};
  const toolResultSizes: number[] = [];
  const readPaths = new Map<string, number>();
  let systemMessageChars = 0;
  let systemMessageCount = 0;
  let toolResultChars = 0;
  let assistantChars = 0;
  let thinkingChars = 0;
  let compactionCount = 0;
  let hookEventCount = 0;
  let largeToolResults = 0;
  let screenshotCount = 0;
  let attachmentChars = 0;
  let errorCount = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let inputTokens = 0;

  // Providers that record explicit tool events also list the same calls on the
  // assistant message that requested them; only count one of the two.
  const hasToolEvents = events.some(
    (e) => e.type === "tool.execution_start" || e.type === "external_tool.requested",
  );

  for (const e of events) {
    const d = e.data;
    outputTokens += num(d.outputTokens);
    inputTokens += num(d.inputTokens);
    cacheReadTokens += num(d.cacheReadTokens);

    switch (e.type) {
      case "assistant.message": {
        assistantChars += String(d.content ?? "").length;
        if (!hasToolEvents) {
          for (const tr of (d.toolRequests as { name?: string }[]) ?? []) {
            if (tr?.name) toolCallCounts[tr.name] = (toolCallCounts[tr.name] || 0) + 1;
          }
        }
        break;
      }
      case "assistant.thinking":
        thinkingChars += String(d.content ?? "").length;
        break;
      // Each agent records its system prompt differently (Copilot as events,
      // Claude Code as prompt snapshots, Codex as base instructions plus
      // developer messages); adapters map all of them onto system.message.
      // Prefer charLength: content is capped for display.
      case "system.message":
        systemMessageChars += num(d.charLength) || String(d.content ?? "").length;
        systemMessageCount++;
        break;
      case "context.attachment":
        attachmentChars += num(d.charLength);
        break;
      case "tool.execution_start":
      case "external_tool.requested": {
        const name = toolNameOf(d);
        if (name) {
          toolCallCounts[name] = (toolCallCounts[name] || 0) + 1;
          if (/screenshot/i.test(name)) screenshotCount++;
        }
        const args = d.arguments as Record<string, unknown> | undefined;
        const target = args?.file_path ?? args?.filePath ?? args?.path;
        if (typeof target === "string" && /read|view|cat/i.test(name ?? "")) {
          readPaths.set(target, (readPaths.get(target) ?? 0) + 1);
        }
        break;
      }
      case "tool.execution_complete":
      case "external_tool.completed": {
        const size = num(d.resultChars);
        toolResultChars += size;
        toolResultSizes.push(size);
        if (size > 10_000) largeToolResults++;
        break;
      }
      case "session.compaction_start":
        compactionCount++;
        break;
      case "session.error":
        errorCount++;
        break;
      case "hook.start":
      case "hook.end":
        hookEventCount++;
        break;
    }
  }

  const topToolsByCount = Object.entries(toolCallCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const hints: TokenHint[] = [];
  const totalToolCalls = Object.values(toolCallCounts).reduce((a, b) => a + b, 0);

  if (totalToolCalls > 50) {
    const topTool = topToolsByCount[0];
    hints.push({
      severity: totalToolCalls > 150 ? "high" : "medium",
      id: "toolVolume",
      values: { count: totalToolCalls, tool: topTool?.name ?? "", uses: topTool?.count ?? 0 },
      saving: "varies",
      focus: { categories: ["tool", "external_tool"] },
    });
  }

  if (largeToolResults > 0) {
    const avgSize = toolResultSizes.length
      ? Math.round(toolResultSizes.reduce((a, b) => a + b, 0) / toolResultSizes.length)
      : 0;
    hints.push({
      severity: largeToolResults > 5 ? "high" : "medium",
      id: "largeResults",
      values: {
        count: largeToolResults,
        avgKb: Math.round(avgSize / 100) / 10,
        thousands: Math.round((largeToolResults * 5000) / CHARS_PER_TOKEN / 1000),
      },
      saving: "tokensPlus",
      focus: { categories: ["tool"], subKeys: ["tool.execution_complete"] },
    });
  }

  const rereads = [...readPaths.entries()].filter(([, n]) => n > 2);
  if (rereads.length > 0) {
    const worst = rereads.sort((a, b) => b[1] - a[1])[0];
    hints.push({
      severity: rereads.length > 3 ? "medium" : "low",
      id: "rereads",
      values: { count: rereads.length, file: worst[0].split("/").pop() ?? worst[0], reads: worst[1] },
      focus: { categories: ["tool"], search: worst[0].split("/").pop() },
    });
  }

  if (screenshotCount > 5) {
    hints.push({
      severity: "medium",
      id: "screenshots",
      values: { count: screenshotCount, tokens: screenshotCount * 800 },
      saving: "tokens",
      focus: { categories: ["tool", "assistant"], search: "screenshot" },
    });
  }

  if (thinkingChars > 20_000) {
    hints.push({
      severity: "low",
      id: "reasoning",
      values: { thousands: Math.round(thinkingChars / CHARS_PER_TOKEN / 1000) },
      focus: { categories: ["assistant"], subKeys: ["assistant.thinking"] },
    });
  }

  if (attachmentChars > 50_000) {
    hints.push({
      severity: "medium",
      id: "injected",
      values: { thousands: Math.round(attachmentChars / 1000) },
      focus: { categories: ["context"] },
    });
  }

  if (errorCount > 2) {
    hints.push({
      severity: errorCount > 10 ? "medium" : "low",
      id: "apiErrors",
      values: { count: errorCount },
      focus: { categories: ["session"], subKeys: ["session.error"] },
    });
  }

  if (cacheReadTokens > 0 && inputTokens > 0) {
    const ratio = cacheReadTokens / (cacheReadTokens + inputTokens);
    if (ratio < 0.5) {
      hints.push({
        severity: "low",
        id: "lowCache",
        values: { percent: Math.round(ratio * 100) },
        focus: { categories: ["assistant"] },
      });
    }
  }

  if (outputTokens > 50_000 && compactionCount === 0) {
    hints.push({
      severity: "medium",
      id: "noCompaction",
      values: { thousands: Math.round(outputTokens / 1000) },
      focus: { categories: ["session"], search: "compaction" },
    });
  }

  if (compactionCount > 0) {
    hints.push({
      severity: "low",
      id: "compacted",
      values: { count: compactionCount },
      focus: {
        categories: ["session"],
        subKeys: ["session.compaction_start", "session.compaction_complete"],
      },
    });
  }

  if (provider === "copilot" && systemMessageCount > 1 && systemMessageChars > 10_000) {
    const perMsg = Math.round(systemMessageChars / systemMessageCount);
    hints.push({
      severity: "low",
      id: "hostContext",
      values: { perTurnK: Math.round(perMsg / 100) / 10, count: systemMessageCount },
      focus: { categories: ["system"], subKeys: ["system.message"] },
    });
  } else if (systemMessageChars > 40_000) {
    hints.push({
      severity: "medium",
      id: "instructions",
      values: { thousands: Math.round(systemMessageChars / 1000) },
      focus: { categories: ["system"], subKeys: ["system.message"] },
    });
  }

  const bashCount = toolCallCounts["bash"] || toolCallCounts["Bash"] || toolCallCounts["shell"] || 0;
  if (bashCount > 30) {
    hints.push({
      severity: "low",
      id: "shellCalls",
      values: { count: bashCount },
      focus: { categories: ["tool"], subKeys: ["tool.execution_start"], search: "bash" },
    });
  }

  return {
    hints,
    topToolsByCount,
    systemMessageChars,
    // Codex world_state is left out: its content is replayed in the developer
    // messages already counted above.
    systemContextChars: systemMessageChars + attachmentChars,
    toolResultChars,
    assistantChars,
    compactionCount,
    hookEventCount,
  };
}
