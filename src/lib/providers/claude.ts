import fs from "fs";
import path from "path";
import os from "os";
import type {
  AgentEvent,
  BilledUsage,
  ProviderId,
  SessionDetail,
  SessionMeta,
  SessionProvider,
} from "./types";
import { quickStatsFromEvents } from "./analysis";
import {
  capText,
  createFileCache,
  readJsonl,
  safeReaddir,
  statOf,
} from "./fs-utils";

export const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  /** Cache writes split by TTL; the two TTLs are billed at different rates. */
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  speed?: string;
}

const INTERRUPTED = /^\[Request interrupted by user/;

interface ClaudeBlock {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface ClaudeRecord {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  entrypoint?: string;
  requestId?: string;
  effort?: string;
  subtype?: string;
  level?: string;
  content?: unknown;
  error?: Record<string, unknown>;
  durationMs?: number;
  hookCount?: number;
  hookErrors?: unknown[];
  compactMetadata?: { trigger?: string; preTokens?: number };
  mode?: string;
  permissionMode?: string;
  customTitle?: string;
  aiTitle?: string;
  totalCostUSD?: number;
  totalAPIDuration?: number;
  attachment?: { type?: string } & Record<string, unknown>;
  message?: {
    role?: string;
    model?: string;
    id?: string;
    content?: ClaudeBlock[] | string;
    usage?: ClaudeUsage;
  };
  toolUseResult?: unknown;
}

/**
 * Claude Code encodes the project path into the directory name by replacing
 * every "/" with "-", which is lossy for paths that contain dashes. Used only
 * as a fallback when no record in the transcript carries a real `cwd`.
 */
function decodeProjectDir(dirName: string): string {
  return dirName.replace(/^-/, "/").replace(/-/g, "/");
}

const FILE_ARG_KEYS = ["file_path", "notebook_path", "path", "filePath"];
const EDIT_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit|Update)$/;

/** Human labels for the attachment kinds Claude Code injects. */
const ATTACHMENT_LABELS: Record<string, string> = {
  deferred_tools_delta: "Tool catalog",
  deferred_tools_record: "Tool catalog",
  tool_definitions: "Tool definitions",
  environment: "Environment",
  model: "Model identity",
  session_context: "Session context",
  date: "Date",
  date_change: "Date",
  batching_reminder_sent: "Reminder",
  silent_turn_reminder: "Reminder",
  agent_listing_delta: "Agent listing",
  mcp_instructions_delta: "MCP instructions",
  skill_listing: "Skill listing",
  auto_mode: "Auto mode",
  total_tokens_reminder: "Token budget",
  edited_text_file: "File edited outside the session",
  nested_memory: "Memory file",
  hook_additional_context: "Hook context",
  queued_command: "Queued command",
  task_reminder: "Task reminder",
  command_permissions: "Command permissions",
  remote_session_change: "Remote session",
  file: "Attached file",
  image: "Image",
};

function joinText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => joinText(v)).join("\n");
  if (typeof value === "string") return value;
  return value == null ? "" : JSON.stringify(value, null, 2);
}

