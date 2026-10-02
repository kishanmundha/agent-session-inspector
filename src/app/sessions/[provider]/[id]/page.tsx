"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  ClipboardList,
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
import { ThemeToggle } from "@/components/common/theme-toggle";
import { EventsTimeline } from "@/components/session/EventsTimeline";
import { SessionHeader } from "@/components/session/session-header";
import { TokenOptimizer } from "@/components/session/token-optimizer";
import {
  CheckpointsList,
  PathList,
} from "@/components/session/checkpoints-list";
import type { EventFocusRequest, SessionData } from "@/components/session/types";
import { firstLine } from "@/lib/format";
import { useTabParam } from "@/lib/use-tab-param";

const SESSION_TABS = [
  "events",
  "checkpoints",
  "files",
  "research",
  "workspace",
  "optimizer",
] as const;

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
  // useTabParam reads the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <Session {...props} />
    </Suspense>
  );
}

function Session({
  params,
}: {
  params: Promise<{ provider: string; id: string }>;
}) {
  const { provider, id } = use(params);
  const [tabParam, setActiveTab] = useTabParam(SESSION_TABS, "events");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFocusRequest, setEventFocusRequest] =
    useState<EventFocusRequest | null>(null);

  // Bumped by the retry button to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${provider}/${id}`);
        if (!res.ok) throw new Error("Request failed");
        const json: SessionData = await res.json();
        if (!json?.meta) throw new Error("Not found");
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
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

  // Distribution of raw event types, for the optimizer's breakdown chart.
  const eventTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.events ?? []) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [data]);

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
          />

          <main id="main" className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="sticky top-[var(--cv-topbar-h)] z-20 -mx-4 mb-5 overflow-x-auto scrollbar-none bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
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
                  focusRequest={eventFocusRequest}
                />
              </TabsContent>

              <TabsContent value="checkpoints">
                <CheckpointsList checkpoints={data.checkpoints} />
              </TabsContent>

              <TabsContent value="files">
                <PathList paths={data.files} kind="file" />
              </TabsContent>

              <TabsContent value="research">
                <PathList paths={data.research} kind="research" />
              </TabsContent>

              <TabsContent value="workspace">
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

              <TabsContent value="optimizer">
                <TokenOptimizer
                  analysis={data.tokenAnalysis}
                  stats={data.stats}
                  cost={data.cost}
                  eventTypeCounts={eventTypeCounts}
                  onFocusHint={(focus) => {
                    setActiveTab("events");
                    setEventFocusRequest({
                      nonce: Date.now(),
                      categories: focus.categories,
                      subKeys: focus.subKeys,
                      search: focus.search,
                    });
                  }}
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
