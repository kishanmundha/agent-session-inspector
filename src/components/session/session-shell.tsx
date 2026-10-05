'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FolderGit2, Keyboard, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SearchInput } from '@/components/common/search-input';
import { firstLine, timeAgo } from '@/lib/format';
import { providerStyle } from '@/lib/provider-meta';
import { isRunning } from '@/lib/session-state';
import { sortSessions, useSessionSort } from '@/lib/session-sort';
import { useHotkeys } from '@/lib/use-hotkeys';
import { cn } from '@/lib/utils';
import type { SessionMeta } from './types';

const TOGGLE_SIDEBAR_EVENT = 'asv:toggle-sidebar';
const OPEN_SHORTCUTS_EVENT = 'asv:open-shortcuts';
const SIDEBAR_STORAGE_KEY = 'asv-session-sidebar';

/** How often the sidebar re-reads the session list, to keep "running" honest. */
const LIST_REFRESH_MS = 30_000;

/** Top-bar button for the session sidebar; `b` does the same. */
export function SidebarTrigger({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              window.dispatchEvent(new Event(TOGGLE_SIDEBAR_EVENT))
            }
            aria-label="Toggle session sidebar"
            className={cn('text-muted-foreground', className)}
          >
            <PanelLeft aria-hidden />
          </Button>
        }
      />
      <TooltipContent>Session sidebar (b)</TooltipContent>
    </Tooltip>
  );
}

/** Top-bar button for the shortcut list; `?` does the same. */
export function ShortcutsTrigger({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))
            }
            aria-label="Keyboard shortcuts"
            className={cn('text-muted-foreground', className)}
          >
            <Keyboard aria-hidden />
          </Button>
        }
      />
      <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
    </Tooltip>
  );
}

// Whether the sidebar is docked on wide screens. localStorage is the source of
// truth, as with the theme and palette preferences.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readDocked() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeDocked(docked: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, docked ? '1' : '0');
  } catch {
    /* private mode: the choice lasts until reload */
  }
  listeners.forEach((notify) => notify());
}

