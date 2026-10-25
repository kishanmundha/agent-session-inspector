"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, FilePen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { ToolArguments } from "@/components/session/EventsTimeline";
import { editPreview, type DiffLine } from "@/lib/edit-preview";
import { editsByTurn, unmatchedFiles, type TurnFile } from "@/lib/edits";
import { firstLine, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import type { AgentEvent } from "./types";

/** Lines of one preview shown before it is cut short. */
const MAX_PREVIEW_LINES = 400;

/**
 * The files the session changed, turn by turn in timeline order: each prompt
 * with what the agent wrote, edited or patched in response, shell commands
 * included. A file opens in place to show each change, with a way to the call
 * in the timeline.
 */
export function SessionEdits({
  events,
  cwd,
  recorded,
  onOpenEvent,
}: {
  events: AgentEvent[];
  /** Paths inside it are shown relative to it. */
  cwd?: string;
  /** Files the agent's own records list, shown when no edit accounts for them. */
  recorded: string[];
  /** Opens the timeline at an event. */
  onOpenEvent: (eventId: string) => void;
}) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const turns = useMemo(() => editsByTurn(events, cwd), [events, cwd]);
  const others = useMemo(() => unmatchedFiles(turns, recorded), [turns, recorded]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const q = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? turns
            .map((turn) => ({
              ...turn,
              files: turn.files.filter((f) => f.path.toLowerCase().includes(q)),
            }))
            .filter((turn) => turn.files.length > 0)
        : turns,
    [turns, q],
  );
  const visibleOthers = q ? others.filter((p) => p.toLowerCase().includes(q)) : others;

  if (turns.length === 0 && others.length === 0) {
    return (
      <EmptyState
        icon={FilePen}
        title={t("edits.emptyTitle")}
        description={t("edits.emptyDetail")}
      />
    );
  }

  const root = cwd ? `${cwd.replace(/[\\/]+$/, "")}/` : null;
  const display = (path: string) => (root && path.startsWith(root) ? path.slice(root.length) : path);
  const files = new Set(turns.flatMap((turn) => turn.files.map((f) => f.path))).size;
  const edits = turns.reduce((sum, turn) => sum + turn.edits, 0);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {files + others.length > 8 && (
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder={t("logs.filterFiles")}
            aria-label={t("edits.filterLabel")}
            className="w-full max-w-sm"
          />
        )}
        {turns.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {t("edits.files", { count: files })} · {t("edits.edits", { count: edits })} ·{" "}
            {t("edits.turns", { count: turns.length })}
          </span>
        )}
      </div>

      {visible.map((turn) => (
        <section
          key={turn.promptEventId ?? "start"}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <header className="flex items-baseline gap-3 border-b border-border bg-muted/40 px-3 py-2">
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {turn.turn > 0 ? t("costByTurn.turn", { turn: turn.turn }) : t("edits.start")}
            </span>
            {turn.promptEventId ? (
              <button
                type="button"
                onClick={() => onOpenEvent(turn.promptEventId!)}
                title={t("edits.openPrompt")}
                className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {firstLine(turn.prompt) ?? t("search.kinds.user")}
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {t("costByTurn.beforeFirst")}
              </span>
            )}
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t("edits.files", { count: turn.files.length })} · {formatDateTime(turn.timestamp)}
            </span>
          </header>
          <ul>
            {turn.files.map((file) => {
              const key = `${turn.turn}:${file.path}`;
              const isOpen = open.has(key);
              return (
                <li key={file.path} className="border-b border-border/60 last:border-b-0">
                  <div className="group flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                      title={file.path}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate font-mono text-[13px]">{display(file.path)}</span>
                    </button>
                    <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <CopyButton value={file.path} label={t("unpriced.copyPath")} />
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {file.tools.join(", ")}
                    </span>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {file.count > 1 ? `×${file.count}` : ""}
                    </span>
                  </div>
                  {isOpen && (
                    <FileChanges
                      file={file}
                      events={events}
                      byId={byId}
                      onOpenEvent={onOpenEvent}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {visibleOthers.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border bg-muted/40 px-3 py-2">
            <p className="text-sm font-medium">{t("edits.recorded")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("edits.recordedNote")}</p>
          </header>
          <ul>
            {visibleOthers.map((path) => (
              <li
                key={path}
                className="group flex items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={path}>
                  {display(path)}
                </span>
                <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <CopyButton value={path} label={t("unpriced.copyPath")} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.length === 0 && visibleOthers.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("edits.noMatches", { query: filter })}
        </p>
      )}
    </div>
  );
}

/** Each call that wrote one file in a turn, shown as it changed the file. */
function FileChanges({
  file,
  events,
  byId,
  onOpenEvent,
}: {
  file: TurnFile;
  events: AgentEvent[];
  byId: Map<string, AgentEvent>;
  onOpenEvent: (eventId: string) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3 border-t border-border/60 bg-muted/20 px-3 py-3">
      {file.changes.map((change, i) => {
        const event = byId.get(change.eventId);
        if (!event) return null;
        const failed = callFailed(event, events);
        return (
          <div key={`${change.eventId}:${i}`} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium text-amber-700 dark:text-amber-300">{change.tool}</span>
              <span className="tabular-nums text-muted-foreground">{formatDateTime(event.timestamp)}</span>
              {failed && (
                <span className="rounded-sm bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/60 dark:text-red-400">
                  {t("timeline.failed")}
                </span>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onOpenEvent(change.eventId)}
                className="ml-auto text-muted-foreground"
              >
                <ArrowUpRight aria-hidden />
                {t("edits.openInTimeline")}
              </Button>
            </div>
            <ChangePreview event={event} path={file.path} events={events} />
          </div>
        );
      })}
    </div>
  );
}

/** Whether the call failed, from its own report or the result that answered it. */
function callFailed(event: AgentEvent, events: AgentEvent[]): boolean {
  if (event.type === "file.patch_applied") return event.data.success === false;
  const callId = event.data.toolCallId;
  if (callId === undefined) return false;
  const result = events.find((e) => e.type === "tool.execution_complete" && e.data.toolCallId === callId);
  return result?.data.success === false;
}

const PREVIEW_CLS =
  "max-h-96 overflow-auto rounded-md border border-border bg-background font-mono text-xs leading-relaxed";

function ChangePreview({ event, path, events }: { event: AgentEvent; path: string; events: AgentEvent[] }) {
  const t = useT();
  const preview = useMemo(() => editPreview(event, path, events), [event, path, events]);

  switch (preview.kind) {
    case "diff":
      return <DiffView lines={preview.lines} />;
    case "command":
      return (
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">{t("edits.command")}</span>
          <pre className={cn(PREVIEW_CLS, "whitespace-pre-wrap break-words p-2 [overflow-wrap:anywhere]")}>
            {preview.text}
          </pre>
        </div>
      );
    case "deleted":
      return <p className="text-xs text-red-700 dark:text-red-400">{t("edits.deleted")}</p>;
    case "applied":
      return (
        <p className="text-xs text-muted-foreground">
          {t("timeline.applied")} · <span className="font-mono">{preview.type}</span>
        </p>
      );
    case "args":
      return <ToolArguments args={preview.args} />;
    case "none":
      return null;
  }
}

const LINE_CLS: Record<DiffLine["kind"], string> = {
  add: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  del: "bg-red-500/10 text-red-800 dark:text-red-300",
  ctx: "text-foreground/80",
  gap: "text-muted-foreground",
};

const LINE_MARK: Record<DiffLine["kind"], string> = { add: "+", del: "-", ctx: " ", gap: "⋯" };

/** Added, removed and unchanged lines, cut short past `MAX_PREVIEW_LINES`. */
function DiffView({ lines }: { lines: DiffLine[] }) {
  const t = useT();
  const shown = lines.slice(0, MAX_PREVIEW_LINES);
  return (
    <div className="space-y-1">
      <div className={PREVIEW_CLS}>
        <div className="w-max min-w-full py-1">
          {shown.map((line, i) => (
            <div key={i} className={cn("flex whitespace-pre px-2", LINE_CLS[line.kind])}>
              <span className="w-4 shrink-0 select-none opacity-70" aria-hidden>
                {LINE_MARK[line.kind]}
              </span>
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
      {lines.length > shown.length && (
        <p className="text-[11px] text-muted-foreground">{t("edits.previewCut")}</p>
      )}
    </div>
  );
}
