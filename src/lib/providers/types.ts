/**
 * Canonical, provider-agnostic session model.
 *
 * Every agent CLI writes its own transcript format. Adapters under
 * `src/lib/providers/<name>.ts` translate those formats into the vocabulary
 * below so the UI only ever deals with one shape.
 */

export type ProviderId = "copilot" | "claude" | "codex";

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
}

/** Everything an adapter must implement to appear in the app. */
export interface SessionProvider {
  info: Omit<ProviderInfo, "available" | "sessionCount">;
  isAvailable(): boolean;
  listSessions(): SessionMeta[];
  getSession(id: string): Omit<SessionDetail, "stats" | "tokenAnalysis"> | null;
  listLogs(): LogFile[];
  getLogContent(name: string): string;
}
