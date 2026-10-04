"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  ClipboardList,
  FilePen,
  FileText,
  FlaskConical,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CopyButton } from "@/components/common/copy-button";
import { ScrollToTop } from "@/components/common/scroll-to-top";
import { Skeleton } from "@/components/common/skeleton";
import { PalettePicker } from "@/components/common/palette-picker";
import { SearchTrigger } from "@/components/common/command-palette";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { EventsTimeline } from "@/components/session/EventsTimeline";
import { SessionEdits } from "@/components/session/session-edits";
import { SessionHeader } from "@/components/session/session-header";
import { ShortcutsTrigger, SidebarTrigger } from "@/components/session/session-shell";
import { TokenOptimizer } from "@/components/session/token-optimizer";
import {
  CheckpointsList,
  PathList,
} from "@/components/session/checkpoints-list";
import type { EventFocusRequest, SessionData } from "@/components/session/types";
import { editsByTurn } from "@/lib/edits";
import { firstLine } from "@/lib/format";
import { isRunning } from "@/lib/session-state";
import { useQueryParam, useTabParam } from "@/lib/use-tab-param";

const SESSION_TABS = [
  "events",
  "checkpoints",
  "files",
  "edits",
  "research",
  "workspace",
  "optimizer",
] as const;

/** How often a running or followed session is checked for new events. */
const POLL_MS = 3000;

function TabCount({ value }: { value: number }) {
  return (
    <span className="ml-1 rounded-sm bg-foreground/10 px-1.5 text-[11px] tabular-nums">
      {value}
    </span>
  );
}

export default function SessionPage(props: {
  params: Promise<{ provider: string; id: string }>;
}) {
  const { provider, id } = use(props.params);
  // useTabParam reads the URL, which needs a Suspense boundary. The key starts
  // each session from a clean slate when the sidebar switches between them.
  return (
    <Suspense>
      <Session key={`${provider}/${id}`} provider={provider} id={id} />
    </Suspense>
  );
}

