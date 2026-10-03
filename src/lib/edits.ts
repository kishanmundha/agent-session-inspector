import type { AgentEvent } from "@/lib/providers/types";

/**
 * The files a session wrote to, read off its events and grouped by the prompt
 * that led to them. Runs in the browser, on the events the session page holds.
 */

/** One file changed during a turn. */
export interface TurnFile {
  path: string;
  /** Edit, write and patch calls that named the file in this turn. */
  count: number;
  /** The tools that made them, e.g. `Write`, `Edit`, `apply_patch`. */
  tools: string[];
  /** The first of those calls, to open in the timeline. */
  eventId: string;
}

export interface TurnEdits {
  /** Position of the prompt among the session's prompts, from 1; 0 before the first. */
  turn: number;
  /** The prompt that started the turn; absent for edits made before any prompt. */
  prompt?: string;
  promptEventId?: string;
  timestamp: string;
  /** In the order the files were first touched. */
  files: TurnFile[];
  edits: number;
}

const FILE_ARG_KEYS = ["file_path", "filePath", "notebook_path", "path"] as const;

/** Tools that write a file, across every agent's naming. */
const EDIT_TOOL =
  /^(edit|write|multiedit|notebookedit|update|create|patch|apply_patch|str_replace\w*|(copilot_)?(write|edit|create|replace|insert)\w*(file|string|edit|notebook)\w*)$/i;

const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

function toolNameOf(data: Record<string, unknown>): string {
  const name = data.toolName ?? data.name;
  return typeof name === "string" ? name : "";
}

/** The files one edit-tool call names, from a path argument or a patch body. */
function editedPaths(data: Record<string, unknown>): string[] {
  const raw = data.arguments;
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const key of FILE_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value) return [value];
  }
  const patch = typeof raw === "string" ? raw : (args.input ?? args.patch ?? args.patchText);
  if (typeof patch !== "string") return [];
  return [...new Set([...patch.matchAll(PATCH_FILE)].map((m) => m[1].trim()))];
}

/** Every turn that changed a file, oldest first. */
export function editsByTurn(events: AgentEvent[]): TurnEdits[] {
  // A patch reported on completion lists every file it touched, so the call
  // that requested it is not counted as well.
  const reported = new Set<unknown>();
  for (const e of events) {
    if (e.type === "file.patch_applied" && e.data.callId) reported.add(e.data.callId);
  }

  const turns: TurnEdits[] = [];
  let current: TurnEdits = { turn: 0, timestamp: events[0]?.timestamp ?? "", files: [], edits: 0 };
  let prompts = 0;

  const record = (event: AgentEvent, path: string, tool: string) => {
    if (current.files.length === 0) turns.push(current);
    current.edits++;
    const file = current.files.find((f) => f.path === path);
    if (!file) current.files.push({ path, count: 1, tools: [tool], eventId: event.id });
    else {
      file.count++;
      if (!file.tools.includes(tool)) file.tools.push(tool);
    }
  };

  for (const e of events) {
    if (e.type === "user.message") {
      current = {
        turn: ++prompts,
        prompt: typeof e.data.content === "string" ? e.data.content : undefined,
        promptEventId: e.id,
        timestamp: e.timestamp,
        files: [],
        edits: 0,
      };
    } else if (e.type === "file.patch_applied") {
      if (e.data.success === false) continue;
      for (const change of (e.data.changes as { file?: string }[]) ?? []) {
        if (change?.file) record(e, change.file, "patch");
      }
    } else if (e.type === "tool.execution_start") {
      const tool = toolNameOf(e.data);
      if (!EDIT_TOOL.test(tool) || reported.has(e.data.toolCallId)) continue;
      for (const path of editedPaths(e.data)) record(e, path, tool);
    }
  }
  return turns;
}
