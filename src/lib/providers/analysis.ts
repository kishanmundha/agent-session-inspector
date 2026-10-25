import type {
  ActivitySlot,
  AgentEvent,
  ProviderId,
  SessionStats,
  TokenAnalysis,
  TokenHint,
  ToolOutputRow,
  ToolOutputTally,
  ToolResultRecord,
} from "./types";
import { ACTIVITY_SLOT_MS } from "./types";
import {
  bucketUsage,
  eventCostLines,
  isBilledRequest,
  isInherited,
  resendRate,
  writeRate,
} from "./pricing";
import { assessHealth } from "./health";
import { CHARS_PER_TOKEN, mcpServerOf } from "@/lib/tool-names";
import { SHELL_TOOL, shellCommand } from "@/lib/edits";
import { commandSignature } from "@/lib/shell-writes";

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


/** The name a tool's output is filed under: MCP tools as `mcp__server__tool`. */
function toolOutputKey(type: string, name: string): string {
  const mcp = mcpToolOf(type, name);
  return mcp ? `mcp__${mcp}` : name;
}

/** The tool a result came from and, for a shell tool, the command it ran. */
interface OutputSource {
  key: string;
  command?: { signature: string; text: string };
}

interface ToolOutputVisitor {
  /**
   * The model wrote `chars` of input for a call; `writer` is the billed
   * request that wrote it, when one came before. `entry` is as for `carried`.
   */
  input?(call: AgentEvent, source: OutputSource, chars: number, writer?: AgentEvent, entry?: string): void;
  /**
   * A tool returned `chars` of result text; `call` is the event that asked
   * for it, when the transcript linked the two. `entry` is as for `carried`.
   */
  result?(event: AgentEvent, source: OutputSource, chars: number, call?: AgentEvent, entry?: string): void;
  /**
   * A model request re-sent `tokens` of the source's earlier input and
   * results. With `perResult`, it is called once per call, named by `entry`:
   * the call's id, or the event's own id when the transcript gave none.
   */
  carried?(request: AgentEvent, source: OutputSource, tokens: number, entry?: string): void;
  /** Report each call's re-sends on its own rather than summed per source. */
  perResult?: boolean;
}

/** Longest command text kept to show beside a large result. */
const COMMAND_TEXT_CHARS = 160;

const LEADING_CD = /^(cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*)+/;

function sourceOf(type: string, data: Record<string, unknown>): OutputSource {
  const name = toolNameOf(data) ?? "unknown";
  const key = toolOutputKey(type, name);
  if (!SHELL_TOOL.test(name)) return { key };
  const text = shellCommand(data);
  if (!text) return { key };
  return {
    key,
    command: {
      signature: commandSignature(text),
      // A leading `cd somewhere &&` only says where; the rest says what ran.
      text: text.trim().replace(LEADING_CD, "").slice(0, COMMAND_TEXT_CHARS),
    },
  };
}

/**
 * Follows every tool result from the moment it arrives until a compaction
 * drops it, reporting each model request that sent it along. Results a fork
 * inherited are the parent's output, but the fork still pays to re-send them.
 */
