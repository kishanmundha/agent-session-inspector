import fs from "fs";
import os from "os";
import path from "path";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import { argumentChars, capText, isoFromMs, parseJson, tildePath, toolResult } from "./fs-utils";
import { LOCAL_RUNTIME } from "./pricing";
import { createDatabaseCache, readDatabase, rows } from "./sqlite-utils";

const DATA_DIR = path.join(
  process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
  "opencode",
);
const DATABASE = path.join(DATA_DIR, "opencode.db");

/** Read with `SELECT *`, so a column an older OpenCode lacks is just absent. */
interface SessionRow {
  id: string;
  parent_id?: string | null;
  directory?: string | null;
  title?: string | null;
  version?: string | null;
  agent?: string | null;
  model?: string | null;
  time_created: number;
  time_updated?: number | null;
}

/** `message` and `part` rows keep everything but their ids in a JSON column. */
interface DataRow {
  id: string;
  session_id: string;
  message_id?: string;
  time_created: number;
  data: string;
}

/**
 * OpenCode 2.x (schema v2) stores one row per message in `session_message`;
 * assistant content parts live inside the row's `data.content` array and the
 * separate `part` table no longer exists.
 */
interface SessionMessageRow {
  id: string;
  session_id: string;
  type: string;
  seq: number;
  time_created: number;
  time_updated?: number | null;
  data: string;
}

interface Tokens {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: { read?: number; write?: number };
}

interface MessageData {
  role?: string;
  agent?: string;
  modelID?: string;
  providerID?: string;
  model?: { modelID?: string; providerID?: string };
  tokens?: Tokens;
  error?: { name?: string; data?: { message?: string } };
}

interface PartData {
  type?: string;
  text?: string;
  synthetic?: boolean;
  time?: { start?: number; end?: number };
  tool?: string;
  callID?: string;
  filename?: string;
  url?: string;
  mime?: string;
  files?: string[];
  auto?: boolean;
  state?: {
    status?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    error?: unknown;
    title?: string;
    time?: { start?: number; end?: number };
  };
}

/** V2 assistant rows carry content parts plus usage directly. */
interface V2AssistantData {
  agent?: string;
  model?: { id?: string; providerID?: string; variant?: string };
  tokens?: Tokens;
  cost?: number;
  finish?: string;
  content?: V2ContentPart[];
  time?: { created?: number; completed?: number };
}

interface V2ContentPart {
  type?: string;
  id?: string;
  name?: string;
  text?: string;
  files?: string[];
  state?: {
    status?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    error?: unknown;
    title?: string;
    time?: { created?: number; start?: number; completed?: number; end?: number };
  };
  time?: { created?: number; completed?: number };
}

const FILE_ARG_KEYS = ["filePath", "file_path", "path"];
const EDIT_TOOLS = /^(edit|write|multiedit|patch|apply_patch)$/;

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function usageFromTokens(tokens: Tokens | undefined, model: string | undefined, runtime: string | undefined) {
  const cacheRead = tokens?.cache?.read ?? 0;
  const cacheWrite = tokens?.cache?.write ?? 0;
  // OpenCode reports reasoning apart from output; both are billed as output.
  const output = (tokens?.output ?? 0) + (tokens?.reasoning ?? 0);
  if (!tokens || (tokens.input ?? 0) + output + cacheRead + cacheWrite === 0) return {};
  return {
    inputTokens: (tokens.input ?? 0) + cacheWrite,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    billedUsage: {
      model,
      inputTokens: tokens.input ?? 0,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      local: LOCAL_RUNTIME.test(runtime ?? "") || undefined,
    } satisfies BilledUsage,
  };
}

