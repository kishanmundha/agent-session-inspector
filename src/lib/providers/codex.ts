import fs from "fs";
import path from "path";
import os from "os";
import type {
  AgentEvent,
  SessionDetail,
  SessionMeta,
  SessionProvider,
} from "./types";
import { quickStatsFromEvents } from "./analysis";
import { createFileCache, readJsonl, walkFiles } from "./fs-utils";

export const CODEX_DIR = path.join(os.homedir(), ".codex");
const SESSIONS_DIR = path.join(CODEX_DIR, "sessions");
const SESSION_INDEX = path.join(CODEX_DIR, "session_index.jsonl");

const TEXT_CAP = 20_000;

function capText(value: unknown): { text: string; chars: number; truncated: boolean } {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  if (text.length <= TEXT_CAP) return { text, chars: text.length, truncated: false };
  return { text: `${text.slice(0, TEXT_CAP)}…`, chars: text.length, truncated: true };
}

/** Codex content is a list of typed text parts; flatten to plain text. */
function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : JSON.stringify(content);
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      const p = part as Record<string, unknown>;
      return typeof p.text === "string" ? p.text : JSON.stringify(p);
    })
    .join("\n");
}

/**
 * Codex delivers part of its system context as user-role messages wrapped in
 * a marker (environment, plugin list, AGENTS.md). These openers identify them.
 */
const INJECTED_USER_CONTEXT =
  /^\s*(<(environment_context|recommended_plugins|user_instructions|turn_aborted|subagent_notification)>|# AGENTS\.md instructions for )/;

/** True when every part of a user-role message is harness-injected context. */
function isInjectedUserContext(content: unknown): boolean {
  const parts = Array.isArray(content) ? content : [content];
  if (parts.length === 0) return false;
  return parts.every((part) => {
    const text =
      typeof part === "string" ? part : (part as { text?: unknown } | null)?.text;
    return typeof text === "string" && INJECTED_USER_CONTEXT.test(text);
  });
}

interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

interface TokenUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

/** id → thread name, from the CLI's own session index. */
function loadThreadNames(): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of readJsonl<{ id?: string; thread_name?: string }>(SESSION_INDEX)) {
    if (row.id && row.thread_name) map.set(row.id, row.thread_name);
  }
  return map;
}

interface ParsedSession {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
}

