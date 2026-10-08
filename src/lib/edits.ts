import type { AgentEvent } from "@/lib/providers/types";
import { shellWrittenPaths } from "./shell-writes";

/**
 * The files a session wrote to, read off its events and grouped by the prompt
 * that led to them. Runs in the browser, on the events the session page holds.
 */

/** One file changed during a turn. */
export interface TurnFile {
  path: string;
  /** Edit, write, patch and shell calls that wrote the file in this turn. */
  count: number;
  /** The tools that made them, e.g. `Write`, `Edit`, `apply_patch`, `Bash`. */
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

const FILE_ARG_KEYS = ["file_path", "filePath", "notebook_path", "path", "target_file"] as const;

/** Tools that write a file, across every agent's naming. */
const EDIT_TOOL =
  /^(edit|write|multiedit|notebookedit|update|create|patch|apply_patch|replace|search_replace|str_replace\w*|(copilot_)?(write|edit|create|replace|insert)\w*(file|string|edit|notebook)\w*)$/i;

/** Tools that run a shell command, which may write files of its own. */
const SHELL_TOOL =
  /^(bash|sh|zsh|shell|exec|exec_command|shell_command|local_shell|terminal|run_in_terminal|run_terminal_cmd|run_terminal_command\w*|run_shell_command|run_command|execute_command|container\.exec)$/i;

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
  return patchedFiles(patch);
}

const patchedFiles = (patch: string) => [
  ...new Set([...patch.matchAll(PATCH_FILE)].map((m) => m[1].trim())),
];

/** The command line of a shell-tool call, whether given as text or as argv. */
function shellCommand(data: Record<string, unknown>): string | undefined {
  const raw = data.arguments;
  if (typeof raw === "string") return raw;
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const command = args.command ?? args.cmd ?? args.script ?? args.input;
  if (typeof command === "string") return command;
  if (!Array.isArray(command) || !command.every((part) => typeof part === "string")) return undefined;
  // `["bash", "-lc", "<script>"]` carries the command line as one argument.
  return /^-l?c$/.test(command[1] ?? "") && command.length === 3 ? command[2] : command.join(" ");
}

/** The files a shell call wrote: those of a patch it applied, or of the command itself. */
function shellEditedPaths(data: Record<string, unknown>, cwd?: string): string[] {
  const command = shellCommand(data);
  if (!command) return [];
  const patched = patchedFiles(command);
  return patched.length > 0 ? patched : shellWrittenPaths(command, cwd);
}

/**
 * Every turn that changed a file, oldest first. Relative paths in shell
 * commands are resolved against `cwd`, the session's working directory.
 */
export function editsByTurn(events: AgentEvent[], cwd?: string): TurnEdits[] {
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
      if (reported.has(e.data.toolCallId)) continue;
      const paths = EDIT_TOOL.test(tool)
        ? editedPaths(e.data)
        : SHELL_TOOL.test(tool)
          ? shellEditedPaths(e.data, cwd)
          : [];
      for (const path of paths) record(e, path, tool);
    }
  }
  return turns;
}