function parseV1(session: SessionRow, messages: DataRow[], parts: DataRow[]): ParsedSession {
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  let model: string | undefined;
  let firstPrompt = "";
  let lastTimestamp = isoFromMs(session.time_created);

  const partsByMessage = new Map<string, DataRow[]>();
  for (const part of parts) {
    if (!part.message_id) continue;
    let list = partsByMessage.get(part.message_id);
    if (!list) partsByMessage.set(part.message_id, (list = []));
    list.push(part);
  }

  const push = (timestamp: string, type: string, data: Record<string, unknown>, parentId: string) => {
    if (timestamp > lastTimestamp) lastTimestamp = timestamp;
    events.push({ type, data, id: `${parentId}:${events.length}`, timestamp, parentId });
  };

  for (const row of messages) {
    const message = parseJson<MessageData>(row.data) ?? {};
    const messageModel = message.modelID ?? message.model?.modelID;
    const runtime = message.providerID ?? message.model?.providerID;
    const isAssistant = message.role === "assistant";
    if (isAssistant && messageModel) model = messageModel;

    // The message's usage rides on the first event it produces.
    let usage: Record<string, unknown> = {};
    if (isAssistant) usage = usageFromTokens(message.tokens, messageModel, runtime);
    const takeUsage = () => {
      const taken = usage;
      usage = {};
      return taken;
    };

    const messageTime = isoFromMs(row.time_created);
    for (const partRow of partsByMessage.get(row.id) ?? []) {
      const part = parseJson<PartData>(partRow.data) ?? {};
      const ts = isoFromMs(part.time?.start) || isoFromMs(partRow.time_created) || messageTime;

      switch (part.type) {
        case "text": {
          const { text, chars, truncated } = capText(part.text);
          if (!text.trim()) break;
          if (isAssistant) {
            push(ts, "assistant.message", { content: text, model: messageModel, ...takeUsage() }, row.id);
          } else if (part.synthetic) {
            // Text OpenCode adds to the prompt itself, e.g. the contents of an attached file.
            push(ts, "context.attachment", {
              attachmentType: "synthetic",
              label: "Injected context",
              items: [],
              itemCount: 0,
              content: text,
              charLength: chars,
              truncated,
            }, row.id);
          } else {
            if (!firstPrompt) firstPrompt = text;
            push(ts, "user.message", { content: text }, row.id);
          }
          break;
        }
        case "reasoning": {
          const { text, chars } = capText(part.text);
          if (!text.trim()) break;
          push(ts, "assistant.thinking", {
            content: text,
            charLength: chars,
            model: messageModel,
            ...takeUsage(),
          }, row.id);
          break;
        }
        case "tool": {
          const toolName = part.tool ?? "tool";
          const state = part.state ?? {};
          const args = state.input ?? {};
          for (const key of FILE_ARG_KEYS) {
            const value = args[key];
            if (typeof value === "string" && EDIT_TOOLS.test(toolName)) files.add(value);
          }
          push(isoFromMs(state.time?.start) || ts, "tool.execution_start", {
            toolName,
            toolCallId: part.callID,
            arguments: args,
            argumentChars: argumentChars(state.input),
            model: messageModel,
            ...takeUsage(),
          }, row.id);
          // A call still pending or running has no result yet.
          if (state.status !== "completed" && state.status !== "error") break;
          push(isoFromMs(state.time?.end) || ts, "tool.execution_complete", {
            toolName,
            toolCallId: part.callID,
            success: state.status === "completed",
            ...toolResult(state.status === "error" ? state.error : state.output),
          }, row.id);
          break;
        }
        case "file":
          push(ts, "context.attachment", {
            attachmentType: "file",
            label: "Attached file",
            subject: part.filename ?? part.url,
            items: [],
            itemCount: 0,
            content: "",
            charLength: 0,
            truncated: false,
          }, row.id);
          break;
        case "patch":
          for (const file of part.files ?? []) files.add(file);
          break;
        case "compaction":
          push(ts, "session.compaction_start", { trigger: part.auto ? "auto" : "manual" }, row.id);
          break;
        // step-start, step-finish and snapshot only bracket the parts above.
      }
    }

    if (message.error) {
      const aborted = message.error.name === "MessageAbortedError";
      push(messageTime, aborted ? "session.turn_aborted" : "session.error", {
        reason: aborted ? "interrupted" : undefined,
        message: message.error.data?.message ?? message.error.name ?? "Error",
        error: message.error,
      }, row.id);
    }
    // Usage with no renderable part still has to be counted.
    if (Object.keys(usage).length > 0) {
      push(messageTime, "assistant.message", { content: "", model: messageModel, ...takeUsage() }, row.id);
    }
  }

  const createdAt = isoFromMs(session.time_created);
  model ??= parseJson<{ id?: string }>(session.model)?.id;
  events.unshift({
    type: "session.start",
    data: {
      sessionId: session.id,
      selectedModel: model,
      copilotVersion: session.version ?? undefined,
      context: { cwd: session.directory ?? undefined },
      agent: session.agent ?? undefined,
      parentSessionId: session.parent_id ?? undefined,
    },
    id: `${session.id}:start`,
    timestamp: createdAt,
    parentId: null,
  });

  const meta: SessionMeta = {
    provider: "opencode",
    id: session.id,
    title: session.title ?? undefined,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd: session.directory ?? undefined,
    model,
    client_name: session.version ?? undefined,
    host_type: session.parent_id ? "subagent" : undefined,
    created_at: createdAt || undefined,
    updated_at: lastTimestamp || createdAt || undefined,
  };
  return { meta, events, files: [...files] };
}