const SHORTCUTS: {
  group: string;
  items: [keys: string[], action: string][];
}[] = [
  {
    group: 'Timeline',
    items: [
      [['/'], 'Search events in this session'],
      [['f'], 'Cycle the transcript view: normal, compact, focused'],
      [['o'], 'Flip the order: oldest or newest first'],
      [['l'], 'Follow the session live'],
      [['j', 'k'], 'Move to the next or previous event'],
      [['Enter'], 'Expand or collapse the selected event'],
      [['e', 'E'], 'Expand or collapse every event'],
    ],
  },
  {
    group: 'Navigation',
    items: [
      [['b'], 'Show or hide the session sidebar'],
      [[']', '['], 'Open the next or previous session'],
      [['⌘K'], 'Search every session'],
      [['?'], 'Show this list'],
    ],
  },
];

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          Available on any session page, outside text fields.
        </DialogDescription>
        {SHORTCUTS.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <dl className="divide-y divide-border rounded-lg border border-border">
              {items.map(([keys, action]) => (
                <div
                  key={action}
                  className="flex items-center justify-between gap-4 px-3 py-1.5"
                >
                  <dt className="text-xs text-foreground">{action}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map((key) => (
                      <kbd
                        key={key}
                        className="min-w-5 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[11px] text-muted-foreground"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Link to a session that carries over the open tab and transcript view, so
 * switching sessions keeps them. Read from the address bar when followed,
 * since both are written there without a navigation.
 */
function sessionHref(s: SessionMeta) {
  const current = new URLSearchParams(window.location.search);
  const kept = new URLSearchParams();
  for (const name of ['tab', 'mode']) {
    const value = current.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return `/sessions/${s.provider}/${s.id}${query ? `?${query}` : ''}`;
}

function sessionLabel(s: SessionMeta) {
  return s.title ?? firstLine(s.name) ?? s.id;
}

/**
 * Frame around every session page: a sidebar listing the other sessions, so
 * switching does not mean going back to the home page, plus the shortcut help.
 * It lives in the layout, so neither reloads when the session changes.
 */
export function SessionShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ provider?: string; id?: string }>();
  const docked = useSyncExternalStore(subscribe, readDocked, () => false);
  // Below the docking breakpoint the sidebar is a drawer that starts closed.
  const [drawer, setDrawer] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [sessions, setSessions] = useState<SessionMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [sameProject, setSameProject] = useState(false);
  // Shared with the home list, so both show sessions in the same order.
  const [sort] = useSessionSort();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) throw new Error('Request failed');
        const json: SessionMeta[] = await res.json();
        if (!cancelled) {
          setSessions(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, LIST_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function toggleSidebar() {
    if (window.matchMedia('(min-width: 1024px)').matches)
      writeDocked(!readDocked());
    else setDrawer((open) => !open);
  }

  useEffect(() => {
    const onShortcuts = () => setShortcutsOpen(true);
    window.addEventListener(TOGGLE_SIDEBAR_EVENT, toggleSidebar);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onShortcuts);
    return () => {
      window.removeEventListener(TOGGLE_SIDEBAR_EVENT, toggleSidebar);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onShortcuts);
    };
  }, []);

  const current = sessions?.find(
    (s) => s.provider === params.provider && s.id === params.id,
  );
  const project = current?.project;

  const visible = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = (sessions ?? []).filter((s) => {
      if (sameProject && project && s.project !== project) return false;
      if (terms.length === 0) return true;
      const text =
        `${sessionLabel(s)} ${s.project ?? ''} ${s.branch ?? ''} ${s.id}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
    return sortSessions(matched, sort);
  }, [sessions, search, sameProject, project, sort]);

  /** Opens the session `step` rows away from the current one in the list. */
  function openNeighbour(step: number) {
    const index = visible.findIndex(
      (s) => s.provider === params.provider && s.id === params.id,
    );
    const next = visible[index === -1 ? 0 : index + step];
    if (next) router.push(sessionHref(next));
  }

  useHotkeys({
    b: toggleSidebar,
    '?': () => setShortcutsOpen(true),
    ']': () => openNeighbour(1),
    '[': () => openNeighbour(-1),
  });

  // Keep the open session in view as the list loads or the session changes.
  const activeRef = useRef<HTMLAnchorElement>(null);
  const loaded = sessions !== null;
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [params.id, loaded, docked, drawer, sort]);

  return (
    <>
      <div
        className={cn('flex min-h-full flex-1 flex-col', docked && 'lg:pl-72')}
      >
        {children}
      </div>

      {drawer && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawer(false)}
          aria-hidden
        />
      )}
      <aside
        aria-label="Sessions"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-border bg-background',
          drawer ? 'flex' : docked ? 'hidden lg:flex' : 'hidden',
        )}
      >
        <div className="flex h-[var(--cv-topbar-h)] shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="text-sm font-medium text-foreground">Sessions</span>
          {sessions && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {visible.length === sessions.length
                ? sessions.length
                : `${visible.length} of ${sessions.length}`}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label="Hide session sidebar"
            className="ml-auto text-muted-foreground"
          >
            <PanelLeftClose aria-hidden />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-b border-border p-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            size="sm"
            placeholder="Filter sessions…"
            aria-label="Filter sessions"
            className="min-w-0 flex-1"
          />
          {project && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    variant="outline"
                    size="sm"
                    pressed={sameProject}
                    onPressedChange={setSameProject}
                    aria-label={`Only sessions in ${project}`}
                    className="text-muted-foreground aria-pressed:border-foreground/25 aria-pressed:text-foreground"
                  >
                    <FolderGit2 aria-hidden />
                  </Toggle>
                }
              />
              <TooltipContent>Only {project}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.map((s) => {
            const active = s.provider === params.provider && s.id === params.id;
            const running = isRunning(s.updated_at);
            return (
              <Link
                key={`${s.provider}:${s.id}`}
                ref={active ? activeRef : undefined}
                href={`/sessions/${s.provider}/${s.id}`}
                onClick={() => setDrawer(false)}
                onNavigate={(e) => {
                  e.preventDefault();
                  router.push(sessionHref(s));
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-md border-l-2 px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'border-brand bg-muted'
                    : 'border-transparent hover:bg-muted/60',
                )}
              >
                <span className="line-clamp-2 break-words text-xs font-medium leading-snug text-foreground">
                  {sessionLabel(s)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      providerStyle(s.provider).dotCls,
                    )}
                    title={providerStyle(s.provider).label}
                  />
                  <span className="min-w-0 truncate">
                    {s.project ?? s.repository ?? '—'}
                  </span>
                  <span className="ml-auto shrink-0 whitespace-nowrap">
                    {running ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <span
                          className="size-1.5 animate-pulse rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        running
                      </span>
                    ) : (
                      timeAgo(s.updated_at)
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
          {sessions === null && (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              {failed
                ? 'The session list could not be loaded.'
                : 'Loading sessions…'}
            </p>
          )}
          {sessions !== null && visible.length === 0 && (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              No sessions match.
            </p>
          )}
        </nav>
      </aside>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
