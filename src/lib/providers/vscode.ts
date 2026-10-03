import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AgentEvent, BilledUsage, SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import {
  appDataDir,
  capText,
  createFileCache,
  isoFromMs,
  parseJson,
  readJsonl,
  safeReadFile,
  safeReaddir,
  tildePath,
} from "./fs-utils";

/** Copilot Chat lives in the editor's own storage, one folder per build. */
const USER_DIRS = ["Code", "Code - Insiders"].map((app) => path.join(appDataDir(app), "User"));

const SESSION_FILE = /\.jsonl?$/;

/**
 * Newer builds store a session as a change log rather than a document: the
 * first line is the whole session (`kind` 0), every later line sets (1),
 * appends to (2) or deletes (3) the value at path `k`.
 */
interface Mutation {
  kind: number;
  k?: (string | number)[];
  v?: unknown;
  /** For an append: the index to truncate the list to first. */
  i?: number;
}

type Container = Record<string | number, unknown>;

function applyMutation(state: unknown, { kind, k, v, i }: Mutation) {
  if (!k || k.length === 0) return;
  let target = state as Container;
  for (const key of k.slice(0, -1)) {
    if (target[key] === null || typeof target[key] !== "object") return;
    target = target[key] as Container;
  }
  const last = k[k.length - 1];
  if (kind === 1) {
    target[last] = v;
  } else if (kind === 2) {
    const list = Array.isArray(target[last]) ? (target[last] as unknown[]) : [];
    if (typeof i === "number") list.length = Math.min(list.length, i);
    if (Array.isArray(v)) list.push(...v);
    target[last] = list;
  } else if (kind === 3) {
    delete target[last];
  }
}

interface MarkdownText {
  value?: string;
}

interface ResponsePart {
  kind?: string;
  value?: string | string[];
  name?: string;
  toolId?: string;
  toolCallId?: string;
  invocationMessage?: string | MarkdownText;
  pastTenseMessage?: string | MarkdownText;
  uri?: { fsPath?: string; path?: string };
  toolSpecificData?: {
    kind?: string;
    description?: string;
    agentName?: string;
    prompt?: string;
    result?: string;
    commandLine?: { original?: string };
    terminalCommandState?: { exitCode?: number; timestamp?: number };
    terminalCommandOutput?: { text?: string };
  };
}

interface ToolCallRound {
  timestamp?: number;
  toolCalls?: { id?: string; name?: string; arguments?: string }[];
}

interface ChatRequest {
  requestId?: string;
  timestamp?: number;
  modelId?: string;
  message?: { text?: string };
  variableData?: { variables?: { name?: string }[] };
  response?: ResponsePart[];
  modelState?: { completedAt?: number };
  modeInfo?: { kind?: string };
  agent?: { extensionVersion?: string };
  promptTokens?: number;
  completionTokens?: number;
  elapsedMs?: number;
  result?: {
    timings?: { totalElapsed?: number };
    errorDetails?: { code?: string; message?: string };
    metadata?: {
      promptTokens?: number;
      outputTokens?: number;
      resolvedModel?: string;
      toolCallRounds?: ToolCallRound[];
      toolCallResults?: Record<string, { content?: { value?: unknown }[] }>;
    };
  };
}

interface ChatSession {
  sessionId?: string;
  creationDate?: number;
  customTitle?: string;
  requests?: ChatRequest[];
}

function readSession(filePath: string): ChatSession | null {
  if (filePath.endsWith(".json")) return parseJson<ChatSession>(safeReadFile(filePath));
  let state: ChatSession | null = null;
  for (const line of readJsonl<Mutation>(filePath)) {
    if (line.kind === 0) state = line.v as ChatSession;
    else if (state) applyMutation(state, line);
  }
  return state;
}

const textOf = (message?: string | MarkdownText) =>
  typeof message === "string" ? message : message?.value ?? "";

/** Tool results are stored as a rendered prompt tree; the text is in its leaves. */
function leafText(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const child of node) leafText(child, out);
  else if (node && typeof node === "object") {
    const { text, node: inner, children } = node as Record<string, unknown>;
    if (typeof text === "string") out.push(text);
    leafText(inner, out);
    leafText(children, out);
  }
  return out;
}

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** A tool call id as the response records it, without the per-window suffix. */
const baseCallId = (id: string) => id.split("__")[0];

