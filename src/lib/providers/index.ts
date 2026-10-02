import { copilotProvider } from "./copilot";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { analyzeTokenUsage, computeSessionStats } from "./analysis";
import { priceBuckets, priceEvents } from "./pricing";
import type {
  LogFile,
  ProviderId,
  ProviderInfo,
  SessionDetail,
  SessionMeta,
  SessionProvider,
} from "./types";

export * from "./types";

/** Registration order is the display order in the UI. */
export const PROVIDERS: SessionProvider[] = [
  copilotProvider,
  claudeProvider,
  codexProvider,
];

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((p) => p.info.id === value);
}

export function getProvider(id: string): SessionProvider | null {
  return PROVIDERS.find((p) => p.info.id === id) ?? null;
}

function byRecency(a: SessionMeta, b: SessionMeta) {
  const at = Date.parse(a.updated_at ?? a.created_at ?? "0") || 0;
  const bt = Date.parse(b.updated_at ?? b.created_at ?? "0") || 0;
  return bt - at;
}

/**
 * Swaps the cached usage buckets for a cost priced against the current table,
 * so a price change shows up without re-parsing any transcript.
 */
function withCost({ usage, ...meta }: SessionMeta): SessionMeta {
  const cost = priceBuckets(usage);
  if (!cost) return meta;
  return {
    ...meta,
    estimatedCostUSD: cost.totalUSD,
    unpricedModels: cost.unpricedModels.length > 0 ? cost.unpricedModels : undefined,
  };
}

/** Sessions from one provider, or from every available provider, newest first. */
export function listSessions(providerId?: string): SessionMeta[] {
  const providers = providerId
    ? [getProvider(providerId)].filter((p): p is SessionProvider => Boolean(p))
    : PROVIDERS;

  const sessions: SessionMeta[] = [];
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    try {
      sessions.push(...provider.listSessions().map(withCost));
    } catch {
      // A broken transcript directory should not take down the whole list.
    }
  }
  return sessions.sort(byRecency);
}

export function listProviders(): ProviderInfo[] {
  return PROVIDERS.map((provider) => {
    const available = provider.isAvailable();
    let sessionCount = 0;
    if (available) {
      try {
        sessionCount = provider.listSessions().length;
      } catch {
        sessionCount = 0;
      }
    }
    return { ...provider.info, available, sessionCount };
  });
}

/** Full session detail, with stats and the token review computed centrally. */
export function getSession(providerId: string, id: string): SessionDetail | null {
  const provider = getProvider(providerId);
  if (!provider) return null;

  const detail = provider.getSession(id);
  if (!detail) return null;

  return {
    ...detail,
    meta: withCost(detail.meta),
    cost: priceEvents(detail.events),
    stats: computeSessionStats(detail.events),
    tokenAnalysis: analyzeTokenUsage(detail.events, provider.info.id),
  };
}

export function listLogs(providerId?: string): (LogFile & { provider: ProviderId })[] {
  const providers = providerId
    ? [getProvider(providerId)].filter((p): p is SessionProvider => Boolean(p))
    : PROVIDERS;

  const logs: (LogFile & { provider: ProviderId })[] = [];
  for (const provider of providers) {
    if (!provider.info.supportsLogs || !provider.isAvailable()) continue;
    try {
      logs.push(
        ...provider.listLogs().map((log) => ({ ...log, provider: provider.info.id })),
      );
    } catch {
      /* ignore unreadable log dirs */
    }
  }
  return logs.sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export function getLogContent(providerId: string, name: string): string {
  return getProvider(providerId)?.getLogContent(name) ?? "";
}