/**
 * Schema v2: one `session_message` row per user/assistant/system/shell/
 * synthetic/compaction/idle/switch event, ordered by `seq`. Everything the v1
 * `part` table carried for assistant turns now lives in `data.content`.
 */
function parseV2(session: SessionRow, messages: SessionMessageRow[]): ParsedSession {
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  let model: string | undefined;
  let firstPrompt = "";
  let lastTimestamp = isoFromMs(session.time_created);
  const sessionModel = parseJson<{ id?: string; providerID?: string }>(session.model);
  model = sessionModel?.id;

  const push = (timestamp: string, type: string, data: Record<string, unknown>, parentId: string) => {
    if (timestamp > lastTimestamp) lastTimestamp = timestamp;
    events.push({ type, data, id: `${parentId}:${events.length}`, timestamp, parentId });
  };

  for (const row of messages) {
    const data = parseJson<Record<string, unknown>>(row.data) ?? {};
    const rowTime = isoFromMs(row.time_created);

    switch (row.type) {
      case "user": {
        const { text } = capText(data.text);
        if (!text.trim()) break;
        if (!firstPrompt) firstPrompt = text;
        push(rowTime, "user.message", { content: text }, row.id);
        break;
      }

      case "assistant": {
        const message = data as V2AssistantData;
        const messageModel = message.model?.id;
        const runtime = message.model?.providerID;
        if (messageModel) model = messageModel;
        let usage: Record<string, unknown> = usageFromTokens(message.tokens, messageModel, runtime);
        const takeUsage = () => {
          const taken = usage;
          usage = {};
          return taken;
        };
        const messageTime = isoFromMs(message.time?.created) || rowTime;

        for (const part of message.content ?? []) {
          const partTime = isoFromMs(part.time?.created) || messageTime;
          switch (part.type) {
            case "text": {
              const { text } = capText(part.text);
              if (!text.trim()) break;
              push(partTime, "assistant.message", { content: text, model: messageModel, ...takeUsage() }, row.id);
              break;
            }
            case "reasoning": {
              const { text, chars } = capText(part.text);
              if (!text.trim()) break;
              push(partTime, "assistant.thinking", {
                content: text,
                charLength: chars,
                model: messageModel,
                ...takeUsage(),
              }, row.id);
              break;
            }
            case "tool": {
              const toolName = part.name ?? part.state?.title ?? "tool";
              const state = part.state ?? {};
              const args = state.input ?? {};
              for (const key of FILE_ARG_KEYS) {
                const value = args[key];
                if (typeof value === "string" && EDIT_TOOLS.test(toolName)) files.add(value);
              }
              push(isoFromMs(part.time?.created) || partTime, "tool.execution_start", {
                toolName,
                toolCallId: part.id,
                arguments: args,
                argumentChars: argumentChars(state.input),
                model: messageModel,
                ...takeUsage(),
              }, row.id);
              if (state.status !== "completed" && state.status !== "error") break;
              push(
                isoFromMs(part.time?.completed) || partTime,
                "tool.execution_complete",
                {
                  toolName,
                  toolCallId: part.id,
                  success: state.status === "completed",
                  ...toolResult(state.status === "error" ? state.error : state.output),
                },
                row.id,
              );
              break;
            }
            case "patch": {
              for (const file of part.files ?? []) files.add(file);
              break;
            }
            // step-start / step-finish bracket the parts above.
          }
        }

        // Usage with no renderable part still has to be counted.
        if (Object.keys(usage).length > 0) {
          push(messageTime, "assistant.message", { content: "", model: messageModel, ...takeUsage() }, row.id);
        }
        break;
      }

      case "shell": {
        // A command the harness ran itself (tests, dev servers) rather than a tool call.
        const command = typeof data.command === "string" ? data.command : "";
        const output = (data.output as { output?: unknown } | undefined)?.output;
        const status = typeof data.status === "string" ? data.status : "";
        const exit = typeof data.exit === "number" ? data.exit : undefined;
        push(rowTime, "tool.execution_start", {
          toolName: "shell",
          toolCallId: data.shellID,
          arguments: command ? { command } : {},
          argumentChars: command.length,
        }, row.id);
        push(rowTime, "tool.execution_complete", {
          toolName: "shell",
          toolCallId: data.shellID,
          success: exit === undefined ? status === "exited" : exit === 0,
          ...toolResult(output),
        }, row.id);
        break;
      }

      case "synthetic": {
        // Text the harness injects into the prompt (shell output, file contents).
        const { text, chars, truncated } = capText(data.text);
        if (!text.trim()) break;
        const source = (data.metadata as { source?: string } | undefined)?.source;
        push(rowTime, "context.attachment", {
          attachmentType: "synthetic",
          label: source ? `Injected context (${source})` : "Injected context",
          items: [],
          itemCount: 0,
          content: text,
          charLength: chars,
          truncated,
        }, row.id);
        break;
      }

      case "system": {
        const { text } = capText(data.text);
        if (!text.trim()) break;
        push(rowTime, "system.message", { content: text }, row.id);
        break;
      }

      case "compaction": {
        const reason = typeof data.reason === "string" ? data.reason : undefined;
        push(rowTime, "session.compaction_start", { trigger: reason }, row.id);
        const { text } = capText(data.summary);
        if (text.trim()) {
          push(rowTime, "session.compaction_complete", { summary: text }, row.id);
        }
        break;
      }

      case "idle": {
        push(rowTime, "assistant.turn_end", { outcome: data.outcome }, row.id);
        break;
      }

      case "model-switched": {
        const next = (data.model as { id?: string } | undefined)?.id;
        const previous = (data.previous as { id?: string } | undefined)?.id;
        if (next) push(rowTime, "session.model_change", { model: next, previous }, row.id);
        break;
      }

      // agent-switched / location-switched are harness bookkeeping.
    }
  }

  const createdAt = isoFromMs(session.time_created);
  events.unshift({
    type: "session.start",
    data: {
      sessionId: session.id,
      selectedModel: model,
      copilotVersion: session.version ?? undefined,
      context: { cwd: session.directory ?? undefined },
      agent: session.agent ?? undefined,
      parentSessionId: session.parent_id ?? undefined,
    },
    id: `${session.id}:start`,
    timestamp: createdAt,
    parentId: null,
  });

  const meta: SessionMeta = {
    provider: "opencode",
    id: session.id,
    title: session.title ?? undefined,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd: session.directory ?? undefined,
    model,
    client_name: session.version ?? undefined,
    host_type: session.parent_id ? "subagent" : undefined,
    created_at: createdAt || undefined,
    updated_at: lastTimestamp || createdAt || undefined,
  };
  return { meta, events, files: [...files] };
}