function Session({ provider, id }: { provider: string; id: string }) {
  const [tabParam, setActiveTab] = useTabParam(SESSION_TABS, "events");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFocusRequest, setEventFocusRequest] =
    useState<EventFocusRequest | null>(null);

  // A search result links here with `?q=`, which opens the timeline filtered
  // to the matches. A newer search replaces whatever a hint had focused.
  const [query] = useQueryParam("q", "");
  const queryFocus = useMemo<EventFocusRequest | null>(
    () => (query ? { nonce: 0, search: query } : null),
    [query],
  );
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    setEventFocusRequest(null);
  }

  // A link copied from an event opens the timeline scrolled to that event.
  const [targetEventId, setTargetEventId] = useQueryParam("event", "");

  // Bumped by the retry button, and by the poll below when the transcript has
  // grown, to re-run the fetch effect.
  const [reloadToken, setReloadToken] = useState(0);
  // What the transcript looked like when it was last fetched.
  const revision = useRef<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Probed first, so a change that lands mid-fetch is caught by the next poll.
        const probe = await fetch(`/api/sessions/${provider}/${id}?probe=1`);
        const seen = probe.ok ? ((await probe.json()).revision as string) : null;
        const res = await fetch(`/api/sessions/${provider}/${id}`);
        if (!res.ok) throw new Error("Request failed");
        const json: SessionData = await res.json();
        if (!json?.meta) throw new Error("Not found");
        if (!cancelled) {
          revision.current = seen;
          loaded.current = true;
          setData(json);
        }
      } catch {
        // A failed background refresh leaves the transcript already on screen.
        if (!cancelled && !loaded.current) {
          setError("This session could not be loaded. It may have been removed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, id, reloadToken]);

  // Following keeps the newest events in view; a session that is still being
  // written refreshes in place either way.
  const [live, setLive] = useState(false);
  const running = isRunning(data?.meta.updated_at);
  const [, setStale] = useState(0);
  const polling = data !== null && (live || running);
  const updatedAt = data?.meta.updated_at;

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/sessions/${provider}/${id}?probe=1`);
        if (!res.ok || cancelled) return;
        const next = (await res.json()).revision as string;
        if (cancelled) return;
        if (next !== revision.current) setReloadToken((t) => t + 1);
        // Nothing new for a while: re-render so "running" can lapse.
        else if (!isRunning(updatedAt)) setStale((n) => n + 1);
      } catch {
        /* the next tick retries */
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [polling, provider, id, updatedAt]);

  // Distribution of raw event types, for the optimizer's breakdown chart.
  const eventTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.events ?? []) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [data]);

  const editCount = useMemo(
    () => editsByTurn(data?.events ?? []).reduce((sum, turn) => sum + turn.edits, 0),
    [data],
  );

  // Real working time: the span between the first and last recorded event.
  const activeMs = useMemo(() => {
    const events = data?.events ?? [];
    if (events.length < 2) return null;
    const times = events
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => Number.isFinite(t));
    if (times.length < 2) return null;
    return Math.max(...times) - Math.min(...times);
  }, [data]);

  // A hint or a health signal opens the timeline filtered to its events.
  function focusEvents(focus: Omit<EventFocusRequest, "nonce">) {
    setActiveTab("events");
    setEventFocusRequest({ nonce: Date.now(), ...focus });
  }

  // An edit opens the timeline scrolled to the call that made it. The nonce
  // makes opening the same event twice scroll to it both times.
  const [opened, setOpened] = useState<{ eventId: string; nonce: number } | null>(null);
  function openEvent(eventId: string) {
    setTargetEventId(eventId);
    setActiveTab("events");
    setOpened({ eventId, nonce: Date.now() });
  }
  useEffect(() => {
    if (!opened || tabParam !== "events") return;
    // After the next paint, once the timeline is on screen with the event in it.
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(`[data-event-id="${CSS.escape(opened.eventId)}"]`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [opened, tabParam]);

  function retry() {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  }

  // Checkpoints and research only exist for some sessions; a link to a tab
  // this session lacks opens the timeline instead of an empty panel.
  const activeTab =
    (tabParam === "checkpoints" && data?.checkpoints.length === 0) ||
    (tabParam === "research" && data?.research.length === 0)
      ? "events"
      : tabParam;

  const title = data
    ? (data.meta.title ?? firstLine(data.meta.name) ?? data.meta.id)
    : id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky bar: back, current session, tab navigation. */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-[var(--cv-topbar-h)] max-w-6xl items-center gap-3 px-4 sm:px-6">
          <SidebarTrigger className="-ml-2 shrink-0" />
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/?tab=sessions" />}
            className="text-muted-foreground"
          >
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline">Sessions</span>
          </Button>
          <span className="text-muted-foreground/50" aria-hidden>
            /
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <SearchTrigger className="shrink-0" />
          <ShortcutsTrigger className="hidden shrink-0 sm:inline-flex" />
          <PalettePicker className="shrink-0" />
          <ThemeToggle className="shrink-0" />
        </div>
      </div>

      {loading ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-24" />
            ))}
          </div>
          <Skeleton className="h-9 w-96" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      ) : error || !data ? (
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              Session unavailable
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/?tab=sessions" />}>
                Back to sessions
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <SessionHeader
            meta={data.meta}
            stats={data.stats}
            cost={data.cost}
            activeMs={activeMs}
            running={running}
            onFocusEvents={focusEvents}
          />

          <main id="main" className="mx-auto max-w-6xl px-4 pt-2 pb-5 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
              <div className="sticky top-[var(--cv-topbar-h)] z-20 -mx-4 overflow-x-auto scrollbar-none bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
                <TabsList className="w-max">
                  <TabsTrigger value="events" className="px-3">
                    <Zap className="size-4" aria-hidden />
                    Events
                    <TabCount value={data.events.length} />
                  </TabsTrigger>
                  {data.checkpoints.length > 0 && (
                    <TabsTrigger value="checkpoints" className="px-3">
                      <Bookmark className="size-4" aria-hidden />
                      Checkpoints
                      <TabCount value={data.checkpoints.length} />
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="files" className="px-3">
                    <FileText className="size-4" aria-hidden />
                    Files
                    <TabCount value={data.files.length} />
                  </TabsTrigger>
                  <TabsTrigger value="edits" className="px-3">
                    <FilePen className="size-4" aria-hidden />
                    Edits
                    <TabCount value={editCount} />
                  </TabsTrigger>
                  {data.research.length > 0 && (
                    <TabsTrigger value="research" className="px-3">
                      <FlaskConical className="size-4" aria-hidden />
                      Research
                      <TabCount value={data.research.length} />
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="workspace" className="px-3">
                    <ClipboardList className="size-4" aria-hidden />
                    Metadata
                  </TabsTrigger>
                  <TabsTrigger value="optimizer" className="px-3">
                    <Lightbulb className="size-4" aria-hidden />
                    Token Optimizer
                    {data.tokenAnalysis?.hints.some((h) => h.severity === "high") && (
                      <span
                        className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                        title="High-impact hints"
                      >
                        {
                          data.tokenAnalysis.hints.filter(
                            (h) => h.severity === "high",
                          ).length
                        }
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="events">
                <EventsTimeline
                  events={data.events}
                  focusRequest={eventFocusRequest ?? queryFocus}
                  targetEventId={targetEventId || undefined}
                  live={live}
                  onLiveChange={setLive}
                  running={running}
                />
              </TabsContent>

              <TabsContent value="checkpoints" className="pt-2">
                <CheckpointsList checkpoints={data.checkpoints} />
              </TabsContent>

              <TabsContent value="files" className="pt-2">
                <PathList paths={data.files} kind="file" />
              </TabsContent>

              <TabsContent value="edits" className="pt-2">
                <SessionEdits events={data.events} cwd={data.meta.cwd} onOpenEvent={openEvent} />
              </TabsContent>

              <TabsContent value="research" className="pt-2">
                <PathList paths={data.research} kind="research" />
              </TabsContent>

              <TabsContent value="workspace" className="pt-2">
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {data.rawMeta.name}
                    </span>
                    {data.rawMeta.content && (
                      <CopyButton
                        value={data.rawMeta.content}
                        label={`Copy ${data.rawMeta.name}`}
                        className="ml-auto"
                      />
                    )}
                  </div>
                  <ScrollArea className="h-[60vh] w-full">
                    <pre className="w-max min-w-full p-4 font-mono text-xs text-foreground">
                      {data.rawMeta.content || "No session metadata found"}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="optimizer" className="pt-2">
                <TokenOptimizer
                  analysis={data.tokenAnalysis}
                  stats={data.stats}
                  cost={data.cost}
                  events={data.events}
                  eventTypeCounts={eventTypeCounts}
                  onFocusHint={focusEvents}
                  onOpenEvent={openEvent}
                />
              </TabsContent>
            </Tabs>
          </main>
        </>
      )}

      <ScrollToTop />
    </div>
  );
}