const EDIT_PARTS = new Set(["textEditGroup", "notebookEditGroup"]);

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function parseFile(filePath: string): ParsedSession | null {
  const session = readSession(filePath);
  const requests = (session?.requests ?? []).filter(Boolean);
  if (!session || requests.length === 0) return null;

  const id = path.basename(filePath).replace(SESSION_FILE, "");
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  let model: string | undefined;
  let clientVersion: string | undefined;
  let lastAt = session.creationDate ?? 0;

  const push = (at: number, type: string, data: Record<string, unknown>, parentId: string | null) => {
    if (at > lastAt) lastAt = at;
    events.push({ type, data, id: `${id}:${events.length}`, timestamp: isoFromMs(at), parentId });
  };

  for (const request of requests) {
    const requestId = request.requestId ?? null;
    const metadata = request.result?.metadata;
    // "copilot/auto" names no model; only the resolved one does.
    const requestModel =
      metadata?.resolvedModel ||
      request.modelId?.replace(/^copilot\//, "").replace(/^auto$/, "") ||
      undefined;
    if (requestModel) model = requestModel;
    if (request.agent?.extensionVersion) clientVersion = request.agent.extensionVersion;

    // The response parts carry no time of their own. Tool calls take the time
    // of the model round that made them; everything else follows on from that.
    let at = request.timestamp ?? lastAt;
    const calls = new Map<string, { name?: string; arguments?: string; at?: number }>();
    for (const round of metadata?.toolCallRounds ?? []) {
      for (const call of round.toolCalls ?? []) {
        if (call.id) calls.set(baseCallId(call.id), { ...call, at: round.timestamp });
      }
    }
    const results = new Map<string, string>();
    for (const [callId, result] of Object.entries(metadata?.toolCallResults ?? {})) {
      results.set(baseCallId(callId), leafText(result.content?.map((c) => c.value)).join("\n"));
    }

    push(at, "user.message", {
      content: capText(request.message?.text).text,
      mode: request.modeInfo?.kind,
    }, requestId);
    const attached = (request.variableData?.variables ?? []).flatMap((v) => v.name ?? []);
    if (attached.length > 0) {
      push(at, "context.attachment", {
        attachmentType: "references",
        label: "Attached context",
        items: attached.slice(0, 200),
        itemCount: attached.length,
        itemsLabel: "references",
        content: "",
        charLength: 0,
        truncated: false,
      }, requestId);
    }

    // Prose arrives in fragments split around inline file links.
    let prose = "";
    let lastMessage: AgentEvent | null = null;
    const flushProse = () => {
      if (prose.trim()) {
        push(at, "assistant.message", { content: capText(prose).text, model: requestModel }, requestId);
        lastMessage = events[events.length - 1];
      }
      prose = "";
    };

    for (const part of request.response ?? []) {
      if (!part || typeof part !== "object") continue;
      if (part.kind === undefined) {
        prose += textOf(part as MarkdownText);
      } else if (part.kind === "inlineReference") {
        prose += part.name ? `\`${part.name}\`` : "";
      } else if (part.kind === "thinking") {
        const thought = Array.isArray(part.value) ? part.value.join("") : part.value ?? "";
        if (!thought.trim()) continue;
        flushProse();
        push(at, "assistant.thinking", {
          content: capText(thought).text,
          charLength: thought.length,
          model: requestModel,
        }, requestId);
      } else if (part.kind === "toolInvocationSerialized") {
        flushProse();
        const callId = part.toolCallId ? baseCallId(part.toolCallId) : undefined;
        const call = callId ? calls.get(callId) : undefined;
        const detail = part.toolSpecificData;
        if (call?.at && call.at > at) at = call.at;
        const toolName = call?.name ?? part.toolId ?? "tool";
        push(at, "tool.execution_start", {
          toolName,
          toolCallId: callId,
          arguments:
            parseJson<Record<string, unknown>>(call?.arguments) ??
            (detail?.kind === "terminal"
              ? { command: detail.commandLine?.original }
              : detail?.kind === "subagent"
                ? { description: detail.description, agent: detail.agentName, prompt: detail.prompt }
                : { description: textOf(part.invocationMessage) }),
          model: requestModel,
        }, requestId);

        const finishedAt = detail?.terminalCommandState?.timestamp;
        if (finishedAt && finishedAt > at) at = finishedAt;
        const exitCode = detail?.terminalCommandState?.exitCode;
        const { text, chars, truncated } = capText(
          (callId && results.get(callId)) ||
            detail?.result ||
            detail?.terminalCommandOutput?.text?.replace(ANSI, "") ||
            textOf(part.pastTenseMessage),
        );
        push(at, "tool.execution_complete", {
          toolName,
          toolCallId: callId,
          success: typeof exitCode !== "number" || exitCode === 0,
          resultChars: chars,
          truncated,
          result: { content: text },
        }, requestId);
      } else if (EDIT_PARTS.has(part.kind)) {
        const file = part.uri?.fsPath ?? part.uri?.path;
        if (file) files.add(file);
      }
    }
    const completedAt = request.modelState?.completedAt;
    if (completedAt && completedAt > at) at = completedAt;
    flushProse();

    // Only the request as a whole is metered, and the prompt count is that of
    // its last model round, so input is a floor for a request that used tools.
    const inputTokens = request.promptTokens ?? metadata?.promptTokens ?? 0;
    const outputTokens = request.completionTokens ?? metadata?.outputTokens ?? 0;
    if (inputTokens + outputTokens > 0) {
      const usage = {
        inputTokens,
        outputTokens,
        billedUsage: { model: requestModel, inputTokens, outputTokens } satisfies BilledUsage,
      };
      if (lastMessage) Object.assign((lastMessage as AgentEvent).data, usage);
      else push(at, "assistant.message", { content: "", model: requestModel, ...usage }, requestId);
    }

    const error = request.result?.errorDetails;
    if (error?.code === "canceled") {
      push(at, "session.turn_aborted", { reason: "interrupted", message: error.message }, requestId);
    } else if (error) {
      push(at, "session.error", { message: error.message ?? error.code ?? "Error", error }, requestId);
    }
    const durationMs = request.elapsedMs ?? request.result?.timings?.totalElapsed;
    if (durationMs) push(at, "assistant.turn_end", { durationMs }, requestId);
  }

  const createdAt = isoFromMs(session.creationDate ?? requests[0].timestamp);
  events.unshift({
    type: "session.start",
    data: {
      sessionId: id,
      selectedModel: model,
      copilotVersion: clientVersion,
      context: {},
      entrypoint: "vscode",
    },
    id: `${id}:start`,
    timestamp: createdAt,
    parentId: null,
  });

  const meta: SessionMeta = {
    provider: "vscode",
    id,
    title: session.customTitle || undefined,
    name: requests[0].message?.text?.slice(0, 500) || undefined,
    model,
    client_name: clientVersion ? `Copilot Chat ${clientVersion}` : undefined,
    host_type: "vscode",
    created_at: createdAt || undefined,
    updated_at: isoFromMs(lastAt) || createdAt || undefined,
  };
  return { meta, events, files: [...files] };
}

const parseCached = createFileCache(parseFile);

const summarize = createFileCache((filePath: string) => {
  const parsed = parseCached(filePath);
  return parsed ? { ...parsed.meta, ...quickStatsFromEvents(parsed.events) } : null;
});

/** The folder a workspace storage directory belongs to, read from its `workspace.json`. */
const workspaceFolder = createFileCache((filePath: string): string | undefined => {
  const workspace = parseJson<{ folder?: string; workspace?: string }>(safeReadFile(filePath));
  try {
    if (workspace?.folder?.startsWith("file:")) return fileURLToPath(workspace.folder);
    // A multi-root workspace: the folder holding its `.code-workspace` file.
    if (workspace?.workspace?.startsWith("file:")) {
      return path.dirname(fileURLToPath(workspace.workspace));
    }
  } catch {
    /* not a path on this machine */
  }
  return undefined;
});

interface SessionFile {
  id: string;
  filePath: string;
  cwd?: string;
}

function sessionFiles(): SessionFile[] {
  const out: SessionFile[] = [];
  const collect = (dir: string, cwd?: string) => {
    for (const entry of safeReaddir(dir)) {
      if (!SESSION_FILE.test(entry)) continue;
      out.push({ id: entry.replace(SESSION_FILE, ""), filePath: path.join(dir, entry), cwd });
    }
  };
  for (const userDir of USER_DIRS) {
    const storage = path.join(userDir, "workspaceStorage");
    for (const workspace of safeReaddir(storage)) {
      const chatDir = path.join(storage, workspace, "chatSessions");
      if (!fs.existsSync(chatDir)) continue;
      collect(chatDir, workspaceFolder(path.join(storage, workspace, "workspace.json")));
    }
    // Chats started in a window with no folder open.
    collect(path.join(userDir, "globalStorage", "emptyWindowChatSessions"));
  }
  return out;
}

export const vscodeProvider: SessionProvider = {
  info: {
    id: "vscode",
    label: "GitHub Copilot Chat (VS Code)",
    shortLabel: "VS Code",
    rootDir: tildePath(path.join(USER_DIRS[0], "workspaceStorage")),
    supportsLogs: false,
  },

  isAvailable() {
    return USER_DIRS.some((dir) => fs.existsSync(dir));
  },

  listSessions() {
    return sessionFiles().flatMap(({ filePath, cwd }) => {
      const meta = summarize(filePath);
      // The editor creates a session file for every chat panel it opens.
      return meta ? [{ ...meta, cwd }] : [];
    });
  },

  getSession(id) {
    const found = sessionFiles().find((file) => file.id === id);
    const parsed = found && parseCached(found.filePath);
    if (!found || !parsed) return null;
    const meta = { ...parsed.meta, cwd: found.cwd };

    return {
      meta: { ...meta, ...quickStatsFromEvents(parsed.events) },
      events: parsed.events,
      files: parsed.files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: path.basename(found.filePath),
        content: JSON.stringify({ transcript: found.filePath, ...meta }, null, 2),
        language: "json",
      },
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
