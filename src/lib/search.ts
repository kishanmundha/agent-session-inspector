import { getProvider, listSessions } from "@/lib/providers";
import { firstLine } from "@/lib/format";
import type { AgentEvent, ProviderId, SessionMeta } from "@/lib/providers/types";

/**
 * Full-text search across every session's transcript.
 *
 * The index lives in memory: one entry per session holding the searchable
 * text of each event, rebuilt only when the session changes. The first search
 * after a start reads every transcript; later ones are a substring scan.
 */

/** What part of the conversation a hit came from. */
export type SearchKind = "user" | "assistant" | "thinking" | "tool" | "result";

export interface SearchHit {
  kind: SearchKind;
  /** Tool name, for tool calls and their results. */
  tool?: string;
  timestamp: string;
  /** The matching text with some context either side, on one line. */
  snippet: string;
}

export interface SearchResult {
  provider: ProviderId;
  id: string;
  label: string;
  project?: string;
  updated_at?: string;
  /** The title, repository, branch, folder or id matched. */
  titleMatch: boolean;
  /** How many events matched; `hits` holds only the best few. */
  matchCount: number;
  hits: SearchHit[];
}

export interface SearchResponse {
  query: string;
  /** Sessions that matched, before `limit` was applied. */
  total: number;
  results: SearchResult[];
  tookMs: number;
}

interface Doc {
  kind: SearchKind;
  tool?: string;
  timestamp: string;
  text: string;
  lower: string;
}

/** Tool output is mostly noise past the first screens, and it dominates memory. */
const RESULT_CAP = 8_000;
const HITS_PER_SESSION = 3;
const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 160;

/** Conversation first: a prompt that matches says more than a log line that does. */
const KIND_RANK: Record<SearchKind, number> = {
  user: 0,
  assistant: 1,
  thinking: 2,
  tool: 3,
  result: 4,
};

/** Every string inside a tool's arguments, whatever their shape. */
function stringLeaves(value: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object" && depth < 4) {
    for (const v of Object.values(value)) stringLeaves(v, out, depth + 1);
  }
  return out;
}

function docOf(event: AgentEvent): Omit<Doc, "lower"> | null {
  const d = event.data;
  const tool = typeof d.toolName === "string" ? d.toolName : undefined;
  const base = { timestamp: event.timestamp };
  switch (event.type) {
    case "user.message":
      return { ...base, kind: "user", text: String(d.content ?? "") };
    case "assistant.message":
      return { ...base, kind: "assistant", text: String(d.content ?? "") };
    case "assistant.thinking":
      return { ...base, kind: "thinking", text: String(d.content ?? "") };
    case "tool.execution_start":
    case "external_tool.requested":
      return { ...base, kind: "tool", tool, text: stringLeaves(d.arguments).join("\n") };
    case "web.search":
      return { ...base, kind: "tool", tool: "web search", text: String(d.query ?? "") };
    case "tool.execution_complete":
    case "external_tool.completed":
      return {
        ...base,
        kind: "result",
        tool,
        text: stringLeaves(d.result).join("\n").slice(0, RESULT_CAP),
      };
    default:
      return null;
  }
}

const index = new Map<string, { version: string; docs: Doc[] }>();

function docsFor(meta: SessionMeta): Doc[] {
  const key = `${meta.provider}:${meta.id}`;
  const version = `${meta.updated_at}|${meta.eventCount}`;
  const cached = index.get(key);
  if (cached?.version === version) return cached.docs;

  const docs: Doc[] = [];
  try {
    for (const event of getProvider(meta.provider)?.getSession(meta.id)?.events ?? []) {
      const doc = docOf(event);
      if (doc?.text.trim()) docs.push({ ...doc, lower: doc.text.toLowerCase() });
    }
  } catch {
    // An unreadable transcript is searchable by its title only.
  }
  index.set(key, { version, docs });
  return docs;
}

function snippetOf(doc: Doc, term: string): string {
  // Lowercasing can change a string's length for a few scripts; fall back to
  // the lowercased text there so the window still lands on the match.
  const source = doc.text.length === doc.lower.length ? doc.text : doc.lower;
  const at = Math.max(0, doc.lower.indexOf(term));
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const end = Math.min(source.length, at + term.length + SNIPPET_AFTER);
  const body = source.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < source.length ? "…" : ""}`;
}

/** The words of a query. An event matches when it contains all of them. */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function searchSessions(
  query: string,
  { project, limit = 30 }: { project?: string; limit?: number } = {},
): SearchResponse {
  const started = performance.now();
  const terms = searchTerms(query);
  const sessions = listSessions();

  // Sessions deleted from disk should not keep their text in memory.
  if (index.size > sessions.length) {
    const live = new Set(sessions.map((s) => `${s.provider}:${s.id}`));
    for (const key of index.keys()) if (!live.has(key)) index.delete(key);
  }

  const results: SearchResult[] = [];
  if (terms.join("").length >= 2) {
    for (const meta of sessions) {
      if (project && meta.project !== project) continue;

      const about = [meta.title, meta.name, meta.repository, meta.branch, meta.cwd, meta.id]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      const titleMatch = terms.every((t) => about.includes(t));

      const matched = docsFor(meta).filter((doc) => terms.every((t) => doc.lower.includes(t)));
      if (!titleMatch && matched.length === 0) continue;

      results.push({
        provider: meta.provider,
        id: meta.id,
        label: meta.title ?? firstLine(meta.name) ?? meta.id,
        project: meta.project,
        updated_at: meta.updated_at ?? meta.created_at,
        titleMatch,
        matchCount: matched.length,
        hits: matched
          // Stable sort: within a kind, hits stay in transcript order.
          .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
          .slice(0, HITS_PER_SESSION)
          .map((doc) => ({
            kind: doc.kind,
            tool: doc.tool,
            timestamp: doc.timestamp,
            snippet: snippetOf(doc, terms[0]),
          })),
      });
    }
  }

  // listSessions is newest first, and a stable sort keeps that within a tier.
  const tier = (r: SearchResult) =>
    r.titleMatch ? 0 : r.hits[0] && KIND_RANK[r.hits[0].kind] <= KIND_RANK.assistant ? 1 : 2;
  results.sort((a, b) => tier(a) - tier(b));

  return {
    query,
    total: results.length,
    results: results.slice(0, limit),
    tookMs: Math.round(performance.now() - started),
  };
}
