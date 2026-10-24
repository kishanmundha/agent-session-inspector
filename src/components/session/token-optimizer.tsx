"use client";

import {
  ArrowRight,
  CheckCircle2,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarList } from "@/components/common/bar-list";
import { ToolOutputTable } from "@/components/common/tool-output-table";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatTokens } from "@/lib/format";
import { CHARS_PER_TOKEN, toolLabel } from "@/lib/tool-names";
import { useT } from "@/i18n/client";
import type { SessionStats, TokenAnalysis, TokenHint } from "./types";

const SEVERITY = {
  high: {
    Icon: TriangleAlert,
    card: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    icon: "text-red-600 dark:text-red-400",
  },
  medium: {
    Icon: TriangleAlert,
    card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    icon: "text-amber-600 dark:text-amber-400",
  },
  low: {
    Icon: Info,
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

const SEVERITY_ORDER = ["high", "medium", "low"] as const;

export function TokenOptimizer({
  analysis,
  stats,
  eventTypeCounts,
  onFocusHint,
  onOpenEvent,
}: {
  analysis: TokenAnalysis;
  stats: SessionStats;
  eventTypeCounts: { name: string; value: number }[];
  onFocusHint: (focus: NonNullable<TokenHint["focus"]>) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const t = useT();
  const breakdown: { label: string; note?: string; chars: number; bar: string; text: string }[] = [
    {
      label: t("optimizer.systemContext"),
      note: t("optimizer.agentManaged"),
      chars: analysis.systemContextChars,
      bar: "bg-red-400 dark:bg-red-500",
      text: "text-red-700 dark:text-red-400",
    },
    {
      label: t("optimizer.toolResults"),
      chars: analysis.toolResultChars,
      bar: "bg-amber-400 dark:bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
    },
    {
      label: t("optimizer.assistantReplies"),
      chars: analysis.assistantChars,
      bar: "bg-sky-400 dark:bg-sky-500",
      text: "text-sky-700 dark:text-sky-400",
    },
  ];
  const totalChars = breakdown.reduce((sum, b) => sum + b.chars, 0);

  const sortedHints = SEVERITY_ORDER.flatMap((sev) =>
    analysis.hints.filter((h) => h.severity === sev),
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb className="size-4 text-brand" aria-hidden />
          {t("optimizer.hints")}
          {sortedHints.length > 0 && (
            <span className="rounded-sm bg-muted px-1.5 text-xs font-normal tabular-nums text-muted-foreground">
              {sortedHints.length}
            </span>
          )}
        </h2>

        {sortedHints.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-foreground">
              {t("optimizer.noIssues")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedHints.map((hint) => {
              const cfg = SEVERITY[hint.severity];
              return (
                <article
                  key={hint.id}
                  className={cn("rounded-xl border p-4", cfg.card)}
                >
                  <div className="flex items-start gap-3">
                    <cfg.Icon
                      className={cn("mt-0.5 size-4 shrink-0", cfg.icon)}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t(`hints.${hint.id}.category`)}
                        </span>
                        <span className="sr-only">{t(`optimizer.severity.${hint.severity}`)}</span>
                        {hint.saving && (
                          <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                            {t("optimizer.save", {
                              amount: t(`hints.savings.${hint.saving}`, hint.values),
                            })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {t(`hints.${hint.id}.title`, hint.values)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t(`hints.${hint.id}.description`, hint.values)}
                      </p>
                      {hint.focus && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => hint.focus && onFocusHint(hint.focus)}
                          className="mt-2.5"
                        >
                          {t("health.viewRelated")}
                          <ArrowRight data-icon="inline-end" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          {t("optimizer.breakdown")}
        </h2>

        {totalChars === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("optimizer.noContext")}
          </p>
        ) : (
          <>
            {/* Single stacked bar gives the at-a-glance split... */}
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {breakdown.map(({ label, chars, bar }) => (
                <div
                  key={label}
                  className={bar}
                  style={{ width: `${(chars / totalChars) * 100}%` }}
                />
              ))}
            </div>

            {/* ...the rows carry the exact numbers. */}
            <div className="space-y-2.5">
              {breakdown.map(({ label, note, chars, bar, text }) => {
                const pct = Math.round((chars / totalChars) * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2 sm:w-60">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", bar)}
                        aria-hidden
                      />
                      <span className="truncate text-xs text-foreground">
                        {label}
                        {note && (
                          <span className="ml-1 hidden text-muted-foreground sm:inline">
                            ({note})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-20 text-right font-mono text-xs font-semibold tabular-nums",
                        text,
                      )}
                    >
                      {t("optimizer.kChars", { amount: Math.round(chars / 1000) })}
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {formatPercent(pct / 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          {[
            {
              label: t("stats.outputTokens"),
              value:
                stats.totalOutputTokens > 0
                  ? `${formatNumber(Math.round(stats.totalOutputTokens / 100) / 10)}K`
                  : "—",
            },
            {
              label: t("usage.inputTokens"),
              value:
                stats.totalInputTokens > 0
                  ? `${formatNumber(Math.round(stats.totalInputTokens / 100) / 10)}K`
                  : t("optimizer.notAvailable"),
            },
            { label: t("optimizer.compactions"), value: formatNumber(analysis.compactionCount) },
            { label: t("optimizer.hookEvents"), value: formatNumber(analysis.hookEventCount) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-base font-bold tabular-nums text-foreground">
                {value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {analysis.toolOutput.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {t("toolOutput.title")}
          </h2>
          <ToolOutputTable rows={analysis.toolOutput} limit={10} />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("toolOutput.footnote")}
          </p>

          {analysis.largestResults.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-xs uppercase tracking-wider text-muted-foreground">
                {t("toolOutput.largestResults")}
              </h3>
              <ol className="divide-y divide-border">
                {analysis.largestResults.map((result) => {
                  const label = result.command
                    ? `${toolLabel(result.tool)} › ${result.command.signature}`
                    : toolLabel(result.tool);
                  return (
                  <li key={result.eventId}>
                    <button
                      type="button"
                      onClick={() => onOpenEvent(result.eventId)}
                      className="flex w-full items-center gap-3 py-1.5 text-left text-xs hover:bg-muted/50"
                      aria-label={t("toolOutput.openResult", { tool: label })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-foreground">{label}</span>
                        {result.command && (
                          <span
                            className="block truncate font-mono text-muted-foreground"
                            title={result.command.text}
                          >
                            {result.command.text}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t("toolOutput.tokensEstimate", {
                          amount: formatTokens(Math.round(result.chars / CHARS_PER_TOKEN)) ?? "0",
                        })}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("analytics.toolUsage")}
          </h3>
          <BarList
            items={analysis.topToolsByCount.map(({ name, count }) => ({
              name,
              value: count,
            }))}
            color="bg-chart-3"
            emptyLabel={t("optimizer.noToolCalls")}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("optimizer.eventTypes")}
          </h3>
          <BarList
            items={eventTypeCounts}
            color="bg-brand-2"
            limit={10}
            emptyLabel={t("optimizer.noEvents")}
          />
        </div>
      </section>
    </div>
  );
}
