import fs from "fs";
import os from "os";
import path from "path";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import {
  capText,
  createFileCache,
  parseJson,
  readJsonl,
  safeReadFile,
  safeReaddir,
  walkFiles,
} from "./fs-utils";

const GEMINI_DIR = path.join(os.homedir(), ".gemini");
/** One folder per project, each with a `chats` folder of session files. */
const TMP_DIR = path.join(GEMINI_DIR, "tmp");

/** What `usageMetadata` of a response came to. `input` includes `cached`. */
interface Tokens {
  input?: number;
  output?: number;
  cached?: number;
  thoughts?: number;
  tool?: number;
}

interface Thought {
  subject?: string;
  description?: string;
  timestamp?: string;
}

interface ToolCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  /** A string, or the `functionResponse` parts sent back to the model. */
  result?: unknown;
  resultDisplay?: unknown;
  status?: string;
  timestamp?: string;
}

interface MessageRecord {
  id: string;
  timestamp?: string;
  /** `user`, `gemini`, or a notice the CLI printed: `info`, `warning`, `error`. */
  type?: string;
  content?: unknown;
  /** What the user typed, when `content` was expanded before it was sent. */
  displayContent?: unknown;
  thoughts?: Thought[];
  tokens?: Tokens | null;
  model?: string;
  toolCalls?: ToolCall[];
}

interface Metadata {
  sessionId?: string;
  projectHash?: string;
  startTime?: string;
  lastUpdated?: string;
  summary?: string;
  /** `subagent` for a session another session started. */
  kind?: string;
  messages?: MessageRecord[];
}

/** A line of a session file: metadata, a message, or a change to either. */
type SessionRecord = Partial<MessageRecord> &
  Metadata & { $set?: Metadata; $rewindTo?: string };

const FILE_ARG_KEYS = ["file_path", "absolute_path", "path"];
const EDIT_TOOLS = /^(write_file|replace|edit)$/;
const FINISHED = /^(success|error|cancelled)$/;

/** Gemini content is a string or a list of parts; only text parts are prose. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(textOf).join("");
  const text = (content as { text?: unknown } | null)?.text;
  return typeof text === "string" ? text : "";
}

/** The text a tool handed back to the model. */
function toolOutput(call: ToolCall): unknown {
  const parts = Array.isArray(call.result) ? call.result : [call.result];
  const texts = parts.flatMap((part) => {
    if (typeof part === "string") return [part];
    const response = (part as { functionResponse?: { response?: Record<string, unknown> } } | null)
      ?.functionResponse?.response;
    const text = response?.output ?? response?.error;
    return typeof text === "string" ? [text] : response ? [JSON.stringify(response)] : [];
  });
  return texts.length > 0 ? texts.join("\n") : call.resultDisplay;
}

/**
 * Replays a session file into its metadata and the messages that survive.
 * The file is a log: a message written again replaces its earlier version,
 * `$set` updates the metadata, and `$rewindTo` drops a message and all after.
 */
function replay(filePath: string): { metadata: Metadata; messages: MessageRecord[] } {
  // Sessions from before the log format are one JSON document.
  if (filePath.endsWith(".json")) {
    const { messages, ...metadata } = parseJson<Metadata>(safeReadFile(filePath)) ?? {};
    return { metadata, messages: Array.isArray(messages) ? messages : [] };
  }

  let metadata: Metadata = {};
  const messages = new Map<string, MessageRecord>();
  const load = (list: MessageRecord[] | undefined, reset: boolean) => {
    if (!Array.isArray(list)) return;
    if (reset) messages.clear();
    for (const message of list) if (typeof message?.id === "string") messages.set(message.id, message);
  };
  for (const record of readJsonl<SessionRecord>(filePath)) {
    if (typeof record.$rewindTo === "string") {
      let found = false;
      for (const id of [...messages.keys()]) {
        if (id === record.$rewindTo) found = true;
        if (found) messages.delete(id);
      }
      if (!found) messages.clear();
    } else if (typeof record.id === "string") {
      messages.set(record.id, record as MessageRecord);
    } else if (record.$set && typeof record.$set === "object") {
      load(record.$set.messages, true);
      metadata = { ...metadata, ...record.$set };
    } else if (typeof record.sessionId === "string") {
      load(record.messages, false);
      metadata = { ...metadata, ...record };
    }
  }
  delete metadata.messages;
  return { metadata, messages: [...messages.values()] };
}

