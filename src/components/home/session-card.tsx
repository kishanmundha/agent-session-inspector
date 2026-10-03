"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  GitBranch,
  MessageSquare,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/common/grade-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  firstLine,
  formatCost,
  formatDateTime,
  formatTokens,
  timeAgo,
} from "@/lib/format";
import { OUTCOME_LABELS, SIGNAL_INFO } from "@/lib/health";
import { providerStyle } from "@/lib/provider-meta";
import { isRunning } from "@/lib/session-state";
import { cn } from "@/lib/utils";
import type { SessionMeta } from "@/components/session/types";

export type { SessionMeta };

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Zap;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5 opacity-70" aria-hidden />
      <span className="font-medium tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function SessionCard({ session: s }: { session: SessionMeta }) {
  // Prefer the AI-generated checkpoint title; fall back to the raw session name.
  const rawName = firstLine(s.name);
  const displayTitle = s.title ?? rawName;
  const subtitle = s.title ? rawName : undefined;
  const health = s.health;
  const input = s.totalInputTokens ?? 0;
  const output = s.totalOutputTokens ?? 0;
  const cost = s.estimatedCostUSD;
  const unpriced = s.unpricedModels ?? [];
  // A session that only used unpriced models has nothing worth showing.
  const showCost = cost != null && (cost > 0 || unpriced.length === 0);
  const hasStats =
    !!s.eventCount || !!s.toolCallCount || !!s.userMessageCount || input + output > 0 || !!health;
  const provider = providerStyle(s.provider);

  return (
    <Link
      href={`/sessions/${s.provider}/${s.id}`}
      className="group block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <article className="relative rounded-xl border border-border bg-card px-4 py-3 transition-all duration-150 hover:border-brand/40 hover:shadow-md hover:shadow-foreground/5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                provider.badgeCls,
              )}
            >
              <span className={cn("size-1.5 rounded-full", provider.dotCls)} aria-hidden />
              {provider.shortLabel}
            </span>
            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">
              {displayTitle ?? (
                <span className="font-normal italic text-muted-foreground">
                  Unnamed session
                </span>
              )}
            </h3>
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 break-words text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex flex-col items-end gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    isRunning(s.updated_at) ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                        running
                      </span>
                    ) : (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {timeAgo(s.updated_at)}
                      </span>
                    )
                  }
                />
                <TooltipContent>
                  Updated {formatDateTime(s.updated_at)}
                </TooltipContent>
              </Tooltip>
              {s.client_name && (
                <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
                  {s.client_name}
                </Badge>
              )}
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          </div>
        </div>

        {/* Where the work happened */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {s.repository && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-foreground/80">
                {s.repository}
              </span>
            </span>
          )}
          {s.branch && (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3 opacity-70" aria-hidden />
              <span className="font-mono">{s.branch}</span>
            </span>
          )}
          {!s.repository && s.cwd && (
            <span className="max-w-full truncate font-mono opacity-80">{s.cwd}</span>
          )}
        </div>

        {hasStats && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/70 pt-2.5">
            {!!s.userMessageCount && (
              <Stat icon={MessageSquare} value={s.userMessageCount} label="turns" />
            )}
            {!!s.toolCallCount && (
              <Stat icon={Wrench} value={s.toolCallCount} label="tools" />
            )}
            {!!s.eventCount && <Stat icon={Zap} value={s.eventCount} label="events" />}

            {(input + output > 0 || showCost || health) && (
              <div className="ml-auto flex items-center gap-1.5">
                {health && (
                  <Tooltip>
                    <TooltipTrigger
                      render={<GradeBadge grade={health.grade} className="h-[22px]" />}
                    />
                    <TooltipContent>
                      Health {health.score} · {OUTCOME_LABELS[health.outcome].toLowerCase()}
                      {health.signals
                        .filter((signal) => signal.id !== "outcome")
                        .map((signal) => ` · ${SIGNAL_INFO[signal.id].label.toLowerCase()}`)}
                    </TooltipContent>
                  </Tooltip>
                )}
                {showCost && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex items-center rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {formatCost(cost)}
                          {unpriced.length > 0 && "+"}
                        </span>
                      }
                    />
                    <TooltipContent>
                      Estimated cost at API list prices
                      {unpriced.length > 0 && ` · excludes ${unpriced.join(", ")}`}
                    </TooltipContent>
                  </Tooltip>
                )}
                {input > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                          <ArrowUpFromLine className="size-3" aria-hidden />
                          {formatTokens(input)}
                        </span>
                      }
                    />
                    <TooltipContent>
                      {input.toLocaleString()} input tokens
                    </TooltipContent>
                  </Tooltip>
                )}
                {output > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex items-center gap-1 rounded-sm border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
                          <ArrowDownToLine className="size-3" aria-hidden />
                          {formatTokens(output)}
                        </span>
                      }
                    />
                    <TooltipContent>
                      {output.toLocaleString()} output tokens
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </Link>
  );
}
