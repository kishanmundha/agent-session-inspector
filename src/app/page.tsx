"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarClock,
  FileText,
  FolderGit2,
  HeartPulse,
  Inbox,
  ListTree,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
import { ScrollToTop } from "@/components/common/scroll-to-top";
import { SearchInput } from "@/components/common/search-input";
import { SessionCardSkeleton } from "@/components/common/skeleton";
import { PalettePicker } from "@/components/common/palette-picker";
import { LanguagePicker } from "@/components/common/language-picker";
import { SearchTrigger } from "@/components/common/command-palette";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { SessionCard, type SessionMeta } from "@/components/home/session-card";
import { LogsViewer, type LogFile } from "@/components/home/logs-viewer";
import { ProjectsTable } from "@/components/home/projects-table";
import { AnalyticsDashboard } from "@/components/home/analytics-dashboard";
import { UsageDashboard } from "@/components/home/usage-dashboard";
import { QualityDashboard } from "@/components/home/quality-dashboard";
import { ActivityDashboard } from "@/components/home/activity-dashboard";
import { AboutDialog } from "@/components/home/about-dialog";
import { APP_INFO } from "@/lib/app-info";
import { providerStyle, supportedAgents } from "@/lib/provider-meta";
import type { ProviderInfo } from "@/components/session/types";
import { ALL_PROJECTS, projectOf, summarizeProjects } from "@/lib/projects";
import { SORT_KEYS, sortSessions, useSessionSort } from "@/lib/session-sort";
import { useQueryParam, useTabParam } from "@/lib/use-tab-param";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/client";

const HOME_TABS = [
  "analytics",
  "usage",
  "activity",
  "quality",
  "projects",
  "sessions",
  "logs",
] as const;

