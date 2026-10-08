import { addDays, computeAnalytics, dayKey, startOfDay } from "@/lib/analytics";
import {
  firstLine,
  formatCost,
  formatCount,
  formatDuration,
  formatTokens,
  timeAgo,
} from "@/lib/format";
import { PROVIDER_STYLES } from "@/lib/provider-meta";
import { listAnalyticsSessions, listSessions } from "@/lib/providers";
import type { AnalyticsSession, SessionMeta } from "@/lib/providers/types";
import { rangeLabel, type Grouping, type Options } from "./args";
import { bar, bold, dim, facts, table } from "./table";

/** Token counts; the app's own format stops at millions, and totals here pass it. */
const tokens = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` : (formatTokens(n) ?? "0");
const agentLabel = (id: string) =>
  PROVIDER_STYLES[id as keyof typeof PROVIDER_STYLES]?.shortLabel ?? id;

const GROUP_HEADERS: Record<Grouping, string> = {
  day: "Date",
  week: "Week of",
  month: "Month",
  project: "Project",
  model: "Model",
  agent: "Agent",
};

/** First day of the range, epoch milliseconds; null for all time. */
function rangeStart(days: number | null, now = new Date()): number | null {
  return days === null ? null : addDays(startOfDay(now), 1 - days).getTime();
}

/** The project as the app names it, whatever case it was typed in. */
function resolveProject(wanted: string, names: Iterable<string>): string {
  if (wanted === "all") return wanted;
  const lower = wanted.toLowerCase();
  for (const name of names) if (name.toLowerCase() === lower) return name;
  return wanted;
}

function unpricedNote(models: string[]): string | null {
  if (models.length === 0) return null;
  const list = models.join(", ");
  return dim(
    `No price is known for ${list}, so cost leaves ${models.length === 1 ? "it" : "them"} out.`,
  );
}

/**
 * Version of the --json output. Adding a field keeps it; renaming or removing
 * one, or changing what a field means, raises it. The fields are listed in the
 * README.
 */
const SCHEMA_VERSION = 1;

function printJson(report: object) {
  console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...report }, null, 2));
}

function print(...blocks: (string | null)[]) {
  console.log(blocks.filter((b) => b !== null).join("\n\n"));
}

// ---------------------------------------------------------------- usage

interface UsageRow {
  key: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUSD: number;
}

const emptyRow = (key: string): UsageRow => ({
  key,
  sessions: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
  costUSD: 0,
});

/**
 * Token usage summed along one dimension. The filters match the Usage tab: the
 * model filter and the date range apply per slice, since a session can switch
 * models and run across days.
 */
function groupUsage(all: AnalyticsSession[], opts: Options) {
  const from = rangeStart(opts.days);
  const project = resolveProject(opts.project, all.map((s) => s.project));
  const rows = new Map<string, UsageRow>();
  // A session counts once towards each row it touched.
  const seen = new Set<string>();
  const total = emptyRow("Total");
  const unpriced = new Set<string>();

  for (const session of all) {
    if (opts.agent !== "all" && session.provider !== opts.agent) continue;
    if (project !== "all" && session.project !== project) continue;
    let counted = false;

    for (const slice of session.usage) {
      if (opts.model !== "all" && slice.model !== opts.model) continue;
      if (from !== null && slice.t < from) continue;
      const sum =
        slice.inputTokens + slice.outputTokens + slice.cacheReadTokens + slice.cacheWriteTokens;
      if (sum === 0) continue;
      if (slice.costUSD === null) unpriced.add(slice.model);

      const at = new Date(slice.t);
      const key = {
        day: () => dayKey(at),
        // Weeks start on Sunday, as they do in the app.
        week: () => dayKey(addDays(at, -at.getDay())),
        month: () => dayKey(at).slice(0, 7),
        project: () => session.project,
        model: () => slice.model,
        agent: () => session.provider,
      }[opts.by]();

      let row = rows.get(key);
      if (!row) rows.set(key, (row = emptyRow(key)));
      const mark = `${key}|${session.provider}|${session.id}`;
      if (!seen.has(mark)) {
        seen.add(mark);
        row.sessions++;
      }
      if (!counted) {
        counted = true;
        total.sessions++;
      }
      for (const target of [row, total]) {
        target.inputTokens += slice.inputTokens;
        target.outputTokens += slice.outputTokens;
        target.cacheReadTokens += slice.cacheReadTokens;
        target.cacheWriteTokens += slice.cacheWriteTokens;
        target.totalTokens += sum;
        target.costUSD += slice.costUSD ?? 0;
      }
    }
  }

  const dated = opts.by === "day" || opts.by === "week" || opts.by === "month";
  const list = [...rows.values()].sort((a, b) =>
    dated ? a.key.localeCompare(b.key) : b.costUSD - a.costUSD,
  );
  return { rows: list, total, unpricedModels: [...unpriced].sort() };
}

export function usageReport(opts: Options) {
  const { rows, total, unpricedModels } = groupUsage(listAnalyticsSessions(), opts);

  if (opts.json) {
    // The total row's label is for the table only.
    const totals = { ...total, key: undefined };
    printJson({ days: opts.days, by: opts.by, rows, total: totals, unpricedModels });
    return;
  }

  const heading = `${bold("Token usage")} ${dim(`· ${rangeLabel(opts.days)} · by ${opts.by}`)}`;
  if (rows.length === 0) {
    print(heading, "No usage in this range.");
    return;
  }

  const peak = Math.max(...rows.map((r) => r.costUSD));
  const cells = (row: UsageRow, name: string, chart: string) => [
    name,
    formatCount(row.sessions),
    tokens(row.inputTokens),
    tokens(row.outputTokens),
    tokens(row.cacheReadTokens),
    tokens(row.cacheWriteTokens),
    tokens(row.totalTokens),
    formatCost(row.costUSD),
    chart,
  ];
  print(
    heading,
    table(
      [
        { header: GROUP_HEADERS[opts.by], max: 40 },
        { header: "Sessions", align: "right" },
        { header: "Input", align: "right" },
        { header: "Output", align: "right" },
        { header: "Cache read", align: "right" },
        { header: "Cache write", align: "right" },
        { header: "Total", align: "right" },
        { header: "Est. cost", align: "right" },
        { header: "" },
      ],
      rows.map((row) =>
        cells(row, opts.by === "agent" ? agentLabel(row.key) : row.key, bar(row.costUSD, peak)),
      ),
      cells(total, "Total", ""),
    ),
    unpricedNote(unpricedModels),
  );
}

// ---------------------------------------------------------------- stats

export function statsReport(opts: Options) {
  const all = listAnalyticsSessions();
  const stats = computeAnalytics(all, {
    days: opts.days,
    provider: opts.agent,
    project: resolveProject(opts.project, all.map((s) => s.project)),
    model: opts.model,
  });
  const { totals, messagesPerSession: per } = stats;

  if (opts.json) {
    const { messagesPerSession, agents, projects, tools, skills, mcpServers, unpricedModels } =
      stats;
    printJson({
      days: opts.days,
      totals,
      messagesPerSession,
      agents,
      projects,
      tools,
      skills,
      mcpServers,
      unpricedModels,
    });
    return;
  }

  const heading = `${bold("Agent sessions")} ${dim(`· ${rangeLabel(opts.days)}`)}`;
  if (totals.sessions === 0) {
    print(heading, "No sessions in this range.");
    return;
  }

  const section = (title: string, total: number, shown: number, body: string) =>
    `${bold(title)}${total > shown ? dim(` · top ${shown} of ${total}`) : ""}\n${body}`;
  const projects = stats.projects.slice(0, opts.limit);
  const tools = stats.tools.slice(0, opts.limit);
  const topTool = tools[0]?.value ?? 0;

  print(
    heading,
    facts([
      ["Sessions", formatCount(totals.sessions)],
      ["Messages", formatCount(totals.messages)],
      ["Msgs / session", `${per.mean.toFixed(1)} (median ${per.median}, p90 ${per.p90})`],
      ["Tool calls", formatCount(totals.toolCalls)],
      ["Est. cost", formatCost(totals.costUSD)],
      ["Output tokens", tokens(totals.outputTokens)],
      ["Active time", formatDuration(totals.activeMs)],
      [
        "Active days",
        opts.days === null ? String(totals.activeDays) : `${totals.activeDays} of ${opts.days}`,
      ],
      ["Projects", formatCount(totals.projects)],
    ]),
    section(
      "By agent",
      0,
      0,
      table(
        [
          { header: "Agent" },
          { header: "Sessions", align: "right" },
          { header: "Messages", align: "right" },
          { header: "Tool calls", align: "right" },
          { header: "Output", align: "right" },
          { header: "Active", align: "right" },
          { header: "Est. cost", align: "right" },
          { header: "Top tools", max: 48 },
        ],
        stats.agents.map((a) => [
          agentLabel(a.provider),
          formatCount(a.sessions),
          formatCount(a.messages),
          formatCount(a.toolCalls),
          tokens(a.outputTokens),
          formatDuration(a.activeMs),
          formatCost(a.costUSD),
          a.topTools.join(", "),
        ]),
      ),
    ),
    section(
      "Projects",
      stats.projects.length,
      projects.length,
      table(
        [
          { header: "Project", max: 40 },
          { header: "Sessions", align: "right" },
          { header: "Messages", align: "right" },
          { header: "Est. cost", align: "right" },
        ],
        projects.map((p) => [
          p.name,
          formatCount(p.sessions),
          formatCount(p.messages),
          formatCost(p.costUSD),
        ]),
      ),
    ),
    tools.length > 0
      ? section(
          "Tools",
          stats.tools.length,
          tools.length,
          table(
            [{ header: "Tool", max: 48 }, { header: "Calls", align: "right" }, { header: "" }],
            tools.map((t) => [t.name, formatCount(t.value), bar(t.value, topTool)]),
          ),
        )
      : null,
    unpricedNote(stats.unpricedModels),
  );
}

// ---------------------------------------------------------------- sessions

const lastActive = (s: SessionMeta) => Date.parse(s.updated_at ?? s.created_at ?? "") || 0;

export function sessionsReport(opts: Options) {
  const all = listSessions();
  const from = rangeStart(opts.days);
  const project = resolveProject(opts.project, all.map((s) => s.project ?? ""));
  const matching = all.filter(
    (s) =>
      (opts.agent === "all" || s.provider === opts.agent) &&
      (project === "all" || s.project === project) &&
      (opts.model === "all" || s.model === opts.model) &&
      (from === null || lastActive(s) >= from),
  );
  // listSessions returns newest first.
  if (opts.sort === "cost") {
    matching.sort((a, b) => (b.estimatedCostUSD ?? 0) - (a.estimatedCostUSD ?? 0));
  }
  const shown = matching.slice(0, opts.limit);

  if (opts.json) {
    printJson({
      days: opts.days,
      sort: opts.sort,
      total: matching.length,
      sessions: shown.map((s) => ({
        agent: s.provider,
        id: s.id,
        title: s.title ?? firstLine(s.name) ?? null,
        project: s.project ?? null,
        model: s.model ?? null,
        createdAt: s.created_at ?? null,
        updatedAt: s.updated_at ?? null,
        userMessages: s.userMessageCount ?? 0,
        toolCalls: s.toolCallCount ?? 0,
        inputTokens: s.totalInputTokens ?? 0,
        outputTokens: s.totalOutputTokens ?? 0,
        estimatedCostUSD: s.estimatedCostUSD ?? null,
        health: s.health ? { score: s.health.score, grade: s.health.grade } : null,
      })),
    });
    return;
  }

  const order = opts.sort === "cost" ? "costliest first" : "newest first";
  const heading = `${bold("Sessions")} ${dim(`· ${rangeLabel(opts.days)} · ${order}`)}`;
  if (shown.length === 0) {
    print(heading, "No sessions in this range.");
    return;
  }
  print(
    heading,
    table(
      [
        { header: "Updated", align: "right" },
        { header: "Agent" },
        { header: "Project", max: 24 },
        { header: "Title", max: 44 },
        { header: "Turns", align: "right" },
        { header: "Tools", align: "right" },
        { header: "Output", align: "right" },
        { header: "Health" },
        { header: "Est. cost", align: "right" },
        { header: "ID" },
      ],
      shown.map((s) => [
        timeAgo(s.updated_at ?? s.created_at) || "—",
        agentLabel(s.provider),
        s.project ?? "—",
        s.title ?? firstLine(s.name) ?? "(untitled)",
        formatCount(s.userMessageCount ?? 0),
        formatCount(s.toolCallCount ?? 0),
        tokens(s.totalOutputTokens ?? 0),
        s.health ? `${s.health.grade} ${s.health.score}` : "—",
        s.estimatedCostUSD === undefined ? "—" : formatCost(s.estimatedCostUSD),
        s.id.slice(0, 8),
      ]),
    ),
    matching.length > shown.length
      ? dim(`${shown.length} of ${matching.length} sessions; --limit shows more.`)
      : null,
  );
}
