import os from "os";
import path from "path";
import bundledPrices from "./prices.json";
import { createFileCache, safeReadFile } from "./fs-utils";
import { ACTIVITY_SLOT_MS } from "./types";
import type {
  AgentEvent,
  BilledUsage,
  CostBreakdown,
  CostLine,
  CostSummary,
  ModelCost,
  PriceEntry,
  TokenClass,
  UsageBucket,
} from "./types";

export type PriceTable = Record<string, PriceEntry[]>;

/** Optional user overrides, merged per model on top of the bundled table. */
export const PRICING_OVERRIDE_PATH = path.join(
  process.env.ASV_HOME ?? path.join(os.homedir(), ".agent-session-visualizer"),
  "pricing.json",
);

function isEntry(value: unknown): value is PriceEntry {
  const e = value as PriceEntry | null;
  return !!e && typeof e.input === "number" && typeof e.output === "number";
}

const byEffectiveDate = (a: PriceEntry, b: PriceEntry) =>
  (a.from ?? "").localeCompare(b.from ?? "");

function normalizeTable(raw: unknown): PriceTable {
  const table: PriceTable = {};
  if (!raw || typeof raw !== "object") return table;
  for (const [model, value] of Object.entries(raw)) {
    const entries = (Array.isArray(value) ? value : [value]).filter(isEntry);
    if (entries.length > 0) table[model.toLowerCase()] = entries.sort(byEffectiveDate);
  }
  return table;
}

const BUNDLED = normalizeTable(bundledPrices);

const loadTable = createFileCache((filePath: string): PriceTable => {
  const content = safeReadFile(filePath);
  if (!content) return BUNDLED;
  try {
    return { ...BUNDLED, ...normalizeTable(JSON.parse(content)) };
  } catch {
    // A malformed override should not take cost estimates down with it.
    return BUNDLED;
  }
});

/** Snapshot suffixes that do not change the price: -20251001, -2025-08-07, -latest. */
const SNAPSHOT_SUFFIX = /-(\d{8}|\d{4}-\d{2}-\d{2}|latest)$/;

