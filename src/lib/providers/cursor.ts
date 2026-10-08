import fs from "fs";
import os from "os";
import path from "path";
import type { DatabaseSync } from "node:sqlite";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import {
  appDataDir,
  capText,
  createFileCache,
  isoFromMs,
  parseJson,
  readJsonl,
  safeReaddir,
  statOf,
  tildePath,
  walkFiles,
} from "./fs-utils";
import { createDatabaseCache, readDatabase, rows } from "./sqlite-utils";

/**
 * The editor keeps every chat in one key-value table: a `composerData:<id>`
 * row per chat and a `bubbleId:<id>:<bubble>` row per message. Only that table
 * is read; the sign-in tokens in the same file live in another one.
 */
const DATABASE = path.join(appDataDir("Cursor"), "User", "globalStorage", "state.vscdb");
/**
 * Plain-text transcripts the agent also writes, one folder per project. They
 * carry no times, tool results or model, so they only stand in for a session
 * the database does not have: one from the CLI, or with the database absent.
 */
const PROJECTS_DIR = path.join(os.homedir(), ".cursor", "projects");

const USER_BUBBLE = 1;

interface Bubble {
  bubbleId?: string;
  /** 1 for the user, 2 for the agent. */
  type?: number;
  text?: string;
  /** ISO time in current releases, epoch milliseconds in older ones. */
  createdAt?: string | number;
  startedAtMs?: number;
  completedAtMs?: number;
  thinking?: { text?: string };
  thinkingDurationMs?: number;
  tokenCount?: { inputTokens?: number; outputTokens?: number };
  modelInfo?: { modelName?: string };
  toolFormerData?: {
    toolCallId?: string;
    name?: string;
    status?: string;
    rawArgs?: string;
    params?: string;
    result?: string;
  };
}

interface Composer {
  composerId: string;
  name?: string;
  status?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  /** The messages in order; their content is in the bubble rows. */
  fullConversationHeadersOnly?: { bubbleId?: string }[];
  /** Older releases kept the messages here instead. */
  conversation?: Bubble[];
  modelConfig?: { modelName?: string };
  contextTokensUsed?: number;
  contextTokenLimit?: number;
  promptTokenBreakdown?: unknown;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
  filesChangedCount?: number;
  workspaceIdentifier?: { uri?: { fsPath?: string } };
}

const FILE_ARG_KEYS = ["path", "file_path", "target_file", "targetFile", "relativeWorkspacePath"];
const EDIT_TOOLS = /edit|write|replace|patch/i;
const FINISHED = /^(completed|error|cancelled)$/;

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function timeOf(bubble: Bubble): string {
  if (typeof bubble.createdAt === "string") return bubble.createdAt;
  return isoFromMs(bubble.createdAt) || isoFromMs(bubble.startedAtMs);
}

