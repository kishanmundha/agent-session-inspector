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
import { formatCost, formatDateTime, formatTokens, timeAgo } from "@/lib/format";
import type { ProjectSummary } from "@/lib/projects";
import { SUPPORTED_AGENTS, providerStyle } from "@/lib/provider-meta";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "sessions" | "cost" | "tokens" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "sessions", label: "Most sessions" },
  { value: "cost", label: "Highest cost" },
  { value: "tokens", label: "Most tokens" },
  { value: "name", label: "Name (A–Z)" },
];

const COLUMNS = ["Project", "Sessions", "Cost", "Input", "Output", "Tool calls", "Last active"];

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
        title="No projects yet"
        description={`Projects appear once a supported agent writes a transcript on this machine: ${SUPPORTED_AGENTS}.`}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search project or path…"
          aria-label="Search projects"
          className="w-full max-w-sm"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline" aria-hidden>
            Sort
          </span>
          <OptionSelect
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            aria-label="Sort projects"
          />
        </div>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {rows.length} of {projects.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No matching projects"
          description={`Nothing matches “${search}”. Try a folder name or part of its path.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-wider hover:bg-transparent">
                {COLUMNS.map((label, i) => (
                  <TableHead
                    key={label}
                    className={cn("text-muted-foreground", i > 0 && "text-right")}
                  >
                    {label}
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
                        {p.path ?? "location not recorded"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{p.sessions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCost(p.costUSD)}
                    {p.unpriced && "+"}
                  </TableCell>
                  <TableCell className="text-right">{tokens(p.inputTokens)}</TableCell>
                  <TableCell className="text-right">{tokens(p.outputTokens)}</TableCell>
                  <TableCell className="text-right">{p.toolCalls.toLocaleString()}</TableCell>
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
