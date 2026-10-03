/**
 * Canonical, provider-agnostic session model.
 *
 * Every agent CLI writes its own transcript format. Adapters under
 * `src/lib/providers/<name>.ts` translate those formats into the vocabulary
 * below so the UI only ever deals with one shape.
 */

export type ProviderId =
  | "copilot"
  | "vscode"
  | "claude"
  | "cowork"
  | "codex"
  | "opencode"
  | "hermes";

export interface ProviderInfo {
  id: ProviderId;
  /** Full product name, e.g. "GitHub Copilot CLI". */
  label: string;
  /** Compact name for badges and tabs. */
  shortLabel: string;
  /** Root directory the adapter reads, shown in the UI. */
  rootDir: string;
  /** Whether that directory exists on this machine. */
  available: boolean;
  /** Whether the provider exposes a log directory. */
  supportsLogs: boolean;
  sessionCount?: number;
}

export interface SessionMeta {
  provider: ProviderId;
  id: string;
  name?: string;
  /** Human/AI-generated session title, when the provider records one. */
  title?: string;
  cwd?: string;
  repository?: string;
  /**
   * Project the session belongs to: the repository folder, else the working
   * directory. Unique across projects, so it doubles as the filter key.
   * Assigned by the registry, not by adapters.
   */
  project?: string;
  /** Folder behind `project`, with the home directory as `~`. */
  projectPath?: string;
  branch?: string;
  created_at?: string;
  updated_at?: string;
  /** Where the session ran: vscode, cli, claude-desktop, … */
  host_type?: string;
  /** Client/CLI version string. */
  client_name?: string;
  /** Last model observed in the transcript. */
  model?: string;
  user_named?: boolean;
  // Quick stats, computed at list time.
  eventCount?: number;
  toolCallCount?: number;
  userMessageCount?: number;
  totalOutputTokens?: number;
  totalInputTokens?: number;
  /** Per-model usage kept by adapters so the list can be priced at read time. */
  usage?: UsageBucket[];
  /** Estimated list-price cost; absent when the session reported no usage. */
  estimatedCostUSD?: number;
  /** Models that used tokens but have no price, so the estimate is a floor. */
  unpricedModels?: string[];
  /** When the session was busy, kept by adapters for cross-session analytics. */
  activity?: ActivitySlot[];
  /** How smoothly the session ran; absent when the agent never did anything. */
  health?: SessionHealth;
}

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

/**
 * How the transcript ends. `completed`: the agent had the last word.
 * `abandoned`: it stopped mid-work, or a prompt went unanswered. `errored`:
 * it ends on an API error. `in_progress`: the agent is still writing.
 */
export type SessionOutcome = "completed" | "abandoned" | "errored" | "in_progress";

export const HEALTH_SIGNALS = [
  "outcome",
  "tool_failures",
  "retry_loops",
  "api_errors",
  "aborted_turns",
  "compactions",
] as const;
export type HealthSignalId = (typeof HEALTH_SIGNALS)[number];

/** One thing that went wrong, and the points it took off the score. */
export interface HealthSignal {
  id: HealthSignalId;
  /** How often it happened; 1 for `outcome`. */
  count: number;
  penalty: number;
}

/**
 * Rule-based score out of 100, read straight off the transcript. It measures
 * how smoothly the session ran, not whether the result was any good.
 */
export interface SessionHealth {
  score: number;
  grade: HealthGrade;
  outcome: SessionOutcome;
  /** Tool calls that reported a result. */
  toolResults: number;
  toolFailures: number;
  /** Only the signals that fired, in `HEALTH_SIGNALS` order. */
  signals: HealthSignal[];
}

/**
 * Slots are this short so the browser can regroup them into days and hours in
 * its own time zone, including zones offset by 30 or 45 minutes.
 */
export const ACTIVITY_SLOT_MS = 15 * 60_000;