function parseComposer(composer: Composer, bubbles: Bubble[]): ParsedSession | null {
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  const createdAt = isoFromMs(composer.createdAt);
  let model = composer.modelConfig?.modelName;
  // The editor's own name for letting it choose the model.
  if (model === "default") model = "auto";
  let firstPrompt = "";
  let lastTimestamp = createdAt;

  const push = (timestamp: string, type: string, data: Record<string, unknown>, parentId: string) => {
    if (timestamp > lastTimestamp) lastTimestamp = timestamp;
    events.push({ type, data, id: `${parentId}:${events.length}`, timestamp, parentId });
  };

  for (const [index, bubble] of bubbles.entries()) {
    const id = bubble.bubbleId ?? `bubble-${index}`;
    // A message with no time of its own happened no earlier than the last.
    const ts = timeOf(bubble) || lastTimestamp;
    const { text, chars } = capText(bubble.text);

    if (bubble.type === USER_BUBBLE) {
      if (bubble.modelInfo?.modelName) model = bubble.modelInfo.modelName;
      if (!text.trim()) continue;
      if (!firstPrompt) firstPrompt = text;
      push(ts, "user.message", { content: text }, id);
      continue;
    }

    // Most releases leave these counts at zero, and the session unpriced.
    let usage: Record<string, unknown> = {};
    const input = bubble.tokenCount?.inputTokens ?? 0;
    const output = bubble.tokenCount?.outputTokens ?? 0;
    if (input + output > 0) {
      usage = {
        inputTokens: input,
        outputTokens: output,
        billedUsage: { model, inputTokens: input, outputTokens: output } satisfies BilledUsage,
      };
    }
    const takeUsage = () => {
      const taken = usage;
      usage = {};
      return taken;
    };

    const thinking = capText(bubble.thinking?.text);
    if (thinking.text.trim()) {
      push(ts, "assistant.thinking", {
        content: thinking.text,
        charLength: thinking.chars,
        durationMs: bubble.thinkingDurationMs,
        model,
        ...takeUsage(),
      }, id);
    }
    if (text.trim()) {
      push(ts, "assistant.message", { content: text, charLength: chars, model, ...takeUsage() }, id);
    }
    const tool = bubble.toolFormerData;
    if (tool?.name) {
      const args = parseJson<Record<string, unknown>>(tool.rawArgs || tool.params) ?? {};
      for (const key of FILE_ARG_KEYS) {
        const value = args[key];
        if (typeof value === "string" && EDIT_TOOLS.test(tool.name)) files.add(value);
      }
      push(isoFromMs(bubble.startedAtMs) || ts, "tool.execution_start", {
        toolName: tool.name,
        toolCallId: tool.toolCallId,
        arguments: args,
        model,
        ...takeUsage(),
      }, id);
      // A call awaiting approval or still running has no result yet.
      if (FINISHED.test(tool.status ?? "")) {
        const result = capText(tool.result);
        push(isoFromMs(bubble.completedAtMs) || ts, "tool.execution_complete", {
          toolName: tool.name,
          toolCallId: tool.toolCallId,
          // The user turning a call down is not the tool failing.
          success: tool.status !== "error",
          cancelled: tool.status === "cancelled" || undefined,
          resultChars: result.chars,
          truncated: result.truncated,
          result: { content: result.text },
        }, id);
      }
    }
    // Usage with nothing to show still has to be counted.
    if (Object.keys(usage).length > 0) {
      push(ts, "assistant.message", { content: "", model, ...takeUsage() }, id);
    }
  }
  // Every window keeps an empty draft chat around.
  if (events.length === 0) return null;

  const cwd = composer.workspaceIdentifier?.uri?.fsPath;
  const startedAt = createdAt || events[0].timestamp;
  events.unshift({
    type: "session.start",
    data: {
      sessionId: composer.composerId,
      selectedModel: model,
      context: { cwd },
      mode: composer.unifiedMode,
    },
    id: `${composer.composerId}:start`,
    timestamp: startedAt,
    parentId: null,
  });

  const meta: SessionMeta = {
    provider: "cursor",
    id: composer.composerId,
    title: composer.name || undefined,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd,
    model,
    host_type: "cursor",
    created_at: startedAt || undefined,
    updated_at: lastTimestamp || startedAt || undefined,
  };
  return { meta, events, files: [...files] };
}

/** Keys of one prefix, as a range the table's index can answer. */
const KEY_RANGE = "key >= ? AND key < ?";
const keyRange = (prefix: string) => [`${prefix}:`, `${prefix};`] as const;

function readComposer(db: DatabaseSync, id: string): { composer: Composer; bubbles: Bubble[] } | null {
  const [row] = rows<{ value: string }>(
    db,
    "SELECT CAST(value AS TEXT) AS value FROM cursorDiskKV WHERE key = ?",
    `composerData:${id}`,
  );
  const composer = parseJson<Composer>(row?.value);
  if (!composer) return null;
  composer.composerId = id;
  if (Array.isArray(composer.conversation) && composer.conversation.length > 0) {
    return { composer, bubbles: composer.conversation };
  }

  const stored = new Map<string, Bubble>();
  const bubbleRows = rows<{ value: string }>(
    db,
    `SELECT CAST(value AS TEXT) AS value FROM cursorDiskKV WHERE ${KEY_RANGE}`,
    ...keyRange(`bubbleId:${id}`),
  );
  for (const { value } of bubbleRows) {
    const bubble = parseJson<Bubble>(value);
    if (bubble?.bubbleId) stored.set(bubble.bubbleId, bubble);
  }
  const bubbles = (composer.fullConversationHeadersOnly ?? []).flatMap((header) => {
    const bubble = header.bubbleId && stored.get(header.bubbleId);
    return bubble ? [bubble] : [];
  });
  return { composer, bubbles };
}

