"use client";

import { useRef, useState } from "react";
import { Bot, Bug, Info, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/common/copy-button";
import { APP_INFO } from "@/lib/app-info";
import { providerStyle } from "@/lib/provider-meta";
import type { ProviderInfo } from "@/components/session/types";
import { cn } from "@/lib/utils";

/** lucide-react ships no brand icons, so the GitHub mark is drawn here. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const externalLink = { target: "_blank", rel: "noreferrer" } as const;

/** Header button plus the dialog it opens: version, author, links and data sources. */
export function AboutDialog({
  providers: providersProp,
  className,
}: {
  /** Omit to have the dialog fetch the list itself the first time it opens. */
  providers?: ProviderInfo[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<ProviderInfo[] | null>(null);
  const requested = useRef(false);
  const providers = providersProp ?? fetched;

  function openDialog() {
    setOpen(true);
    if (providersProp || requested.current) return;
    requested.current = true;
    fetch("/api/providers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFetched)
      .catch(() => setFetched([]));
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              onClick={openDialog}
              aria-label="About"
              className={cn("text-muted-foreground", className)}
            >
              <Info className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <TooltipContent>About</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Bot className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle>{APP_INFO.name}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">v{APP_INFO.version}</span>
                {" · by "}
                <a
                  href={APP_INFO.author.url}
                  {...externalLink}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {APP_INFO.author.name}
                </a>
              </p>
            </div>
          </div>

          <DialogDescription>{APP_INFO.description}</DialogDescription>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={APP_INFO.repoUrl} {...externalLink} />}
            >
              <GitHubMark className="size-3.5" />
              GitHub
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={APP_INFO.releasesUrl} {...externalLink} />}
            >
              <Tag className="size-3.5" aria-hidden />
              Releases
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={APP_INFO.issuesUrl} {...externalLink} />}
            >
              <Bug className="size-3.5" aria-hidden />
              Report an issue
            </Button>
          </div>

          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-xs font-medium text-foreground">Data sources</h3>
            {!providers ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : providers.length > 0 ? (
              <ul className="overflow-hidden rounded-lg border border-border text-xs">
                {providers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        p.available ? providerStyle(p.id).dotCls : "bg-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.label}</p>
                      <p className="truncate font-mono text-muted-foreground">{p.rootDir}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.available
                        ? `${p.sessionCount ?? 0} ${p.sessionCount === 1 ? "session" : "sessions"}`
                        : "not found"}
                    </span>
                    <CopyButton value={p.rootDir} label="Copy path" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No agent directories found.</p>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