/** What happened in one slot of a session. */
export interface ActivitySlot {
  /** Slot start, epoch milliseconds. */
  t: number;
  /** User and assistant messages. */
  messages: number;
  toolCalls: number;
  outputTokens: number;
  /** Time spent working: gaps between events, ignoring idle stretches. */
  activeMs: number;
  /** Tool calls by tool name; absent when the slot made none. */
  tools?: Record<string, number>;
  /** Skill invocations by skill name; absent when the slot made none. */
  skills?: Record<string, number>;
  /** MCP tool calls keyed `server__tool`; absent when the slot made none. */
  mcp?: Record<string, number>;
  /**
   * Estimated list-price cost of the slot's usage. Never cached: the analytics
   * endpoint prices it on each read, so a price change applies at once.
   */
  costUSD?: number;
}

/** One session as the analytics dashboard sees it. */
export interface AnalyticsSession {
  provider: ProviderId;
  id: string;
  label: string;
  /** Same value as `SessionMeta.project`. */
  project: string;
  model?: string;
  activity: ActivitySlot[];
  /** Token usage per slot and model, for the usage page. */
  usage: UsageSlice[];
  /** Models that used tokens but have no price, so the cost is a floor. */
  unpricedModels?: string[];
  health?: SessionHealth;
}

/** One model's tokens in one activity slot, priced at today's table. */
export interface UsageSlice {
  /** Slot start, epoch milliseconds. */
  t: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Cache writes at either TTL. */
  cacheWriteTokens: number;
  /** Null when the model has no price. */
  costUSD: number | null;
}

/**
 * What a model request is billed for. Unlike the display counters, the token
 * classes here never overlap, whatever the provider's own accounting does.
 */
export interface BilledUsage {
  model?: string;
  /** Uncached input: excludes cache reads and cache writes. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  /** Cache writes at the provider's default TTL. */
  cacheWriteTokens?: number;
  /** Cache writes at the extended (1 hour) TTL, billed higher. */
  cacheWrite1hTokens?: number;
  /** Request ran in a premium speed tier. */
  fast?: boolean;
  /**
   * The model ran on the user's own machine (Ollama, LM Studio, …), so no
   * tokens were billed: the usage costs $0 whatever the price table says.
   */
  local?: boolean;
}

/**
 * Usage summed over one model and one activity slot. `day` (YYYY-MM-DD) picks
 * the price entry in force; `t` lines the bucket up with its `ActivitySlot`.
 */
export interface UsageBucket extends BilledUsage {
  day: string;
  /** Slot start, epoch milliseconds; absent when the record had no timestamp. */
  t?: number;
}

/** Dollars per token class. */
export interface CostBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * List prices in USD per million tokens. A model maps to one entry per price
 * change; `from` (YYYY-MM-DD) is the day that entry took effect, and usage is
 * priced with the entry in force on the day it happened. Nothing derived from
 * these is stored, so correcting a price re-prices every session.
 */
export interface PriceEntry {
  from?: string;
  input: number;
  output: number;
  /** Defaults to `input` for providers that do not discount cache hits. */
  cacheRead?: number;
  /** Defaults to `input` for providers that do not bill cache writes apart. */
  cacheWrite?: number;
  /** Extended-TTL cache writes; defaults to `cacheWrite`. */
  cacheWrite1h?: number;
  /** Multiplier applied to every token class in the premium speed tier. */
  fast?: number;
}

export type TokenClass = "input" | "cacheWrite" | "cacheWrite1h" | "cacheRead" | "output";

/** One receipt row: the tokens of one class a model was billed at one rate. */
export interface CostLine {
  model: string;
  kind: TokenClass;
  tokens: number;
  /** USD per million tokens; null when the model has no price. */
  rate: number | null;
  usd: number | null;
}

export interface ModelCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Both cache TTLs combined. */
  cacheWriteTokens: number;
  /** null when the price table has no entry for this model. */
  costUSD: number | null;
}