function parseFile(filePath: string): ParsedSession {
  const lines = readJsonl<RolloutLine>(filePath);
  const events: AgentEvent[] = [];
  const files = new Set<string>();
  const meta: SessionMeta = { provider: "codex", id: "" };
  let firstTimestamp = "";
  let lastTimestamp = "";
  let seq = 0;

  // Newer rollouts carry the conversation twice: once as `event_msg` (what the
  // UI showed) and once as `response_item` (what the model saw). Prefer the
  // former and demote the latter to injected context, so turns aren't doubled.
  const eventMsgKinds = new Set<string>();
  for (const line of lines) {
    if (line.type === "event_msg") {
      const t = (line.payload as { type?: string } | undefined)?.type;
      if (t) eventMsgKinds.add(t);
    }
  }
  const hasUserEvents = eventMsgKinds.has("user_message");
  const hasAgentEvents = eventMsgKinds.has("agent_message");

  /** call_id → tool name, so tool outputs can be labelled like every other provider. */
  const toolNames = new Map<string, string>();

  const push = (timestamp: string, type: string, data: Record<string, unknown>) => {
    events.push({
      type,
      data,
      id: `codex-${seq++}`,
      timestamp,
      parentId: null,
    });
  };

  for (const line of lines) {
    const ts = line.timestamp ?? lastTimestamp;
    if (line.timestamp) {
      if (!firstTimestamp) firstTimestamp = line.timestamp;
      lastTimestamp = line.timestamp;
    }
    const p = line.payload ?? {};

    switch (line.type) {
      case "session_meta": {
        // A rollout can embed further session_meta records for sub-agent
        // threads; only the first one identifies this session.
        if (meta.id) {
          push(ts, "subagent.session_start", {
            sessionId: p.id ?? p.session_id,
            cwd: p.cwd,
            agentNickname: p.agent_nickname,
            agentPath: p.agent_path,
            parentThreadId: p.parent_thread_id,
          });
          continue;
        }
        meta.id = String(p.id ?? p.session_id ?? "");
        meta.cwd = p.cwd as string | undefined;
        meta.host_type = (p.originator as string) ?? (p.source as string);
        meta.client_name = p.cli_version as string | undefined;
        const git = p.git as Record<string, unknown> | undefined;
        if (git) {
          meta.branch = git.branch as string | undefined;
          const url = git.repository_url as string | undefined;
          meta.repository = url?.replace(/^git@[^:]+:/, "").replace(/\.git$/, "");
        }
        push(ts, "session.start", {
          sessionId: meta.id,
          context: { cwd: meta.cwd, branch: meta.branch, repository: meta.repository },
          originator: p.originator,
          source: p.source,
          cliVersion: p.cli_version,
          modelProvider: p.model_provider,
          forkedFrom: p.forked_from_id,
        });
        const instructions = p.base_instructions as { text?: string } | string | undefined;
        const text =
          typeof instructions === "string" ? instructions : instructions?.text ?? "";
        if (text) {
          const capped = capText(text);
          push(ts, "system.message", {
            role: "base_instructions",
            content: capped.text,
            charLength: capped.chars,
            truncated: capped.truncated,
          });
        }
        // Tool schemas ride along with the base instructions on every request.
        if (Array.isArray(p.dynamic_tools) && p.dynamic_tools.length > 0) {
          const names = (p.dynamic_tools as { name?: string; tools?: { name?: string }[] }[])
            .flatMap((entry) =>
              Array.isArray(entry.tools)
                ? entry.tools.map((tool) => `${entry.name ?? "tools"}.${tool?.name ?? "tool"}`)
                : [entry.name ?? "tool"],
            );
          push(ts, "context.attachment", {
            attachmentType: "tool_definitions",
            label: "Tool definitions",
            items: names.slice(0, 200),
            itemCount: names.length,
            itemsLabel: "tools",
            content: "",
            charLength: JSON.stringify(p.dynamic_tools).length,
            truncated: false,
          });
        }
        continue;
      }

      case "turn_context": {
        if (p.model) meta.model = p.model as string;
        push(ts, "session.turn_context", {
          turnId: p.turn_id,
          model: p.model,
          effort: p.effort,
          cwd: p.cwd,
          approvalPolicy: p.approval_policy,
          sandboxPolicy: p.sandbox_policy,
          personality: p.personality,
        });
        continue;
      }

      case "world_state": {
        const state = (p.state as Record<string, unknown>) ?? {};
        const environments = state.environments as Record<string, unknown> | undefined;
        const local = (environments?.environments as Record<string, Record<string, unknown>>)
          ?.local;
        const capped = capText(state);
        push(ts, "session.world_state", {
          full: p.full,
          cwd: local?.cwd,
          shell: local?.shell,
          currentDate: environments?.current_date,
          timezone: environments?.timezone,
          // Which slices of runtime state were sent with this snapshot.
          sections: Object.keys(state),
          charLength: capped.chars,
          truncated: capped.truncated,
          content: capped.text,
        });
        continue;
      }

      case "inter_agent_communication_metadata":
        push(ts, "subagent.message", { ...p });
        continue;

      case "event_msg": {
        switch (p.type) {
          case "user_message": {
            const capped = capText(p.message);
            push(ts, "user.message", { content: capped.text, charLength: capped.chars });
            break;
          }
          case "agent_message": {
            const capped = capText(p.message);
            push(ts, "assistant.message", {
              content: capped.text,
              phase: p.phase,
              model: meta.model,
            });
            break;
          }
          case "agent_reasoning": {
            const capped = capText(p.text);
            push(ts, "assistant.thinking", {
              content: capped.text,
              charLength: capped.chars,
            });
            break;
          }
          case "task_started":
            push(ts, "assistant.turn_start", {
              turnId: p.turn_id,
              contextWindow: p.model_context_window,
              model: meta.model,
            });
            break;
          case "task_complete":
            push(ts, "assistant.turn_end", {
              turnId: p.turn_id,
              durationMs: p.duration_ms,
              timeToFirstTokenMs: p.time_to_first_token_ms,
              model: meta.model,
            });
            break;
          case "token_count": {
            const info = p.info as
              | { total_token_usage?: TokenUsage; last_token_usage?: TokenUsage; model_context_window?: number }
              | undefined;
            const total = info?.total_token_usage ?? {};
            const last = info?.last_token_usage ?? {};
            push(ts, "session.usage_checkpoint", {
              usage: {
                inputTokens: total.input_tokens ?? 0,
                cachedInputTokens: total.cached_input_tokens ?? 0,
                outputTokens: total.output_tokens ?? 0,
                reasoningTokens: total.reasoning_output_tokens ?? 0,
                totalTokens: total.total_tokens ?? 0,
              },
              lastTurnTokens: last.total_tokens ?? 0,
              contextWindow: info?.model_context_window,
              rateLimits: p.rate_limits,
              // Cumulative — the shared stats layer takes the latest one.
              sessionTotals: {
                inputTokens: total.input_tokens ?? 0,
                outputTokens: total.output_tokens ?? 0,
                cacheReadTokens: total.cached_input_tokens ?? 0,
              },
            });
            break;
          }
          case "patch_apply_end": {
            const changes = (p.changes as Record<string, { type?: string }>) ?? {};
            for (const filePathKey of Object.keys(changes)) files.add(filePathKey);
            push(ts, "file.patch_applied", {
              success: p.success,
              callId: p.call_id,
              stdout: capText(p.stdout).text,
              stderr: capText(p.stderr).text,
              changes: Object.entries(changes).map(([file, change]) => ({
                file,
                type: change?.type ?? "modify",
              })),
            });
            break;
          }
          case "web_search_end":
            push(ts, "web.search", {
              query: p.query,
              callId: p.call_id,
              resultCount: Array.isArray(p.results) ? p.results.length : undefined,
            });
            break;
          case "mcp_tool_call_end": {
            const invocation = p.invocation as
              | { server?: string; tool?: string; arguments?: unknown }
              | undefined;
            const capped = capText(p.result);
            push(ts, "external_tool.completed", {
              toolName: invocation ? `${invocation.server}__${invocation.tool}` : "mcp tool",
              toolCallId: p.call_id,
              arguments: invocation?.arguments,
              resultChars: capped.chars,
              success: Boolean((p.result as Record<string, unknown> | undefined)?.Ok),
              result: { content: capped.text },
            });
            break;
          }
          case "thread_settings_applied": {
            const settings = p.thread_settings as Record<string, unknown> | undefined;
            const model = settings?.model as string | undefined;
            if (model) meta.model = model;
            push(ts, "session.model_change", {
              newModel: model,
              serviceTier: settings?.service_tier,
              approvalPolicy: settings?.approval_policy,
            });
            break;
          }
          case "turn_aborted":
            push(ts, "session.turn_aborted", {
              turnId: p.turn_id,
              reason: p.reason,
              durationMs: p.duration_ms,
            });
            break;
          case "thread_rolled_back":
            push(ts, "session.rollback", { turns: p.num_turns });
            break;
          case "sub_agent_activity":
            push(ts, "subagent.activity", {
              kind: p.kind,
              agentPath: p.agent_path,
              agentThreadId: p.agent_thread_id,
            });
            break;
          default:
            push(ts, `session.${String(p.type ?? "event")}`, { ...p });
        }
        continue;
      }

      case "response_item": {
        switch (p.type) {
          case "message": {
            const role = p.role as string | undefined;
            const capped = capText(flattenContent(p.content));
            if (role === "assistant") {
              if (hasAgentEvents) break; // already emitted from event_msg
              push(ts, "assistant.message", { content: capped.text, model: meta.model });
            } else if (role === "user") {
              if (hasUserEvents || isInjectedUserContext(p.content)) {
                // Injected per-turn context rather than something the user typed.
                push(ts, "system.message", {
                  role: "user_context",
                  content: capped.text,
                  charLength: capped.chars,
                  truncated: capped.truncated,
                });
              } else {
                push(ts, "user.message", { content: capped.text });
              }
            } else {
              push(ts, "system.message", {
                role: role ?? "developer",
                content: capped.text,
                charLength: capped.chars,
                truncated: capped.truncated,
              });
            }
            break;
          }
          case "reasoning": {
            const summary = flattenContent(p.summary);
            if (!summary.trim()) break; // encrypted-only payload, nothing to show
            const capped = capText(summary);
            push(ts, "assistant.thinking", {
              content: capped.text,
              charLength: capped.chars,
            });
            break;
          }
          case "custom_tool_call":
          case "function_call":
          case "local_shell_call": {
            const rawArgs = p.input ?? p.arguments ?? p.action;
            let args: Record<string, unknown>;
            if (typeof rawArgs === "string") {
              try {
                args = JSON.parse(rawArgs) as Record<string, unknown>;
              } catch {
                args = { input: capText(rawArgs).text };
              }
            } else {
              args = (rawArgs as Record<string, unknown>) ?? {};
            }
            const toolName = (p.name as string) ?? "exec";
            if (typeof p.call_id === "string") toolNames.set(p.call_id, toolName);
            push(ts, "tool.execution_start", {
              toolName,
              toolCallId: p.call_id,
              status: p.status,
              arguments: args,
            });
            break;
          }
          case "custom_tool_call_output":
          case "function_call_output":
          case "local_shell_call_output": {
            const capped = capText(flattenContent(p.output));
            push(ts, "tool.execution_complete", {
              toolName: toolNames.get(String(p.call_id)) ?? "exec",
              toolCallId: p.call_id,
              success: true,
              resultChars: capped.chars,
              truncated: capped.truncated,
              result: { content: capped.text },
            });
            break;
          }
          case "agent_message": {
            if (hasAgentEvents) break;
            push(ts, "assistant.message", {
              content: capText(flattenContent(p.content ?? p.message)).text,
              model: meta.model,
            });
            break;
          }
          default:
            push(ts, `session.${String(p.type ?? "response_item")}`, { ...p });
        }
        continue;
      }

      default:
        if (line.type) push(ts, `session.${line.type}`, { ...p });
    }
  }

  // Fall back to the rollout filename when session_meta is missing.
  if (!meta.id) {
    const match = /rollout-.*?-([0-9a-f-]{36})\.jsonl$/.exec(path.basename(filePath));
    meta.id = match?.[1] ?? path.basename(filePath, ".jsonl");
  }
  meta.created_at = firstTimestamp || undefined;
  meta.updated_at = lastTimestamp || firstTimestamp || undefined;

  return { meta, events, files: [...files] };
}

