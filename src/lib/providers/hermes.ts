import fs from "fs";
import os from "os";
import path from "path";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import { capText, isoFromMs, parseJson, tildePath } from "./fs-utils";
import { LOCAL_RUNTIME } from "./pricing";
import { createDatabaseCache, readDatabase, rows } from "./sqlite-utils";

export const HERMES_DIR = process.env.HERMES_HOME ?? path.join(os.homedir(), ".hermes");
const STATE_DB = path.join(HERMES_DIR, "state.db");

/** Hermes stores time as fractional epoch seconds. */
const iso = (seconds: unknown) => isoFromMs(typeof seconds === "number" ? seconds * 1000 : NaN);

/** Read with `SELECT *`, so a column an older Hermes lacks is just absent. */
interface SessionRow {
  id: string;
  source: string | null;
  model: string | null;
  system_prompt: string | null;
  parent_session_id: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  cwd: string | null;
  git_branch: string | null;
  git_repo_root: string | null;
  billing_provider: string | null;
  billing_base_url: string | null;
  title: string | null;
}

interface MessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string | null;
  tool_call_id: string | null;
  tool_calls: string | null;
  tool_name: string | null;
  timestamp: number;
  finish_reason: string | null;
  reasoning: string | null;
  reasoning_content: string | null;
}

interface ToolCall {
  id?: string;
  call_id?: string;
  function?: { name?: string; arguments?: string };
}

const FILE_ARG_KEYS = ["path", "file_path", "filePath"];
const EDIT_TOOLS = /^(write_file|patch|edit_file|create_file)$/;

/** Hermes tools report failure in the JSON they return, not out of band. */
function toolFailed(content: string): boolean {
  if (!content.startsWith("{")) return false;
  const result = parseJson<{ success?: unknown; error?: unknown }>(content);
  return result?.success === false || Boolean(result?.error);
}

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function parse(session: SessionRow, messages: MessageRow[]): ParsedSession {
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  const toolNames = new Map<string, string>();
  const startedAt = iso(session.started_at);
  let lastTimestamp = startedAt;
  let firstPrompt = "";

  const push = (timestamp: string, type: string, data: Record<string, unknown>) => {
    events.push({ type, data, id: `${session.id}:${events.length}`, timestamp, parentId: null });
  };

  push(startedAt, "session.start", {
    sessionId: session.id,
    selectedModel: session.model,
    context: { cwd: session.cwd, branch: session.git_branch },
    entrypoint: session.source,
    parentSessionId: session.parent_session_id ?? undefined,
  });
  if (session.system_prompt) {
    const { text, chars, truncated } = capText(session.system_prompt);
    push(startedAt, "system.message", {
      role: "system_prompt",
      content: text,
      charLength: chars,
      truncated,
    });
  }

  for (const message of messages) {
    const ts = iso(message.timestamp) || lastTimestamp;
    lastTimestamp = ts;
    const content = message.content ?? "";

    if (message.role === "user") {
      if (!firstPrompt) firstPrompt = content;
      push(ts, "user.message", { content: capText(content).text });
    } else if (message.role === "assistant") {
      const reasoning = message.reasoning || message.reasoning_content;
      if (reasoning) {
        push(ts, "assistant.thinking", {
          content: capText(reasoning).text,
          charLength: reasoning.length,
          model: session.model,
        });
      }
      if (content.trim()) {
        push(ts, "assistant.message", { content: capText(content).text, model: session.model });
      }
      for (const call of parseJson<ToolCall[]>(message.tool_calls) ?? []) {
        const toolName = call.function?.name ?? "tool";
        const toolCallId = call.id ?? call.call_id;
        if (toolCallId) toolNames.set(toolCallId, toolName);
        const args = parseJson<Record<string, unknown>>(call.function?.arguments) ?? {};
        for (const key of FILE_ARG_KEYS) {
          const value = args[key];
          if (typeof value === "string" && EDIT_TOOLS.test(toolName)) files.add(value);
        }
        push(ts, "tool.execution_start", {
          toolName,
          toolCallId,
          arguments: args,
          model: session.model,
        });
      }
    } else if (message.role === "tool") {
      const { text, chars, truncated } = capText(content);
      push(ts, "tool.execution_complete", {
        toolName: message.tool_name ?? toolNames.get(message.tool_call_id ?? "") ?? "tool",
        toolCallId: message.tool_call_id,
        success: !toolFailed(content),
        resultChars: chars,
        truncated,
        result: { content: text },
      });
    } else if (content) {
      const { text, chars, truncated } = capText(content);
      push(ts, "system.message", { role: message.role, content: text, charLength: chars, truncated });
    }
  }

  // Hermes counts tokens per session, not per message, so the whole session's
  // usage lands on one checkpoint at its last message.
  const input = session.input_tokens ?? 0;
  const output = session.output_tokens ?? 0;
  const cacheRead = session.cache_read_tokens ?? 0;
  const cacheWrite = session.cache_write_tokens ?? 0;
  if (input + output + cacheRead + cacheWrite > 0) {
    push(lastTimestamp, "session.usage_checkpoint", {
      billedUsage: {
        model: session.model ?? undefined,
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        local:
          LOCAL_RUNTIME.test(`${session.billing_provider ?? ""} ${session.billing_base_url ?? ""}`) ||
          undefined,
      } satisfies BilledUsage,
      usage: {
        inputTokens: input,
        cachedInputTokens: cacheRead,
        outputTokens: output,
        reasoningTokens: session.reasoning_tokens ?? 0,
        totalTokens: input + output + cacheRead + cacheWrite,
      },
      sessionTotals: {
        inputTokens: input + cacheWrite,
        outputTokens: output,
        cacheReadTokens: cacheRead,
      },
    });
  }

  const meta: SessionMeta = {
    provider: "hermes",
    id: session.id,
    title: session.title ?? undefined,
    name: firstPrompt.slice(0, 500) || undefined,
    cwd: session.git_repo_root ?? session.cwd ?? undefined,
    branch: session.git_branch ?? undefined,
    model: session.model ?? undefined,
    host_type: session.source ?? undefined,
    created_at: startedAt || undefined,
    updated_at: lastTimestamp || startedAt || undefined,
  };
  return { meta, events, files: [...files] };
}

