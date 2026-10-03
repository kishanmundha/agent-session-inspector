"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { GradeBadge } from "@/components/common/grade-badge";
import {
  GRADE_STYLES,
  OUTCOME_LABELS,
  OUTCOME_NOTES,
  SIGNAL_INFO,
  type HealthFocus,
} from "@/lib/health";
import { cn } from "@/lib/utils";
import type { SessionHealth } from "./types";

/** How the session's score was reached: each signal and the points it cost. */
export function HealthDialog({
  health,
  open,
  onOpenChange,
  onFocus,
}: {
  health: SessionHealth;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows the events behind a signal in the timeline. */
  onFocus?: (focus: HealthFocus) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Session health</DialogTitle>
        <DialogDescription>
          A rule-based score read straight off the transcript. It measures how
          smoothly the session ran, not whether the result was any good.
        </DialogDescription>

        <div className="flex items-center gap-4">
          <GradeBadge grade={health.grade} className="h-12 min-w-12 rounded-lg text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold leading-none tabular-nums">{health.score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              <span className="ml-auto text-xs font-medium">{OUTCOME_LABELS[health.outcome]}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", GRADE_STYLES[health.grade].bar)}
                style={{ width: `${health.score}%` }}
              />
            </div>
          </div>
        </div>

        {health.signals.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <p className="text-sm">
              Nothing went wrong. {OUTCOME_NOTES[health.outcome]}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {health.signals.map((signal) => {
              const info = SIGNAL_INFO[signal.id];
              return (
                <li key={signal.id} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {signal.id === "outcome" ? OUTCOME_LABELS[health.outcome] : info.label}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                      −{signal.penalty}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {info.describe(signal, health)} {info.advice}
                  </p>
                  {info.focus && onFocus && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        onOpenChange(false);
                        if (info.focus) onFocus(info.focus);
                      }}
                    >
                      View related events
                      <ArrowRight data-icon="inline-end" aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Every session starts at 100 and loses points for each signal above.
          90 and up is an A, 80 a B, 70 a C, 60 a D; anything lower is an F.
          {health.toolResults > 0 && health.toolFailures === 0 && (
            <> All {health.toolResults.toLocaleString()} tool results succeeded.</>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