/** A transcript model id in the spelling the price table is keyed by. */
function normalizeModelId(model: string): string {
  const id = model
    .toLowerCase()
    .replace(/\[.*\]$/, "")
    // Routing prefixes: "anthropic/…", "us.anthropic.…", "openai/…".
    .replace(/^.*\//, "")
    .replace(/^([a-z]{2}\.)?anthropic\./, "");
  // Copilot writes Claude versions with a dot (claude-sonnet-4.6).
  return id.startsWith("claude") ? id.replace(/\./g, "-") : id;
}

/** Table key for a transcript model id, or null when the model has no price. */
export function resolveModel(model: string | undefined, table: PriceTable): string | null {
  if (!model) return null;
  const id = normalizeModelId(model);
  if (table[id]) return id;
  const base = id.replace(SNAPSHOT_SUFFIX, "");
  return table[base] ? base : null;
}

function entryAt(entries: PriceEntry[], timestamp?: string): PriceEntry {
  if (!timestamp) return entries[entries.length - 1];
  let chosen = entries[0];
  for (const entry of entries) {
    if ((entry.from ?? "") <= timestamp) chosen = entry;
  }
  return chosen;
}

/** Receipt order: what was sent, then what came back. */
const TOKEN_CLASSES: TokenClass[] = ["input", "cacheWrite", "cacheWrite1h", "cacheRead", "output"];

type UsageLine = Omit<CostLine, "model">;

/**
 * One usage record as priced lines, one per token class it used. Rates are
 * null when the model is not in the price table.
 */
export function costOf(usage: BilledUsage, timestamp?: string): UsageLine[] {
  const tokens: Record<TokenClass, number> = {
    input: usage.inputTokens,
    cacheWrite: usage.cacheWriteTokens ?? 0,
    cacheWrite1h: usage.cacheWrite1hTokens ?? 0,
    cacheRead: usage.cacheReadTokens ?? 0,
    output: usage.outputTokens,
  };
  const table = loadTable(PRICING_OVERRIDE_PATH);
  const key = resolveModel(usage.model, table);
  let rates: Record<TokenClass, number> | null = null;
  if (usage.local) {
    rates = { input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 };
  } else if (key) {
    const p = entryAt(table[key], timestamp);
    const cacheWrite = p.cacheWrite ?? p.input;
    // The speed premium applies to every class.
    const premium = usage.fast ? p.fast ?? 1 : 1;
    rates = {
      input: p.input * premium,
      cacheWrite: cacheWrite * premium,
      cacheWrite1h: (p.cacheWrite1h ?? cacheWrite) * premium,
      cacheRead: (p.cacheRead ?? p.input) * premium,
      output: p.output * premium,
    };
  }
  return TOKEN_CLASSES.filter((kind) => tokens[kind] > 0).map((kind) => ({
    kind,
    tokens: tokens[kind],
    rate: rates ? rates[kind] : null,
    usd: rates ? (tokens[kind] * rates[kind]) / 1_000_000 : null,
  }));
}

function tokenCount(u: BilledUsage) {
  return (
    u.inputTokens +
    u.outputTokens +
    (u.cacheReadTokens ?? 0) +
    (u.cacheWriteTokens ?? 0) +
    (u.cacheWrite1hTokens ?? 0)
  );
}

/** Usage an adapter attached to an event; adapters emit one record or one per model. */
function billedUsageOf(event: AgentEvent): BilledUsage[] {
  const raw = event.data.billedUsage as BilledUsage | BilledUsage[] | undefined;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((u) => tokenCount(u) > 0);
}

const UNKNOWN_MODEL = "unknown";

class CostAccumulator {
  private models = new Map<string, ModelCost>();
  private breakdown: CostBreakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  /** Keyed by model, class and rate, so a mid-session price change gets its own row. */
  private lines = new Map<string, CostLine>();

  add(usage: BilledUsage, timestamp?: string): number | null {
    const model = usage.model || UNKNOWN_MODEL;
    let cost: number | null = null;
    for (const part of costOf(usage, timestamp)) {
      const lineKey = `${model}|${part.kind}|${part.rate}`;
      const line = this.lines.get(lineKey);
      if (line) {
        line.tokens += part.tokens;
        if (line.usd !== null && part.usd !== null) line.usd += part.usd;
      } else {
        this.lines.set(lineKey, { model, ...part });
      }
      if (part.usd === null) continue;
      cost = (cost ?? 0) + part.usd;
      this.breakdown[part.kind === "cacheWrite1h" ? "cacheWrite" : part.kind] += part.usd;
    }
    let row = this.models.get(model);
    if (!row) {
      row = {
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUSD: cost === null ? null : 0,
      };
      this.models.set(model, row);
    }
    row.inputTokens += usage.inputTokens;
    row.outputTokens += usage.outputTokens;
    row.cacheReadTokens += usage.cacheReadTokens ?? 0;
    row.cacheWriteTokens += (usage.cacheWriteTokens ?? 0) + (usage.cacheWrite1hTokens ?? 0);
    if (cost !== null && row.costUSD !== null) row.costUSD += cost;
    return cost;
  }

  summary(): CostSummary {
    const byModel = [...this.models.values()].sort(
      (a, b) => (b.costUSD ?? -1) - (a.costUSD ?? -1),
    );
    const table = loadTable(PRICING_OVERRIDE_PATH);
    const prices: CostSummary["prices"] = {};
    for (const { model } of byModel) {
      if (model === UNKNOWN_MODEL) continue;
      const key = resolveModel(model, table);
      prices[key ?? normalizeModelId(model)] = key ? table[key] : null;
    }
    return {
      totalUSD: byModel.reduce((sum, m) => sum + (m.costUSD ?? 0), 0),
      breakdown: this.breakdown,
      byModel,
      lines: byModel.flatMap((m) =>
        [...this.lines.values()]
          .filter((line) => line.model === m.model)
          .sort(
            (a, b) =>
              TOKEN_CLASSES.indexOf(a.kind) - TOKEN_CLASSES.indexOf(b.kind) ||
              (a.rate ?? 0) - (b.rate ?? 0),
          ),
      ),
      prices,
      overridePath: PRICING_OVERRIDE_PATH.replace(os.homedir(), "~"),
      unpricedModels: byModel.filter((m) => m.costUSD === null).map((m) => m.model),
    };
  }
}

/**
 * Prices a whole session and stamps `costUSD` on each event that carries
 * usage, so the timeline can show where the money went.
 */
export function priceEvents(events: AgentEvent[]): CostSummary {
  const acc = new CostAccumulator();
  for (const event of events) {
    const usages = billedUsageOf(event);
    if (usages.length === 0) continue;
    let eventCost: number | null = null;
    for (const usage of usages) {
      const cost = acc.add(usage, event.timestamp);
      if (cost !== null) eventCost = (eventCost ?? 0) + cost;
    }
    if (eventCost !== null) event.data.costUSD = eventCost;
  }
  return acc.summary();
}

/**
 * Collapses a session's usage to one record per model and activity slot. That
 * is small enough to cache with the session list yet still priceable at read
 * time, including across a price change, and fine enough to chart cost by day
 * and hour.
 */
export function bucketUsage(events: AgentEvent[]): UsageBucket[] {
  const buckets = new Map<string, UsageBucket>();
  for (const event of events) {
    const day = event.timestamp?.slice(0, 10) ?? "";
    const at = Date.parse(event.timestamp);
    const t = Number.isNaN(at) ? undefined : Math.floor(at / ACTIVITY_SLOT_MS) * ACTIVITY_SLOT_MS;
    for (const usage of billedUsageOf(event)) {
      const key = `${usage.model ?? ""}|${t ?? day}|${usage.fast ? 1 : 0}|${usage.local ? 1 : 0}`;
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, {
          day,
          t,
          model: usage.model,
          fast: usage.fast,
          local: usage.local,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens ?? 0,
          cacheWriteTokens: usage.cacheWriteTokens ?? 0,
          cacheWrite1hTokens: usage.cacheWrite1hTokens ?? 0,
        });
        continue;
      }
      bucket.inputTokens += usage.inputTokens;
      bucket.outputTokens += usage.outputTokens;
      bucket.cacheReadTokens = (bucket.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0);
      bucket.cacheWriteTokens = (bucket.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
      bucket.cacheWrite1hTokens =
        (bucket.cacheWrite1hTokens ?? 0) + (usage.cacheWrite1hTokens ?? 0);
    }
  }
  return [...buckets.values()];
}

/** One bucket's cost, or null when its model has no price. */
export function priceBucket(bucket: UsageBucket): number | null {
  let cost: number | null = null;
  for (const line of costOf(bucket, bucket.day || undefined)) {
    if (line.usd !== null) cost = (cost ?? 0) + line.usd;
  }
  return cost;
}

export function priceBuckets(buckets: UsageBucket[] | undefined): CostSummary | null {
  if (!buckets || buckets.length === 0) return null;
  const acc = new CostAccumulator();
  for (const bucket of buckets) acc.add(bucket, bucket.day || undefined);
  return acc.summary();
}
