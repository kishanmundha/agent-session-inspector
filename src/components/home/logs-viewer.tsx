"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  FileText,
  Loader2,
  WrapText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { Skeleton } from "@/components/common/skeleton";
import { formatBytes, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LogFile {
  name: string;
  mtime: string;
  size: number;
  /** Which agent CLI wrote the log; used when fetching its content. */
  provider?: string;
}

type Level = "error" | "warn" | "info" | "debug";

const LEVEL_STYLE: Record<Level, string> = {
  error: "text-destructive",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-foreground",
  debug: "text-muted-foreground",
};

function levelOf(line: string): Level {
  if (line.includes("[ERROR]")) return "error";
  if (line.includes("[WARN]")) return "warn";
  if (line.includes("[INFO]")) return "info";
  return "debug";
}

export function LogsViewer({
  logs,
  loading,
}: {
  logs: LogFile[];
  loading: boolean;
}) {
  const [fileFilter, setFileFilter] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // What has actually been fetched. Comparing it to `selected` derives the
  // loading state, so nothing has to be synced back in an effect.
  const [loaded, setLoaded] = useState<{ name: string; content: string } | null>(
    null,
  );
  const [lineFilter, setLineFilter] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [wrap, setWrap] = useState(true);

  // Default to the newest log so the pane is never empty on arrival.
  const selected = picked ?? logs[0]?.name ?? null;
  const selectedProvider =
    logs.find((l) => l.name === selected)?.provider ?? "copilot";
  const loadingLog = selected !== null && loaded?.name !== selected;
  const content = loaded?.name === selected ? loaded.content : "";

  const visibleFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    return q ? logs.filter((l) => l.name.toLowerCase().includes(q)) : logs;
  }, [logs, fileFilter]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/logs?provider=${encodeURIComponent(selectedProvider)}&name=${encodeURIComponent(selected)}`,
        );
        const data = await r.json();
        if (!cancelled) setLoaded({ name: selected, content: data.content || "" });
      } catch {
        if (!cancelled) setLoaded({ name: selected, content: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, selectedProvider]);

  function selectLog(name: string) {
    setPicked(name);
    setLineFilter("");
    setErrorsOnly(false);
  }

  const allLines = useMemo(
    () => (content ? content.split("\n") : []),
    [content],
  );

  const lines = useMemo(() => {
    const q = lineFilter.trim().toLowerCase();
    return allLines
      .map((text, i) => ({ text, n: i + 1, level: levelOf(text) }))
      .filter((l) => {
        if (errorsOnly && l.level !== "error" && l.level !== "warn") return false;
        if (q && !l.text.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [allLines, lineFilter, errorsOnly]);

  const errorCount = useMemo(
    () => allLines.filter((l) => levelOf(l) === "error").length,
    [allLines],
  );

  if (loading) {
    return (
      <div className="grid gap-4 lg:h-[calc(100vh-16rem)] lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-64 lg:h-full" />
        <Skeleton className="h-[60vh] lg:h-full" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No log files"
        description="Nothing has been written to ~/.copilot/logs yet."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-16rem)] lg:min-h-[420px] lg:grid-cols-[280px_1fr]">
      {/* File list. Caps its own height when the panes stack on narrow screens. */}
      <div className="flex min-h-0 max-h-64 flex-col gap-2 lg:max-h-none">
        <SearchInput
          value={fileFilter}
          onChange={setFileFilter}
          placeholder="Filter files…"
          aria-label="Filter log files"
        />
        <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border">
          <div className="space-y-1 p-2">
            {visibleFiles.map((log) => {
              const active = selected === log.name;
              return (
                <button
                  key={log.name}
                  onClick={() => selectLog(log.name)}
                  aria-current={active}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <div className="truncate font-mono">{log.name}</div>
                  <div
                    className={cn(
                      "mt-0.5 flex justify-between",
                      active ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    <span>{formatBytes(log.size)}</span>
                    <span>{timeAgo(log.mtime)}</span>
                  </div>
                </button>
              );
            })}
            {visibleFiles.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No files match “{fileFilter}”
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex min-h-0 h-[60vh] flex-col overflow-hidden rounded-xl border border-border lg:h-auto">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
              <span className="min-w-0 truncate font-mono text-xs text-foreground">
                {selected}
              </span>
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                  <AlertCircle className="size-3" aria-hidden />
                  {errorCount} error{errorCount === 1 ? "" : "s"}
                </span>
              )}
              {/* Every control here is the `sm` size, so the row shares one height. */}
              <div className="ml-auto flex w-full items-center gap-1.5 sm:w-auto">
                <SearchInput
                  value={lineFilter}
                  onChange={setLineFilter}
                  size="sm"
                  placeholder="Filter lines…"
                  aria-label="Filter log lines"
                  className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Toggle
                        variant="outline"
                        size="sm"
                        pressed={errorsOnly}
                        onPressedChange={setErrorsOnly}
                        className="bg-background text-muted-foreground aria-pressed:border-destructive/40 aria-pressed:bg-destructive/10 aria-pressed:text-destructive"
                      >
                        <AlertCircle aria-hidden />
                        Problems
                      </Toggle>
                    }
                  />
                  <TooltipContent>Show only errors and warnings</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Toggle
                        variant="outline"
                        size="sm"
                        pressed={wrap}
                        onPressedChange={setWrap}
                        aria-label="Wrap long lines"
                        className="bg-background text-muted-foreground aria-pressed:text-foreground"
                      >
                        <WrapText aria-hidden />
                      </Toggle>
                    }
                  />
                  <TooltipContent>Wrap long lines</TooltipContent>
                </Tooltip>
                <CopyButton value={content} label="Copy log" size="sm" />
              </div>
            </div>

            {(lineFilter || errorsOnly) && (
              <div className="border-b border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">
                {lines.length.toLocaleString()} of {allLines.length.toLocaleString()} lines
              </div>
            )}

            <ScrollArea className="min-h-0 flex-1">
              {loadingLog ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : lines.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No lines match the current filter.
                </p>
              ) : (
                <div className="p-3 font-mono text-xs">
                  {lines.map((line) => (
                    <div
                      key={line.n}
                      className={cn(
                        "flex gap-3 rounded-sm px-1 leading-5 hover:bg-muted/60",
                        LEVEL_STYLE[line.level],
                      )}
                    >
                      <span className="w-10 shrink-0 select-none text-right text-muted-foreground/40 tabular-nums">
                        {line.n}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          wrap
                            ? "whitespace-pre-wrap [overflow-wrap:anywhere]"
                            : "whitespace-pre",
                        )}
                      >
                        {line.text || " "}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a log file to view
          </div>
        )}
      </div>
    </div>
  );
}
