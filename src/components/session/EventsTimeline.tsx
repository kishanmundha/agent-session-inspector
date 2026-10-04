"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleX,
  Filter,
  Info,
  Link2,
  ListFilter,
  Radio,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/common/copy-button";
import { InputTokensIcon, OutputTokensIcon } from "@/components/common/token-icons";
import { SearchInput } from "@/components/common/search-input";
import { Segmented } from "@/components/common/segmented";
import { costTimeline, type CostTurn } from "@/lib/cost-timeline";
import { formatCost } from "@/lib/format";
import { useHotkeys } from "@/lib/use-hotkeys";
import { useQueryParam } from "@/lib/use-tab-param";
import { cn } from "@/lib/utils";

import type { AgentEvent } from "./types";

interface Props {
  events: AgentEvent[];
  focusRequest?: {
    nonce: number;
    categories?: string[];
    subKeys?: string[];
    search?: string;
    failures?: boolean;
  } | null;
  /** Event a copied link points at: scrolled to, opened and outlined. */
  targetEventId?: string;
  /** Following the session: the newest events stay in view as they arrive. */
  live?: boolean;
  onLiveChange?: (live: boolean) => void;
  /** The agent is still writing to this session. */
  running?: boolean;
}

// Per event type: display label plus light/dark-aware colour classes.
const EVENT_CONFIG: Record<string, {
  label: string;
  dotCls: string;      // circle dot
  typeCls: string;     // type label text color
}> = {
  "session.start": {
    label: "Session Start",
    dotCls: "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-700",
    typeCls: "text-emerald-700 dark:text-emerald-400",
  },
  "session.shutdown": {
    label: "Session Shutdown",
    dotCls: "bg-red-100 border-red-400 dark:bg-red-900/60 dark:border-red-700",
    typeCls: "text-red-700 dark:text-red-400",
  },
  "session.resume": {
    label: "Session Resume",
    dotCls: "bg-violet-100 border-violet-400 dark:bg-violet-900/60 dark:border-violet-700",
    typeCls: "text-violet-700 dark:text-violet-400",
  },
  "user.message": {
    label: "User Message",
    dotCls: "bg-violet-100 border-violet-400 dark:bg-violet-900/60 dark:border-violet-700",
    typeCls: "text-violet-700 dark:text-violet-400",
  },
  "assistant.message": {
    label: "Assistant",
    dotCls: "bg-sky-100 border-sky-400 dark:bg-sky-900/60 dark:border-sky-700",
    typeCls: "text-sky-700 dark:text-sky-400",
  },
  "assistant.turn_start": {
    label: "Turn Start",
    dotCls: "bg-cyan-100 border-cyan-400 dark:bg-cyan-900/60 dark:border-cyan-700",
    typeCls: "text-cyan-700 dark:text-cyan-400",
  },
  "assistant.turn_end": {
    label: "Turn End",
    dotCls: "bg-cyan-100 border-cyan-400 dark:bg-cyan-900/60 dark:border-cyan-700",
    typeCls: "text-cyan-700 dark:text-cyan-400",
  },
  "tool.execution_start": {
    label: "Tool Start",
    dotCls: "bg-amber-100 border-amber-400 dark:bg-amber-900/60 dark:border-amber-700",
    typeCls: "text-amber-700 dark:text-amber-400",
  },
  "tool.execution_complete": {
    label: "Tool Done",
    dotCls: "bg-amber-100 border-amber-400 dark:bg-amber-900/60 dark:border-amber-700",
    typeCls: "text-amber-700 dark:text-amber-400",
  },
  "external_tool.requested": {
    label: "External Tool Request",
    dotCls: "bg-lime-100 border-lime-400 dark:bg-lime-900/60 dark:border-lime-700",
    typeCls: "text-lime-700 dark:text-lime-400",
  },
  "external_tool.completed": {
    label: "External Tool Done",
    dotCls: "bg-lime-100 border-lime-400 dark:bg-lime-900/60 dark:border-lime-700",
    typeCls: "text-lime-700 dark:text-lime-400",
  },
  "permission.requested": {
    label: "Permission",
    dotCls: "bg-orange-100 border-orange-400 dark:bg-orange-900/60 dark:border-orange-700",
    typeCls: "text-orange-700 dark:text-orange-400",
  },
  "permission.completed": {
    label: "Permission Done",
    dotCls: "bg-orange-100 border-orange-400 dark:bg-orange-900/60 dark:border-orange-700",
    typeCls: "text-orange-700 dark:text-orange-400",
  },
  "hook.start": {
    label: "Hook Start",
    dotCls: "bg-cyan-100 border-cyan-400 dark:bg-cyan-900/60 dark:border-cyan-700",
    typeCls: "text-cyan-700 dark:text-cyan-400",
  },
  "hook.end": {
    label: "Hook End",
    dotCls: "bg-cyan-100 border-cyan-400 dark:bg-cyan-900/60 dark:border-cyan-700",
    typeCls: "text-cyan-700 dark:text-cyan-400",
  },
  "session.auto_mode_resolved": {
    label: "Auto Mode",
    dotCls: "bg-fuchsia-100 border-fuchsia-400 dark:bg-fuchsia-900/60 dark:border-fuchsia-700",
    typeCls: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  "session.binary_asset": {
    label: "Binary Asset",
    dotCls: "bg-rose-100 border-rose-400 dark:bg-rose-900/60 dark:border-rose-700",
    typeCls: "text-rose-700 dark:text-rose-400",
  },
  "session.usage_checkpoint": {
    label: "Usage Checkpoint",
    dotCls: "bg-teal-100 border-teal-400 dark:bg-teal-900/60 dark:border-teal-700",
    typeCls: "text-teal-700 dark:text-teal-400",
  },
  "subagent.deselected": {
    label: "Subagent Deselected",
    dotCls: "bg-slate-100 border-slate-400 dark:bg-slate-900/60 dark:border-slate-700",
    typeCls: "text-slate-700 dark:text-slate-400",
  },
  "session.model_change": {
    label: "Model Change",
    dotCls: "bg-violet-100 border-violet-400 dark:bg-violet-900/60 dark:border-violet-700",
    typeCls: "text-violet-700 dark:text-violet-400",
  },
  "session.compaction_start": {
    label: "Compaction Start",
    dotCls: "bg-violet-100 border-violet-400 dark:bg-violet-900/60 dark:border-violet-700",
    typeCls: "text-violet-700 dark:text-violet-400",
  },
  "session.compaction_complete": {
    label: "Compaction Complete",
    dotCls: "bg-purple-100 border-purple-400 dark:bg-purple-900/60 dark:border-purple-700",
    typeCls: "text-purple-700 dark:text-purple-400",
  },
  "system.message": {
    label: "System",
    dotCls: "bg-slate-100 border-slate-400 dark:bg-slate-900/60 dark:border-slate-700",
    typeCls: "text-slate-700 dark:text-slate-400",
  },
  // Types produced by the Claude Code and Codex adapters.
  "assistant.thinking": {
    label: "Thinking",
    dotCls: "bg-indigo-100 border-indigo-400 dark:bg-indigo-900/60 dark:border-indigo-700",
    typeCls: "text-indigo-700 dark:text-indigo-400",
  },
  "session.error": {
    label: "Error",
    dotCls: "bg-red-100 border-red-400 dark:bg-red-900/60 dark:border-red-700",
    typeCls: "text-red-700 dark:text-red-400",
  },
  "context.attachment": {
    label: "Attachment",
    dotCls: "bg-stone-100 border-stone-400 dark:bg-stone-900/60 dark:border-stone-700",
    typeCls: "text-stone-700 dark:text-stone-400",
  },
  "file.patch_applied": {
    label: "Patch Applied",
    dotCls: "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-700",
    typeCls: "text-emerald-700 dark:text-emerald-400",
  },
  "web.search": {
    label: "Web Search",
    dotCls: "bg-blue-100 border-blue-400 dark:bg-blue-900/60 dark:border-blue-700",
    typeCls: "text-blue-700 dark:text-blue-400",
  },
  "session.turn_context": {
    label: "Turn Context",
    dotCls: "bg-fuchsia-100 border-fuchsia-400 dark:bg-fuchsia-900/60 dark:border-fuchsia-700",
    typeCls: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  "session.world_state": {
    label: "World State",
    dotCls: "bg-fuchsia-100 border-fuchsia-400 dark:bg-fuchsia-900/60 dark:border-fuchsia-700",
    typeCls: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  "session.mode_change": {
    label: "Mode Change",
    dotCls: "bg-violet-100 border-violet-400 dark:bg-violet-900/60 dark:border-violet-700",
    typeCls: "text-violet-700 dark:text-violet-400",
  },
  "session.turn_aborted": {
    label: "Turn Aborted",
    dotCls: "bg-orange-100 border-orange-400 dark:bg-orange-900/60 dark:border-orange-700",
    typeCls: "text-orange-700 dark:text-orange-400",
  },
  "session.rollback": {
    label: "Rollback",
    dotCls: "bg-orange-100 border-orange-400 dark:bg-orange-900/60 dark:border-orange-700",
    typeCls: "text-orange-700 dark:text-orange-400",
  },
  "subagent.activity": {
    label: "Subagent",
    dotCls: "bg-zinc-100 border-zinc-400 dark:bg-zinc-900/60 dark:border-zinc-700",
    typeCls: "text-zinc-700 dark:text-zinc-400",
  },
  "session.plan_changed": {
    label: "Plan Changed",
    dotCls: "bg-fuchsia-100 border-fuchsia-400 dark:bg-fuchsia-900/60 dark:border-fuchsia-700",
    typeCls: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  "system.notification": {
    label: "Notification",
    dotCls: "bg-slate-100 border-slate-400 dark:bg-slate-900/60 dark:border-slate-700",
    typeCls: "text-slate-700 dark:text-slate-400",
  },
  "subagent.session_start": {
    label: "Subagent Start",
    dotCls: "bg-zinc-100 border-zinc-400 dark:bg-zinc-900/60 dark:border-zinc-700",
    typeCls: "text-zinc-700 dark:text-zinc-400",
  },
  "subagent.message": {
    label: "Subagent Message",
    dotCls: "bg-zinc-100 border-zinc-400 dark:bg-zinc-900/60 dark:border-zinc-700",
    typeCls: "text-zinc-700 dark:text-zinc-400",
  },
};

const DEFAULT_CONFIG = {
  label: "Event",
  dotCls: "bg-muted border-border",
  typeCls: "text-muted-foreground",
  chipCls: "border-border bg-muted text-muted-foreground",
};

const CATEGORY_VISUAL: Record<string, { dotCls: string; typeCls: string; chipCls: string }> = {
  session: {
    dotCls: "bg-fuchsia-100 border-fuchsia-400 dark:bg-fuchsia-900/60 dark:border-fuchsia-700",
    typeCls: "text-fuchsia-700 dark:text-fuchsia-400",
    chipCls: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
  },
  user: {
    dotCls: "bg-pink-100 border-pink-400 dark:bg-pink-900/60 dark:border-pink-700",
    typeCls: "text-pink-700 dark:text-pink-400",
    chipCls: "border-pink-300 bg-pink-100 text-pink-800 dark:border-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  },
  assistant: {
    dotCls: "bg-sky-100 border-sky-400 dark:bg-sky-900/60 dark:border-sky-700",
    typeCls: "text-sky-700 dark:text-sky-400",
    chipCls: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  },
  tool: {
    dotCls: "bg-amber-100 border-amber-400 dark:bg-amber-900/60 dark:border-amber-700",
    typeCls: "text-amber-700 dark:text-amber-400",
    chipCls: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  external_tool: {
    dotCls: "bg-lime-100 border-lime-400 dark:bg-lime-900/60 dark:border-lime-700",
    typeCls: "text-lime-700 dark:text-lime-400",
    chipCls: "border-lime-300 bg-lime-100 text-lime-800 dark:border-lime-800 dark:bg-lime-900/50 dark:text-lime-300",
  },
  permission: {
    dotCls: "bg-red-100 border-red-400 dark:bg-red-900/60 dark:border-red-700",
    typeCls: "text-red-700 dark:text-red-400",
    chipCls: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
  hook: {
    dotCls: "bg-teal-100 border-teal-400 dark:bg-teal-900/60 dark:border-teal-700",
    typeCls: "text-teal-700 dark:text-teal-400",
    chipCls: "border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  },
  system: {
    dotCls: "bg-slate-100 border-slate-400 dark:bg-slate-900/60 dark:border-slate-700",
    typeCls: "text-slate-700 dark:text-slate-400",
    chipCls: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
  },
  subagent: {
    dotCls: "bg-zinc-100 border-zinc-400 dark:bg-zinc-900/60 dark:border-zinc-700",
    typeCls: "text-zinc-700 dark:text-zinc-400",
    chipCls: "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300",
  },
  context: {
    dotCls: "bg-stone-100 border-stone-400 dark:bg-stone-900/60 dark:border-stone-700",
    typeCls: "text-stone-700 dark:text-stone-400",
    chipCls: "border-stone-300 bg-stone-100 text-stone-800 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-300",
  },
  file: {
    dotCls: "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-700",
    typeCls: "text-emerald-700 dark:text-emerald-400",
    chipCls: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  web: {
    dotCls: "bg-blue-100 border-blue-400 dark:bg-blue-900/60 dark:border-blue-700",
    typeCls: "text-blue-700 dark:text-blue-400",
    chipCls: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
};

/** Events rendered per page; the rest load on demand. */
const PAGE_SIZE = 150;

const EVENT_TYPE_HELP: Record<string, string> = {
  "session.start": "Session initialization event. Captures the runtime context and selected model when a session begins.",
  "session.resume": "Session resumed from previous state. Indicates context reload and continuation.",
  "session.shutdown": "Session end summary. Usually includes usage, token totals, premium requests, and API timing.",
  "session.auto_mode_resolved": "Auto-mode model selection result. Shows predicted task profile and chosen model settings.",
  "session.binary_asset": "Binary payload captured in the session (typically screenshots/images). Can consume significant context/storage.",
  "session.usage_checkpoint": "Interim usage accounting snapshot (AIU/premium usage/cache state) while session is active.",
  "session.model_change": "Model configuration switched during the session (model/effort/context tier).",
  "session.compaction_start": "Context compaction started. Conversation is being summarized/compressed to reduce token load.",
  "session.compaction_complete": "Compaction finished, with success/failure metadata and request identifiers.",
  "user.message": "User input message that drives the next assistant turn.",
  "assistant.message": "Assistant output message, optionally with model/tool-request and token metadata.",
  "assistant.turn_start": "Start of a single assistant reasoning/execution turn.",
  "assistant.turn_end": "End of the assistant turn after reasoning/tools/output.",
  "tool.execution_start": "A local tool invocation started with tool name and arguments.",
  "tool.execution_complete": "A local tool invocation completed with status and result payload.",
  "external_tool.requested": "Request sent to an external tool bridge/service.",
  "external_tool.completed": "External tool request lifecycle completed.",
  "permission.requested": "Runtime requested user permission for an action (e.g., file/system/network).",
  "permission.completed": "Permission flow resolved (approved/denied).",
  "hook.start": "Lifecycle hook execution started (for example, prompt submission hooks).",
  "hook.end": "Lifecycle hook execution completed with success/failure state.",
  "subagent.deselected": "Subagent focus was cleared and control returned to the main agent context.",
  "system.message": "System-level instruction/context block injected into the conversation runtime.",
  "assistant.thinking": "Extended reasoning the model produced before answering. Billed as output tokens.",
  "session.error": "API or transport error. Each retry re-sends the full request context.",
  "context.attachment": "Context the runtime injected automatically: file snapshots, reminders, tool or skill listings.",
  "file.patch_applied": "A patch the agent applied to the workspace, with the files it touched.",
  "web.search": "Web search issued by the model; results are added to the conversation context.",
  "session.turn_context": "Per-turn runtime configuration: model, effort, sandbox and approval policy.",
  "session.world_state": "Snapshot of the workspace the runtime handed to the model.",
  "session.mode_change": "Interaction or permission mode switched during the session.",
  "session.turn_aborted": "The turn was interrupted before it completed.",
  "session.rollback": "Conversation was rolled back by a number of turns.",
  "subagent.activity": "Activity reported by a subagent working under the main agent.",
  "subagent.message": "Message passed between agents.",
  "subagent.session_start": "A subagent thread started inside this session.",
  "session.plan_changed": "The agent created or updated its working plan.",
  "system.notification": "Runtime notification injected into the conversation, such as a background shell finishing.",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function durationMs(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function splitEventType(type: string) {
  const [category, ...rest] = type.split(".");
  return {
    category: category || "unknown",
    subCategory: rest.join(".") || "general",
  };
}

/** A tool result, or an applied patch, that reported failure. */
function eventFailed(event: AgentEvent | undefined): boolean {
  return (
    !!event &&
    event.data.success === false &&
    (CALL_END_TYPES.has(event.type) || event.type === "file.patch_applied")
  );
}

function eventHasTokenUsage(event: AgentEvent): boolean {
  const data = event.data as Record<string, unknown>;

  const directOutput = data.outputTokens;
  if (typeof directOutput === "number" && directOutput > 0) return true;

  const directInput = data.inputTokens;
  if (typeof directInput === "number" && directInput > 0) return true;

  const directCache = data.cacheReadTokens;
  if (typeof directCache === "number" && directCache > 0) return true;

  const tokenDetails = data.tokenDetails as Record<string, Record<string, number>> | undefined;
  if (tokenDetails) {
    const input = tokenDetails.input?.tokenCount ?? 0;
    const output = tokenDetails.output?.tokenCount ?? 0;
    const cacheRead = tokenDetails.cache_read?.tokenCount ?? 0;
    if (input > 0 || output > 0 || cacheRead > 0) return true;
  }

  return false;
}

function formatCompactNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function UserMessageCard({ data }: { data: Record<string, unknown> }) {
  const content = (data.content as string) || "";
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 300);
  const hasMore = content.length > 300;
  return (
    <div>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {expanded ? content : preview}{hasMore && !expanded && "..."}
      </div>
      {hasMore && (
        <Button variant="link" size="xs" onClick={() => setExpanded(!expanded)} className="h-auto px-0 font-normal text-violet-600 dark:text-violet-400 mt-1">
          {expanded ? "Show less" : `Show more (${content.length} chars)`}
        </Button>
      )}
    </div>
  );
}

function AssistantMessageCard({ data }: { data: Record<string, unknown> }) {
  const content = (data.content as string) || "";
  const toolRequests = (data.toolRequests as unknown[]) || [];
  const model = data.model as string;
  const outputTokens = data.outputTokens as number | undefined;
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 400);
  const hasMore = content.length > 400;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {model && (
          <Badge variant="secondary" className="text-xs font-mono">{model}</Badge>
        )}
        {outputTokens !== undefined && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 border border-violet-300 dark:bg-violet-950 dark:border-violet-800 rounded-full text-xs text-violet-700 dark:text-violet-300">
            <span className="opacity-60">out</span>
            <span className="font-semibold font-mono">{outputTokens.toLocaleString()}</span>
            <span className="opacity-60">tokens</span>
          </span>
        )}
      </div>
      {content && (
        <div>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {expanded ? content : preview}{hasMore && !expanded && "..."}
          </div>
          {hasMore && (
            <Button variant="link" size="xs" onClick={() => setExpanded(!expanded)} className="h-auto px-0 font-normal text-sky-600 dark:text-sky-400 mt-1">
              {expanded ? "Show less" : `Show more (${content.length} chars)`}
            </Button>
          )}
        </div>
      )}
      {toolRequests.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {toolRequests.map((tr: unknown, i) => {
            const tool = tr as Record<string, unknown>;
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 dark:bg-amber-900/50 dark:border-amber-800 rounded-sm text-xs text-amber-800 dark:text-amber-300 font-mono">
                🔧 {tool.name as string}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolExecutionCard({ data, type }: { data: Record<string, unknown>; type: string }) {
  const toolName = data.toolName as string;
  const args = data.arguments as Record<string, unknown>;
  const result = data.result as Record<string, unknown>;
  const success = data.success as boolean;
  const [showArgs, setShowArgs] = useState(false);
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">{toolName}</span>
        {type === "tool.execution_complete" && (
          <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${
            success
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400"
          }`}>
            {success ? "success" : "failed"}
          </span>
        )}
      </div>
      {args && Object.keys(args).length > 0 && (
        <div>
          <Button variant="link" size="xs" onClick={() => setShowArgs(!showArgs)} className="h-auto px-0 font-normal text-amber-600 dark:text-amber-500">
            {showArgs ? "▼" : "▶"} Arguments
          </Button>
          {showArgs && (
            <pre className="mt-1 p-2 bg-muted rounded-sm text-xs text-foreground overflow-auto max-h-48 font-mono border border-border">
              {JSON.stringify(args, null, 2)}
            </pre>
          )}
        </div>
      )}
      {result && (
        <div>
          <Button variant="link" size="xs" onClick={() => setShowResult(!showResult)} className="h-auto px-0 font-normal text-amber-600 dark:text-amber-500">
            {showResult ? "▼" : "▶"} Result
          </Button>
          {showResult && (
            <pre className="mt-1 p-2 bg-muted rounded-sm text-xs text-foreground overflow-auto max-h-48 font-mono border border-border">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SessionShutdownCard({ data }: { data: Record<string, unknown> }) {
  const tokenDetails = data.tokenDetails as Record<string, Record<string, number>> | undefined;
  const totalApiDurationMs = data.totalApiDurationMs as number | undefined;
  const totalPremiumRequests = data.totalPremiumRequests as number | undefined;
  const shutdownType = data.shutdownType as string | undefined;

  const inputTokens = tokenDetails?.input?.tokenCount;
  const outputTokens = tokenDetails?.output?.tokenCount;
  const cacheReadTokens = tokenDetails?.cache_read?.tokenCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {shutdownType && (
          <Badge variant="outline" className="text-xs">{shutdownType}</Badge>
        )}
        {totalPremiumRequests !== undefined && (
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{totalPremiumRequests}</span> premium req
          </span>
        )}
        {totalApiDurationMs !== undefined && (
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{(totalApiDurationMs / 1000).toFixed(1)}s</span> API
          </span>
        )}
      </div>
      {(inputTokens !== undefined || outputTokens !== undefined) && (
        <div className="flex items-center gap-2 flex-wrap">
          {inputTokens !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-100 border border-cyan-300 dark:bg-cyan-950 dark:border-cyan-800 rounded-full text-xs text-cyan-700 dark:text-cyan-300">
              <span className="opacity-60">in</span>
              <span className="font-semibold font-mono">{inputTokens.toLocaleString()}</span>
            </span>
          )}
          {outputTokens !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 border border-violet-300 dark:bg-violet-950 dark:border-violet-800 rounded-full text-xs text-violet-700 dark:text-violet-300">
              <span className="opacity-60">out</span>
              <span className="font-semibold font-mono">{outputTokens.toLocaleString()}</span>
            </span>
          )}
          {cacheReadTokens !== undefined && cacheReadTokens > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-100 border border-teal-300 dark:bg-teal-950 dark:border-teal-800 rounded-full text-xs text-teal-700 dark:text-teal-300">
              <span className="opacity-60">cache</span>
              <span className="font-semibold font-mono">{cacheReadTokens.toLocaleString()}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SystemMessageCard({ data }: { data: Record<string, unknown> }) {
  const role = data.role as string | undefined;
  const interactionId = data.interactionId as string | undefined;
  const content = (data.content as string) || "";
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 420);
  const hasMore = content.length > 420;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {role && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 font-mono">
            {role}
          </span>
        )}
        {interactionId && (
          <span className="text-xs text-muted-foreground font-mono">
            interaction: {interactionId}
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200/80 dark:border-slate-800/80 bg-background/70 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          System Prompt
        </p>
        <pre className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed overflow-auto max-h-72 font-mono">
          {expanded ? content : preview}
          {hasMore && !expanded && "..."}
        </pre>
      </div>

      {hasMore && (
        <Button
          variant="link"
          size="xs"
          onClick={() => setExpanded(!expanded)}
          className="h-auto px-0 font-normal text-slate-700 dark:text-slate-300"
        >
          {expanded ? "Show less" : `Show full system prompt (${content.length.toLocaleString()} chars)`}
        </Button>
      )}
    </div>
  );
}

function HookEventCard({ data, type }: { data: Record<string, unknown>; type: "hook.start" | "hook.end" }) {
  const hookType = data.hookType as string | undefined;
  const hookInvocationId = data.hookInvocationId as string | undefined;
  const success = data.success as boolean | undefined;
  const input = data.input as Record<string, unknown> | undefined;
  const prompt = input?.prompt as string | undefined;
  const [expanded, setExpanded] = useState(false);
  const preview = (prompt || "").slice(0, 300);
  const hasMore = (prompt || "").length > 300;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        {hookType && (
          <Badge variant="secondary" className="text-xs font-mono">
            {hookType}
          </Badge>
        )}
        {type === "hook.end" && success !== undefined && (
          <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium border ${
            success
              ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800"
          }`}>
            {success ? "success" : "failed"}
          </span>
        )}
        {hookInvocationId && (
          <span className="text-xs text-muted-foreground font-mono">
            {hookInvocationId}
          </span>
        )}
      </div>

      {type === "hook.start" && prompt && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Prompt Preview</p>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed overflow-auto max-h-44 font-mono">
            {expanded ? prompt : preview}
            {hasMore && !expanded && "..."}
          </pre>
          {hasMore && (
            <Button
              variant="link"
              size="xs"
              onClick={() => setExpanded(!expanded)}
              className="h-auto px-0 font-normal text-cyan-700 dark:text-cyan-300 mt-1"
            >
              {expanded ? "Show less" : `Show more (${prompt.length.toLocaleString()} chars)`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AutoModeResolvedCard({ data }: { data: Record<string, unknown> }) {
  const chosenModel = data.chosenModel as string | undefined;
  const reasoningBucket = data.reasoningBucket as string | undefined;
  const predictedLabel = data.predictedLabel as string | undefined;
  const confidence = data.confidence as number | undefined;
  const candidateModels = (data.candidateModels as unknown[]) || [];
  const categoryScores = data.categoryScores as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {chosenModel && (
          <Badge className="text-xs font-mono bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300 dark:bg-fuchsia-900/50 dark:text-fuchsia-300 dark:border-fuchsia-800">
            {chosenModel}
          </Badge>
        )}
        {reasoningBucket && (
          <Badge variant="outline" className="text-xs font-mono">
            reasoning: {reasoningBucket}
          </Badge>
        )}
        {predictedLabel && (
          <span className="text-xs text-muted-foreground">
            label: <span className="font-mono text-foreground">{predictedLabel}</span>
          </span>
        )}
        {typeof confidence === "number" && (
          <span className="text-xs text-muted-foreground">
            confidence: <span className="font-mono text-foreground">{Math.round(confidence * 100)}%</span>
          </span>
        )}
      </div>

      {candidateModels.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Candidate Models</p>
          <div className="flex flex-wrap gap-1.5">
            {candidateModels.slice(0, 8).map((candidate, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-sm border border-fuchsia-300 bg-fuchsia-100/70 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 text-xs font-mono"
              >
                {String(candidate)}
              </span>
            ))}
          </div>
        </div>
      )}

      {categoryScores && Object.keys(categoryScores).length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Category Scores</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Object.entries(categoryScores).slice(0, 6).map(([name, value]) => (
              <div
                key={name}
                className="text-xs border border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-900/80 dark:bg-fuchsia-950/25 rounded-sm px-2 py-1 flex items-center justify-between gap-2"
              >
                <span className="text-muted-foreground">{name}</span>
                <span className="font-mono text-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExternalToolCard({ data, type }: { data: Record<string, unknown>; type: "external_tool.requested" | "external_tool.completed" }) {
  const requestId = data.requestId as string | undefined;
  const toolName = data.toolName as string | undefined;
  const toolCallId = data.toolCallId as string | undefined;
  const workingDirectory = data.workingDirectory as string | undefined;
  const argumentsObj = data.arguments as Record<string, unknown> | undefined;
  const [showArgs, setShowArgs] = useState(false);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
          type === "external_tool.requested"
            ? "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/60 dark:text-lime-300 dark:border-lime-800"
            : "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800"
        }`}>
          {type === "external_tool.requested" ? "requested" : "completed"}
        </span>
        {toolName && (
          <Badge variant="secondary" className="text-xs font-mono">
            {toolName}
          </Badge>
        )}
        {toolCallId && (
          <span className="text-xs text-muted-foreground font-mono">
            {toolCallId}
          </span>
        )}
      </div>

      {requestId && (
        <div className="text-xs text-muted-foreground font-mono">
          request: {requestId}
        </div>
      )}

      {type === "external_tool.requested" && workingDirectory && (
        <div className="text-xs text-muted-foreground">
          cwd: <span className="font-mono text-foreground break-all">{workingDirectory}</span>
        </div>
      )}

      {type === "external_tool.requested" && argumentsObj && Object.keys(argumentsObj).length > 0 && (
        <div>
          <Button variant="link" size="xs" onClick={() => setShowArgs(!showArgs)} className="h-auto px-0 font-normal text-lime-700 dark:text-lime-400">
            {showArgs ? "▼" : "▶"} Arguments
          </Button>
          {showArgs && (
            <pre className="mt-1 p-2 bg-background/70 rounded-sm text-xs text-foreground overflow-auto max-h-40 font-mono border border-lime-200 dark:border-lime-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {JSON.stringify(argumentsObj, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SessionBinaryAssetCard({ data }: { data: Record<string, unknown> }) {
  const assetId = data.assetId as string | undefined;
  const assetType = data.type as string | undefined;
  const mimeType = data.mimeType as string | undefined;
  const byteLength = data.byteLength as number | undefined;
  const rawData = data.data as string | undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {assetType && <Badge variant="secondary" className="text-xs font-mono">{assetType}</Badge>}
        {mimeType && <span className="text-xs text-muted-foreground font-mono">{mimeType}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {byteLength !== undefined && (
          <div className="rounded-sm border border-rose-200 dark:border-rose-900 px-2 py-1 bg-rose-100/60 dark:bg-rose-950/25">
            size: <span className="font-mono text-foreground">{byteLength.toLocaleString()} bytes</span>
          </div>
        )}
        {rawData && (
          <div className="rounded-sm border border-rose-200 dark:border-rose-900 px-2 py-1 bg-rose-100/60 dark:bg-rose-950/25">
            payload: <span className="font-mono text-foreground">{rawData.length.toLocaleString()} chars</span>
          </div>
        )}
      </div>
      {assetId && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          asset: {assetId}
        </div>
      )}
    </div>
  );
}

function UsageCheckpointCard({ data }: { data: Record<string, unknown> }) {
  const usage = data.usage as Record<string, number> | undefined;
  const contextWindow = data.contextWindow as number | undefined;
  const totalNanoAiu = data.totalNanoAiu as number | undefined;
  const totalPremiumRequests = data.totalPremiumRequests as number | undefined;
  const modelCacheState = data.modelCacheState as unknown[] | undefined;
  const aiu = typeof totalNanoAiu === "number" ? totalNanoAiu / 1_000_000_000 : undefined;

  return (
    <div className="space-y-2">
      {usage && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            ["in", usage.inputTokens],
            ["cached", usage.cachedInputTokens],
            ["out", usage.outputTokens],
            ["reasoning", usage.reasoningTokens],
          ]
            .filter(([, value]) => typeof value === "number" && value > 0)
            .map(([label, value]) => (
              <span
                key={label as string}
                className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300"
              >
                <span className="opacity-60">{label}</span>
                <span className="font-mono font-semibold">
                  {formatCompactNumber(value as number)}
                </span>
              </span>
            ))}
          {contextWindow && (
            <span className="text-muted-foreground">
              window {formatCompactNumber(contextWindow)}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {aiu !== undefined && (
          <div className="rounded-sm border border-teal-200 dark:border-teal-900 px-2 py-1 bg-teal-100/60 dark:bg-teal-950/25">
            total AIU: <span className="font-mono text-foreground">{formatCompactNumber(aiu)}</span>
          </div>
        )}
        {totalPremiumRequests !== undefined && (
          <div className="rounded-sm border border-teal-200 dark:border-teal-900 px-2 py-1 bg-teal-100/60 dark:bg-teal-950/25">
            premium req: <span className="font-mono text-foreground">{totalPremiumRequests}</span>
          </div>
        )}
      </div>
      {modelCacheState && (
        <div className="text-xs text-muted-foreground">
          cache state entries: <span className="font-mono text-foreground">{modelCacheState.length}</span>
        </div>
      )}
    </div>
  );
}

function ModelChangeCard({ data }: { data: Record<string, unknown> }) {
  const previousModel = data.previousModel as string | undefined;
  const newModel = data.newModel as string | undefined;
  const reasoningEffort = data.reasoningEffort as string | null | undefined;
  const contextTier = data.contextTier as string | null | undefined;

  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground">
        <span className="font-mono">{previousModel || "unknown"}</span>
        <span className="mx-2 text-muted-foreground">→</span>
        <span className="font-mono font-semibold">{newModel || "unknown"}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="px-2 py-0.5 rounded-sm border border-violet-200 dark:border-violet-900 bg-violet-100/60 dark:bg-violet-950/25 text-muted-foreground">
          effort: <span className="font-mono text-foreground">{reasoningEffort ?? "default"}</span>
        </span>
        <span className="px-2 py-0.5 rounded-sm border border-violet-200 dark:border-violet-900 bg-violet-100/60 dark:bg-violet-950/25 text-muted-foreground">
          context: <span className="font-mono text-foreground">{contextTier ?? "default"}</span>
        </span>
      </div>
    </div>
  );
}

function CompactionStartCard({ data }: { data: Record<string, unknown> }) {
  const model = data.model as string | undefined;
  const systemTokens = data.systemTokens as number | undefined;
  const conversationTokens = data.conversationTokens as number | undefined;
  const toolDefinitionsTokens = data.toolDefinitionsTokens as number | undefined;
  const total = [systemTokens, conversationTokens, toolDefinitionsTokens]
    .filter((v): v is number => typeof v === "number")
    .reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {model && <Badge variant="secondary" className="text-xs font-mono">{model}</Badge>}
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            total: <span className="font-mono text-foreground">{formatCompactNumber(total)}</span> tokens
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
        {systemTokens !== undefined && (
          <div className="rounded-sm border border-violet-200 dark:border-violet-900 px-2 py-1 bg-violet-100/60 dark:bg-violet-950/25">
            system: <span className="font-mono text-foreground">{formatCompactNumber(systemTokens)}</span>
          </div>
        )}
        {conversationTokens !== undefined && (
          <div className="rounded-sm border border-violet-200 dark:border-violet-900 px-2 py-1 bg-violet-100/60 dark:bg-violet-950/25">
            convo: <span className="font-mono text-foreground">{formatCompactNumber(conversationTokens)}</span>
          </div>
        )}
        {toolDefinitionsTokens !== undefined && (
          <div className="rounded-sm border border-violet-200 dark:border-violet-900 px-2 py-1 bg-violet-100/60 dark:bg-violet-950/25">
            tools: <span className="font-mono text-foreground">{formatCompactNumber(toolDefinitionsTokens)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactionCompleteCard({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean | undefined;
  const error = data.error as string | undefined;
  const statusCode = data.statusCode as number | undefined;
  const requestId = data.requestId as string | undefined;
  const serviceRequestId = data.serviceRequestId as string | undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
          success
            ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800"
        }`}>
          {success ? "success" : "failed"}
        </span>
        {statusCode !== undefined && (
          <span className="text-xs text-muted-foreground">
            status: <span className="font-mono text-foreground">{statusCode}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 dark:text-red-300 bg-red-100/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-sm px-2 py-1.5 font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {error}
        </div>
      )}

      {requestId && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          requestId: {requestId}
        </div>
      )}
      {serviceRequestId && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          serviceRequestId: {serviceRequestId}
        </div>
      )}
    </div>
  );
}

function SubagentDeselectedCard() {
  return (
    <div className="text-xs text-muted-foreground">
      Active subagent context was cleared and focus returned to the main agent.
    </div>
  );
}

function AssistantTurnCard({ data, type }: { data: Record<string, unknown>; type: "assistant.turn_start" | "assistant.turn_end" }) {
  const model = data.model as string | undefined;
  const turnId = data.turnId as number | string | undefined;
  const interactionId = data.interactionId as string | undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
          type === "assistant.turn_start"
            ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700"
        }`}>
          {type === "assistant.turn_start" ? "turn started" : "turn finished"}
        </span>
        {turnId !== undefined && (
          <span className="text-xs text-muted-foreground">
            turn: <span className="font-mono text-foreground">{String(turnId)}</span>
          </span>
        )}
        {model && (
          <Badge variant="secondary" className="text-xs font-mono">
            {model}
          </Badge>
        )}
      </div>
      {interactionId && (
        <div className="text-xs text-muted-foreground font-mono">
          interaction: {interactionId}
        </div>
      )}
    </div>
  );
}

function ThinkingCard({ data }: { data: Record<string, unknown> }) {
  const content = (data.content as string) || "";
  const charLength = (data.charLength as number) ?? content.length;
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 400);
  const hasMore = content.length > 400;

  if (!content) {
    return (
      <p className="text-xs text-muted-foreground">
        Reasoning was recorded but its content is encrypted in the transcript.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Reasoning · {charLength.toLocaleString()} chars
      </p>
      <div className="text-sm italic leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {expanded ? content : preview}
        {hasMore && !expanded && "…"}
      </div>
      {hasMore && (
        <Button
          variant="link"
          size="xs"
          onClick={() => setExpanded(!expanded)}
          className="h-auto px-0 font-normal text-indigo-600 dark:text-indigo-400"
        >
          {expanded ? "Show less" : `Show more (${charLength.toLocaleString()} chars)`}
        </Button>
      )}
    </div>
  );
}

function ErrorCard({ data }: { data: Record<string, unknown> }) {
  const message = (data.message as string) || "Error";
  const detail = data.detail as string | undefined;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {detail && detail !== message && (
        <p className="text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

/** Chip list that stays scannable when a delta adds a hundred tool names. */
function NameChips({ items, label }: { items: string[]; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, 12);

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {items.length} {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {visible.map((item) => (
          <span
            key={item}
            className="max-w-full truncate rounded-sm border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
            title={item}
          >
            {item}
          </span>
        ))}
        {!expanded && items.length > visible.length && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setExpanded(true)}
            className="text-[11px] font-normal text-muted-foreground"
          >
            +{items.length - visible.length} more
          </Button>
        )}
      </div>
    </div>
  );
}

/** Body text that starts clipped; used by the context-heavy cards. */
function ExpandableText({
  text,
  charLength,
  limit = 400,
  mono = true,
  accentCls = "text-muted-foreground",
}: {
  text: string;
  charLength?: number;
  limit?: number;
  mono?: boolean;
  accentCls?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const hasMore = text.length > limit;
  const total = charLength ?? text.length;

  return (
    <div className="space-y-1">
      <pre
        className={cn(
          "max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80",
          mono && "font-mono",
        )}
      >
        {expanded ? text : text.slice(0, limit)}
        {!expanded && hasMore && "…"}
      </pre>
      {hasMore && (
        <Button
          variant="link"
          size="xs"
          onClick={() => setExpanded(!expanded)}
          className={cn("h-auto px-0 font-normal", accentCls)}
        >
          {expanded ? "Show less" : `Show more (${total.toLocaleString()} chars)`}
        </Button>
      )}
    </div>
  );
}

function AttachmentCard({ data }: { data: Record<string, unknown> }) {
  const attachmentType = (data.attachmentType as string) || "attachment";
  const label = (data.label as string) || attachmentType;
  const subject = data.subject as string | undefined;
  const items = (data.items as string[]) ?? [];
  const itemsLabel = data.itemsLabel as string | undefined;
  const charLength = (data.charLength as number) ?? 0;
  const content = (data.content as string) || "";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {label}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {attachmentType}
        </span>
        {charLength > 0 && (
          <span className="text-xs text-muted-foreground">
            ~{Math.round(charLength / 4).toLocaleString()} tokens
          </span>
        )}
      </div>

      {subject && (
        <p className="break-all font-mono text-xs text-foreground/80">{subject}</p>
      )}

      <NameChips items={items} label={itemsLabel} />

      <ExpandableText
        text={content}
        charLength={charLength}
        accentCls="text-stone-600 dark:text-stone-400"
      />
    </div>
  );
}

function PatchAppliedCard({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean | undefined;
  const changes = (data.changes as { file: string; type: string }[]) || [];
  const stdout = (data.stdout as string) || "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
            success === false
              ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400"
          }`}
        >
          {success === false ? "failed" : "applied"}
        </span>
        <span className="text-xs text-muted-foreground">
          {changes.length} file{changes.length === 1 ? "" : "s"}
        </span>
      </div>
      {changes.length > 0 && (
        <ul className="space-y-1">
          {changes.slice(0, 12).map((change) => (
            <li key={change.file} className="flex items-center gap-2 text-xs">
              <span className="rounded-sm border border-emerald-300 bg-emerald-100/70 px-1 font-mono text-[10px] uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {change.type}
              </span>
              <span className="truncate font-mono text-foreground/80" title={change.file}>
                {change.file}
              </span>
            </li>
          ))}
        </ul>
      )}
      {stdout && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
          {stdout}
        </pre>
      )}
    </div>
  );
}

function WebSearchCard({ data }: { data: Record<string, unknown> }) {
  const query = (data.query as string) || "";
  const resultCount = data.resultCount as number | undefined;
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-foreground">{query}</p>
      {resultCount !== undefined && (
        <p className="text-xs text-muted-foreground">
          {resultCount} result{resultCount === 1 ? "" : "s"} returned
        </p>
      )}
    </div>
  );
}

/** Small labelled facts, used by the runtime-state cards. */
function FactGrid({ facts }: { facts: [string, unknown][] }) {
  const shown = facts.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {shown.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-2 rounded-sm border border-border bg-muted/40 px-2 py-1 text-xs"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="min-w-0 truncate font-mono text-foreground" title={String(value)}>
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModeChangeCard({ data }: { data: Record<string, unknown> }) {
  const mode = (data.mode as string) || "unknown";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Mode set to</span>
      <Badge variant="secondary" className="font-mono">
        {mode}
      </Badge>
    </div>
  );
}

function TurnContextCard({ data }: { data: Record<string, unknown> }) {
  const sandbox = data.sandboxPolicy as Record<string, unknown> | undefined;
  const approval = data.approvalPolicy as Record<string, unknown> | undefined;
  const writableRoots = (sandbox?.writable_roots as string[]) ?? [];

  return (
    <div className="space-y-2">
      <FactGrid
        facts={[
          ["model", data.model],
          ["effort", data.effort],
          ["personality", data.personality],
          ["sandbox", sandbox?.type],
          ["network", sandbox?.network_access === true ? "enabled" : "restricted"],
          ["approval", approval ? Object.keys(approval)[0] : undefined],
          ["cwd", data.cwd],
        ]}
      />
      {writableRoots.length > 0 && (
        <NameChips items={writableRoots} label="writable roots" />
      )}
    </div>
  );
}

function WorldStateCard({ data }: { data: Record<string, unknown> }) {
  const sections = (data.sections as string[]) ?? [];
  const content = (data.content as string) || "";
  const charLength = (data.charLength as number) ?? 0;

  return (
    <div className="space-y-2.5">
      <FactGrid
        facts={[
          ["cwd", data.cwd],
          ["shell", data.shell],
          ["date", data.currentDate],
          ["timezone", data.timezone],
          ["snapshot", data.full === true ? "full" : "delta"],
          ["size", charLength ? `${charLength.toLocaleString()} chars` : undefined],
        ]}
      />
      <NameChips items={sections} label="state sections" />
      <ExpandableText text={content} charLength={charLength} />
    </div>
  );
}

function SubagentCard({ data, type }: { data: Record<string, unknown>; type: string }) {
  if (type === "subagent.session_start") {
    return (
      <FactGrid
        facts={[
          ["agent", data.agentNickname],
          ["path", data.agentPath],
          ["thread", data.sessionId],
          ["parent", data.parentThreadId],
          ["cwd", data.cwd],
        ]}
      />
    );
  }
  if (type === "subagent.activity") {
    return (
      <FactGrid
        facts={[
          ["activity", data.kind],
          ["path", data.agentPath],
          ["thread", data.agentThreadId],
        ]}
      />
    );
  }
  return <GenericDataCard data={data} />;
}

function TurnAbortedCard({ data }: { data: Record<string, unknown> }) {
  const durationMs = data.durationMs as number | undefined;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-sm bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800 dark:bg-orange-900/60 dark:text-orange-300">
        {(data.reason as string) ?? "aborted"}
      </span>
      {durationMs !== undefined && (
        <span className="text-muted-foreground">
          after{" "}
          <span className="font-mono text-foreground">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        </span>
      )}
      {data.turnId !== undefined && (
        <span className="font-mono text-muted-foreground">turn {String(data.turnId)}</span>
      )}
    </div>
  );
}

function RollbackCard({ data }: { data: Record<string, unknown> }) {
  const turns = data.turns as number | undefined;
  return (
    <p className="text-sm text-foreground">
      Conversation rolled back{" "}
      <span className="font-semibold">{turns ?? "?"}</span> turn
      {turns === 1 ? "" : "s"}.
    </p>
  );
}

function PlanChangedCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Plan</span>
      <Badge variant="secondary" className="font-mono">
        {(data.operation as string) ?? "changed"}
      </Badge>
    </div>
  );
}

function NotificationCard({ data }: { data: Record<string, unknown> }) {
  const kind = data.kind as Record<string, unknown> | undefined;
  const content = (data.content as string) || "";
  return (
    <div className="space-y-2">
      <FactGrid
        facts={[
          ["kind", kind?.type],
          ["shell", kind?.shellId],
          ["exit code", kind?.exitCode],
          ["description", kind?.description],
        ]}
      />
      <ExpandableText text={content} mono={false} />
    </div>
  );
}

function GenericDataCard({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const preview = json.slice(0, 300);
  const hasMore = json.length > 300;
  return (
    <div>
      <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
        {expanded ? json : preview}{hasMore && !expanded && "..."}
      </pre>
      {hasMore && (
        <Button variant="link" size="xs" onClick={() => setExpanded(!expanded)} className="h-auto px-0 font-normal text-muted-foreground hover:text-foreground mt-1">
          {expanded ? "Collapse" : "Expand"}
        </Button>
      )}
    </div>
  );
}

/** Collapse whitespace and clip to a single scannable line. */
function shorten(value: unknown, max = 150) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** The argument most worth showing for a tool call, mirroring the CLI's own bias. */
function firstArg(input?: Record<string, unknown>) {
  if (!input) return "";
  for (const key of [
    "command",
    "cmd",
    "input",
    "script",
    "filePath",
    "file_path",
    "notebook_path",
    "path",
    "pattern",
    "query",
    "description",
    "url",
    "prompt",
  ]) {
    if (input[key]) return `${key}: ${shorten(input[key], 90)}`;
  }
  const keys = Object.keys(input);
  return keys.length ? shorten(JSON.stringify(input), 90) : "(no args)";
}

/** Lines in a block of text; a trailing newline does not start another one. */
const lineCount = (text: unknown) =>
  typeof text === "string" && text.length > 0
    ? text.replace(/\n$/, "").split("\n").length
    : 0;

/**
 * Lines a file-writing tool call adds and removes, read from its arguments.
 * Covers the write/edit tools of all three CLIs; null for anything else.
 */
function lineDelta(input?: Record<string, unknown>): { added: number; removed: number } | null {
  if (!input) return null;
  const patch = [input.input, input.patch, input.command].find(
    (v): v is string => typeof v === "string" && v.includes("*** Begin Patch"),
  );
  if (patch) {
    let added = 0;
    let removed = 0;
    for (const line of patch.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
      else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
    }
    return { added, removed };
  }
  const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : [input];
  let added = 0;
  let removed = 0;
  let found = false;
  for (const edit of edits) {
    const next = edit.new_string ?? edit.new_str ?? edit.content ?? edit.file_text;
    const prev = edit.old_string ?? edit.old_str;
    if (typeof next !== "string" && typeof prev !== "string") continue;
    found = true;
    added += lineCount(next);
    removed += lineCount(prev);
  }
  return found ? { added, removed } : null;
}

/**
 * One-line description of an event, so the timeline can stay collapsed by
 * default and still be readable at a glance.
 */
function eventSummary(event: AgentEvent): {
  label: string;
  preview: string;
  delta?: { added: number; removed: number } | null;
} {
  const d = event.data;
  const fallback = EVENT_CONFIG[event.type]?.label ?? splitEventType(event.type).subCategory;

  switch (event.type) {
    case "user.message":
      return { label: "User", preview: shorten(d.content) };
    case "assistant.message": {
      const toolRequests = (d.toolRequests as { name?: string }[]) ?? [];
      const content = shorten(d.content);
      if (content) return { label: "Assistant", preview: content };
      if (toolRequests.length) {
        return {
          label: "Assistant",
          preview: `requests ${toolRequests.map((t) => t.name).filter(Boolean).join(", ")}`,
        };
      }
      return { label: "Assistant", preview: "(no text)" };
    }
    case "assistant.turn_start":
    case "assistant.turn_end": {
      const turn = d.turnId;
      return {
        label: event.type === "assistant.turn_start" ? "Turn start" : "Turn end",
        preview: [turn !== undefined ? `turn ${turn}` : "", d.model as string]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "tool.execution_start":
      return {
        label: (d.toolName as string) || "Tool",
        preview: firstArg(d.arguments as Record<string, unknown> | undefined),
        delta: lineDelta(d.arguments as Record<string, unknown> | undefined),
      };
    case "tool.execution_complete":
      return {
        label: (d.toolName as string) || "Tool",
        preview: d.success === false ? "failed" : "completed",
      };
    case "external_tool.requested":
    case "external_tool.completed":
      return {
        label: (d.toolName as string) || "External tool",
        preview:
          event.type === "external_tool.requested"
            ? firstArg(d.arguments as Record<string, unknown> | undefined)
            : "completed",
      };
    case "session.start":
    case "session.resume": {
      const ctx = d.context as Record<string, unknown> | undefined;
      return {
        label: event.type === "session.start" ? "Session start" : "Session resume",
        preview: [
          ctx?.branch ? `branch ${ctx.branch}` : "",
          d.selectedModel ? `model ${d.selectedModel}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "session.shutdown":
      return {
        label: "Shutdown",
        preview: [
          d.shutdownType as string,
          d.totalPremiumRequests !== undefined
            ? `${d.totalPremiumRequests} premium req`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.auto_mode_resolved":
      return {
        label: "Auto mode",
        preview: [
          d.chosenModel as string,
          d.predictedLabel ? `label ${d.predictedLabel}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.binary_asset":
      return {
        label: "Binary asset",
        preview: [
          d.mimeType as string,
          typeof d.byteLength === "number"
            ? `${(d.byteLength / 1024).toFixed(0)} KB`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.usage_checkpoint": {
      const usage = d.usage as Record<string, number> | undefined;
      if (usage) {
        return {
          label: "Usage checkpoint",
          preview: `in ${formatCompactNumber(usage.inputTokens ?? 0)} · out ${formatCompactNumber(usage.outputTokens ?? 0)}`,
        };
      }
      return {
        label: "Usage checkpoint",
        preview:
          d.totalPremiumRequests !== undefined
            ? `${d.totalPremiumRequests} premium req`
            : "usage snapshot",
      };
    }
    case "session.model_change":
      return {
        label: "Model change",
        preview: `${d.previousModel ?? "unknown"} → ${d.newModel ?? "unknown"}`,
      };
    case "session.compaction_start":
      return { label: "Compaction", preview: `started · ${d.model ?? ""}`.trim() };
    case "session.compaction_complete":
      return {
        label: "Compaction",
        preview: d.success ? "completed" : `failed${d.error ? `: ${shorten(d.error, 80)}` : ""}`,
      };
    case "system.message": {
      const chars = (d.charLength as number) || String(d.content ?? "").length;
      return {
        label: "System",
        preview: `${d.role ?? "system"} · ${chars.toLocaleString()} chars`,
      };
    }
    case "hook.start":
    case "hook.end": {
      const input = d.input as Record<string, unknown> | undefined;
      if (event.type === "hook.end") {
        return {
          label: (d.hookType as string) || "Hook",
          preview: d.success === false ? "failed" : "success",
        };
      }
      return {
        label: (d.hookType as string) || "Hook",
        preview: shorten(input?.prompt, 90) || "started",
      };
    }
    case "permission.requested": {
      const pr = d.permissionRequest as Record<string, unknown> | undefined;
      return {
        label: "Permission",
        preview: [pr?.kind as string, shorten(pr?.intention, 90)]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "permission.completed": {
      const res = d.result as Record<string, unknown> | undefined;
      return { label: "Permission", preview: (res?.kind as string) ?? "resolved" };
    }
    case "subagent.deselected":
      return { label: "Subagent", preview: "focus returned to main agent" };
    case "subagent.activity":
      return {
        label: "Subagent",
        preview: [d.kind as string, d.agentPath as string].filter(Boolean).join(" · "),
      };
    case "subagent.session_start":
      return {
        label: "Subagent start",
        preview: [d.agentNickname as string, d.agentPath as string, d.cwd as string]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.plan_changed":
      return { label: "Plan", preview: String(d.operation ?? "changed") };
    case "system.notification": {
      const kind = d.kind as Record<string, unknown> | undefined;
      return {
        label: "Notification",
        preview:
          [kind?.type as string, kind?.description as string]
            .filter(Boolean)
            .join(" · ") || shorten(d.content, 90),
      };
    }
    case "assistant.thinking": {
      const content = shorten(d.content);
      const chars = (d.charLength as number) ?? 0;
      return {
        label: "Thinking",
        preview: content || (chars ? `${chars.toLocaleString()} chars (encrypted)` : "reasoning"),
      };
    }
    case "session.error":
      return { label: "Error", preview: shorten(d.detail || d.message, 90) };
    case "context.attachment": {
      const chars = (d.charLength as number) ?? 0;
      const itemCount = (d.itemCount as number) ?? 0;
      const detail =
        (d.subject as string) ||
        (itemCount ? `${itemCount} ${d.itemsLabel ?? "items"}` : "") ||
        shorten(d.content, 70);
      return {
        label: (d.label as string) || "Attachment",
        preview: [detail, chars ? `${chars.toLocaleString()} chars` : ""]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "file.patch_applied": {
      const changes = (d.changes as { file: string }[]) ?? [];
      const first = changes[0]?.file.split("/").pop();
      return {
        label: "Patch",
        preview:
          changes.length > 1
            ? `${changes.length} files · ${first}, …`
            : first ?? (d.success === false ? "failed" : "applied"),
      };
    }
    case "web.search":
      return { label: "Web search", preview: shorten(d.query, 90) };
    case "session.turn_context":
      return {
        label: "Turn context",
        preview: [d.model as string, d.effort ? `effort ${d.effort}` : ""]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.world_state":
      return {
        label: "World state",
        preview: (() => {
          const sections = ((d.sections as string[]) ?? []).length;
          return [
            d.full === true ? "full snapshot" : "delta",
            `${sections} section${sections === 1 ? "" : "s"}`,
            `${((d.charLength as number) ?? 0).toLocaleString()} chars`,
          ].join(" · ");
        })(),
      };
    case "session.mode_change":
      return { label: "Mode", preview: String(d.mode ?? "changed") };
    case "session.turn_aborted":
      return {
        label: "Turn aborted",
        preview: [d.reason as string, d.durationMs ? `${Math.round((d.durationMs as number) / 1000)}s` : ""]
          .filter(Boolean)
          .join(" · "),
      };
    case "session.rollback":
      return { label: "Rollback", preview: `${d.turns ?? "?"} turn(s)` };
    default:
      return { label: fallback, preview: shorten(JSON.stringify(d), 90) };
  }
}

/** Token counts to show inline on a collapsed row, if the event reports any. */
function eventTokenBadge(event: AgentEvent): { input: number; output: number } | null {
  const d = event.data;
  const details = d.tokenDetails as Record<string, { tokenCount?: number }> | undefined;
  const totals = d.sessionTotals as Record<string, number> | undefined;
  const summary = d.usageSummary as Record<string, number> | undefined;
  const input =
    (typeof d.inputTokens === "number" ? d.inputTokens : 0) ||
    (details?.input?.tokenCount ?? 0) ||
    (summary?.inputTokens ?? 0) ||
    (totals?.inputTokens ?? 0);
  const output =
    (typeof d.outputTokens === "number" ? d.outputTokens : 0) ||
    (details?.output?.tokenCount ?? 0) ||
    (summary?.outputTokens ?? 0) ||
    (totals?.outputTokens ?? 0);
  if (input === 0 && output === 0) return null;
  return { input, output };
}

/** Conversation turns read best already open; the machinery starts collapsed. */
const DEFAULT_OPEN_TYPES = new Set([
  "user.message",
  "assistant.message",
  "assistant.thinking",
]);

function EventCard({
  event,
  prevTimestamp,
  expandAll,
  parallel = false,
  target = false,
  merged = false,
  result,
  runningUSD,
  costShare = 0,
  turn,
}: {
  event: AgentEvent;
  prevTimestamp?: string;
  /** One of several tool calls the model issued together. */
  parallel?: boolean;
  /** The event a copied link points at. */
  target?: boolean;
  /** A tool call shown as one row with its outcome, as the compact view does. */
  merged?: boolean;
  /** The event that completed this call; absent while it runs or if it never returned. */
  result?: AgentEvent;
  /** The session's cost up to and including this request. */
  runningUSD?: number;
  /** This request's cost against the session's dearest, 0 to 1. */
  costShare?: number;
  /** What the prompt and everything done to answer it cost; prompts only. */
  turn?: CostTurn;
  /** Bumped by the toolbar; `open` forces every row open, `closed` closes them. */
  expandAll: { nonce: number; mode: "open" | "closed" } | null;
}) {
  const cfg = EVENT_CONFIG[event.type] || DEFAULT_CONFIG;
  const gap = prevTimestamp ? durationMs(prevTimestamp, event.timestamp) : null;
  const [showRaw, setShowRaw] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Local open state, re-seeded whenever the toolbar issues a new expand/collapse.
  const [openState, setOpenState] = useState({
    nonce: 0,
    open: DEFAULT_OPEN_TYPES.has(event.type) || target,
  });
  const open =
    expandAll && expandAll.nonce !== openState.nonce
      ? expandAll.mode === "open"
      : openState.open;
  const setOpen = (next: boolean) =>
    setOpenState({ nonce: expandAll?.nonce ?? 0, open: next });

  const summary = eventSummary(event);
  const tokenBadge = eventTokenBadge(event);
  const costUSD = typeof event.data.costUSD === "number" ? event.data.costUSD : null;
  const typeParts = splitEventType(event.type);
  const categoryVisual = CATEGORY_VISUAL[typeParts.category];
  const visual = categoryVisual ?? cfg;
  const helpText = EVENT_TYPE_HELP[event.type] ?? `Event in "${typeParts.category}" category with "${typeParts.subCategory}" sub-category.`;

  function renderContent() {
    if (merged) {
      return (
        <ToolExecutionCard
          data={
            result
              ? { ...event.data, result: result.data.result, success: result.data.success }
              : event.data
          }
          type={result ? "tool.execution_complete" : "tool.execution_start"}
        />
      );
    }
    switch (event.type) {
      case "user.message":
        return <UserMessageCard data={event.data} />;
      case "assistant.message":
        return <AssistantMessageCard data={event.data} />;
      case "assistant.turn_start":
        return <AssistantTurnCard data={event.data} type="assistant.turn_start" />;
      case "assistant.turn_end":
        return <AssistantTurnCard data={event.data} type="assistant.turn_end" />;
      case "tool.execution_start":
      case "tool.execution_complete":
        return <ToolExecutionCard data={event.data} type={event.type} />;
      case "external_tool.requested":
        return <ExternalToolCard data={event.data} type="external_tool.requested" />;
      case "external_tool.completed":
        return <ExternalToolCard data={event.data} type="external_tool.completed" />;
      case "session.shutdown":
        return <SessionShutdownCard data={event.data} />;
      case "session.start":
      case "session.resume": {
        const ctx = event.data.context as Record<string, unknown> | undefined;
        return (
          <div className="text-xs text-muted-foreground space-y-1">
            {ctx && (
              <div>
                Branch: <span className="text-foreground">{ctx.branch as string}</span>
                {" · "}
                Model: <span className="text-foreground">{event.data.selectedModel as string}</span>
              </div>
            )}
          </div>
        );
      }
      case "hook.start":
        return <HookEventCard data={event.data} type="hook.start" />;
      case "hook.end":
        return <HookEventCard data={event.data} type="hook.end" />;
      case "session.auto_mode_resolved":
        return <AutoModeResolvedCard data={event.data} />;
      case "session.binary_asset":
        return <SessionBinaryAssetCard data={event.data} />;
      case "session.usage_checkpoint":
        return <UsageCheckpointCard data={event.data} />;
      case "subagent.deselected":
        return <SubagentDeselectedCard />;
      case "session.model_change":
        return <ModelChangeCard data={event.data} />;
      case "session.compaction_start":
        return <CompactionStartCard data={event.data} />;
      case "session.compaction_complete":
        return <CompactionCompleteCard data={event.data} />;
      case "system.message":
        return <SystemMessageCard data={event.data} />;
      case "assistant.thinking":
        return <ThinkingCard data={event.data} />;
      case "session.error":
        return <ErrorCard data={event.data} />;
      case "context.attachment":
        return <AttachmentCard data={event.data} />;
      case "file.patch_applied":
        return <PatchAppliedCard data={event.data} />;
      case "web.search":
        return <WebSearchCard data={event.data} />;
      case "session.mode_change":
        return <ModeChangeCard data={event.data} />;
      case "session.turn_context":
        return <TurnContextCard data={event.data} />;
      case "session.world_state":
        return <WorldStateCard data={event.data} />;
      case "subagent.session_start":
      case "subagent.activity":
      case "subagent.message":
        return <SubagentCard data={event.data} type={event.type} />;
      case "session.turn_aborted":
        return <TurnAbortedCard data={event.data} />;
      case "session.rollback":
        return <RollbackCard data={event.data} />;
      case "session.plan_changed":
        return <PlanChangedCard data={event.data} />;
      case "system.notification":
        return <NotificationCard data={event.data} />;
      case "permission.requested": {
        const pr = event.data.permissionRequest as Record<string, unknown>;
        return pr ? (
          <div className="text-xs text-muted-foreground">
            <span className="text-orange-600 dark:text-orange-400 font-medium">{pr.kind as string}</span>{" "}
            {pr.intention as string}
          </div>
        ) : null;
      }
      case "permission.completed": {
        const res = event.data.result as Record<string, unknown>;
        return res ? (
          <div className="text-xs">
            <span className={res.kind === "approved"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
            }>
              {res.kind as string}
            </span>
          </div>
        ) : null;
      }
      default:
        return <GenericDataCard data={event.data} />;
    }
  }

  const content = renderContent();
  const rawJson = JSON.stringify(merged && result ? [event, result] : event, null, 2);
  const failed = result?.data.success === false;
  const took = result ? durationMs(event.timestamp, result.timestamp) : null;
  // Every row is expandable: even without a rendered detail there is always the
  // raw event and the row actions to show.
  const hasDetail = Boolean(content);

  return (
    <div
      data-event-id={event.id}
      className="relative scroll-mt-40 border-l-2 border-border pb-1.5 pl-6 last:border-l-transparent"
    >
      {/* Small dot centred on the rail. */}
      <span
        className={`absolute -left-[5px] top-3 size-2 rounded-full border border-background ${visual.dotCls}`}
        aria-hidden
      />

      {/* Header and detail share one container, so an expanded event reads as a
          single object rather than two stacked cards. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card",
          parallel && "border-l-2 border-l-amber-400 dark:border-l-amber-600",
          target && "ring-2 ring-brand/60",
        )}
      >
        {/* Left edge, stronger the more the request cost: dear ones stand out in a scroll. */}
        {costShare > 0 && (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-emerald-500"
            style={{ opacity: Math.max(0.12, costShare) }}
            aria-hidden
          />
        )}
        <button
          type="button"
          data-event-row
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
            aria-hidden
          />
          <span
            className={`max-w-[9rem] shrink-0 truncate rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold ${visual.chipCls ?? cfg.typeCls}`}
            title={summary.label}
          >
            {summary.label}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
            {summary.preview}
          </span>

          {summary.delta && (
            <span
              className="shrink-0 font-mono text-[11px] tabular-nums"
              title="Lines written and replaced by this call"
            >
              <span className="text-emerald-700 dark:text-emerald-400">+{summary.delta.added}</span>
              {summary.delta.removed > 0 && (
                <span className="ml-1 text-red-700 dark:text-red-400">−{summary.delta.removed}</span>
              )}
            </span>
          )}

          {merged && (
            <span
              className={cn(
                "shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                failed
                  ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400"
                  : "bg-muted text-muted-foreground",
              )}
              title={
                !result
                  ? "No result was recorded for this call"
                  : failed
                    ? "The call failed"
                    : "Time from the call to its result"
              }
            >
              {!result
                ? "no result"
                : failed
                  ? "failed"
                  : took !== null && took >= 1000
                    ? `${(took / 1000).toFixed(1)}s`
                    : "done"}
            </span>
          )}

          {tokenBadge && (
            <span
              className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline-flex"
              title={`${tokenBadge.input.toLocaleString()} input tokens · ${tokenBadge.output.toLocaleString()} output tokens`}
            >
              {tokenBadge.input > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <InputTokensIcon className="size-3" aria-hidden />
                  <span className="opacity-70">in</span> {formatCompactNumber(tokenBadge.input)}
                </span>
              )}
              {tokenBadge.output > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <OutputTokensIcon className="size-3" aria-hidden />
                  <span className="opacity-70">out</span> {formatCompactNumber(tokenBadge.output)}
                </span>
              )}
            </span>
          )}

          {costUSD !== null && costUSD > 0 && (
            <span
              className="hidden shrink-0 font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400 sm:inline"
              title="Estimated cost of this request at API list prices"
            >
              {formatCost(costUSD)}
            </span>
          )}

          {runningUSD !== undefined && (
            <span
              className="hidden shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground md:inline"
              title="Estimated cost of the session up to and including this request"
            >
              Σ {formatCost(runningUSD)}
            </span>
          )}

          {turn && turn.costUSD > 0 && (
            <span
              className="hidden shrink-0 font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400 sm:inline"
              title={`Estimated cost of the ${turn.requests} ${turn.requests === 1 ? "request" : "requests"} made to answer this prompt; ${formatCost(turn.totalUSD)} for the session by the end of the turn`}
            >
              turn {formatCost(turn.costUSD)}
            </span>
          )}

          {gap !== null && gap > 5000 && (
            <span
              className="hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline"
              title="Gap since the previous event"
            >
              +{gap > 60000 ? `${(gap / 60000).toFixed(1)}m` : `${(gap / 1000).toFixed(1)}s`}
            </span>
          )}

          {/* Timestamp is the row's right-hand anchor and never moves. */}
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatTime(event.timestamp)}
          </span>
        </button>

        {open && (
          <div className="border-t border-border">
            {hasDetail ? (
              <div className="px-3 py-2.5">{content}</div>
            ) : (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                No structured detail for this event — see the raw event below.
              </p>
            )}

            {/* Occasional actions live at the foot of the detail, out of the
                scanning path of the collapsed rows. */}
            <div className="flex items-center gap-1 border-t border-border bg-muted/30 px-2 py-1.5">
              <span className="mr-auto truncate pl-1 font-mono text-[11px] text-muted-foreground">
                {merged && result ? `${event.type} + ${result.type}` : event.type}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowHelp(!showHelp)}
                aria-expanded={showHelp}
                className="text-muted-foreground"
              >
                <Info className="size-3.5" aria-hidden />
                About
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowRaw(!showRaw)}
                aria-expanded={showRaw}
                className="text-muted-foreground"
              >
                <Braces className="size-3.5" aria-hidden />
                {showRaw ? "Hide raw" : "Raw"}
              </Button>
              <CopyButton
                value={() => {
                  const url = new URL(window.location.href);
                  url.search = "";
                  url.searchParams.set("event", event.id);
                  return url.toString();
                }}
                label="Copy a link to this event"
                icon={Link2}
              >
                Link
              </CopyButton>
              <CopyButton value={rawJson} label="Copy raw JSON">
                Copy
              </CopyButton>
            </div>

            {/* Both panels open below the action bar, so toggling either one
                never shifts the button that controls it. They are ordered to
                match the buttons above them. */}
            {showHelp && (
              <div className="border-t border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {helpText}
              </div>
            )}

            {/* Raw JSON supplements the rendered detail rather than replacing it. */}
            {showRaw && (
              <div className="border-t border-border px-3 py-2.5">
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Raw event
                </p>
                <pre className="max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-2.5 font-mono text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
                  {rawJson}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getCategoryChipClass(category: string) {
  return CATEGORY_VISUAL[category]?.chipCls || "border-border bg-muted text-muted-foreground";
}

/** Runtime-injected context, hidden together by the toolbar toggle. */
const INJECTED_CONTEXT_TYPES = new Set([
  "system.message",
  "context.attachment",
  "session.world_state",
]);

/** A model asking for a tool; several in a row with no result between ran together. */
const CALL_START_TYPES = new Set(["tool.execution_start", "external_tool.requested"]);
const CALL_END_TYPES = new Set(["tool.execution_complete", "external_tool.completed"]);

/** What the compact view keeps besides tool calls: the conversation itself. */
const CONVERSATION_TYPES = new Set(["user.message", "assistant.thinking", "assistant.message"]);

type ViewMode = "normal" | "compact" | "focused";
const VIEW_MODES: ViewMode[] = ["normal", "compact", "focused"];

/** Moves keyboard focus to the event row `step` away, starting from the first one on screen. */
function focusEventRow(step: number) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-event-row]"));
  const current = rows.indexOf(document.activeElement as HTMLElement);
  const index =
    current === -1
      ? Math.max(0, rows.findIndex((row) => row.getBoundingClientRect().top > 160))
      : Math.min(rows.length - 1, Math.max(0, current + step));
  rows[index]?.focus({ preventScroll: true });
  rows[index]?.scrollIntoView({ block: "center" });
}

function getTypeChipClass(type: string) {
  const { category } = splitEventType(type);
  return getCategoryChipClass(category);
}

export function EventsTimeline({
  events,
  focusRequest,
  targetEventId,
  live = false,
  onLiveChange,
  running = false,
}: Props) {
  // The view mode is mirrored to `?mode=`, so a refresh keeps it.
  const [modeParam, setModeParam] = useQueryParam("mode", "normal");
  const [mode, setMode] = useState<ViewMode>(
    VIEW_MODES.includes(modeParam as ViewMode) ? (modeParam as ViewMode) : "normal",
  );
  useEffect(() => setModeParam(mode), [mode, setModeParam]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubKeys, setSelectedSubKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showSystem, setShowSystem] = useState(true);
  const [onlyTokenEvents, setOnlyTokenEvents] = useState(false);
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The toolbar only needs its bottom border once it is stuck and events
  // scroll beneath it; at rest the first date divider already separates them.
  const stickySentinel = useRef<HTMLDivElement>(null);
  const [toolbarStuck, setToolbarStuck] = useState(false);
  useEffect(() => {
    const sentinel = stickySentinel.current;
    if (!sentinel) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const offset =
      parseFloat(rootStyle.getPropertyValue("--cv-topbar-h")) +
      parseFloat(rootStyle.getPropertyValue("--cv-tabbar-h"));
    const observer = new IntersectionObserver(
      ([entry]) =>
        setToolbarStuck(!entry.isIntersecting && entry.boundingClientRect.top < offset),
      { rootMargin: `-${offset}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  const [expandAll, setExpandAll] = useState<{
    nonce: number;
    mode: "open" | "closed";
  } | null>(null);

  const typedEvents = useMemo(() => {
    return events.map((event) => {
      const parts = splitEventType(event.type);
      return {
        ...event,
        category: parts.category,
        subCategory: parts.subCategory,
        subKey: `${parts.category}.${parts.subCategory}`,
      };
    });
  }, [events]);

  // Where the cost built up, for each row's running total and turn subtotal.
  const cost = useMemo(() => costTimeline(events), [events]);

  // The focused transcript: each prompt and the answer the turn ended on,
  // without the reasoning and tool calls in between.
  const focusedIds = useMemo(() => {
    const ids = new Set<string>();
    let answer: string | null = null;
    const closeTurn = () => {
      if (answer) ids.add(answer);
      answer = null;
    };
    for (const event of events) {
      if (event.type === "user.message") {
        closeTurn();
        ids.add(event.id);
      } else if (event.type === "assistant.message" && String(event.data.content ?? "").trim()) {
        answer = event.id;
      }
    }
    closeTurn();
    return ids;
  }, [events]);

  // Each tool call matched to the event that completed it, so the compact view
  // can show the pair as one row. Matched by call id, else by tool name.
  const callResults = useMemo(() => {
    const results = new Map<string, AgentEvent>();
    const consumed = new Set<string>();
    const open: AgentEvent[] = [];
    for (const event of events) {
      if (CALL_START_TYPES.has(event.type)) {
        open.push(event);
      } else if (CALL_END_TYPES.has(event.type)) {
        const callId = event.data.toolCallId;
        const index = open.findIndex((start) =>
          callId
            ? start.data.toolCallId === callId
            : !start.data.toolCallId && start.data.toolName === event.data.toolName,
        );
        if (index === -1) continue;
        results.set(open[index].id, event);
        consumed.add(event.id);
        open.splice(index, 1);
      }
    }
    return { results, consumed };
  }, [events]);

  // Tool calls the model issued in one go, keyed by event id to the group's size.
  const parallelGroups = useMemo(() => {
    const groups = new Map<string, { key: string; size: number }>();
    let run: AgentEvent[] = [];
    const closeRun = () => {
      if (run.length > 1) {
        const group = { key: run[0].id, size: run.length };
        for (const event of run) groups.set(event.id, group);
      }
      run = [];
    };
    for (const event of events) {
      if (CALL_START_TYPES.has(event.type)) run.push(event);
      else closeRun();
    }
    closeRun();
    return groups;
  }, [events]);

  // Injected context — system prompts and auto-attached blocks — is bulky and
  // rarely what you are reading the timeline for, so it hides as one group.
  // What the chosen view keeps, before any filter. The filter chips are built
  // from this, so they only ever offer what the view can show.
  const inView = useMemo(() => {
    if (mode === "normal") return typedEvents;
    return typedEvents.filter((event) => {
      if (mode === "focused") return focusedIds.has(event.id);
      if (callResults.consumed.has(event.id)) return false;
      return (
        CALL_START_TYPES.has(event.type) ||
        // A result whose call is missing still has to show up somewhere.
        CALL_END_TYPES.has(event.type) ||
        (CONVERSATION_TYPES.has(event.type) &&
          (event.type !== "assistant.message" || String(event.data.content ?? "").trim()))
      );
    });
  }, [typedEvents, mode, focusedIds, callResults]);

  const hasContext = useMemo(
    () => inView.some((event) => INJECTED_CONTEXT_TYPES.has(event.type)),
    [inView],
  );

  const visibleBySystem = useMemo(() => {
    return inView.filter(
      (event) => showSystem || !INJECTED_CONTEXT_TYPES.has(event.type),
    );
  }, [inView, showSystem]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, { count: number; typeCounts: Map<string, number> }>();
    for (const event of visibleBySystem) {
      const current = counts.get(event.category) ?? { count: 0, typeCounts: new Map<string, number>() };
      current.count += 1;
      current.typeCounts.set(event.type, (current.typeCounts.get(event.type) || 0) + 1);
      counts.set(event.category, current);
    }
    return Array.from(counts.entries())
      .map(([category, value]) => {
        const representativeType = Array.from(value.typeCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
        return { category, count: value.count, representativeType };
      })
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }, [visibleBySystem]);

  // A category picked in one view may not exist in another; it is ignored there
  // rather than left to filter everything out, and applies again on return.
  const activeCategories = useMemo(
    () => selectedCategories.filter((c) => categoryCounts.some((item) => item.category === c)),
    [selectedCategories, categoryCounts],
  );

  const subCategoryCounts = useMemo(() => {
    if (activeCategories.length === 0) return [];
    const selectedSet = new Set(activeCategories);
    const counts = new Map<string, { category: string; subCategory: string; count: number }>();
    for (const event of visibleBySystem) {
      if (!selectedSet.has(event.category)) continue;
      const current = counts.get(event.subKey);
      if (current) current.count += 1;
      else counts.set(event.subKey, { category: event.category, subCategory: event.subCategory, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.subCategory.localeCompare(b.subCategory));
  }, [visibleBySystem, activeCategories]);

  // As with categories: a sub-type the current view or category choice no
  // longer offers is ignored, not left to filter everything out.
  const activeSubKeys = useMemo(() => {
    const available = new Set(subCategoryCounts.map((item) => `${item.category}.${item.subCategory}`));
    return selectedSubKeys.filter((key) => available.has(key));
  }, [selectedSubKeys, subCategoryCounts]);

  // A new request replaces the filters. Done while rendering, so the timeline
  // never paints the old filters first.
  const [appliedFocus, setAppliedFocus] = useState<Props["focusRequest"]>(null);
  if (focusRequest && focusRequest !== appliedFocus) {
    setAppliedFocus(focusRequest);
    setSelectedCategories(focusRequest.categories ?? []);
    setSelectedSubKeys(focusRequest.subKeys ?? []);
    setSearch(focusRequest.search ?? "");
    setOnlyFailures(focusRequest.failures ?? false);
    const wantsSystem =
      (focusRequest.categories ?? []).includes("system")
      || (focusRequest.subKeys ?? []).includes("system.message");
    if (wantsSystem) setShowSystem(true);
    // What a hint or a search points at is usually not part of the focused view.
    setMode("normal");
    // Reveal the chips so it is obvious which filters the hint applied.
    setFiltersOpen(true);
  }

  const filtered = useMemo(() => {
    const categorySet = new Set(activeCategories);
    const subKeySet = new Set(activeSubKeys);
    // Every word has to appear in the event, as in the cross-session search.
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = visibleBySystem.filter((event) => {
      if (categorySet.size > 0 && !categorySet.has(event.category)) return false;
      if (subKeySet.size > 0 && !subKeySet.has(event.subKey)) return false;
      if (onlyTokenEvents && !eventHasTokenUsage(event)) return false;
      // A call is kept alongside its failed result, so what was tried is in view.
      if (onlyFailures && !eventFailed(event) && !eventFailed(callResults.results.get(event.id))) {
        return false;
      }
      if (terms.length > 0) {
        // A merged row answers for its result too.
        const result = mode === "compact" ? callResults.results.get(event.id) : undefined;
        const text = (JSON.stringify(event) + (result ? JSON.stringify(result) : "")).toLowerCase();
        return terms.every((term) => text.includes(term));
      }
      return true;
    });
    return order === "desc" ? matched.reverse() : matched;
  }, [visibleBySystem, activeCategories, activeSubKeys, onlyTokenEvents, onlyFailures, search, mode, callResults, order]);

  // Render in pages: huge sessions (thousands of events) would otherwise mount
  // every card up front and make the tab feel frozen. Tagging the page state
  // with the filter signature resets it back to page one whenever the filters
  // change, without an effect.
  const filterKey = `${activeCategories.join()}|${activeSubKeys.join()}|${search}|${showSystem}|${onlyTokenEvents}|${onlyFailures}|${mode}|${order}`;
  const [page, setPage] = useState({ key: filterKey, count: PAGE_SIZE });
  // A linked event has to be on the page, however far down it sits.
  const targetIndex = targetEventId
    ? filtered.findIndex((event) => event.id === targetEventId)
    : -1;
  const visibleCount = Math.max(
    page.key === filterKey ? page.count : PAGE_SIZE,
    targetIndex + 1,
  );

  const showMore = (count: number) => setPage({ key: filterKey, count });

  // Following an oldest-first timeline means watching its end, so the page
  // window is anchored there and earlier events load upwards.
  const tail = live && order === "asc";
  const shown = useMemo(
    () => (tail ? filtered.slice(-visibleCount) : filtered.slice(0, visibleCount)),
    [filtered, visibleCount, tail],
  );

  useEffect(() => {
    if (!tail) return;
    // After the next paint, once the new rows have their final height.
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight }),
    );
    return () => cancelAnimationFrame(frame);
  }, [tail, events.length]);

  useEffect(() => {
    if (!targetEventId) return;
    document
      .querySelector(`[data-event-id="${CSS.escape(targetEventId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [targetEventId]);

  useHotkeys({
    f: () => setMode((m) => VIEW_MODES[(VIEW_MODES.indexOf(m) + 1) % VIEW_MODES.length]),
    o: () => setOrder((o) => (o === "asc" ? "desc" : "asc")),
    l: onLiveChange && (() => onLiveChange(!live)),
    e: () => setExpandAll({ nonce: Date.now(), mode: "open" }),
    E: () => setExpandAll({ nonce: Date.now(), mode: "closed" }),
    j: () => focusEventRow(1),
    k: () => focusEventRow(-1),
  });

  const groups = useMemo(() => {
    const g: { date: string; events: AgentEvent[] }[] = [];
    for (const ev of shown) {
      const d = formatDate(ev.timestamp);
      const last = g[g.length - 1];
      if (!last || last.date !== d) g.push({ date: d, events: [ev] });
      else last.events.push(ev);
    }
    return g;
  }, [shown]);

  // Everything set inside the filter panel, shown on its button.
  const panelFilterCount =
    activeCategories.length +
    activeSubKeys.length +
    (onlyTokenEvents ? 1 : 0) +
    (onlyFailures ? 1 : 0) +
    (hasContext && !showSystem ? 1 : 0);
  const activeFilterCount = panelFilterCount + (search ? 1 : 0);

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedSubKeys([]);
    setSearch("");
    setOnlyTokenEvents(false);
    setOnlyFailures(false);
    setShowSystem(true);
    setMode("normal");
  }

  const hiddenCount = filtered.length - shown.length;
  const loadMore = hiddenCount > 0 && (
    <div className="flex flex-col items-center gap-2 py-6">
      <p className="text-xs text-muted-foreground">
        Showing {tail ? "the last " : ""}
        {shown.length.toLocaleString()} of {filtered.length.toLocaleString()} matching events
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => showMore(visibleCount + PAGE_SIZE)}
        >
          Load {Math.min(PAGE_SIZE, hiddenCount)} {tail ? "earlier" : "more"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => showMore(filtered.length)}
          className="text-muted-foreground"
        >
          Show all
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Toolbar. Sticks below the page chrome so filters stay reachable
          while scrolling a long timeline. */}
      <div ref={stickySentinel} aria-hidden />
      <div
        className={cn(
          "sticky top-[calc(var(--cv-topbar-h)+var(--cv-tabbar-h))] z-10 -mx-4 border-b bg-background/90 px-4 pt-1 pb-2.5 backdrop-blur transition-colors supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6",
          toolbarStuck ? "border-border" : "border-transparent",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            shortcut
            placeholder="Search events…"
            aria-label="Search events"
            className="w-full sm:w-56"
          />

          <Segmented
            label="Transcript view"
            size="default"
            value={mode}
            onChange={setMode}
            options={[
              { value: "normal", label: "Normal" },
              { value: "compact", label: "Compact" },
              { value: "focused", label: "Focused" },
            ]}
          />

          <Button
            variant="outline"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={cn(
              panelFilterCount > 0
                ? "border-foreground/25 bg-muted"
                : "text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filters
            {panelFilterCount > 0 && (
              <span className="rounded-sm bg-foreground/10 px-1 tabular-nums">
                {panelFilterCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                filtersOpen && "rotate-180",
              )}
              aria-hidden
            />
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {onLiveChange && (
              <ToolbarToggle
                active={live}
                onClick={() => onLiveChange(!live)}
                icon={Radio}
                label="Follow live"
                title={
                  running
                    ? "Follow the session: keep the newest events in view (l)"
                    : "Watch for new events and keep the newest in view (l)"
                }
                pulse={running}
                iconOnly
              />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
                    aria-label={order === "asc" ? "Show newest first" : "Show oldest first"}
                    className="text-muted-foreground"
                  >
                    {order === "asc" ? (
                      <ArrowDownNarrowWide className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowUpNarrowWide className="size-3.5" aria-hidden />
                    )}
                  </Button>
                }
              />
              <TooltipContent>
                {order === "asc" ? "Oldest first" : "Newest first"} (o)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setExpandAll({ nonce: Date.now(), mode: "open" })
                    }
                    aria-label="Expand all events"
                    className="text-muted-foreground"
                  >
                    <ChevronsUpDown className="size-3.5" aria-hidden />
                  </Button>
                }
              />
              <TooltipContent>Expand all</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setExpandAll({ nonce: Date.now(), mode: "closed" })
                    }
                    aria-label="Collapse all events"
                    className="text-muted-foreground"
                  >
                    <ChevronsDownUp className="size-3.5" aria-hidden />
                  </Button>
                }
              />
              <TooltipContent>Collapse all</TooltipContent>
            </Tooltip>
            <span className="ml-1 text-xs tabular-nums text-muted-foreground">
              {filtered.length === events.length
                ? `${events.length} events`
                : `${filtered.length} of ${events.length} events`}
            </span>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {hasContext && (
                <ToolbarToggle
                  active={!showSystem}
                  onClick={() => setShowSystem(!showSystem)}
                  icon={Filter}
                  label="Hide context"
                  title="Hide system prompts, auto-attached context and world-state snapshots"
                />
              )}
              <ToolbarToggle
                active={onlyTokenEvents}
                onClick={() => setOnlyTokenEvents(!onlyTokenEvents)}
                icon={ListFilter}
                label="Token events"
                title="Show only events that report token usage"
              />
              <ToolbarToggle
                active={onlyFailures}
                onClick={() => setOnlyFailures(!onlyFailures)}
                icon={CircleX}
                label="Failures"
                title="Show only tool calls that failed"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {categoryCounts.map(({ category, count, representativeType }) => {
                const isActive = activeCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(category)
                          ? prev.filter((value) => value !== category)
                          : [...prev, category],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-all",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      representativeType
                        ? getTypeChipClass(representativeType)
                        : getCategoryChipClass(category),
                      isActive
                        ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                        : "opacity-70 hover:opacity-100",
                    )}
                  >
                    <span>{category}</span>
                    <span className="font-bold tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>

            {activeCategories.length > 0 && subCategoryCounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Sub-type
                </span>
                {subCategoryCounts.map(({ category, subCategory, count }) => {
                  const key = `${category}.${subCategory}`;
                  const isActive = activeSubKeys.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      title={key}
                      onClick={() =>
                        setSelectedSubKeys((prev) =>
                          prev.includes(key)
                            ? prev.filter((value) => value !== key)
                            : [...prev, key],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs transition-all",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                        getTypeChipClass(key),
                        isActive
                          ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                          : "opacity-70 hover:opacity-100",
                      )}
                    >
                      {activeCategories.length > 1 && (
                        <span className="opacity-70">{category}:</span>
                      )}
                      <span>{subCategory}</span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="pr-2">
        {tail && loadMore}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {group.date}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {group.events.map((event, i) => {
              const parallel = parallelGroups.get(event.id);
              // The event that came before this one in time, whichever way the list runs.
              const earlier = group.events[order === "asc" ? i - 1 : i + 1];
              const opensGroup =
                parallel && parallelGroups.get(group.events[i - 1]?.id) !== parallel;
              return (
                <Fragment key={event.id}>
                  {opensGroup && (
                    <div className="border-l-2 border-border pb-1 pl-6 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                      parallel · {parallel.size} calls
                    </div>
                  )}
                  <EventCard
                    event={event}
                    prevTimestamp={earlier?.timestamp}
                    expandAll={expandAll}
                    parallel={Boolean(parallel)}
                    target={event.id === targetEventId}
                    merged={mode === "compact" && CALL_START_TYPES.has(event.type)}
                    result={mode === "compact" ? callResults.results.get(event.id) : undefined}
                    runningUSD={cost.runningUSD.get(event.id)}
                    costShare={
                      cost.runningUSD.has(event.id) && typeof event.data.costUSD === "number"
                        ? event.data.costUSD / cost.maxEventUSD
                        : 0
                    }
                    turn={cost.turnByPrompt.get(event.id)}
                  />
                </Fragment>
              );
            })}
          </div>
        ))}

        {!tail && loadMore}

        {filtered.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground">
              No events match your filters
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {events.length.toLocaleString()} events are recorded in this session.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact on/off control used by the timeline toolbar. */
function ToolbarToggle({
  active,
  onClick,
  icon: Icon,
  label,
  title,
  pulse = false,
  iconOnly = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Filter;
  label: string;
  title: string;
  /** Adds a live dot, for a control whose subject is changing right now. */
  pulse?: boolean;
  /** Drops the text; the label stays as the accessible name. */
  iconOnly?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            variant="outline"
            pressed={active}
            onPressedChange={onClick}
            aria-label={iconOnly ? label : undefined}
            className={cn(
              "relative gap-1.5 text-muted-foreground aria-pressed:border-foreground/25 aria-pressed:text-foreground",
              iconOnly && "px-0 aria-pressed:border-emerald-500/60 aria-pressed:text-emerald-600 dark:aria-pressed:text-emerald-400",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {!iconOnly && label}
            {pulse && (
              <span
                className={cn(
                  "size-1.5 animate-pulse rounded-full bg-emerald-500",
                  iconOnly && "absolute top-1 right-1",
                )}
                aria-hidden
              />
            )}
          </Toggle>
        }
      />
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
