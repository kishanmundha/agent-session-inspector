"use client";

import { useMemo, useState } from "react";
import { FilePen } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { editsByTurn } from "@/lib/edits";
import { firstLine, formatDateTime } from "@/lib/format";
import type { AgentEvent } from "./types";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/**
 * The files the session changed, turn by turn in timeline order: each prompt
 * with what the agent wrote, edited or patched in response, shell commands
 * included.
 */
export function SessionEdits({
  events,
  cwd,
  onOpenEvent,
}: {
  events: AgentEvent[];
  /** Paths inside it are shown relative to it. */
  cwd?: string;
  /** Opens the timeline at an event. */
  onOpenEvent: (eventId: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const turns = useMemo(() => editsByTurn(events, cwd), [events, cwd]);

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

  if (turns.length === 0) {
    return (
      <EmptyState
        icon={FilePen}
        title="No file edits"
        description="Files appear here, grouped by prompt, when the agent writes, edits or patches one, or changes one from the shell."
      />
    );
  }

  const root = cwd ? `${cwd.replace(/[\\/]+$/, "")}/` : null;
  const display = (path: string) => (root && path.startsWith(root) ? path.slice(root.length) : path);
  const files = new Set(turns.flatMap((turn) => turn.files.map((f) => f.path))).size;
  const edits = turns.reduce((sum, turn) => sum + turn.edits, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {files > 8 && (
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Filter files…"
            aria-label="Filter edited files"
            className="w-full max-w-sm"
          />
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {plural(files, "file")} · {plural(edits, "edit")} · {plural(turns.length, "turn")}
        </span>
      </div>

      {visible.map((turn) => (
        <section
          key={turn.promptEventId ?? "start"}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <header className="flex items-baseline gap-3 border-b border-border bg-muted/40 px-3 py-2">
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {turn.turn > 0 ? `Turn ${turn.turn}` : "Start"}
            </span>
            {turn.promptEventId ? (
              <button
                type="button"
                onClick={() => onOpenEvent(turn.promptEventId!)}
                title="Open this prompt in the timeline"
                className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {firstLine(turn.prompt) ?? "Prompt"}
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                Before the first prompt
              </span>
            )}
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {plural(turn.files.length, "file")} · {formatDateTime(turn.timestamp)}
            </span>
          </header>
          <ul>
            {turn.files.map((file) => (
              <li
                key={file.path}
                className="group flex items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => onOpenEvent(file.eventId)}
                  title={`${file.path}\nOpen the edit in the timeline`}
                  className="min-w-0 flex-1 truncate rounded-sm text-left font-mono text-[13px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {display(file.path)}
                </button>
                <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <CopyButton value={file.path} label="Copy path" />
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {file.tools.join(", ")}
                </span>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {file.count > 1 ? `×${file.count}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No files match &ldquo;{filter}&rdquo;
        </p>
      )}
    </div>
  );
}