function walkToolOutput(events: AgentEvent[], visit: ToolOutputVisitor) {
  const callsById = new Map<string, { source: OutputSource; call: AgentEvent }>();
  // Estimated tokens of each tool's (and command's, or call's) input and output still in context.
  const live = new Map<string, { source: OutputSource; tokens: number; entry: string }>();
  const keep = (source: OutputSource, entry: string, chars: number) => {
    const key = visit.perResult ? entry : `${source.key}\n${source.command?.signature ?? ""}`;
    const held = live.get(key) ?? { source, tokens: 0, entry };
    held.tokens += chars / CHARS_PER_TOKEN;
    live.set(key, held);
  };
  // The latest billed request: the one that wrote a call that follows it.
  let writer: AgentEvent | undefined;

  for (const e of events) {
    const d = e.data;
    // Input joins the context from the next request on, not the one that wrote it.
    let written: { source: OutputSource; entry: string; chars: number } | null = null;
    switch (e.type) {
      case "tool.execution_start":
      case "external_tool.requested": {
        const id = d.toolCallId;
        const source = sourceOf(e.type, d);
        if (typeof id === "string") callsById.set(id, { source, call: e });
        const chars = num(d.argumentChars);
        if (chars === 0) break;
        const entry = typeof id === "string" ? id : e.id;
        if (isBilledRequest(e)) writer = e;
        if (!isInherited(e)) visit.input?.(e, source, chars, writer, entry);
        written = { source, entry, chars };
        break;
      }
      case "tool.execution_complete":
      case "external_tool.completed": {
        const chars = num(d.resultChars);
        if (chars === 0) break;
        const id = d.toolCallId;
        const requested =
          e.type === "external_tool.completed" ? "external_tool.requested" : "tool.execution_start";
        const linked = typeof id === "string" ? callsById.get(id) : undefined;
        const source = linked?.source ?? {
          key: toolOutputKey(requested, toolNameOf(d) ?? "unknown"),
        };
        const entry = linked && typeof id === "string" ? id : e.id;
        keep(source, entry, chars);
        if (!isInherited(e)) visit.result?.(e, source, chars, linked?.call, entry);
        break;
      }
      case "session.compaction_start":
      case "session.compaction_complete":
        live.clear();
        break;
    }
    if (isBilledRequest(e)) {
      for (const { source, tokens, entry } of live.values()) visit.carried?.(e, source, tokens, entry);
      writer = e;
    }
    if (written) keep(written.source, written.entry, written.chars);
  }
}

/** Argument fields that say what a call was about, most telling first. */
const GIST_FIELDS = ["file_path", "filePath", "path", "url", "query", "pattern", "command", "prompt"];

/** A one-line idea of what a call asked for: its command, or its main argument. */
function callGist(source: OutputSource, call?: AgentEvent): string | undefined {
  if (source.command) return source.command.text;
  const args = call?.data.arguments;
  if (typeof args === "string") return args.slice(0, COMMAND_TEXT_CHARS) || undefined;
  if (!args || typeof args !== "object") return undefined;
  const fields = args as Record<string, unknown>;
  for (const field of GIST_FIELDS) {
    const value = fields[field];
    if (typeof value === "string" && value) return value.slice(0, COMMAND_TEXT_CHARS);
  }
  const json = JSON.stringify(args);
  return json === "{}" ? undefined : json.slice(0, COMMAND_TEXT_CHARS);
}

/**
 * Which results a drill-down wants: one tool (`Bash`), every tool of an MCP
 * server (`mcp__server`), or one command of a shell tool.
 */
export interface ToolOutputMatch {
  tool: string;
  command?: string;
}

function matches(source: OutputSource, match: ToolOutputMatch): boolean {
  const tool =
    source.key === match.tool ||
    (mcpServerOf(match.tool) === match.tool.slice("mcp__".length) &&
      source.key.startsWith(`${match.tool}__`));
  return tool && (match.command === undefined || source.command?.signature === match.command);
}

/**
 * Every result in the session that `match` names and that arrived at or after
 * `from`, with what re-sending it cost in requests from then on.
 */
