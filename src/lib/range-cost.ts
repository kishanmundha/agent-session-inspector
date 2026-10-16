import type {
  AnalyticsSession,
  CostLine,
  CostSummary,
  ModelCost,
  TokenClass,
  UsageSlice,
} from "@/lib/providers/types";

/** Receipt order: what was sent, then what came back. */
const TOKEN_CLASSES: TokenClass[] = ["input", "cacheWrite", "cacheWrite1h", "cacheRead", "output"];

/** Where overrides live unless ASI_HOME moves them; the dashboards have no server path to hand. */
export const DEFAULT_OVERRIDE_PATH = "~/.agent-session-inspector/pricing.json";

/**
 * The cost receipt for many sessions at once: the usage slices each tab
 * counts, summed per model, token class and rate, in the same shape the
 * session page shows. Only the slices `keep` accepts are counted.
 */
export function summarizeCost(
  sessions: AnalyticsSession[],
  keep: (session: AnalyticsSession, slice: UsageSlice) => boolean,
): CostSummary {
  const models = new Map<string, ModelCost>();
  const lines = new Map<string, CostLine>();
  const breakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const priceKeys: Record<string, string> = {};
  const custom = new Set<string>();

  for (const session of sessions) {
    for (const slice of session.usage) {
      if (!keep(session, slice)) continue;
      const { model } = slice;
      const key = session.priceKeys?.[model];
      if (key) priceKeys[model] ??= key;
      if (session.customPriced?.includes(model)) custom.add(model);

      let row = models.get(model);
      if (!row) {
        row = {
          model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUSD: slice.costUSD === null ? null : 0,
        };
        models.set(model, row);
      }
      row.inputTokens += slice.inputTokens;
      row.outputTokens += slice.outputTokens;
      row.cacheReadTokens += slice.cacheReadTokens;
      row.cacheWriteTokens += slice.cacheWriteTokens;
      if (slice.costUSD !== null && row.costUSD !== null) row.costUSD += slice.costUSD;

      for (const part of slice.lines ?? []) {
        const usd = part.rate === null ? null : (part.tokens * part.rate) / 1_000_000;
        const lineKey = `${model}|${part.kind}|${part.rate}`;
        const line = lines.get(lineKey);
        if (line) {
          line.tokens += part.tokens;
          if (line.usd !== null && usd !== null) line.usd += usd;
        } else {
          lines.set(lineKey, { model, ...part, usd });
        }
        if (usd !== null) breakdown[part.kind === "cacheWrite1h" ? "cacheWrite" : part.kind] += usd;
      }
    }
  }

  const byModel = [...models.values()]
    .filter((m) => m.inputTokens + m.outputTokens + m.cacheReadTokens + m.cacheWriteTokens > 0)
    .sort((a, b) => (b.costUSD ?? -1) - (a.costUSD ?? -1));
  return {
    totalUSD: byModel.reduce((sum, m) => sum + (m.costUSD ?? 0), 0),
    breakdown,
    byModel,
    lines: byModel.flatMap((m) =>
      [...lines.values()]
        .filter((line) => line.model === m.model)
        .sort(
          (a, b) =>
            TOKEN_CLASSES.indexOf(a.kind) - TOKEN_CLASSES.indexOf(b.kind) ||
            (a.rate ?? 0) - (b.rate ?? 0),
        ),
    ),
    // The full price entries stay on the server; the receipt has the rates.
    prices: {},
    priceKeys,
    customPriced: byModel.filter((m) => custom.has(m.model)).map((m) => m.model),
    overridePath: DEFAULT_OVERRIDE_PATH,
    unpricedModels: byModel.filter((m) => m.costUSD === null).map((m) => m.model),
  };
}
