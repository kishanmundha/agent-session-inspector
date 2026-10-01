import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";
import { DatabaseSync } from "node:sqlite";
import type {
  AgentEvent,
  CheckpointFile,
  LogFile,
  SessionDetail,
  SessionMeta,
  SessionProvider,
} from "./types";
import { quickStatsFromEvents } from "./analysis";
import { readJsonl, statOf, safeReaddir, safeReadFile } from "./fs-utils";

export const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const SESSION_STATE_DIR = path.join(COPILOT_DIR, "session-state");
const LOGS_DIR = path.join(COPILOT_DIR, "logs");
const SESSION_STORE_DB = path.join(COPILOT_DIR, "session-store.db");

/** sessionId → latest checkpoint title, from the CLI's own sqlite store. */
function loadCheckpointTitles(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(SESSION_STORE_DB)) return map;
  try {
    const db = new DatabaseSync(SESSION_STORE_DB, { readOnly: true });
    const rows = db
      .prepare(
        "SELECT session_id, title FROM checkpoints WHERE title IS NOT NULL AND title != '' ORDER BY id DESC",
      )
      .all() as unknown as { session_id: string; title: string }[];
    // First row per session wins (highest id = latest checkpoint).
    for (const row of rows) {
      if (!map.has(row.session_id)) map.set(row.session_id, row.title);
    }
    db.close();
  } catch {
    /* store may be locked or schema-changed; titles are optional */
  }
  return map;
}

function parseYaml(content: string): Record<string, unknown> {
  try {
    return (yaml.load(content) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

interface ShutdownUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/**
 * Copilot has shipped two shutdown shapes: an older `tokenDetails` map and a
 * newer per-model `modelMetrics`. Read whichever is present.
 */
function usageFromShutdown(data: Record<string, unknown>): ShutdownUsage | null {
  const td = data.tokenDetails as Record<string, { tokenCount?: number }> | undefined;
  if (td) {
    return {
      inputTokens: td.input?.tokenCount ?? 0,
      outputTokens: td.output?.tokenCount ?? 0,
      cacheReadTokens: td.cache_read?.tokenCount ?? 0,
    };
  }
  const metrics = data.modelMetrics as
    | Record<string, { usage?: Record<string, number> }>
    | undefined;
  if (metrics) {
    const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
    for (const entry of Object.values(metrics)) {
      const u = entry?.usage ?? {};
      totals.inputTokens += u.inputTokens ?? 0;
      totals.outputTokens += u.outputTokens ?? 0;
      totals.cacheReadTokens += u.cacheReadTokens ?? 0;
    }
    return totals;
  }
  return null;
}

/**
 * Copilot's on-disk events already use the canonical `category.subCategory`
 * vocabulary, so normalization here only adds the derived fields the shared
 * analysis layer expects.
 */
function normalize(raw: AgentEvent): AgentEvent {
  const data = { ...raw.data };

  if (raw.type === "tool.execution_complete" || raw.type === "external_tool.completed") {
    const result = data.result as Record<string, unknown> | undefined;
    data.resultChars = String(result?.content ?? "").length;
    data.toolName = data.toolName ?? data.name;
  }

  if (raw.type === "session.shutdown") {
    const usage = usageFromShutdown(data);
    data.sessionTotals = {
      ...(usage ?? {}),
      apiDurationMs: (data.totalApiDurationMs as number) ?? 0,
      premiumRequests: (data.totalPremiumRequests as number) ?? 0,
    };
    if (usage) data.usageSummary = usage;
  }

  if (raw.type === "abort") {
    // Same concept as Codex's turn_aborted; use one vocabulary for both.
    return { ...raw, type: "session.turn_aborted", data };
  }

  if (raw.type === "session.usage_checkpoint") {
    // Interim snapshot: only premium/AIU accounting, no token totals.
    data.premiumRequests = data.totalPremiumRequests;
  }

  return { ...raw, data };
}

function readEvents(id: string): AgentEvent[] {
  const eventsPath = path.join(SESSION_STATE_DIR, id, "events.jsonl");
  return readJsonl<AgentEvent>(eventsPath)
    .filter((e) => e && typeof e.type === "string")
    .map(normalize);
}

function metaFromYaml(id: string, checkpointTitle?: string): SessionMeta {
  const yamlPath = path.join(SESSION_STATE_DIR, id, "workspace.yaml");
  const content = safeReadFile(yamlPath);
  if (!content) return { provider: "copilot", id, title: checkpointTitle };

  const parsed = parseYaml(content);
  const str = (k: string) => {
    const v = parsed[k];
    if (v == null) return undefined;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };
  return {
    provider: "copilot",
    id,
    name: str("name"),
    title: checkpointTitle,
    cwd: str("cwd"),
    repository: str("repository"),
    branch: str("branch"),
    created_at: str("created_at"),
    updated_at: str("updated_at"),
    host_type: str("host_type"),
    client_name: str("client_name"),
    user_named: parsed.user_named === true || parsed.user_named === "true",
  };
}

function getCheckpoints(id: string): CheckpointFile[] {
  const dir = path.join(SESSION_STATE_DIR, id, "checkpoints");
  return safeReaddir(dir).map((name) => ({
    name,
    content: safeReadFile(path.join(dir, name)),
  }));
}

export const copilotProvider: SessionProvider = {
  info: {
    id: "copilot",
    label: "GitHub Copilot CLI",
    shortLabel: "Copilot",
    rootDir: "~/.copilot",
    supportsLogs: true,
  },

  isAvailable() {
    return fs.existsSync(SESSION_STATE_DIR);
  },

  listSessions() {
    if (!fs.existsSync(SESSION_STATE_DIR)) return [];
    const titles = loadCheckpointTitles();

    return safeReaddir(SESSION_STATE_DIR)
      .filter((d) => {
        try {
          return fs.statSync(path.join(SESSION_STATE_DIR, d)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((id) => ({
        ...metaFromYaml(id, titles.get(id)),
        ...quickStatsFromEvents(readEvents(id)),
      }));
  },

  getSession(id) {
    const sessionDir = path.join(SESSION_STATE_DIR, id);
    if (!fs.existsSync(sessionDir)) return null;

    const titles = loadCheckpointTitles();
    const meta = metaFromYaml(id, titles.get(id));
    const events = readEvents(id);

    return {
      meta: { ...meta, ...quickStatsFromEvents(events) },
      events,
      files: safeReaddir(path.join(sessionDir, "files")),
      checkpoints: getCheckpoints(id),
      research: safeReaddir(path.join(sessionDir, "research")),
      rawMeta: {
        name: "workspace.yaml",
        content: safeReadFile(path.join(sessionDir, "workspace.yaml")),
        language: "yaml",
      },
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis">;
  },

  listLogs(): LogFile[] {
    return safeReaddir(LOGS_DIR)
      .filter((f) => f.endsWith(".log"))
      .map((name) => {
        const p = path.join(LOGS_DIR, name);
        const stat = statOf(p);
        return {
          name,
          path: p,
          mtime: stat?.mtime.toISOString() ?? "",
          size: stat?.size ?? 0,
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  },

  getLogContent(name: string) {
    // Guard against traversal: only plain file names inside the logs dir.
    if (name.includes("/") || name.includes("..")) return "";
    return safeReadFile(path.join(LOGS_DIR, name));
  },
};