export function toolOutputResults(
  events: AgentEvent[],
  match: ToolOutputMatch,
  from: number | null,
): ToolResultRecord[] {
  // By call: its input can be written and re-sent before its result arrives.
  const calls = new Map<string, Omit<ToolResultRecord, "eventId" | "timestamp"> & { at?: AgentEvent }>();
  const callOf = (source: OutputSource, entry: string) => {
    let call = calls.get(entry);
    if (!call) {
      call = {
        tool: source.key,
        ...(source.command ? { command: source.command.signature } : {}),
        chars: 0,
        inputChars: 0,
        inputUSD: null,
        carriedTokens: 0,
        carriedUSD: null,
      };
      calls.set(entry, call);
    }
    return call;
  };
  const rates = new Map<AgentEvent, number | null>();
  const writeRates = new Map<AgentEvent, number | null>();
  walkToolOutput(events, {
    perResult: true,
    input(event, source, chars, writer, entry) {
      if (!entry || !matches(source, match)) return;
      const call = callOf(source, entry);
      call.inputChars += chars;
      const rate = writer ? cachedRate(writeRates, writer, writeRate) : null;
      if (rate != null) call.inputUSD = (call.inputUSD ?? 0) + (chars / CHARS_PER_TOKEN) * rate;
      const gist = callGist(source, event);
      if (gist) call.detail = gist;
    },
    result(e, source, chars, request, entry) {
      if (!entry || !matches(source, match)) return;
      const call = callOf(source, entry);
      call.chars += chars;
      call.at = e;
      if (!call.detail) {
        const gist = callGist(source, request);
        if (gist) call.detail = gist;
      }
    },
    carried(request, source, tokens, entry) {
      if (!entry || !matches(source, match)) return;
      const call = callOf(source, entry);
      call.carriedTokens += tokens;
      const rate = cachedRate(rates, request, resendRate);
      if (rate != null) call.carriedUSD = (call.carriedUSD ?? 0) + tokens * rate;
    },
  });
  // A call is listed once its result arrived in the range.
  const records: ToolResultRecord[] = [];
  for (const { at, ...call } of calls.values()) {
    if (!at || (from !== null && Date.parse(at.timestamp) < from)) continue;
    records.push({
      ...call,
      eventId: at.id,
      timestamp: at.timestamp,
      carriedTokens: Math.round(call.carriedTokens),
    });
  }
  return records;
}

/** A request's rate, priced once however many tools it re-sent or wrote. */
function cachedRate(
  cache: Map<AgentEvent, number | null>,
  request: AgentEvent,
  rateOf: (lines: ReturnType<typeof eventCostLines>) => number | null,
): number | null {
  if (!cache.has(request)) cache.set(request, rateOf(eventCostLines(request)));
  return cache.get(request) ?? null;
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

  const emptyTally = (): ToolOutputTally => ({
    results: 0,
    chars: 0,
    largest: 0,
    inputChars: 0,
    carried: 0,
  });
  // The tool's tally in the event's slot, and its command's tally under it.
  const talliesOf = (e: AgentEvent, source: OutputSource): ToolOutputTally[] => {
    const slot = slots.get(Math.floor(Date.parse(e.timestamp) / ACTIVITY_SLOT_MS) * ACTIVITY_SLOT_MS);
    if (!slot) return [];
    slot.toolOutput ??= {};
    const tool = (slot.toolOutput[source.key] ??= emptyTally());
    if (!source.command) return [tool];
    tool.commands ??= {};
    return [tool, (tool.commands[source.command.signature] ??= emptyTally())];
  };
  walkToolOutput(events, {
    result(e, source, chars) {
      for (const tally of talliesOf(e, source)) {
        tally.results++;
        tally.chars += chars;
        tally.largest = Math.max(tally.largest, chars);
      }
    },
    input(call, source, chars) {
      for (const tally of talliesOf(call, source)) tally.inputChars += chars;
    },
    carried(e, source, tokens) {
      for (const tally of talliesOf(e, source)) tally.carried += tokens;
    },
  });
  for (const slot of slots.values()) {
    for (const tally of Object.values(slot.toolOutput ?? {})) {
      tally.carried = Math.round(tally.carried);
      for (const command of Object.values(tally.commands ?? {})) command.carried = Math.round(command.carried);
    }
  }

  return [...slots.values()].sort((a, b) => a.t - b.t);
}

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

  const emptyRow = (name: string): ToolOutputRow => ({
    name,
    results: 0,
    chars: 0,
    largest: 0,
    inputChars: 0,
    inputUSD: null,
    carriedTokens: 0,
    carriedUSD: null,
  });
  const outputRows = new Map<string, ToolOutputRow & { byCommand?: Map<string, ToolOutputRow> }>();
  // The tool's row, and its command's row under it.
  const rowsOf = (source: OutputSource): ToolOutputRow[] => {
    let row = outputRows.get(source.key);
    if (!row) outputRows.set(source.key, (row = emptyRow(source.key)));
    if (!source.command) return [row];
    row.byCommand ??= new Map();
    const signature = source.command.signature;
    let command = row.byCommand.get(signature);
    if (!command) row.byCommand.set(signature, (command = emptyRow(signature)));
    return [row, command];
  };
  const largest: TokenAnalysis["largestResults"] = [];
  // Every tool a request re-sent shares its rate; price each request once.
  const rates = new Map<AgentEvent, number | null>();
  const writeRates = new Map<AgentEvent, number | null>();
  walkToolOutput(events, {
    input(_call, source, chars, writer) {
      const rate = writer ? cachedRate(writeRates, writer, writeRate) : null;
      for (const row of rowsOf(source)) {
        row.inputChars += chars;
        if (rate != null) row.inputUSD = (row.inputUSD ?? 0) + (chars / CHARS_PER_TOKEN) * rate;
      }
    },
    result(e, source, chars) {
      for (const row of rowsOf(source)) {
        row.results++;
        row.chars += chars;
        row.largest = Math.max(row.largest, chars);
      }
      largest.push({
        eventId: e.id,
        tool: source.key,
        chars,
        ...(source.command ? { command: source.command } : {}),
      });
    },
    carried(e, source, tokens) {
      const rate = cachedRate(rates, e, resendRate);
      for (const row of rowsOf(source)) {
        row.carriedTokens += tokens;
        if (rate != null) row.carriedUSD = (row.carriedUSD ?? 0) + tokens * rate;
      }
    },
  });
  const settled = (row: ToolOutputRow): ToolOutputRow => ({
    ...row,
    carriedTokens: Math.round(row.carriedTokens),
  });
  const byCarried = (a: ToolOutputRow, b: ToolOutputRow) =>
    b.carriedTokens - a.carriedTokens || b.chars - a.chars;
  const toolOutput = [...outputRows.values()]
    .map(({ byCommand, ...row }) => ({
      ...settled(row),
      ...(byCommand ? { commands: [...byCommand.values()].map(settled).sort(byCarried) } : {}),
    }))
    .sort(byCarried);
  const largestResults = largest.sort((a, b) => b.chars - a.chars).slice(0, 5);

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

  hints.push(...toolOutputHints(toolOutput));

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
    toolOutput,
    largestResults,
    assistantChars,
    compactionCount,
    hookEventCount,
  };
}