function groupBySession(list: DataRow[]): Map<string, DataRow[]> {
  const grouped = new Map<string, DataRow[]>();
  for (const row of list) {
    let group = grouped.get(row.session_id);
    if (!group) grouped.set(row.session_id, (group = []));
    group.push(row);
  }
  return grouped;
}

function groupMessagesBySession(list: SessionMessageRow[]): Map<string, SessionMessageRow[]> {
  const grouped = new Map<string, SessionMessageRow[]>();
  for (const row of list) {
    let group = grouped.get(row.session_id);
    if (!group) grouped.set(row.session_id, (group = []));
    group.push(row);
  }
  return grouped;
}

const MESSAGES = "SELECT * FROM message";
const PARTS = "SELECT * FROM part";
/** Ids sort by creation, so this is conversation order. */
const IN_ORDER = "ORDER BY time_created, id";

/** OpenCode 2.x renamed the tables; v2 is preferred when it is present. */
function hasV2Schema(db: import("node:sqlite").DatabaseSync): boolean {
  return rows<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_v2'").length > 0;
}

function listV2(db: import("node:sqlite").DatabaseSync): ParsedSession[] {
  const messages = groupMessagesBySession(
    rows<SessionMessageRow>(db, "SELECT * FROM session_message ORDER BY session_id, seq"),
  );
  return rows<SessionRow>(db, "SELECT * FROM session_v2").flatMap((session) => {
    const own = messages.get(session.id);
    return own ? [parseV2(session, own)] : [];
  });
}