const listAll = createDatabaseCache(STATE_DB, (): SessionMeta[] => {
  const parsed = readDatabase(STATE_DB, (db) => {
    const bySession = new Map<string, MessageRow[]>();
    for (const message of rows<MessageRow>(db, "SELECT * FROM messages ORDER BY id")) {
      let list = bySession.get(message.session_id);
      if (!list) bySession.set(message.session_id, (list = []));
      list.push(message);
    }
    return rows<SessionRow>(db, "SELECT * FROM sessions").flatMap((session) => {
      // Hermes opens a session row at launch; one nobody typed into is not a session.
      const messages = bySession.get(session.id);
      return messages ? [parse(session, messages)] : [];
    });
  });
  return (parsed ?? []).map(({ meta, events }) => ({ ...meta, ...quickStatsFromEvents(events) }));
});

export const hermesProvider: SessionProvider = {
  info: {
    id: "hermes",
    label: "Hermes Agent",
    shortLabel: "Hermes",
    rootDir: tildePath(STATE_DB),
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(STATE_DB);
  },

  listSessions() {
    return listAll();
  },

  getSession(id) {
    const found = readDatabase(STATE_DB, (db) => {
      const [session] = rows<SessionRow>(db, "SELECT * FROM sessions WHERE id = ?", id);
      if (!session) return null;
      const messages = rows<MessageRow>(
        db,
        "SELECT * FROM messages WHERE session_id = ? ORDER BY id",
        id,
      );
      return { session, ...parse(session, messages) };
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
        name: "state.db · sessions",
        content: JSON.stringify(
          { database: STATE_DB, ...session, system_prompt: undefined },
          null,
          2,
        ),
        language: "json",
      },
      storagePath: STATE_DB,
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
