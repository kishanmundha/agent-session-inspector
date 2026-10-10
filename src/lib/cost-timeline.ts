import type { AgentEvent, CostLine } from "@/lib/providers/types";

/**
 * Where a session's cost built up, read off the `costUSD` the server stamps on
 * each priced event and grouped by the prompt that led to it. Runs in the
 * browser, on the events the session page holds.
 */

/** What one prompt, and everything the agent did in answer to it, cost. */
export interface CostTurn {
  /** Position of the prompt among the session's prompts, from 1; 0 before the first. */
  turn: number;
  /** The prompt that started the turn; absent for requests made before any prompt. */
  prompt?: string;
  /** The prompt, else the first priced request, to open in the timeline. */
  eventId: string;
  timestamp: string;
  costUSD: number;
  /** Priced requests in the turn. */
  requests: number;
  /** The tokens behind `costUSD`: a row per model, token class and rate. */
  lines: CostLine[];
  /** The session's cost up to and including this turn. */
  totalUSD: number;
  /** The context was compacted during the turn. */
  compacted: boolean;
}

/** One request to a model: what it sent, what came back and what that cost. */
export interface CostRequest {
  /** Position among the session's requests, from 1. */
  n: number;
  /** The turn it was made in; 0 before the first prompt. */
  turn: number;
  eventId: string;
  timestamp: string;
  models: string[];
  /** Sent at full price: not in the cache, and not stored in it. */
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  /** Everything the request sent: the three input classes together. */
  contextTokens: number;
  /** Null when no model in the request has a price. */
  costUSD: number | null;
}

export interface CostTimeline {
  /** Every turn from the first that cost anything, oldest first. */
  turns: CostTurn[];
  /** Every request that reported usage, oldest first. */
  requests: CostRequest[];
  /** Keyed by prompt event id. */
  turnByPrompt: Map<string, CostTurn>;
  /** The turn each event belongs to, by event id; none before the first prompt. */
  turnOf: Map<string, number>;
  /** The session's cost up to and including each priced event, by event id. */
  runningUSD: Map<string, number>;
  /** The dearest single request, to scale the others against. */
  maxEventUSD: number;
  totalUSD: number;
  /** What the history a fork copied in cost its parent; no part of `totalUSD`. */
  inheritedUSD: number;
}

/**
 * History a fork copied from its parent is left out throughout: the parent
 * session was billed for it, so it is no part of this session's total.
 */
export function costTimeline(events: AgentEvent[]): CostTimeline {
  const turns: CostTurn[] = [];
  const requests: CostRequest[] = [];
  const turnByPrompt = new Map<string, CostTurn>();
  const turnOf = new Map<string, number>();
  const runningUSD = new Map<string, number>();
  let maxEventUSD = 0;
  let totalUSD = 0;
  let inheritedUSD = 0;
  let prompts = 0;
  let current: CostTurn | null = null;

  for (const event of events) {
    if (event.data.inherited === true) {
      if (typeof event.data.costUSD === "number") inheritedUSD += event.data.costUSD;
      continue;
    }
    if (event.type === "user.message") {
      prompts += 1;
      current = {
        turn: prompts,
        prompt: typeof event.data.content === "string" ? event.data.content : undefined,
        eventId: event.id,
        timestamp: event.timestamp,
        costUSD: 0,
        requests: 0,
        lines: [],
        totalUSD,
        compacted: false,
      };
      turns.push(current);
      turnByPrompt.set(event.id, current);
      turnOf.set(event.id, prompts);
      continue;
    }
    if (current) turnOf.set(event.id, current.turn);
    if (current && event.type.startsWith("session.compaction")) current.compacted = true;

    const cost = event.data.costUSD;
    const priced = typeof cost === "number" && cost > 0;
    const lines = Array.isArray(event.data.costLines) ? (event.data.costLines as CostLine[]) : [];
    // Usage with no price still belongs on its turn's receipt.
    if (!priced && !current) continue;
    if (!current) {
      current = {
        turn: 0,
        eventId: event.id,
        timestamp: event.timestamp,
        costUSD: 0,
        requests: 0,
        lines: [],
        totalUSD,
        compacted: false,
      };
      turns.push(current);
    }
    for (const line of lines) addLine(current.lines, line);
    if (lines.length > 0) {
      requests.push(requestOf(event, lines, requests.length + 1, current.turn, priced ? cost : null));
    }
    if (!priced) continue;
    totalUSD += cost;
    current.costUSD += cost;
    current.requests += 1;
    current.totalUSD = totalUSD;
    runningUSD.set(event.id, totalUSD);
    maxEventUSD = Math.max(maxEventUSD, cost);
  }

  // Prompts sent before the session cost anything would only pad the chart.
  const first = turns.findIndex((turn) => turn.costUSD > 0);
  return {
    turns: first === -1 ? [] : turns.slice(first),
    requests,
    turnByPrompt,
    turnOf,
    runningUSD,
    maxEventUSD,
    totalUSD,
    inheritedUSD,
  };
}

function requestOf(
  event: AgentEvent,
  lines: CostLine[],
  n: number,
  turn: number,
  costUSD: number | null,
): CostRequest {
  const tokens = (...kinds: CostLine["kind"][]) =>
    lines.reduce((sum, l) => (kinds.includes(l.kind) ? sum + l.tokens : sum), 0);
  const inputTokens = tokens("input");
  const cacheWriteTokens = tokens("cacheWrite", "cacheWrite1h");
  const cacheReadTokens = tokens("cacheRead");
  return {
    n,
    turn,
    eventId: event.id,
    timestamp: event.timestamp,
    models: [...new Set(lines.map((l) => l.model))],
    inputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    outputTokens: tokens("output"),
    contextTokens: inputTokens + cacheWriteTokens + cacheReadTokens,
    costUSD,
  };
}

/** Folds a request's line into the turn's row for the same model, class and rate. */
function addLine(lines: CostLine[], line: CostLine) {
  const row = lines.find(
    (l) => l.model === line.model && l.kind === line.kind && l.rate === line.rate,
  );
  if (!row) {
    lines.push({ ...line });
    return;
  }
  row.tokens += line.tokens;
  if (row.usd !== null && line.usd !== null) row.usd += line.usd;
}