const listAll = createDatabaseCache(DATABASE, (): SessionMeta[] => {
  const parsed = readDatabase(DATABASE, (db) => {
    if (hasV2Schema(db)) return listV2(db);
    const messages = groupBySession(rows<DataRow>(db, `${MESSAGES} ${IN_ORDER}`));
    const parts = groupBySession(rows<DataRow>(db, `${PARTS} ${IN_ORDER}`));
    return rows<SessionRow>(db, "SELECT * FROM session").flatMap((session) => {
      const own = messages.get(session.id);
      return own ? [parseV1(session, own, parts.get(session.id) ?? [])] : [];
    });
  });
  return (parsed ?? []).map(({ meta, events }) => ({ ...meta, ...quickStatsFromEvents(events) }));
});

export const opencodeProvider: SessionProvider = {
  info: {
    id: "opencode",
    label: "OpenCode",
    shortLabel: "OpenCode",
    rootDir: tildePath(DATABASE),
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(DATABASE);
  },

  listSessions() {
    return listAll();
  },

  getSession(id) {
    const found = readDatabase(DATABASE, (db) => {
      if (hasV2Schema(db)) {
        const [session] = rows<SessionRow>(db, "SELECT * FROM session_v2 WHERE id = ?", id);
        if (!session) return null;
        const messages = rows<SessionMessageRow>(db, "SELECT * FROM session_message WHERE session_id = ? ORDER BY seq", id);
        return { session, ...parseV2(session, messages) };
      }
      const [session] = rows<SessionRow>(db, "SELECT * FROM session WHERE id = ?", id);
      if (!session) return null;
      const messages = rows<DataRow>(db, `${MESSAGES} WHERE session_id = ? ${IN_ORDER}`, id);
      const parts = rows<DataRow>(db, `${PARTS} WHERE session_id = ? ${IN_ORDER}`, id);
      return { session, ...parseV1(session, messages, parts) };
    });
    if (!found) return null;
    const { session, meta, events, files } = found;

    return {
      meta: { ...meta, ...quickStatsFromEvents(events) },
      events,
      files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: "opencode.db · session",
        content: JSON.stringify({ database: DATABASE, ...session }, null, 2),
        language: "json",
      },
      storagePath: DATABASE,
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
