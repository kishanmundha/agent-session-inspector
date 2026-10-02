"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  FileText,
  Inbox,
  ListTree,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/empty-state";
import { ScrollToTop } from "@/components/common/scroll-to-top";
import { SearchInput } from "@/components/common/search-input";
import { SessionCardSkeleton } from "@/components/common/skeleton";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { SessionCard, type SessionMeta } from "@/components/home/session-card";
import { LogsViewer, type LogFile } from "@/components/home/logs-viewer";
import { AnalyticsDashboard } from "@/components/home/analytics-dashboard";
import { providerStyle } from "@/lib/provider-meta";
import type { ProviderInfo } from "@/components/session/types";
import { useTabParam } from "@/lib/use-tab-param";
import { cn } from "@/lib/utils";

const HOME_TABS = ["analytics", "sessions", "logs"] as const;

type SortKey = "recent" | "oldest" | "cost" | "tokens" | "events" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "cost", label: "Highest cost" },
  { value: "tokens", label: "Most tokens" },
  { value: "events", label: "Most events" },
  { value: "name", label: "Name (A–Z)" },
];

function totalTokens(s: SessionMeta) {
  return (s.totalInputTokens ?? 0) + (s.totalOutputTokens ?? 0);
}

function sessionLabel(s: SessionMeta) {
  return (s.title ?? s.name ?? s.id).toLowerCase();
}

export default function HomePage() {
  // useTabParam reads the URL, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const [tab, setTab] = useTabParam(HOME_TABS, "analytics");
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>("all");
  const [logs, setLogs] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  // Bumped by the refresh button to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessionsRes, logsRes, providersRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/logs"),
          fetch("/api/providers"),
        ]);
        if (!sessionsRes.ok || !logsRes.ok || !providersRes.ok) {
          throw new Error("Request failed");
        }
        const [nextSessions, nextLogs, nextProviders] = await Promise.all([
          sessionsRes.json(),
          logsRes.json(),
          providersRes.json(),
        ]);
        if (cancelled) return;
        setSessions(nextSessions);
        setLogs(nextLogs);
        setProviders(nextProviders);
      } catch {
        if (!cancelled) {
          setError(
            "Could not read the agent session directories. Are ~/.copilot, ~/.claude or ~/.codex present and readable?",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function refresh() {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  }

  const availableProviders = useMemo(
    () => providers.filter((p) => p.available),
    [providers],
  );

  const providerSessions = useMemo(
    () =>
      provider === "all"
        ? sessions
        : sessions.filter((s) => s.provider === provider),
    [sessions, provider],
  );

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? providerSessions.filter(
          (s) =>
            s.name?.toLowerCase().includes(q) ||
            s.title?.toLowerCase().includes(q) ||
            s.repository?.toLowerCase().includes(q) ||
            s.branch?.toLowerCase().includes(q) ||
            s.cwd?.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q),
        )
      : providerSessions;

    // The API already returns updated_at desc, so "recent" needs no re-sort.
    if (sort === "recent") return matched;
    const sorted = [...matched];
    switch (sort) {
      case "oldest":
        return sorted.reverse();
      case "cost":
        return sorted.sort(
          (a, b) => (b.estimatedCostUSD ?? 0) - (a.estimatedCostUSD ?? 0),
        );
      case "tokens":
        return sorted.sort((a, b) => totalTokens(b) - totalTokens(a));
      case "events":
        return sorted.sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0));
      case "name":
        return sorted.sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b)));
    }
  }, [providerSessions, search, sort]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-none tracking-tight">
                Agent <span className="text-brand">Session</span> Visualizer
              </h1>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {availableProviders.length > 0
                  ? availableProviders.map((p) => p.rootDir).join("  ·  ")
                  : "no agent directories found"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  error ? "bg-destructive" : "bg-emerald-500",
                )}
                aria-hidden
              />
              <span className="font-medium tabular-nums text-foreground">
                {providerSessions.length}
              </span>
              sessions
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    aria-label="Refresh"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn("size-3.5", loading && "animate-spin")}
                      aria-hidden
                    />
                  </button>
                }
              />
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Failed to load sessions
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5 max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="analytics" className="px-3">
              <BarChart3 className="size-4" aria-hidden />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="sessions" className="px-3">
              <ListTree className="size-4" aria-hidden />
              Sessions
              <span className="ml-1 rounded bg-foreground/10 px-1.5 text-[11px] tabular-nums">
                {sessions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="px-3">
              <FileText className="size-4" aria-hidden />
              Logs
              <span className="ml-1 rounded bg-foreground/10 px-1.5 text-[11px] tabular-nums">
                {logs.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard reloadToken={reloadToken} />
          </TabsContent>

          <TabsContent value="sessions">
            {availableProviders.length > 1 && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter by agent"
              >
                <ProviderChip
                  active={provider === "all"}
                  onClick={() => setProvider("all")}
                  label="All agents"
                  count={sessions.length}
                />
                {availableProviders.map((p) => (
                  <ProviderChip
                    key={p.id}
                    active={provider === p.id}
                    onClick={() => setProvider(p.id)}
                    label={providerStyle(p.id).shortLabel}
                    count={p.sessionCount ?? 0}
                    dotCls={providerStyle(p.id).dotCls}
                  />
                ))}
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                shortcut
                placeholder="Search title, repo, branch or id…"
                aria-label="Search sessions"
                className="w-full max-w-sm"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort sessions"
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `${filteredSessions.length} of ${providerSessions.length}`}
              </span>
            </div>

            <div className="grid gap-2">
              {loading ? (
                Array.from({ length: 5 }, (_, i) => <SessionCardSkeleton key={i} />)
              ) : filteredSessions.length > 0 ? (
                filteredSessions.map((s) => (
                  <SessionCard key={`${s.provider}:${s.id}`} session={s} />
                ))
              ) : (
                <EmptyState
                  icon={Inbox}
                  title={search ? "No matching sessions" : "No sessions yet"}
                  description={
                    search
                      ? `Nothing matches “${search}”. Try a repository name, branch or session id.`
                      : "Sessions appear here once Copilot, Claude Code or Codex writes a transcript to your home directory."
                  }
                  action={
                    search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        Clear search
                      </button>
                    ) : undefined
                  }
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <LogsViewer logs={logs} loading={loading} />
          </TabsContent>
        </Tabs>
      </main>

      <ScrollToTop />
    </div>
  );
}

function ProviderChip({
  active,
  onClick,
  label,
  count,
  dotCls,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dotCls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        active
          ? "border-brand/50 bg-brand/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {dotCls && <span className={cn("size-1.5 rounded-full", dotCls)} aria-hidden />}
      {label}
      <span className="rounded bg-foreground/10 px-1.5 tabular-nums">{count}</span>
    </button>
  );
}
