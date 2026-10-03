"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Database,
  FolderGit2,
  GitBranch,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/common/copy-button";
import { StatCard, StatCardGrid } from "@/components/common/stat-card";
import { CostDialog } from "./cost-dialog";
import { HealthDialog } from "./health-dialog";
import {
  firstLine,
  formatCost,
  formatDuration,
  formatFullDateTime,
  timeAgo,
} from "@/lib/format";
import { OUTCOME_LABELS, healthSummary, type HealthFocus } from "@/lib/health";
import { providerStyle } from "@/lib/provider-meta";
import { resumeCommand } from "@/lib/session-state";
import { cn } from "@/lib/utils";
import type { CostSummary, SessionMeta, SessionStats } from "./types";

function tokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function SessionHeader({
  meta,
  stats,
  cost,
  activeMs,
  running = false,
  onFocusEvents,
}: {
  meta: SessionMeta;
  stats?: SessionStats;
  cost?: CostSummary;
  /** First-to-last event span. Real working time, unlike created→updated. */
  activeMs?: number | null;
  /** The agent wrote to the transcript in the last few minutes. */
  running?: boolean;
  /** Shows the events behind a health signal in the timeline. */
  onFocusEvents?: (focus: HealthFocus) => void;
}) {
  const rawName = firstLine(meta.name);
  const title = meta.title ?? rawName;
  const subtitle = meta.title ? rawName : undefined;

  const [costOpen, setCostOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const health = meta.health;

  const provider = providerStyle(meta.provider);
  const resume = resumeCommand(meta);
  const input = stats?.totalInputTokens ?? 0;
  const output = stats?.totalOutputTokens ?? 0;
  const cache = stats?.totalCacheReadTokens ?? 0;
  const total = input + output + cache;

  return (
    <div className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-foreground sm:text-xl">
              {title ?? (
                <span className="font-normal italic text-muted-foreground">
                  Unnamed session
                </span>
              )}
            </h1>
            {subtitle && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {meta.id}
              </span>
              <CopyButton value={meta.id} label="Copy session id" />
              {resume && (
                <CopyButton
                  value={resume}
                  label="Copy the command that resumes this session in a terminal"
                  icon={Terminal}
                  className="ml-1"
                >
                  Resume
                </CopyButton>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                Running
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                provider.badgeCls,
              )}
            >
              <span className={cn("size-1.5 rounded-full", provider.dotCls)} aria-hidden />
              {provider.label}
            </span>
            {meta.model && (
              <Badge variant="secondary" className="font-mono">
                {meta.model}
              </Badge>
            )}
            {meta.client_name && (
              <Badge variant="secondary">{meta.client_name}</Badge>
            )}
            {meta.host_type && <Badge variant="outline">{meta.host_type}</Badge>}
          </div>
        </div>

        {/* Context row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {meta.project && (
            <Link
              href={`/?tab=sessions&project=${encodeURIComponent(meta.project)}`}
              title={meta.projectPath}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <FolderGit2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate font-medium text-foreground/80">{meta.project}</span>
            </Link>
          )}
          {meta.repository && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Database className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate font-mono text-foreground/80">
                {meta.repository}
              </span>
            </span>
          )}
          {meta.branch && (
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="size-3.5 opacity-70" aria-hidden />
              <span className="font-mono">{meta.branch}</span>
            </span>
          )}
          {meta.created_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 opacity-70" aria-hidden />
              {formatFullDateTime(meta.created_at)}
            </span>
          )}
          {meta.updated_at && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 opacity-70" aria-hidden />
                    Updated {timeAgo(meta.updated_at)}
                  </span>
                }
              />
              <TooltipContent>{formatFullDateTime(meta.updated_at)}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {stats && (
          <div className="mt-4">
            <StatCardGrid>
              <StatCard
                label="Events"
                value={stats.eventCount.toLocaleString()}
                sub="recorded in session"
              />
              <StatCard
                label="Messages"
                value={(
                  stats.totalUserMessages + stats.totalAssistantMessages
                ).toLocaleString()}
                sub={`${stats.totalUserMessages} user · ${stats.totalAssistantMessages} assistant`}
              />
              <StatCard
                label="Tool calls"
                value={stats.totalToolCalls.toLocaleString()}
                sub="local + external"
              />
              <StatCard
                label="Total tokens"
                value={total > 0 ? tokens(total) : "—"}
                sub="in + out + cache"
                accent
              />
              {cost && (cost.inherited || cost.byModel.some((m) => m.costUSD !== null)) && (
                <StatCard
                  label="Est. cost"
                  value={`${formatCost(cost.totalUSD)}${cost.unpricedModels.length > 0 ? "+" : ""}`}
                  sub={
                    cost.unpricedModels.length > 0
                      ? `excludes ${cost.unpricedModels.join(", ")}`
                      : cost.inherited
                        ? `+ ${formatCost(cost.inherited.totalUSD)} inherited`
                        : "at API list prices"
                  }
                  onClick={() => setCostOpen(true)}
                />
              )}
              {health && (
                <StatCard
                  label="Health"
                  value={healthSummary(health)}
                  sub={
                    health.signals.length > 0
                      ? `${OUTCOME_LABELS[health.outcome].toLowerCase()} · ${health.signals.length} signal${health.signals.length === 1 ? "" : "s"}`
                      : OUTCOME_LABELS[health.outcome].toLowerCase()
                  }
                  onClick={() => setHealthOpen(true)}
                />
              )}
              {/* Only surface the token buckets the session actually reported —
                  empty "—" cards are noise. */}
              {input > 0 && (
                <StatCard label="Input tokens" value={tokens(input)} sub="fresh input" />
              )}
              {output > 0 && (
                <StatCard label="Output tokens" value={tokens(output)} sub="generated" />
              )}
              {cache > 0 && (
                <StatCard label="Cache reads" value={tokens(cache)} sub="reused context" />
              )}
              {stats.totalPremiumRequests > 0 && (
                <StatCard
                  label="Premium req"
                  value={stats.totalPremiumRequests.toLocaleString()}
                  sub="billed requests"
                />
              )}
              {stats.totalApiDurationMs > 0 && (
                <StatCard
                  label="API time"
                  value={formatDuration(stats.totalApiDurationMs)}
                  sub="waiting on the model"
                />
              )}
              {activeMs != null && activeMs > 0 && (
                <StatCard
                  label="Time span"
                  value={formatDuration(activeMs)}
                  sub="first to last event"
                />
              )}
            </StatCardGrid>
            {cost && (
              <CostDialog cost={cost} open={costOpen} onOpenChange={setCostOpen} />
            )}
            {health && (
              <HealthDialog
                health={health}
                open={healthOpen}
                onOpenChange={setHealthOpen}
                onFocus={onFocusEvents}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