/**
 * One tool whose results took most of what the session re-sent, and the MCP
 * server whose calls return the most per call. Both count only when the
 * amounts are big enough to be worth acting on.
 */
function toolOutputHints(rows: ToolOutputRow[]): TokenHint[] {
  const hints: TokenHint[] = [];
  const carried = rows.reduce((sum, r) => sum + r.carriedTokens, 0);
  const top = rows[0];
  if (top && carried > 200_000 && top.carriedTokens / carried >= 0.4) {
    hints.push({
      severity: top.carriedTokens > 1_000_000 ? "high" : "medium",
      id: "heavyTool",
      values: {
        tool: top.name,
        percent: Math.round((top.carriedTokens / carried) * 100),
        thousands: Math.round(top.carriedTokens / 1000),
        count: top.results,
      },
      saving: "varies",
      // A shell tool's heaviest command finds its calls better than the tool name.
      focus: { categories: ["tool", "external_tool"], search: top.commands?.[0]?.name ?? top.name },
    });
  }

  const servers = new Map<string, { results: number; chars: number }>();
  for (const row of rows) {
    const server = mcpServerOf(row.name);
    if (!server) continue;
    const sum = servers.get(server) ?? { results: 0, chars: 0 };
    sum.results += row.results;
    sum.chars += row.chars;
    servers.set(server, sum);
  }
  const [heaviest] = [...servers.entries()]
    .filter(([, s]) => s.results >= 3)
    .map(([server, s]) => ({ server, ...s, avg: s.chars / s.results / CHARS_PER_TOKEN }))
    .sort((a, b) => b.avg - a.avg);
  if (heaviest && heaviest.avg >= 5_000) {
    hints.push({
      severity: heaviest.avg >= 15_000 ? "high" : "medium",
      id: "mcpPayload",
      values: {
        server: heaviest.server,
        avgK: Math.round(heaviest.avg / 100) / 10,
        count: heaviest.results,
      },
      saving: "varies",
      focus: { categories: ["external_tool"], search: heaviest.server },
    });
  }
  return hints;
}
