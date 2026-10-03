import { copilotProvider } from "./copilot";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { analyzeTokenUsage, computeSessionStats } from "./analysis";
import { priceBucket, priceBuckets, priceEvents } from "./pricing";
import { settleHealth } from "./health";
import { findGitRoot } from "./fs-utils";
import { isRunning } from "@/lib/session-state";
import { firstLine } from "@/lib/format";
import os from "os";
import type {
  ActivitySlot,
  AnalyticsSession,
  LogFile,
  ProviderId,
  ProviderInfo,
  SessionDetail,
  SessionMeta,
  SessionProvider,
  UsageSlice,
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

/** Sessions of every available provider, as the adapters cached them. */
function rawSessions(): SessionMeta[] {
  const sessions: SessionMeta[] = [];
  for (const provider of PROVIDERS) {
    if (!provider.isAvailable()) continue;
    try {
      sessions.push(...provider.listSessions());
    } catch {
      // A broken transcript directory should not take down the whole list.
    }
  }
  return sessions;
}

/**
 * The Codex app starts each chat that has no project in a fresh dated folder
 * (`…/Codex/2026-07-25/some-slug`). Captures the folder they all live under.
 */
const CODEX_SCRATCH = /^(.*[\\/]Codex)[\\/]\d{4}-\d{2}-\d{2}[\\/][^\\/]+[\\/]?$/;

const segments = (source: string) => source.split(/[\\/]/).filter(Boolean);

type ProjectFields = Pick<SessionMeta, "project" | "projectPath">;

/**
 * Works out which project each session belongs to. Sessions started anywhere
 * inside one repository, or in one of its worktrees, share a project; outside
 * a repository the working directory is the project, except that Codex's
 * throwaway chat folders count as one. Two folders with the same name are told
 * apart by their parent folder.
 */
function projectResolver(sessions: SessionMeta[]): (meta: SessionMeta) => ProjectFields {
  // Lets a session whose checkout is gone join the others from its repository.
  const repoRoots = new Map<string, string>();
  for (const meta of sessions) {
    const root = meta.cwd && meta.repository ? findGitRoot(meta.cwd) : null;
    if (root && meta.repository) repoRoots.set(meta.repository, root);
  }
  const sourceOf = (meta: SessionMeta) =>
    (meta.cwd && findGitRoot(meta.cwd)) ||
    (meta.repository && repoRoots.get(meta.repository)) ||
    (meta.provider === "codex" && meta.cwd?.match(CODEX_SCRATCH)?.[1]) ||
    meta.cwd ||
    meta.repository ||
    "unknown";

  const sourcesByName = new Map<string, Set<string>>();
  for (const meta of sessions) {
    const source = sourceOf(meta);
    const name = segments(source).pop() ?? source;
    let sources = sourcesByName.get(name);
    if (!sources) sourcesByName.set(name, (sources = new Set()));
    sources.add(source);
  }

  const home = os.homedir();
  return (meta) => {
    const source = sourceOf(meta);
    const parts = segments(source);
    const name = parts[parts.length - 1] ?? source;
    const ambiguous = (sourcesByName.get(name)?.size ?? 0) > 1;
    return {
      project: ambiguous ? parts.slice(-2).join("/") : name,
      // A bare repository name is not a place on disk.
      projectPath:
        source === meta.repository || source === "unknown"
          ? undefined
          : source.startsWith(home)
            ? `~${source.slice(home.length)}`
            : source,
    };
  };
}

/**
 * Swaps the cached usage buckets for a cost priced against the current table,
 * so a price change shows up without re-parsing any transcript. The activity
 * slots are dropped too: only the analytics endpoint ships them.
 * Health is settled here for the same reason: whether the session is still
 * running depends on when it is read.
 */
function forList(session: SessionMeta, project: ProjectFields): SessionMeta {
  const meta = {
    ...session,
    ...project,
    health: settleHealth(session.health, isRunning(session.updated_at)),
  };
  delete meta.usage;
  delete meta.activity;
  const cost = priceBuckets(session.usage);
  if (!cost) return meta;
  return {
    ...meta,
    estimatedCostUSD: cost.totalUSD,
    unpricedModels: cost.unpricedModels.length > 0 ? cost.unpricedModels : undefined,
  };
}

/** Sessions from one provider, or from every available provider, newest first. */
export function listSessions(providerId?: string): SessionMeta[] {
  // Projects are named against every provider's sessions, so a name means the
  // same thing whichever provider is asked for.
  const all = rawSessions();
  const projectOf = projectResolver(all);
  return all
    .filter((s) => !providerId || s.provider === providerId)
    .map((s) => forList(s, projectOf(s)))
    .sort(byRecency);
}

/** The session's activity and usage with each slot priced at today's table. */
function pricedActivity(
  meta: SessionMeta,
): Pick<AnalyticsSession, "activity" | "usage" | "unpricedModels"> {
  const slots = new Map<number, ActivitySlot>();
  for (const slot of meta.activity ?? []) slots.set(slot.t, { ...slot });
  const slices = new Map<string, UsageSlice>();
  const unpriced = new Set<string>();
  for (const bucket of meta.usage ?? []) {
    const model = bucket.model ?? "unknown";
    const cost = priceBucket(bucket);
    if (cost === null) unpriced.add(model);
    // Usage without a timestamp cannot be placed on a day, so it is left out.
    const slot = bucket.t === undefined ? undefined : slots.get(bucket.t);
    if (!slot) continue;
    if (cost !== null) slot.costUSD = (slot.costUSD ?? 0) + cost;

    // Speed tiers of one model share a slice: the usage page groups by model.
    const key = `${slot.t}|${model}`;
    let slice = slices.get(key);
    if (!slice) {
      slice = {
        t: slot.t,
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUSD: cost === null ? null : 0,
      };
      slices.set(key, slice);
    }
    slice.inputTokens += bucket.inputTokens;
    slice.outputTokens += bucket.outputTokens;
    slice.cacheReadTokens += bucket.cacheReadTokens ?? 0;
    slice.cacheWriteTokens += (bucket.cacheWriteTokens ?? 0) + (bucket.cacheWrite1hTokens ?? 0);
    if (cost !== null) slice.costUSD = (slice.costUSD ?? 0) + cost;
  }
  return {
    activity: [...slots.values()],
    usage: [...slices.values()],
    unpricedModels: unpriced.size > 0 ? [...unpriced] : undefined,
  };
}

/** Every session reduced to what the analytics dashboard aggregates. */
export function listAnalyticsSessions(): AnalyticsSession[] {
  const all = rawSessions();
  const projectOf = projectResolver(all);
  return all
    .filter((meta) => meta.activity && meta.activity.length > 0)
    .map((meta) => ({
      provider: meta.provider,
      id: meta.id,
      label: meta.title ?? firstLine(meta.name) ?? meta.id,
      project: projectOf(meta).project ?? "unknown",
      model: meta.model,
      health: settleHealth(meta.health, isRunning(meta.updated_at)),
      ...pricedActivity(meta),
    }));
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
    meta: forList(detail.meta, projectResolver(rawSessions())(detail.meta)),
    cost: priceEvents(detail.events),
    stats: computeSessionStats(detail.events),
    tokenAnalysis: analyzeTokenUsage(detail.events, provider.info.id),
  };
}

/**
 * What changes when a transcript grows, without parsing it again: the session
 * page polls this to learn when a running session has something new.
 */
export function probeSession(providerId: string, id: string): { revision: string } | null {
  const provider = getProvider(providerId);
  if (!provider) return null;
  const meta = provider.listSessions().find((s) => s.id === id);
  if (!meta) return null;
  return { revision: `${meta.updated_at ?? ""}:${meta.eventCount ?? 0}` };
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
