import type {
  AgentEvent,
  ProviderId,
  SessionStats,
  TokenAnalysis,
  TokenHint,
} from "./types";

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
    messageInput += num(e.data.inputTokens);
    messageOutput += num(e.data.outputTokens);
    messageCacheRead += num(e.data.cacheReadTokens);

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
  return {
    eventCount: events.length,
    toolCallCount: stats.totalToolCalls,
    userMessageCount: stats.totalUserMessages,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
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
      category: "Tool Calls",
      title: `High tool call volume (${totalToolCalls} calls)`,
      description: `Most used: ${topTool?.name} (${topTool?.count}×). Every call adds its arguments and result to the context of each later turn. Batch related operations and prefer targeted commands.`,
      saving: "Varies",
      focus: { categories: ["tool", "external_tool"] },
    });
  }

  if (largeToolResults > 0) {
    const avgSize = toolResultSizes.length
      ? Math.round(toolResultSizes.reduce((a, b) => a + b, 0) / toolResultSizes.length)
      : 0;
    hints.push({
      severity: largeToolResults > 5 ? "high" : "medium",
      category: "Tool Results",
      title: `${largeToolResults} tool result${largeToolResults > 1 ? "s" : ""} over 10KB`,
      description: `Large outputs (avg ${(avgSize / 1000).toFixed(1)}KB) dominate context. Read file ranges instead of whole files, and pipe shell output through head/tail.`,
      saving: `~${Math.round((largeToolResults * 5000) / CHARS_PER_TOKEN / 1000)}K+ tokens`,
      focus: { categories: ["tool"], subKeys: ["tool.execution_complete"] },
    });
  }

  const rereads = [...readPaths.entries()].filter(([, n]) => n > 2);
  if (rereads.length > 0) {
    const worst = rereads.sort((a, b) => b[1] - a[1])[0];
    hints.push({
      severity: rereads.length > 3 ? "medium" : "low",
      category: "Redundant Reads",
      title: `${rereads.length} file${rereads.length > 1 ? "s" : ""} read 3+ times`,
      description: `${worst[0].split("/").pop()} was read ${worst[1]} times. Re-reading a file the agent already has in context duplicates its whole content.`,
      focus: { categories: ["tool"], search: worst[0].split("/").pop() },
    });
  }

  if (screenshotCount > 5) {
    hints.push({
      severity: "medium",
      category: "Browser Tools",
      title: `${screenshotCount} screenshots captured`,
      description:
        "Screenshots bill as image tokens. Prefer an accessibility/DOM snapshot when you only need page structure rather than pixels.",
      saving: `~${screenshotCount * 800} tokens`,
      focus: { categories: ["tool", "assistant"], search: "screenshot" },
    });
  }

  if (thinkingChars > 20_000) {
    hints.push({
      severity: "low",
      category: "Reasoning",
      title: `~${Math.round(thinkingChars / CHARS_PER_TOKEN / 1000)}K tokens of reasoning`,
      description:
        "Extended reasoning is billed as output. Lower the reasoning effort for routine work and reserve it for genuinely hard steps.",
      focus: { categories: ["assistant"], subKeys: ["assistant.thinking"] },
    });
  }

  if (attachmentChars > 50_000) {
    hints.push({
      severity: "medium",
      category: "Injected Context",
      title: `~${Math.round(attachmentChars / 1000)}K chars of auto-attached context`,
      description:
        "Attachments (tool definitions, tool/skill listings, file snapshots, reminders) are injected by the agent. Trimming unused MCP servers and skills shrinks every request.",
      focus: { categories: ["context"] },
    });
  }

  if (errorCount > 2) {
    hints.push({
      severity: errorCount > 10 ? "medium" : "low",
      category: "Reliability",
      title: `${errorCount} API errors / retries`,
      description:
        "Each retry re-sends the full request context. Frequent retries inflate input tokens without producing output.",
      focus: { categories: ["session"], subKeys: ["session.error"] },
    });
  }

  if (cacheReadTokens > 0 && inputTokens > 0) {
    const ratio = cacheReadTokens / (cacheReadTokens + inputTokens);
    if (ratio < 0.5) {
      hints.push({
        severity: "low",
        category: "Prompt Cache",
        title: `Only ${Math.round(ratio * 100)}% of input came from cache`,
        description:
          "Cache hits are much cheaper than fresh input. Changing early context (system prompt, tool set, attached files) mid-session invalidates the cache prefix.",
        focus: { categories: ["assistant"] },
      });
    }
  }

  if (outputTokens > 50_000 && compactionCount === 0) {
    hints.push({
      severity: "medium",
      category: "Context Management",
      title: "No context compaction detected",
      description: `Long session (${(outputTokens / 1000).toFixed(0)}K output tokens) with no compaction. Compacting summarizes history and cuts the per-turn input cost.`,
      focus: { categories: ["session"], search: "compaction" },
    });
  }

  if (compactionCount > 0) {
    hints.push({
      severity: "low",
      category: "Context Management",
      title: `Context compacted ${compactionCount} time${compactionCount > 1 ? "s" : ""}`,
      description:
        "Compaction is working as intended. For very long sessions, compacting more often keeps per-turn input smaller.",
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
      category: "Platform Context",
      title: "System context is host-managed",
      description: `System context repeats each turn (~${(perMsg / 1000).toFixed(1)}K chars × ${systemMessageCount} turns). That is expected in the Copilot runtime and is usually not user-configurable.`,
      focus: { categories: ["system"], subKeys: ["system.message"] },
    });
  } else if (systemMessageChars > 40_000) {
    hints.push({
      severity: "medium",
      category: "Instructions",
      title: `~${Math.round(systemMessageChars / 1000)}K chars of system instructions`,
      description:
        "Instruction files (AGENTS.md / CLAUDE.md), skills and developer messages ride along on every request. Keep them short and scope-specific.",
      focus: { categories: ["system"], subKeys: ["system.message"] },
    });
  }

  const bashCount = toolCallCounts["bash"] || toolCallCounts["Bash"] || toolCallCounts["shell"] || 0;
  if (bashCount > 30) {
    hints.push({
      severity: "low",
      category: "Tool Calls",
      title: `${bashCount} shell calls`,
      description:
        "Each shell call adds its output to context. Combine commands with && and limit output with head/tail.",
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
