import fs from "fs";
import os from "os";
import path from "path";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import { capText, isoFromMs, parseJson, tildePath } from "./fs-utils";
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

const FILE_ARG_KEYS = ["filePath", "file_path", "path"];
const EDIT_TOOLS = /^(edit|write|multiedit|patch|apply_patch)$/;

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function parse(session: SessionRow, messages: DataRow[], parts: DataRow[]): ParsedSession {
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
    const tokens = message.tokens;
    const cacheRead = tokens?.cache?.read ?? 0;
    const cacheWrite = tokens?.cache?.write ?? 0;
    // OpenCode reports reasoning apart from output; both are billed as output.
    const output = (tokens?.output ?? 0) + (tokens?.reasoning ?? 0);
    if (isAssistant && tokens && (tokens.input ?? 0) + output + cacheRead + cacheWrite > 0) {
      usage = {
        inputTokens: (tokens.input ?? 0) + cacheWrite,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        billedUsage: {
          model: messageModel,
          inputTokens: tokens.input ?? 0,
          outputTokens: output,
          cacheReadTokens: cacheRead,
          cacheWriteTokens: cacheWrite,
          local: LOCAL_RUNTIME.test(runtime ?? "") || undefined,
        } satisfies BilledUsage,
      };
    }
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
            model: messageModel,
            ...takeUsage(),
          }, row.id);
          // A call still pending or running has no result yet.
          if (state.status !== "completed" && state.status !== "error") break;
          const { text, chars, truncated } = capText(
            state.status === "error" ? state.error : state.output,
          );
          push(isoFromMs(state.time?.end) || ts, "tool.execution_complete", {
            toolName,
            toolCallId: part.callID,
            success: state.status === "completed",
            resultChars: chars,
            truncated,
            result: { content: text },
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

function groupBySession(list: DataRow[]): Map<string, DataRow[]> {
  const grouped = new Map<string, DataRow[]>();
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

const listAll = createDatabaseCache(DATABASE, (): SessionMeta[] => {
  const parsed = readDatabase(DATABASE, (db) => {
    const messages = groupBySession(rows<DataRow>(db, `${MESSAGES} ${IN_ORDER}`));
    const parts = groupBySession(rows<DataRow>(db, `${PARTS} ${IN_ORDER}`));
    return rows<SessionRow>(db, "SELECT * FROM session").flatMap((session) => {
      const own = messages.get(session.id);
      return own ? [parse(session, own, parts.get(session.id) ?? [])] : [];
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
      const [session] = rows<SessionRow>(db, "SELECT * FROM session WHERE id = ?", id);
      if (!session) return null;
      const messages = rows<DataRow>(db, `${MESSAGES} WHERE session_id = ? ${IN_ORDER}`, id);
      const parts = rows<DataRow>(db, `${PARTS} WHERE session_id = ? ${IN_ORDER}`, id);
      return { session, ...parse(session, messages, parts) };
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