function toNames(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/**
 * Attachments are injected context with a different shape per kind. Flatten
 * each into a common {label, subject, items, body} so the UI can render them
 * as content rather than as raw JSON.
 */
function describeAttachment(
  attachment: { type?: string } & Record<string, unknown>,
): Record<string, unknown> {
  const type = attachment.type ?? "unknown";
  let subject: string | undefined;
  let items: string[] = [];
  let itemsLabel: string | undefined;
  let body = "";

  switch (type) {
    case "total_tokens_reminder":
    case "batching_reminder_sent":
    case "silent_turn_reminder":
    case "model":
      body = joinText(attachment.text);
      break;
    case "date":
    case "date_change":
      subject = (attachment.date as string) ?? (attachment.newDate as string);
      break;
    case "environment":
      body = joinText(attachment.snapshot);
      break;
    case "session_context":
      body = Object.values((attachment.context as Record<string, unknown>) ?? {})
        .map((v) => joinText(v))
        .join("\n\n");
      break;
    case "deferred_tools_record": {
      const entries = (attachment.entries as { name?: string }[]) ?? [];
      items = entries.map((entry) => String(entry?.name ?? "tool"));
      itemsLabel = "tools";
      body = joinText(entries);
      break;
    }
    case "edited_text_file":
      subject = attachment.filename as string;
      body = joinText(attachment.snippet);
      break;
    case "file": {
      subject = (attachment.displayPath as string) ?? (attachment.filename as string);
      const content = attachment.content as Record<string, unknown> | undefined;
      const file = content?.file as Record<string, unknown> | undefined;
      body = joinText(file?.content ?? content);
      break;
    }
    case "nested_memory": {
      subject = (attachment.displayPath as string) ?? (attachment.path as string);
      const content = attachment.content as Record<string, unknown> | undefined;
      body = joinText(content?.content ?? content);
      break;
    }
    case "hook_additional_context":
      subject = attachment.hookName as string;
      body = joinText(attachment.content);
      break;
    case "queued_command":
      subject = attachment.commandMode as string;
      body = joinText(attachment.prompt);
      break;
    case "task_reminder":
      subject =
        typeof attachment.itemCount === "number"
          ? `${attachment.itemCount} item${attachment.itemCount === 1 ? "" : "s"}`
          : undefined;
      body = joinText(attachment.content);
      break;
    case "command_permissions":
      items = toNames(attachment.allowedTools);
      itemsLabel = "allowed";
      break;
    case "skill_listing":
      items = toNames(attachment.names);
      itemsLabel = "skills";
      subject = attachment.isInitial ? "initial listing" : "updated";
      body = joinText(attachment.content);
      break;
    case "agent_listing_delta":
      items = toNames(attachment.addedTypes);
      itemsLabel = "agents";
      body = joinText(attachment.addedLines);
      break;
    case "mcp_instructions_delta":
      items = toNames(attachment.addedNames);
      itemsLabel = "servers";
      body = joinText(attachment.addedBlocks);
      break;
    case "deferred_tools_delta": {
      items = toNames(attachment.addedNames);
      itemsLabel = "tools added";
      const removed = toNames(attachment.removedNames).length;
      subject = removed ? `${removed} removed` : undefined;
      body = joinText(attachment.addedLines);
      break;
    }
    case "auto_mode":
      items = Object.entries(attachment)
        .filter(([key, value]) => key !== "type" && value === true)
        .map(([key]) => key);
      itemsLabel = "flags";
      break;
    case "remote_session_change":
      subject = (attachment.url as string) ?? undefined;
      body = [attachment.commit, attachment.pr].filter(Boolean).map(String).join("\n");
      break;
    case "image":
      break;
    default:
      body = joinText(attachment);
  }

  const capped = capText(body);
  return {
    attachmentType: type,
    label: ATTACHMENT_LABELS[type] ?? type.replace(/_/g, " "),
    subject,
    items: items.slice(0, 200),
    itemCount: items.length,
    itemsLabel,
    content: capped.text,
    charLength: capped.chars,
    truncated: capped.truncated,
  };
}

/** `prompt_snapshot` is where Claude Code records the system prompt it sent. */
function systemPromptOf(attachment: Record<string, unknown>): string {
  const sections = Array.isArray(attachment.systemPrompt)
    ? attachment.systemPrompt.map((s) => joinText(s).trim())
    : [joinText(attachment.systemPrompt).trim()];
  return sections.filter(Boolean).join("\n\n");
}

/** Tool schemas sent alongside the system prompt; listed by name, sized in full. */
function describeToolDefinitions(tools: unknown[], chars: number): Record<string, unknown> {
  const names = tools.map((tool) => String((tool as { name?: string })?.name ?? "tool"));
  return {
    attachmentType: "tool_definitions",
    label: ATTACHMENT_LABELS.tool_definitions,
    items: names.slice(0, 200),
    itemCount: names.length,
    itemsLabel: "tools",
    content: "",
    charLength: chars,
    truncated: false,
  };
}

/** CLAUDE.md / AGENTS.md files loaded into the system prompt. */
function instructionFilesText(attachment: Record<string, unknown>): string {
  const files = (attachment.files as { path?: string; type?: string; content?: string }[]) ?? [];
  return files
    .map((file) => `# ${file.path ?? "instructions"}${file.type ? ` (${file.type})` : ""}\n${file.content ?? ""}`)
    .join("\n\n");
}

export interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

/**
 * Reads one Claude Code transcript. Cowork runs the same CLI inside its own
 * sessions, so its adapter parses with this too, under its own provider id.
 */
export function parseClaudeTranscript(
  filePath: string,
  provider: ProviderId = "claude",
  id = path.basename(filePath, ".jsonl"),
): ParsedSession {
  const records = readJsonl<ClaudeRecord>(filePath);
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  /** tool_use id → tool name, so results can be labelled. */
  const toolNames = new Map<string, string>();
  /** Streamed messages repeat their usage on every block record; count once. */
  const usageSeen = new Set<string>();
  let lastSystemPrompt = "";
  let lastToolDefinitions = "";

  const meta: SessionMeta = { provider, id };
  let firstTimestamp = "";
  let lastTimestamp = "";
  let seq = 0;
  // A fork starts as a copy of its parent's records, which keep the parent's
  // sessionId. A file with no record of its own is not a fork, just renamed.
  const hasOwnRecords = records.some((rec) => rec.sessionId === id);
  let inherited = false;

  const push = (
    timestamp: string,
    type: string,
    data: Record<string, unknown>,
    uuid?: string,
    parentUuid?: string | null,
  ) => {
    events.push({
      type,
      data: inherited ? { ...data, inherited: true } : data,
      id: uuid ? `${uuid}:${seq++}` : `claude-${seq++}`,
      timestamp,
      parentId: parentUuid ?? null,
    });
  };

  for (const rec of records) {
    const ts = rec.timestamp ?? lastTimestamp;
    if (rec.timestamp) {
      if (!firstTimestamp) firstTimestamp = rec.timestamp;
      lastTimestamp = rec.timestamp;
    }
    inherited = hasOwnRecords && !!rec.sessionId && rec.sessionId !== id;
    // Copied records run parent-first, so the last one names the direct parent.
    if (inherited) meta.forkedFrom = rec.sessionId;
    if (rec.cwd) meta.cwd = rec.cwd;
    if (rec.gitBranch) meta.branch = rec.gitBranch;
    if (rec.version) meta.client_name = rec.version;
    if (rec.entrypoint) meta.host_type = rec.entrypoint;

    switch (rec.type) {
      case "custom-title":
        if (rec.customTitle) {
          meta.title = rec.customTitle;
          meta.user_named = true;
        }
        continue;
      case "ai-title":
        if (rec.aiTitle && !meta.user_named) meta.title = rec.aiTitle;
        continue;
      // Session bookkeeping records with no place on a timeline.
      case "last-prompt":
      case "atis-latch":
      case "bridge-session":
      case "queue-operation":
      case "file-history-snapshot":
        continue;

      case "mode":
      case "permission-mode":
        push(ts, "session.mode_change", {
          mode: rec.mode ?? rec.permissionMode,
        }, rec.uuid, rec.parentUuid);
        continue;

      case "cost-state":
        push(ts, "session.usage_checkpoint", {
          totalCostUSD: rec.totalCostUSD,
          apiDurationMs: rec.totalAPIDuration,
          sessionTotals: { apiDurationMs: rec.totalAPIDuration ?? 0 },
        }, rec.uuid, rec.parentUuid);
        continue;

      case "attachment": {
        const attachment = rec.attachment ?? {};
        if (attachment.type === "prompt_snapshot") {
          // The snapshot is re-recorded whenever any part of it changes, so
          // only emit the parts that differ from what was last shown.
          const prompt = systemPromptOf(attachment);
          if (prompt && prompt !== lastSystemPrompt) {
            lastSystemPrompt = prompt;
            // The one-line CLI prefix only appears on some snapshots, so it
            // is shown but kept out of the comparison above.
            const prefix = joinText(attachment.cliPrefix).trim();
            const { text, chars, truncated } = capText(
              prefix ? `${prefix}\n\n${prompt}` : prompt,
            );
            push(ts, "system.message", {
              role: "system_prompt",
              content: text,
              charLength: chars,
              truncated,
            }, rec.uuid, rec.parentUuid);
          }
          if (Array.isArray(attachment.tools)) {
            const serialized = JSON.stringify(attachment.tools);
            if (serialized !== lastToolDefinitions) {
              lastToolDefinitions = serialized;
              push(
                ts,
                "context.attachment",
                describeToolDefinitions(attachment.tools, serialized.length),
                rec.uuid,
                rec.parentUuid,
              );
            }
          }
          continue;
        }
        if (attachment.type === "instructions") {
          const { text, chars, truncated } = capText(instructionFilesText(attachment));
          push(ts, "system.message", {
            role: "instructions",
            content: text,
            charLength: chars,
            truncated,
          }, rec.uuid, rec.parentUuid);
          continue;
        }
        push(ts, "context.attachment", describeAttachment(attachment), rec.uuid, rec.parentUuid);
        continue;
      }

      case "system": {
        if (rec.subtype === "api_error") {
          push(ts, "session.error", {
            message: rec.error?.message ?? "API error",
            detail: rec.error?.formatted ?? "",
            level: rec.level,
            error: rec.error,
          }, rec.uuid, rec.parentUuid);
        } else if (rec.subtype === "stop_hook_summary") {
          push(ts, "hook.end", {
            hookType: "Stop",
            hookCount: rec.hookCount,
            success: (rec.hookErrors?.length ?? 0) === 0,
          }, rec.uuid, rec.parentUuid);
        } else if (rec.subtype === "compact_boundary") {
          push(ts, "session.compaction_start", {
            trigger: rec.compactMetadata?.trigger,
            preTokens: rec.compactMetadata?.preTokens,
          }, rec.uuid, rec.parentUuid);
        } else if (rec.subtype === "turn_duration") {
          push(ts, "assistant.turn_end", {
            durationMs: rec.durationMs,
          }, rec.uuid, rec.parentUuid);
        } else {
          const { text, chars, truncated } = capText(rec.content);
          push(ts, "system.message", {
            role: rec.subtype ?? "system",
            content: text,
            charLength: chars,
            truncated,
          }, rec.uuid, rec.parentUuid);
        }
        continue;
      }

      case "user": {
        const content = rec.message?.content;
        // An interruption is logged as if the user had typed it. Same concept
        // as Codex's turn_aborted; use one vocabulary for both.
        const pushText = (raw: unknown) => {
          const { text } = capText(raw);
          if (INTERRUPTED.test(text)) {
            push(ts, "session.turn_aborted", { reason: "interrupted", message: text }, rec.uuid, rec.parentUuid);
          } else {
            push(ts, "user.message", { content: text }, rec.uuid, rec.parentUuid);
          }
        };
        if (typeof content === "string") {
          pushText(content);
          continue;
        }
        for (const block of content ?? []) {
          if (block.type === "text") {
            pushText(block.text);
          } else if (block.type === "tool_result") {
            const raw = block.content ?? rec.toolUseResult;
            const { text, chars, truncated } = capText(
              typeof raw === "string" ? raw : raw,
            );
            const toolName = toolNames.get(block.tool_use_id ?? "") ?? "tool";
            push(
              ts,
              toolName.startsWith("mcp__") ? "external_tool.completed" : "tool.execution_complete",
              {
                toolName,
                toolCallId: block.tool_use_id,
                success: block.is_error !== true,
                resultChars: chars,
                truncated,
                result: { content: text },
              },
              rec.uuid,
              rec.parentUuid,
            );
          } else if (block.type === "image") {
            push(ts, "context.attachment", describeAttachment({ type: "image" }), rec.uuid, rec.parentUuid);
          }
        }
        continue;
      }

      case "assistant": {
        const message = rec.message;
        if (!message) continue;
        // "<synthetic>" marks a message Claude Code wrote itself (an API error,
        // an expired login), not a model that ran.
        if (message.model && message.model !== "<synthetic>") meta.model = message.model;

        const usage = message.usage;
        const messageKey = message.id ?? rec.requestId ?? rec.uuid ?? "";
        let usageData: Record<string, unknown> = {};
        if (usage && messageKey && !usageSeen.has(messageKey)) {
          usageSeen.add(messageKey);
          usageData = {
            outputTokens: usage.output_tokens ?? 0,
            inputTokens:
              (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
            cacheReadTokens: usage.cache_read_input_tokens ?? 0,
            billedUsage: {
              model: message.model,
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              cacheReadTokens: usage.cache_read_input_tokens ?? 0,
              // Older transcripts have no TTL split; those writes were 5-minute.
              cacheWriteTokens: usage.cache_creation
                ? usage.cache_creation.ephemeral_5m_input_tokens ?? 0
                : usage.cache_creation_input_tokens ?? 0,
              cacheWrite1hTokens: usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
              fast: usage.speed === "fast",
            } satisfies BilledUsage,
          };
        }

        const blocks = Array.isArray(message.content) ? message.content : [];
        let usageAttached = false;
        const attachUsage = () => {
          if (usageAttached) return {};
          usageAttached = true;
          return usageData;
        };

        for (const block of blocks) {
          if (block.type === "text") {
            push(ts, "assistant.message", {
              content: capText(block.text).text,
              model: message.model,
              effort: rec.effort,
              requestId: rec.requestId,
              ...attachUsage(),
            }, rec.uuid, rec.parentUuid);
          } else if (block.type === "thinking") {
            push(ts, "assistant.thinking", {
              content: capText(block.thinking).text,
              charLength: (block.thinking ?? "").length,
              model: message.model,
              ...attachUsage(),
            }, rec.uuid, rec.parentUuid);
          } else if (block.type === "tool_use") {
            const name = block.name ?? "tool";
            if (block.id) toolNames.set(block.id, name);
            for (const key of FILE_ARG_KEYS) {
              const v = block.input?.[key];
              if (typeof v === "string" && EDIT_TOOLS.test(name)) files.add(v);
            }
            push(
              ts,
              name.startsWith("mcp__") ? "external_tool.requested" : "tool.execution_start",
              {
                toolName: name,
                toolCallId: block.id,
                arguments: block.input ?? {},
                model: message.model,
                ...attachUsage(),
              },
              rec.uuid,
              rec.parentUuid,
            );
          }
        }
        // Usage-only records (no renderable block) still need to be counted.
        if (!usageAttached && Object.keys(usageData).length > 0) {
          push(ts, "assistant.message", {
            content: "",
            model: message.model,
            ...usageData,
          }, rec.uuid, rec.parentUuid);
        }
        continue;
      }
    }
  }

  // Claude Code has no explicit session.start record; synthesize one so the
  // timeline opens with the same context header every provider gets.
  if (firstTimestamp) {
    events.unshift({
      type: "session.start",
      data: {
        sessionId: id,
        selectedModel: meta.model,
        copilotVersion: meta.client_name,
        context: { cwd: meta.cwd, branch: meta.branch },
        entrypoint: meta.host_type,
        forkedFrom: meta.forkedFrom,
      },
      id: `${id}:start`,
      timestamp: firstTimestamp,
      parentId: null,
    });
  }

  meta.created_at = firstTimestamp || undefined;
  meta.updated_at = lastTimestamp || firstTimestamp || undefined;

  return { meta, events, files: [...files] };
}

function parseFile(filePath: string, projectDir: string): ParsedSession {
  const parsed = parseClaudeTranscript(filePath);
  if (!parsed.meta.cwd) parsed.meta.cwd = decodeProjectDir(path.basename(projectDir));
  return parsed;
}

/** Listing only needs meta + counters, and those are stable per file version. */
const summarize = createFileCache((filePath: string): SessionMeta => {
  const projectDir = path.dirname(filePath);
  const { meta, events } = parseFile(filePath, projectDir);
  return { ...meta, ...quickStatsFromEvents(events) };
});

function sessionFiles(): { filePath: string; projectDir: string }[] {
  const out: { filePath: string; projectDir: string }[] = [];
  for (const project of safeReaddir(PROJECTS_DIR)) {
    const projectDir = path.join(PROJECTS_DIR, project);
    if (!statOf(projectDir)?.isDirectory()) continue;
    for (const entry of safeReaddir(projectDir)) {
      if (!entry.endsWith(".jsonl")) continue;
      out.push({ filePath: path.join(projectDir, entry), projectDir });
    }
  }
  return out;
}

function findSessionFile(id: string) {
  if (id.includes("/") || id.includes("..")) return null;
  return sessionFiles().find((f) => path.basename(f.filePath, ".jsonl") === id) ?? null;
}

export const claudeProvider: SessionProvider = {
  info: {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    rootDir: "~/.claude/projects",
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(PROJECTS_DIR);
  },

  listSessions() {
    return sessionFiles().map(({ filePath }) => summarize(filePath));
  },

  getSession(id) {
    const found = findSessionFile(id);
    if (!found) return null;
    const { meta, events, files } = parseFile(found.filePath, found.projectDir);

    return {
      meta: { ...meta, ...quickStatsFromEvents(events) },
      events,
      files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: path.basename(found.filePath),
        content: JSON.stringify(
          {
            transcript: found.filePath,
            project: path.basename(found.projectDir),
            ...meta,
          },
          null,
          2,
        ),
        language: "json",
      },
      storagePath: found.filePath,
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