/** `…/tmp/<project>/chats/<file>`, or one folder deeper for a subagent. */
function locate(filePath: string): { projectDir: string; parentSessionId?: string } {
  const dir = path.dirname(filePath);
  if (path.basename(dir) === "chats") return { projectDir: path.dirname(dir) };
  return { projectDir: path.dirname(path.dirname(dir)), parentSessionId: path.basename(dir) };
}

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
  metadata: Metadata;
}

function parseFile(filePath: string): ParsedSession | null {
  const { metadata, messages } = replay(filePath);
  if (!metadata.sessionId) return null;
  const sessionId = metadata.sessionId;
  const { projectDir, parentSessionId } = locate(filePath);
  // Older releases named the project folder by a hash and left no way back.
  const cwd = safeReadFile(path.join(projectDir, ".project_root")).trim() || undefined;

  const events: AgentEvent[] = [];
  const files = new Set<string>();
  let model: string | undefined;
  let firstPrompt = "";
  let lastTimestamp = metadata.startTime ?? "";

  const push = (timestamp: string, type: string, data: Record<string, unknown>, parentId: string) => {
    if (timestamp > lastTimestamp) lastTimestamp = timestamp;
    events.push({ type, data, id: `${parentId}:${events.length}`, timestamp, parentId });
  };

  for (const message of messages) {
    const ts = message.timestamp ?? lastTimestamp;
    const { text, chars } = capText(textOf(message.content));

    if (message.type === "user") {
      if (!text.trim()) continue;
      if (!firstPrompt) firstPrompt = textOf(message.displayContent) || text;
      push(ts, "user.message", { content: text }, message.id);
      continue;
    }
    if (message.type === "error") {
      push(ts, "session.error", { message: text }, message.id);
      continue;
    }
    if (message.type !== "gemini") {
      // Notices the CLI printed for the user; the model never saw them.
      if (text.trim()) push(ts, "session.info", { level: message.type, content: text }, message.id);
      continue;
    }

    if (message.model) model = message.model;
    // The response's usage rides on the first event it produces.
    let usage: Record<string, unknown> = {};
    const tokens = message.tokens;
    const cached = tokens?.cached ?? 0;
    // The prompt count includes cache hits but not the tokens of tool results.
    const input = Math.max(0, (tokens?.input ?? 0) - cached) + (tokens?.tool ?? 0);
    // Thinking is reported apart from the reply; both are billed as output.
    const output = (tokens?.output ?? 0) + (tokens?.thoughts ?? 0);
    if (input + output + cached > 0) {
      usage = {
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cached,
        billedUsage: {
          model: message.model,
          inputTokens: input,
          outputTokens: output,
          cacheReadTokens: cached,
        } satisfies BilledUsage,
      };
    }
    const takeUsage = () => {
      const taken = usage;
      usage = {};
      return taken;
    };

    for (const thought of message.thoughts ?? []) {
      const content = [thought.subject && `**${thought.subject}**`, thought.description]
        .filter(Boolean)
        .join("\n\n");
      if (!content) continue;
      push(thought.timestamp ?? ts, "assistant.thinking", {
        content,
        charLength: content.length,
        model: message.model,
        ...takeUsage(),
      }, message.id);
    }
    if (text.trim()) {
      push(ts, "assistant.message", {
        content: text,
        charLength: chars,
        model: message.model,
        ...takeUsage(),
      }, message.id);
    }
    for (const call of message.toolCalls ?? []) {
      const toolName = call.name ?? "tool";
      const args = call.args ?? {};
      for (const key of FILE_ARG_KEYS) {
        const value = args[key];
        if (typeof value === "string" && EDIT_TOOLS.test(toolName)) files.add(value);
      }
      const callTime = call.timestamp ?? ts;
      push(callTime, "tool.execution_start", {
        toolName,
        toolCallId: call.id,
        arguments: args,
        model: message.model,
        ...takeUsage(),
      }, message.id);
      // A call awaiting approval or still running has no result yet.
      if (!FINISHED.test(call.status ?? "")) continue;
      const result = capText(toolOutput(call));
      push(callTime, "tool.execution_complete", {
        toolName,
        toolCallId: call.id,
        // The user turning a call down is not the tool failing.
        success: call.status !== "error",
        cancelled: call.status === "cancelled" || undefined,
        resultChars: result.chars,
        truncated: result.truncated,
        result: { content: result.text },
      }, message.id);
    }
    // Usage with nothing to show still has to be counted.
    if (Object.keys(usage).length > 0) {
      push(ts, "assistant.message", { content: "", model: message.model, ...takeUsage() }, message.id);
    }
  }
  if (events.length === 0) return null;

  const createdAt = metadata.startTime ?? events[0].timestamp;
  events.unshift({
    type: "session.start",
    data: {
      sessionId,
      selectedModel: model,
      context: { cwd },
      parentSessionId,
    },
    id: `${sessionId}:start`,
    timestamp: createdAt,
    parentId: null,
  });

  const meta: SessionMeta = {
    provider: "gemini",
    id: sessionId,
    title: metadata.summary || undefined,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd,
    model,
    host_type: metadata.kind === "subagent" || parentSessionId ? "subagent" : undefined,
    created_at: createdAt || undefined,
    updated_at: lastTimestamp || createdAt || undefined,
  };
  return { meta, events, files: [...files], metadata };
}