/** Name resolution lives outside the cached parse so renames show up. */
function withTitle(meta: SessionMeta, names: Map<string, string>): SessionMeta {
  return { ...meta, title: names.get(meta.id) };
}

const summarize = createFileCache((filePath: string): SessionMeta => {
  const { meta, events } = parseFile(filePath);
  return { ...meta, ...quickStatsFromEvents(events) };
});

function rolloutFiles(): string[] {
  return walkFiles(SESSIONS_DIR, (name) => name.endsWith(".jsonl"));
}

export const codexProvider: SessionProvider = {
  info: {
    id: "codex",
    label: "OpenAI Codex CLI",
    shortLabel: "Codex",
    rootDir: "~/.codex/sessions",
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(SESSIONS_DIR);
  },

  listSessions() {
    const names = loadThreadNames();
    return rolloutFiles().map((filePath) => withTitle(summarize(filePath), names));
  },

  getSession(id) {
    if (id.includes("/") || id.includes("..")) return null;
    const filePath = rolloutFiles().find((f) => path.basename(f).endsWith(`-${id}.jsonl`));
    if (!filePath) return null;

    const { meta, events, files } = parseFile(filePath);
    const named = withTitle(meta, loadThreadNames());

    return {
      meta: { ...named, ...quickStatsFromEvents(events) },
      events,
      files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: path.basename(filePath),
        content: JSON.stringify({ rollout: filePath, ...named }, null, 2),
        language: "json",
      },
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
