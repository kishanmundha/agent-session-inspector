"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  CornerDownLeft,
  FileText,
  FolderGit2,
  ListTree,
  Loader2,
  type LucideIcon,
  Search,
  Terminal,
  User,
  Wallet,
  Wrench,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { providerStyle } from "@/lib/provider-meta";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SearchKind, SearchResponse } from "@/lib/search";

const OPEN_EVENT = "asv:open-search";

const PAGES: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Analytics", href: "/?tab=analytics", icon: BarChart3 },
  { label: "Usage", href: "/?tab=usage", icon: Wallet },
  { label: "Projects", href: "/?tab=projects", icon: FolderGit2 },
  { label: "Sessions", href: "/?tab=sessions", icon: ListTree },
  { label: "Logs", href: "/?tab=logs", icon: FileText },
];

const KIND_META: Record<SearchKind, { label: string; icon: LucideIcon }> = {
  user: { label: "Prompt", icon: User },
  assistant: { label: "Reply", icon: Bot },
  thinking: { label: "Thinking", icon: Bot },
  tool: { label: "Tool call", icon: Wrench },
  result: { label: "Tool output", icon: Terminal },
};

/** One row the arrow keys can land on. */
interface Item {
  key: string;
  href: string;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const pattern = useMemo(() => {
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return escaped.length > 0 ? new RegExp(`(${escaped.join("|")})`, "gi") : null;
  }, [terms]);
  if (!pattern) return text;
  // With one capture group, split puts the matches at the odd positions.
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-xs bg-brand/20 text-foreground">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Header button that opens the palette; ⌘K does the same from anywhere. */
export function SearchTrigger({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label="Search all sessions"
      className={cn("gap-2 text-muted-foreground", className)}
    >
      <Search aria-hidden />
      <span className="hidden md:inline">Search…</span>
      <kbd className="pointer-events-none hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] md:block">
        ⌘K
      </kbd>
    </Button>
  );
}

/**
 * ⌘K palette: jump to a page, or search the text of every session. Mounted
 * once in the root layout so it works on every page.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Every open and close goes through here, so the palette always starts empty.
  const toggle = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    setOpen(next);
    setQuery("");
    setResponse(null);
    setFailed(false);
    setActive(0);
  }, []);

  const trimmed = query.trim();
  const searchable = trimmed.replace(/\s+/g, "").length >= 2;
  // Results for an earlier query stay on screen until the new ones arrive.
  const pending = searchable && !failed && response?.query !== trimmed;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      e.preventDefault();
      toggle((o) => !o);
    }
    const onOpen = () => toggle(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [toggle]);

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Request failed");
        setResponse(await res.json());
        setActive(0);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  const terms = useMemo(() => trimmed.toLowerCase().split(/\s+/).filter(Boolean), [trimmed]);
  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(trimmed.toLowerCase()));
  const results = searchable ? (response?.results ?? []) : [];

  // Flat list in display order, so the arrow keys cross section boundaries.
  const items: Item[] = [
    ...pages.map((p) => ({ key: `page:${p.href}`, href: p.href })),
    ...results.flatMap((r) => {
      const base = `/sessions/${r.provider}/${r.id}`;
      // Opening a hit lands on the timeline already filtered to the matches.
      const filtered = `${base}?q=${encodeURIComponent(trimmed)}`;
      return [
        { key: `session:${r.provider}:${r.id}`, href: r.matchCount > 0 ? filtered : base },
        ...r.hits.map((_, i) => ({ key: `hit:${r.provider}:${r.id}:${i}`, href: filtered })),
      ];
    }),
  ];
  const indexOf = (key: string) => items.findIndex((item) => item.key === key);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(href: string) {
    toggle(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + items.length) % items.length);
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active].href);
    }
  }

  const rowProps = (key: string) => {
    const index = indexOf(key);
    return {
      "data-index": index,
      role: "option" as const,
      "aria-selected": index === active,
      onMouseMove: () => setActive(index),
      onClick: () => go(items[index].href),
      className: cn(
        "flex w-full cursor-pointer items-center gap-2.5 px-4 text-left",
        index === active && "bg-muted",
      ),
    };
  };

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search the text of every session, or jump to a page.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border py-3 pr-12 pl-4">
          {pending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Search className="size-4 text-muted-foreground" aria-hidden />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFailed(false);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search prompts, replies, commands and tool output…"
            aria-label="Search all sessions"
            role="combobox"
            aria-expanded
            aria-controls="cv-palette-list"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          ref={listRef}
          id="cv-palette-list"
          role="listbox"
          // DialogContent pins its children with *:shrink-0; the list must shrink to scroll.
          className="min-h-0 flex-1 shrink! overflow-y-auto py-1.5"
        >
          {pages.length > 0 && (
            <>
              <p className="px-4 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Go to
              </p>
              {pages.map((p) => (
                <div key={p.href} {...rowProps(`page:${p.href}`)}>
                  <p.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="py-1.5 text-sm">{p.label}</span>
                </div>
              ))}
            </>
          )}

          {searchable && response && (
            <p className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {response.total === 0
                ? "Sessions"
                : response.total > results.length
                  ? `Sessions · first ${results.length} of ${response.total}`
                  : `Sessions · ${response.total}`}
            </p>
          )}

          {results.map((r) => {
            const provider = providerStyle(r.provider);
            const id = `${r.provider}:${r.id}`;
            return (
              <div key={id} className="pb-1">
                <div {...rowProps(`session:${id}`)}>
                  <span className={cn("size-2 shrink-0 rounded-full", provider.dotCls)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate py-1.5 text-sm font-medium">
                    <Highlight text={r.label} terms={terms} />
                  </span>
                  <span className="shrink-0 truncate text-xs text-muted-foreground">
                    {[provider.shortLabel, r.project, timeAgo(r.updated_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {r.hits.map((hit, i) => {
                  const kind = KIND_META[hit.kind];
                  return (
                    <div key={i} {...rowProps(`hit:${id}:${i}`)}>
                      <kind.icon
                        className="ml-4.5 size-3 shrink-0 text-muted-foreground"
                        aria-label={hit.tool ? `${kind.label}: ${hit.tool}` : kind.label}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate py-1 text-xs text-muted-foreground",
                          (hit.kind === "tool" || hit.kind === "result") && "font-mono",
                        )}
                      >
                        <Highlight text={hit.snippet} terms={terms} />
                      </span>
                    </div>
                  );
                })}
                {r.matchCount > r.hits.length && (
                  <p className="py-0.5 pr-4 pl-13 text-[11px] text-muted-foreground/80">
                    +{r.matchCount - r.hits.length} more in this session
                  </p>
                )}
              </div>
            );
          })}

          {failed ? (
            <p className="px-4 py-6 text-center text-sm text-destructive">
              Search failed. Check that the app is still running.
            </p>
          ) : searchable && response && response.total === 0 && !pending ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No session mentions “{response.query}”.
            </p>
          ) : searchable && !response ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching… the first search reads every transcript.
            </p>
          ) : (
            !searchable &&
            pages.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type at least two characters to search.
              </p>
            )
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ to move</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" aria-hidden /> to open
          </span>
          <span>Words must all appear in the same message</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
