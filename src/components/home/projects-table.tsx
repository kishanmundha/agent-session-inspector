"use client";

import { useMemo, useState } from "react";
import { FolderGit2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { OptionSelect } from "@/components/common/option-select";
import { SearchInput } from "@/components/common/search-input";
import { Skeleton } from "@/components/common/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCost, formatDateTime, formatNumber, formatTokens, timeAgo } from "@/lib/format";
import type { ProjectSummary } from "@/lib/projects";
import { providerStyle, supportedAgents } from "@/lib/provider-meta";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "sessions" | "cost" | "tokens" | "name";

const SORT_KEYS: SortKey[] = ["recent", "sessions", "cost", "tokens", "name"];

const COLUMNS = [
  "project",
  "sessions",
  "cost",
  "input",
  "output",
  "toolCalls",
  "lastActive",
] as const;

const tokens = (n: number) => formatTokens(n) ?? "0";

/** Every project with its all-time totals. Picking one filters the other tabs. */
export function ProjectsTable({
  projects,
  loading,
  selected,
  onSelect,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  /** The project the other tabs are filtered to, or "all". */
  selected: string;
  onSelect: (name: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? projects.filter(
          (p) => p.name.toLowerCase().includes(q) || p.path?.toLowerCase().includes(q),
        )
      : projects;

    // `projects` arrives most recent first, so "recent" needs no re-sort.
    if (sort === "recent") return matched;
    const sorted = [...matched];
    switch (sort) {
      case "sessions":
        return sorted.sort((a, b) => b.sessions - a.sessions);
      case "cost":
        return sorted.sort((a, b) => b.costUSD - a.costUSD);
      case "tokens":
        return sorted.sort(
          (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
        );
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [projects, search, sort]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderGit2}
        title={t("projects.emptyTitle")}
        description={t("projects.emptyDetail", { agents: supportedAgents(locale) })}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("projects.searchPlaceholder")}
          aria-label={t("projects.search")}
          className="w-full max-w-sm"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline" aria-hidden>
            {t("home.sort")}
          </span>
          <OptionSelect
            value={sort}
            onChange={setSort}
            options={SORT_KEYS.map((key) => ({ value: key, label: t(`projects.sort.${key}`) }))}
            aria-label={t("projects.sortLabel")}
          />
        </div>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {t("common.nOfTotal", { shown: rows.length, total: projects.length })}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={t("projects.noMatches")}
          description={t("projects.noMatchDetail", { query: search })}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              {t("common.clearSearch")}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                {COLUMNS.map((column, i) => (
                  <TableHead
                    key={column}
                    className={cn("text-muted-foreground", i > 0 && "text-right")}
                  >
                    {t(`projects.columns.${column}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {rows.map((p) => (
                <TableRow
                  key={p.name}
                  data-state={p.name === selected ? "selected" : undefined}
                >
                  <TableCell className="w-full max-w-0">
                    <button
                      type="button"
                      onClick={() => onSelect(p.name)}
                      className="block max-w-full truncate rounded-sm text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {p.name}
                    </button>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.providers.map((id) => (
                        <span
                          key={id}
                          className={cn("size-1.5 shrink-0 rounded-full", providerStyle(id).dotCls)}
                          title={providerStyle(id).shortLabel}
                        />
                      ))}
                      <span className="truncate font-mono" title={p.path}>
                        {p.path ?? t("projects.noLocation")}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(p.sessions)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCost(p.costUSD)}
                    {p.unpriced && "+"}
                  </TableCell>
                  <TableCell className="text-right">{tokens(p.inputTokens)}</TableCell>
                  <TableCell className="text-right">{tokens(p.outputTokens)}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.toolCalls)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger render={<span>{timeAgo(p.lastActive) || "—"}</span>} />
                      <TooltipContent>{formatDateTime(p.lastActive)}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