/**
 * The store is rewritten all the time while the editor is open and can run to
 * gigabytes, so a chat is parsed again only when its own row changed size:
 * every new message, and every tool call finishing, adds to it.
 */
const summaries = new Map<string, { size: number; meta: SessionMeta | null }>();

const listStored = createDatabaseCache(DATABASE, (): SessionMeta[] => {
  const listed = readDatabase(DATABASE, (db) => {
    const chats = rows<{ key: string; size: number }>(
      db,
      `SELECT key, length(value) AS size FROM cursorDiskKV WHERE ${KEY_RANGE}`,
      ...keyRange("composerData"),
    );
    return chats.flatMap(({ key, size }) => {
      const id = key.slice("composerData:".length);
      let summary = summaries.get(id);
      if (summary?.size !== size) {
        const found = readComposer(db, id);
        const parsed = found && parseComposer(found.composer, found.bubbles);
        summary = {
          size,
          meta: parsed && { ...parsed.meta, ...quickStatsFromEvents(parsed.events) },
        };
        summaries.set(id, summary);
      }
      return summary.meta ? [summary.meta] : [];
    });
  });
  return listed ?? [];
});

interface TranscriptLine {
  role?: string;
  /** `turn_ended` closes a turn; lines with a `role` have none. */
  type?: string;
  status?: string;
  message?: {
    content?: { type?: string; text?: string; name?: string; input?: Record<string, unknown> }[];
  };
}

/** The app wraps each prompt in tags and stamps it to the minute. */
const USER_QUERY = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/;
const STAMP = /<timestamp>\s*(?:[A-Za-z]+, )?(.+?)\s*\((UTC[^)]*)\)\s*<\/timestamp>/;

const folderCache = new Map<string, string | null>();

/**
 * The folder a project directory was named after. The name is the path with
 * its separators turned into dashes, so it is matched against what is on disk.
 */
function projectFolder(encoded: string): string | undefined {
  const find = (dir: string, parts: string[]): string | null => {
    if (parts.length === 0) return dir;
    for (let take = 1; take <= parts.length; take++) {
      const next = path.join(dir, parts.slice(0, take).join("-"));
      if (!statOf(next)?.isDirectory()) continue;
      const found = find(next, parts.slice(take));
      if (found) return found;
    }
    return null;
  };
  let folder = folderCache.get(encoded);
  if (folder === undefined) {
    folder = find(path.parse(os.homedir()).root, encoded.split("-"));
    folderCache.set(encoded, folder);
  }
  return folder ?? undefined;
}

function parseTranscript(filePath: string): ParsedSession | null {
  const id = path.basename(filePath, ".jsonl");
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  const stat = statOf(filePath);
  const writtenAt = isoFromMs(stat?.mtimeMs);
  // Only prompts are timed; what follows one is filed under it.
  let ts = "";
  let firstPrompt = "";

  const push = (type: string, data: Record<string, unknown>, turn: number) => {
    events.push({ type, data, id: `${id}:${events.length}`, timestamp: ts, parentId: `${id}:turn-${turn}` });
  };

  for (const [index, line] of readJsonl<TranscriptLine>(filePath).entries()) {
    if (line.type === "turn_ended" && line.status && line.status !== "success") {
      push("session.turn_aborted", { reason: line.status }, index);
    }
    for (const part of line.message?.content ?? []) {
      if (part.type === "tool_use") {
        const toolName = part.name ?? "tool";
        const args = part.input ?? {};
        for (const key of FILE_ARG_KEYS) {
          const value = args[key];
          if (typeof value === "string" && EDIT_TOOLS.test(toolName)) files.add(value);
        }
        push("tool.execution_start", { toolName, arguments: args }, index);
        continue;
      }
      if (part.type !== "text" || !part.text?.trim()) continue;
      if (line.role !== "user") {
        push("assistant.message", { content: capText(part.text).text }, index);
        continue;
      }
      const stamp = part.text.match(STAMP);
      const stamped = stamp ? Date.parse(`${stamp[1]} ${stamp[2]}`) : NaN;
      if (isoFromMs(stamped) > ts) ts = isoFromMs(stamped);
      const prompt = capText(part.text.match(USER_QUERY)?.[1] ?? part.text).text;
      if (!firstPrompt) firstPrompt = prompt;
      push("user.message", { content: prompt }, index);
    }
  }
  if (events.length === 0) return null;
  // A transcript with no stamp at all can only be dated by its file.
  const createdAt = events[0].timestamp || isoFromMs(stat?.birthtimeMs) || writtenAt;
  for (const event of events) event.timestamp ||= createdAt;

  const cwd = projectFolder(path.basename(filePath.split(`${path.sep}agent-transcripts${path.sep}`)[0]));
  events.unshift({
    type: "session.start",
    data: { sessionId: id, context: { cwd } },
    id: `${id}:start`,
    timestamp: createdAt,
    parentId: null,
  });
  const meta: SessionMeta = {
    provider: "cursor",
    id,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd,
    host_type: "cursor",
    created_at: createdAt || undefined,
    updated_at: (writtenAt > ts ? writtenAt : ts) || undefined,
  };
  return { meta, events, files: [...files] };
}