/**
 * API-equivalent estimate at list prices. It is not a bill: subscription and
 * request-based plans charge differently.
 */
export interface CostSummary {
  totalUSD: number;
  /** The total split by what was billed, across all priced models. */
  breakdown: CostBreakdown;
  byModel: ModelCost[];
  /** The arithmetic behind the total, in display order. */
  lines: CostLine[];
  /**
   * The price entries in force for each model, keyed the way the override
   * file expects; null for a model with no price. Lets the UI hand the user a
   * correct starting point for that file.
   */
  prices: Record<string, PriceEntry[] | null>;
  /** Where user price overrides are read from, with the home dir as `~`. */
  overridePath: string;
  unpricedModels: string[];
}

/**
 * One timeline entry. `type` is always `category.subCategory`; the shared
 * vocabulary is documented in `EVENT_TYPES` below, and `data` carries
 * whatever the provider recorded (normalized where it is worth normalizing).
 */
export interface AgentEvent {
  type: string;
  data: Record<string, unknown>;
  id: string;
  timestamp: string;
  parentId: string | null;
}

/**
 * Canonical event types. Adapters should map onto these where a concept
 * exists; anything unmapped still renders through the generic card.
 */
export const EVENT_TYPES = {
  sessionStart: "session.start",
  sessionResume: "session.resume",
  sessionShutdown: "session.shutdown",
  sessionError: "session.error",
  modelChange: "session.model_change",
  usageCheckpoint: "session.usage_checkpoint",
  compactionStart: "session.compaction_start",
  compactionComplete: "session.compaction_complete",
  userMessage: "user.message",
  assistantMessage: "assistant.message",
  assistantThinking: "assistant.thinking",
  turnStart: "assistant.turn_start",
  turnEnd: "assistant.turn_end",
  toolStart: "tool.execution_start",
  toolComplete: "tool.execution_complete",
  externalToolRequested: "external_tool.requested",
  externalToolCompleted: "external_tool.completed",
  systemMessage: "system.message",
  contextAttachment: "context.attachment",
  filePatch: "file.patch_applied",
  webSearch: "web.search",
} as const;

export interface LogFile {
  name: string;
  path: string;
  mtime: string;
  size: number;
}

export interface CheckpointFile {
  name: string;
  content: string;
}

export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalToolCalls: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalApiDurationMs: number;
  totalPremiumRequests: number;
  eventCount: number;
}

export interface TokenHint {
  severity: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  saving?: string;
  focus?: {
    categories?: string[];
    subKeys?: string[];
    search?: string;
  };
}

export interface TokenAnalysis {
  hints: TokenHint[];
  topToolsByCount: { name: string; count: number }[];
  /** System prompt and instruction messages only. */
  systemMessageChars: number;
  /** Everything the agent injects itself: system messages plus attached context. */
  systemContextChars: number;
  toolResultChars: number;
  assistantChars: number;
  compactionCount: number;
  hookEventCount: number;
}

/** Provider-supplied raw metadata document, shown verbatim in the UI. */
export interface RawMetaDoc {
  name: string;
  content: string;
  /** Highlight/label hint: "yaml" or "json". */
  language: "yaml" | "json" | "text";
}

export interface SessionDetail {
  meta: SessionMeta;
  events: AgentEvent[];
  /** Files the session touched (provider-dependent: stored copies or edited paths). */
  files: string[];
  checkpoints: CheckpointFile[];
  research: string[];
  rawMeta: RawMetaDoc;
  stats: SessionStats;
  tokenAnalysis: TokenAnalysis;
  cost: CostSummary;
}

/** Everything an adapter must implement to appear in the app. */
export interface SessionProvider {
  info: Omit<ProviderInfo, "available" | "sessionCount">;
  isAvailable(): boolean;
  listSessions(): SessionMeta[];
  getSession(id: string): Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost"> | null;
  listLogs(): LogFile[];
  getLogContent(name: string): string;
}