export default function HomePage() {
  // useTabParam reads the URL, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useTabParam(HOME_TABS, "analytics");
  const [projectParam, setProject] = useQueryParam("project", ALL_PROJECTS);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>("all");
  const [logs, setLogs] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useSessionSort();

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
          setError(true);
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
    setError(false);
    setReloadToken((t) => t + 1);
  }

  // An agent whose folder is there but empty has nothing to filter by.
  const availableProviders = useMemo(
    () => providers.filter((p) => p.available && (p.sessionCount ?? 0) > 0),
    [providers],
  );

  const projects = useMemo(() => summarizeProjects(sessions), [sessions]);
  // A project from a stale link is ignored once the list has loaded.
  const project =
    loading || projects.some((p) => p.name === projectParam) ? projectParam : ALL_PROJECTS;

  const projectOptions = useMemo(
    () => [
      { value: ALL_PROJECTS, label: t("home.allProjects") },
      ...[...projects]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.name, label: p.name })),
    ],
    [projects, t],
  );

  const projectSessions = useMemo(
    () =>
      project === ALL_PROJECTS
        ? sessions
        : sessions.filter((s) => projectOf(s) === project),
    [sessions, project],
  );

  const providerSessions = useMemo(
    () =>
      provider === "all"
        ? projectSessions
        : projectSessions.filter((s) => s.provider === provider),
    [projectSessions, provider],
  );

  function openProject(name: string) {
    setProject(name);
    setTab("sessions");
  }

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

    return sortSessions(matched, sort);
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
                Agent <span className="text-brand">Session</span> Inspector
              </h1>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                v{APP_INFO.version}
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
              {t.rich(
                "home.sessionCount",
                {
                  n: (chunks) => (
                    <span className="font-medium tabular-nums text-foreground">{chunks}</span>
                  ),
                },
                { count: providerSessions.length },
              )}
            </span>
            <SearchTrigger />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={refresh}
                    disabled={loading}
                    aria-label={t("home.refresh")}
                    className="text-muted-foreground"
                  >
                    <RefreshCw
                      className={cn("size-3.5", loading && "animate-spin")}
                      aria-hidden
                    />
                  </Button>
                }
              />
              <TooltipContent>{t("home.refresh")}</TooltipContent>
            </Tooltip>
            <LanguagePicker />
            <PalettePicker />
            <ThemeToggle />
            <AboutDialog providers={providers} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {t("home.loadError")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("home.loadErrorDetail")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              {t("home.retry")}
            </Button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5 max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="analytics" className="px-3">
              <BarChart3 className="size-4" aria-hidden />
              {t("home.tabs.analytics")}
            </TabsTrigger>
            <TabsTrigger value="usage" className="px-3">
              <Wallet className="size-4" aria-hidden />
              {t("home.tabs.usage")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-3">
              <CalendarClock className="size-4" aria-hidden />
              {t("home.tabs.activity")}
            </TabsTrigger>
            <TabsTrigger value="quality" className="px-3">
              <HeartPulse className="size-4" aria-hidden />
              {t("home.tabs.quality")}
            </TabsTrigger>
            <TabsTrigger value="projects" className="px-3">
              <FolderGit2 className="size-4" aria-hidden />
              {t("home.tabs.projects")}
              <span className="ml-1 rounded-sm bg-foreground/10 px-1.5 text-[11px] tabular-nums">
                {projects.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="px-3">
              <ListTree className="size-4" aria-hidden />
              {t("home.tabs.sessions")}
              <span className="ml-1 rounded-sm bg-foreground/10 px-1.5 text-[11px] tabular-nums">
                {projectSessions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="px-3">
              <FileText className="size-4" aria-hidden />
              {t("home.tabs.logs")}
              <span className="ml-1 rounded-sm bg-foreground/10 px-1.5 text-[11px] tabular-nums">
                {logs.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard
              reloadToken={reloadToken}
              project={project}
              onProjectChange={setProject}
              projectOptions={projectOptions}
            />
          </TabsContent>

          <TabsContent value="usage">
            <UsageDashboard
              reloadToken={reloadToken}
              project={project}
              onProjectChange={setProject}
              projectOptions={projectOptions}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityDashboard
              reloadToken={reloadToken}
              project={project}
              onProjectChange={setProject}
              projectOptions={projectOptions}
            />
          </TabsContent>

          <TabsContent value="quality">
            <QualityDashboard
              reloadToken={reloadToken}
              project={project}
              onProjectChange={setProject}
              projectOptions={projectOptions}
            />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectsTable
              projects={projects}
              loading={loading}
              selected={project}
              onSelect={openProject}
            />
          </TabsContent>

          <TabsContent value="sessions">
            {availableProviders.length > 1 && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2"
                role="group"
                aria-label={t("home.filterByAgent")}
              >
                <ProviderChip
                  active={provider === "all"}
                  onClick={() => setProvider("all")}
                  label={t("home.allAgents")}
                  count={projectSessions.length}
                />
                {availableProviders.map((p) => (
                  <ProviderChip
                    key={p.id}
                    active={provider === p.id}
                    onClick={() => setProvider(p.id)}
                    label={providerStyle(p.id).shortLabel}
                    count={projectSessions.filter((s) => s.provider === p.id).length}
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
                placeholder={t("home.searchPlaceholder")}
                aria-label={t("home.searchSessions")}
                className="w-full max-w-sm"
              />
              {projectOptions.length > 2 && (
                <OptionSelect
                  value={project}
                  onChange={setProject}
                  options={projectOptions}
                  aria-label={t("home.project")}
                  className="max-w-56"
                />
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline" aria-hidden>
                  {t("home.sort")}
                </span>
                <OptionSelect
                  value={sort}
                  onChange={setSort}
                  options={SORT_KEYS.map((key) => ({ value: key, label: t(`sort.${key}`) }))}
                  aria-label={t("home.sortSessions")}
                />
              </div>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {loading
                  ? t("common.loading")
                  : t("common.nOfTotal", {
                      shown: filteredSessions.length,
                      total: providerSessions.length,
                    })}
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
                  title={search ? t("home.noMatchingSessions") : t("home.noSessions")}
                  description={
                    search
                      ? t("home.noMatchDetail", { query: search })
                      : project !== ALL_PROJECTS
                        ? t("home.noProjectSessions", {
                            agent: providerStyle(provider).shortLabel,
                            project,
                          })
                        : t("home.noSessionsDetail", { agents: supportedAgents(locale) })
                  }
                  action={
                    search ? (
                      <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                        {t("common.clearSearch")}
                      </Button>
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
    <Toggle
      variant="outline"
      size="sm"
      pressed={active}
      onPressedChange={onClick}
      className="gap-1.5 rounded-full bg-background px-3 text-xs text-muted-foreground aria-pressed:border-brand/50 aria-pressed:bg-brand/10 aria-pressed:text-foreground"
    >
      {dotCls && <span className={cn("size-1.5 rounded-full", dotCls)} aria-hidden />}
      {label}
      <span className="rounded-sm bg-foreground/10 px-1.5 tabular-nums">{count}</span>
    </Toggle>
  );
}
