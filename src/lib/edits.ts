import type { AgentEvent } from "@/lib/providers/types";
import { shellWrittenPaths } from "./shell-writes";

/**
 * The files a session wrote to, read off its events and grouped by the prompt
 * that led to them. Runs in the browser, on the events the session page holds.
 */

/** One call that wrote a file: the event to preview it from and open in the timeline. */
export interface FileChange {
  eventId: string;
  tool: string;
}

/** One file changed during a turn. */
export interface TurnFile {
  path: string;
  /** Edit, write, patch and shell calls that wrote the file in this turn. */
  count: number;
  /** The tools that made them, e.g. `Write`, `Edit`, `apply_patch`, `Bash`. */
  tools: string[];
  /** The first of those calls, to open in the timeline. */
  eventId: string;
  /** Every one of those calls, in order. */
  changes: FileChange[];
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

/** Arguments that hold a list of edits, each naming its own file. */
const EDIT_LIST_KEYS = ["replacements", "edits"] as const;

/** Tools that write a file, across every agent's naming. */
const EDIT_TOOL =
  /^(edit|write|multiedit|notebookedit|update|create|patch|replace|search_replace|str_replace\w*|(copilot_)?apply_?patch|(copilot_)?(multi_?)?(write|edit|create|replace|insert)\w*(file|string|edit|notebook)\w*)$/i;

/** Tools that run a shell command, which may write files of its own. */
export const SHELL_TOOL =
  /^(bash|sh|zsh|shell|exec|exec_command|shell_command|local_shell|terminal|run_in_terminal|run_terminal_cmd|run_terminal_command\w*|run_shell_command|run_command|execute_command|container\.exec)$/i;

const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

function toolNameOf(data: Record<string, unknown>): string {
  const name = data.toolName ?? data.name;
  return typeof name === "string" ? name : "";
}

/** The path argument of a call or of one edit in its list, if it has one. */
export function filePathArg(args: Record<string, unknown>): string | undefined {
  for (const key of FILE_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/** The edits of a multi-file call, such as VS Code's `multi_replace_string_in_file`. */
export function editList(args: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of EDIT_LIST_KEYS) {
    const list = args[key];
    if (Array.isArray(list)) {
      return list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }
  return [];
}

/** The patch body of a call, given as its whole argument or under a patch key. */
export function patchText(raw: unknown): string | undefined {
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const patch = typeof raw === "string" ? raw : (args.input ?? args.patch ?? args.patchText);
  return typeof patch === "string" ? patch : undefined;
}

/** The files one edit-tool call names: a path argument, a list of edits, or a patch body. */
function editedPaths(data: Record<string, unknown>): string[] {
  const raw = data.arguments;
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const path = filePathArg(args);
  if (path) return [path];
  const listed = editList(args).map(filePathArg).filter((p): p is string => !!p);
  if (listed.length > 0) return [...new Set(listed)];
  const patch = patchText(raw);
  return patch ? patchedFiles(patch) : [];
}

export const patchedFiles = (patch: string) => [
  ...new Set([...patch.matchAll(PATCH_FILE)].map((m) => m[1].trim())),
];

/**
 * Codex's code-mode `exec` custom tool, which takes JavaScript in `input`
 * rather than a command line. Its local shell call shares the name but
 * carries a `command`.
 */
function isCodeModeExec(data: Record<string, unknown>): boolean {
  const args = data.arguments;
  return (
    toolNameOf(data) === "exec" &&
    !!args &&
    typeof args === "object" &&
    "input" in args &&
    !("command" in args || "cmd" in args)
  );
}

/** The command line of a shell-tool call, whether given as text or as argv. */
export function shellCommand(data: Record<string, unknown>): string | undefined {
  const raw = data.arguments;
  if (typeof raw === "string") return raw;
  if (isCodeModeExec(data)) return undefined;
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
    const change = { eventId: event.id, tool };
    if (!file) current.files.push({ path, count: 1, tools: [tool], eventId: event.id, changes: [change] });
    else {
      file.count++;
      file.changes.push(change);
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

/** A path and the one a patch or a report names, which may be relative to the other. */
export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.endsWith(`/${short.replace(/^\.\//, "")}`);
}

/**
 * Files the agent's own records list that no edit in the timeline accounts
 * for, such as the workspace files Copilot saves beside a session.
 */
export function unmatchedFiles(turns: TurnEdits[], recorded: string[]): string[] {
  // Exact paths: a name Copilot saved beside the session is not a workspace file of the same name.
  const edited = new Set(turns.flatMap((turn) => turn.files.map((f) => f.path)));
  return [...new Set(recorded)].filter((path) => !edited.has(path));
}