const summarizeTranscript = createFileCache((filePath: string): SessionMeta | null => {
  const parsed = parseTranscript(filePath);
  return parsed && { ...parsed.meta, ...quickStatsFromEvents(parsed.events) };
});

/** `<project>/agent-transcripts/<id>/<id>.jsonl`, or without the folder. */
function transcriptFiles(): string[] {
  return safeReaddir(PROJECTS_DIR).flatMap((project) =>
    walkFiles(path.join(PROJECTS_DIR, project, "agent-transcripts"), (name) => name.endsWith(".jsonl"), 1),
  );
}

/** Transcripts of sessions the database does not hold. */
function listTranscripts(stored: SessionMeta[]): { filePath: string; meta: SessionMeta }[] {
  const known = new Set(stored.map((meta) => meta.id));
  return transcriptFiles().flatMap((filePath) => {
    if (known.has(path.basename(filePath, ".jsonl"))) return [];
    const meta = summarizeTranscript(filePath);
    return meta ? [{ filePath, meta }] : [];
  });
}

/** Chat fields worth showing; the row also holds keys and opaque state. */
function describe(composer: Composer) {
  return {
    database: DATABASE,
    composerId: composer.composerId,
    name: composer.name,
    status: composer.status,
    mode: composer.unifiedMode,
    createdAt: isoFromMs(composer.createdAt) || undefined,
    lastUpdatedAt: isoFromMs(composer.lastUpdatedAt) || undefined,
    workspace: composer.workspaceIdentifier?.uri?.fsPath,
    modelConfig: composer.modelConfig,
    contextTokensUsed: composer.contextTokensUsed,
    contextTokenLimit: composer.contextTokenLimit,
    promptTokenBreakdown: composer.promptTokenBreakdown,
    totalLinesAdded: composer.totalLinesAdded,
    totalLinesRemoved: composer.totalLinesRemoved,
    filesChangedCount: composer.filesChangedCount,
  };
}

export const cursorProvider: SessionProvider = {
  info: {
    id: "cursor",
    label: "Cursor",
    shortLabel: "Cursor",
    rootDir: tildePath(DATABASE),
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(DATABASE) || fs.existsSync(PROJECTS_DIR);
  },

  listSessions() {
    const stored = listStored();
    return [...stored, ...listTranscripts(stored).map(({ meta }) => meta)];
  },

  getSession(id) {
    const base = { checkpoints: [], research: [] };
    const found = readDatabase(DATABASE, (db) => readComposer(db, id));
    const parsed = found && parseComposer(found.composer, found.bubbles);
    if (found && parsed) {
      return {
        ...base,
        meta: { ...parsed.meta, ...quickStatsFromEvents(parsed.events) },
        events: parsed.events,
        files: parsed.files,
        rawMeta: {
          name: "state.vscdb · composerData",
          content: JSON.stringify(describe(found.composer), null, 2),
          language: "json",
        },
        storagePath: DATABASE,
      } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
    }

    const filePath = listTranscripts([]).find(({ meta }) => meta.id === id)?.filePath;
    const transcript = filePath && parseTranscript(filePath);
    if (!filePath || !transcript) return null;
    return {
      ...base,
      meta: { ...transcript.meta, ...quickStatsFromEvents(transcript.events) },
      events: transcript.events,
      files: transcript.files,
      rawMeta: {
        name: path.basename(filePath),
        content: JSON.stringify({ transcript: filePath, cwd: transcript.meta.cwd }, null, 2),
        language: "json",
      },
      storagePath: filePath,
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