const summarize = createFileCache((filePath: string): SessionMeta | null => {
  const parsed = parseFile(filePath);
  return parsed && { ...parsed.meta, ...quickStatsFromEvents(parsed.events) };
});

/**
 * Session files of every project. A session resumed by a newer release is
 * copied from `.json` to `.jsonl`, so the log sorts first and wins.
 */
function sessionFiles(): string[] {
  const isSession = (name: string) => name.endsWith(".jsonl") || /^session-.*\.json$/.test(name);
  return safeReaddir(TMP_DIR)
    .flatMap((project) => walkFiles(path.join(TMP_DIR, project, "chats"), isSession, 1))
    .sort((a, b) => Number(b.endsWith(".jsonl")) - Number(a.endsWith(".jsonl")));
}

function listAll(): { filePath: string; meta: SessionMeta }[] {
  const seen = new Set<string>();
  return sessionFiles().flatMap((filePath) => {
    const meta = summarize(filePath);
    if (!meta || seen.has(meta.id)) return [];
    seen.add(meta.id);
    return [{ filePath, meta }];
  });
}

export const geminiProvider: SessionProvider = {
  info: {
    id: "gemini",
    label: "Gemini CLI",
    shortLabel: "Gemini",
    rootDir: "~/.gemini/tmp",
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(TMP_DIR);
  },

  listSessions() {
    return listAll().map(({ meta }) => meta);
  },

  getSession(id) {
    const filePath = listAll().find(({ meta }) => meta.id === id)?.filePath;
    const parsed = filePath && parseFile(filePath);
    if (!filePath || !parsed) return null;
    const { meta, events, files, metadata } = parsed;

    return {
      meta: { ...meta, ...quickStatsFromEvents(events) },
      events,
      files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: path.basename(filePath),
        content: JSON.stringify(metadata, null, 2),
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
