"use client";

import { useState } from "react";
import { Bookmark, ChevronRight, FileText, FlaskConical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import type { CheckpointFile } from "./types";

export function CheckpointsList({
  checkpoints,
}: {
  checkpoints: CheckpointFile[];
}) {
  const t = useT();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (checkpoints.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title={t("checkpoints.emptyTitle")}
        description={t("checkpoints.emptyDetail")}
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
                  {t("checkpoints.chars", { count: cp.content.length })}
                </span>
              )}
            </button>
            {isOpen &&
              (cp.content ? (
                <div className="border-t border-border">
                  <div className="flex justify-end border-b border-border bg-background px-2 py-1">
                    <CopyButton value={cp.content} label={t("checkpoints.copy")} />
                  </div>
                  <ScrollArea className="h-[60vh] w-full">
                    <pre className="w-max min-w-full p-4 font-mono text-xs text-foreground">
                      {cp.content}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <p className="border-t border-border p-4 text-sm text-muted-foreground">
                  {t("checkpoints.emptyFile")}
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
  const t = useT();
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const visible = q ? paths.filter((p) => p.toLowerCase().includes(q)) : paths;
  const Icon = kind === "research" ? FlaskConical : FileText;

  if (paths.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={kind === "research" ? t("paths.noResearch") : t("paths.noFiles")}
        description={
          kind === "research" ? t("paths.noResearchDetail") : t("paths.noFilesDetail")
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
          placeholder={t("paths.filter")}
          aria-label={t("paths.filterLabel")}
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
          <CopyButton value={p} label={t("unpriced.copyPath")} />
        </div>
      ))}
      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("paths.noMatches", { query: filter })}
        </p>
      )}
    </div>
  );
}
