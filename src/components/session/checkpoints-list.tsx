"use client";

import { useState } from "react";
import { Bookmark, ChevronRight, FileText, FlaskConical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { cn } from "@/lib/utils";
import type { CheckpointFile } from "./types";

export function CheckpointsList({
  checkpoints,
}: {
  checkpoints: CheckpointFile[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (checkpoints.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No checkpoints"
        description="Copilot CLI writes checkpoint files when it summarizes progress. Claude Code and Codex sessions have none."
      />
    );
  }

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {checkpoints.map((cp) => {
        const isOpen = expanded.has(cp.name);
        return (
          <div
            key={cp.name}
            className="overflow-hidden rounded-xl border border-border"
          >
            <button
              type="button"
              onClick={() => toggle(cp.name)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 bg-muted/60 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-90",
                )}
                aria-hidden
              />
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-foreground">
                {cp.name}
              </span>
              {cp.content && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {cp.content.length.toLocaleString()} chars
                </span>
              )}
            </button>
            {isOpen &&
              (cp.content ? (
                <div className="border-t border-border">
                  <div className="flex justify-end border-b border-border bg-background px-2 py-1">
                    <CopyButton value={cp.content} label="Copy checkpoint" />
                  </div>
                  <ScrollArea className="h-[60vh] w-full">
                    <pre className="w-max min-w-full p-4 font-mono text-xs text-foreground">
                      {cp.content}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <p className="border-t border-border p-4 text-sm text-muted-foreground">
                  Empty file
                </p>
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** Shared renderer for the Files and Research tabs. */
export function PathList({
  paths,
  kind,
}: {
  paths: string[];
  kind: "file" | "research";
}) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const visible = q ? paths.filter((p) => p.toLowerCase().includes(q)) : paths;
  const Icon = kind === "research" ? FlaskConical : FileText;

  if (paths.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={kind === "research" ? "No research files" : "No files"}
        description={
          kind === "research"
            ? "Research notes appear here when the agent saves its findings."
            : "No files recorded. Copilot lists its workspace files here; Claude Code and Codex list the files the session edited."
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {paths.length > 8 && (
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Filter paths…"
          aria-label="Filter paths"
          className="w-full max-w-sm"
        />
      )}
      {visible.map((p) => (
        <div
          key={p}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-mono text-foreground">{p}</span>
          <CopyButton value={p} label="Copy path" />
        </div>
      ))}
      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No paths match &ldquo;{filter}&rdquo;
        </p>
      )}
    </div>
  );
}
