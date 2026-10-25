import type { AgentEvent } from "@/lib/providers/types";
import { SHELL_TOOL, editList, filePathArg, patchText, samePath, shellCommand } from "./edits";

/**
 * What one call did to one file, read off its arguments, for the Edits tab to
 * show in place: a diff for an edit or a patch, the new text for a write, the
 * command for a shell call. Runs in the browser, on the events the page holds.
 */

export interface DiffLine {
  kind: "add" | "del" | "ctx" | "gap";
  text: string;
}

export type EditPreview =
  | { kind: "diff"; lines: DiffLine[] }
  | { kind: "command"; text: string }
  | { kind: "deleted" }
  /** A patch reported applied, with no request to read its body from. */
  | { kind: "applied"; type: string }
  | { kind: "args"; args: Record<string, unknown> }
  | { kind: "none" };

const OLD_KEYS = ["old_string", "old_str", "oldString"] as const;
const NEW_KEYS = ["new_string", "new_str", "newString"] as const;
const CONTENT_KEYS = ["content", "file_text", "contents", "text", "code"] as const;

/** Unchanged lines kept around each change. */
const CONTEXT = 3;

/** Above this many line pairs a diff shows the old text removed and the new added. */
const MAX_DIFF_CELLS = 1_000_000;

const PATCH_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/;

function stringAt(obj: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    if (typeof obj[key] === "string") return obj[key] as string;
  }
  return undefined;
}

const splitLines = (text: string) => (text === "" ? [] : text.replace(/\n$/, "").split("\n"));

/** Line diff of two texts, cut down to the changes and a few lines around each. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  const lines: DiffLine[] = a.slice(0, start).map((text) => ({ kind: "ctx", text }));
  if (middleA.length * middleB.length > MAX_DIFF_CELLS) {
    lines.push(...middleA.map((text) => ({ kind: "del" as const, text })));
    lines.push(...middleB.map((text) => ({ kind: "add" as const, text })));
  } else {
    lines.push(...lcsDiff(middleA, middleB));
  }
  lines.push(...a.slice(endA).map((text) => ({ kind: "ctx" as const, text })));
  return trimContext(lines);
}

/** Longest-common-subsequence diff, removals before additions within a run. */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const cols = b.length + 1;
  const table = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: "ctx", text: a[i] });
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && table[(i + 1) * cols + j] >= table[i * cols + j + 1])) {
      lines.push({ kind: "del", text: a[i++] });
    } else {
      lines.push({ kind: "add", text: b[j++] });
    }
  }
  return lines;
}

/** Keeps `CONTEXT` unchanged lines on each side of a change; longer runs become a gap. */
function trimContext(lines: DiffLine[]): DiffLine[] {
  const near = lines.map(() => false);
  lines.forEach((line, i) => {
    if (line.kind === "ctx") return;
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(lines.length - 1, i + CONTEXT); k++) {
      near[k] = true;
    }
  });
  const out: DiffLine[] = [];
  lines.forEach((line, i) => {
    if (near[i]) out.push(line);
    else if (out.at(-1)?.kind !== "gap") out.push({ kind: "gap", text: "" });
  });
  return out;
}

/** The part of an `apply_patch` body that changes one file, as diff lines. */
export function patchSection(patch: string, path: string): EditPreview | null {
  const lines = patch.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const header = PATCH_HEADER.exec(lines[i]);
    if (!header || !samePath(header[2].trim(), path)) continue;
    if (header[1] === "Delete") return { kind: "deleted" };
    const out: DiffLine[] = [];
    for (let k = i + 1; k < lines.length && !lines[k].startsWith("*** "); k++) {
      const line = lines[k];
      if (line.startsWith("@@")) {
        if (out.length > 0) out.push({ kind: "gap", text: line.slice(2).trim() });
      } else if (line.startsWith("+")) out.push({ kind: "add", text: line.slice(1) });
      else if (line.startsWith("-")) out.push({ kind: "del", text: line.slice(1) });
      else out.push({ kind: "ctx", text: line.startsWith(" ") ? line.slice(1) : line });
    }
    return { kind: "diff", lines: out };
  }
  return null;
}

/** One old/new pair, or a whole new text, as diff lines; null when the edit has neither. */
function pairDiff(edit: Record<string, unknown>): DiffLine[] | null {
  const before = stringAt(edit, OLD_KEYS);
  const after = stringAt(edit, NEW_KEYS);
  if (before !== undefined || after !== undefined) return lineDiff(before ?? "", after ?? "");
  const content = stringAt(edit, CONTENT_KEYS);
  if (content !== undefined) return splitLines(content).map((text) => ({ kind: "add", text }));
  return null;
}

/** What the call `event` did to `path`. `events` lets a patch report find its request. */
export function editPreview(event: AgentEvent, path: string, events: AgentEvent[]): EditPreview {
  if (event.type === "file.patch_applied") {
    const request = events.find(
      (e) =>
        e.type === "tool.execution_start" &&
        event.data.callId !== undefined &&
        e.data.toolCallId === event.data.callId,
    );
    const fromRequest = request ? editPreview(request, path, events) : null;
    if (fromRequest && fromRequest.kind !== "none" && fromRequest.kind !== "args") return fromRequest;
    const change = ((event.data.changes as { file?: string; type?: string }[]) ?? []).find(
      (c) => c?.file && samePath(c.file, path),
    );
    return change?.type === "delete" ? { kind: "deleted" } : { kind: "applied", type: change?.type ?? "update" };
  }

  const raw = event.data.arguments;
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tool = String(event.data.toolName ?? event.data.name ?? "");

  if (SHELL_TOOL.test(tool)) {
    const command = shellCommand(event.data);
    if (!command) return { kind: "none" };
    return patchSection(command, path) ?? { kind: "command", text: command };
  }

  const patch = patchText(raw);
  if (patch) {
    const section = patchSection(patch, path);
    if (section) return section;
  }

  const listed = editList(args).filter((edit) => {
    const own = filePathArg(edit);
    return own === undefined || samePath(own, path);
  });
  if (listed.length > 0) {
    const lines: DiffLine[] = [];
    for (const edit of listed) {
      const diff = pairDiff(edit);
      if (!diff) continue;
      if (lines.length > 0) lines.push({ kind: "gap", text: "" });
      lines.push(...diff);
    }
    if (lines.length > 0) return { kind: "diff", lines };
  }

  const diff = pairDiff(args);
  if (diff) return { kind: "diff", lines: diff };
  return Object.keys(args).length > 0 ? { kind: "args", args } : { kind: "none" };
}
