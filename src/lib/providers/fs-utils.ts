import fs from "fs";
import os from "os";
import path from "path";
import type { ToolImage, ToolResult } from "./types";

export function safeReadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

export function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export function statOf(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/** Parse a JSON-lines file, skipping blank and malformed lines. */
export function readJsonl<T>(filePath: string): T[] {
  const content = safeReadFile(filePath);
  if (!content) return [];
  const out: T[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

/** The record `readJsonl` returns at `index`, read fresh from disk. */
export function readJsonlRecord(filePath: string, index: string): unknown {
  if (!/^\d+$/.test(index)) return null;
  return readJsonl<unknown>(filePath)[Number(index)] ?? null;
}

/** Recursively collect files matching a predicate, bounded by depth. */
export function walkFiles(
  dir: string,
  match: (name: string) => boolean,
  maxDepth = 6,
): string[] {
  if (maxDepth < 0) return [];
  const out: string[] = [];
  for (const entry of safeReaddir(dir)) {
    const full = path.join(dir, entry);
    const stat = statOf(full);
    if (!stat) continue;
    if (stat.isDirectory()) {
      out.push(...walkFiles(full, match, maxDepth - 1));
    } else if (match(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Memoizes an expensive per-file parse, keyed on mtime+size so an edited
 * transcript is re-read but an unchanged one is not.
 */
export function createFileCache<T>(compute: (filePath: string) => T) {
  const cache = new Map<string, { key: string; value: T }>();
  return (filePath: string): T => {
    const stat = statOf(filePath);
    const key = stat ? `${stat.mtimeMs}:${stat.size}` : "missing";
    const hit = cache.get(filePath);
    if (hit && hit.key === key) return hit.value;
    const value = compute(filePath);
    cache.set(filePath, { key, value });
    return value;
  };
}

const gitRoots = new Map<string, string | null>();

/**
 * The repository a working directory belongs to: the nearest ancestor holding
 * `.git`, with a linked worktree resolved to its main checkout. Null when the
 * directory is not in a repository, or no longer exists on this machine.
 * Remembered for the life of the process.
 */
export function findGitRoot(cwd: string): string | null {
  const cached = gitRoots.get(cwd);
  if (cached !== undefined) return cached;

  // A repository at the home directory (dotfiles) would swallow every project.
  const home = os.homedir();
  let root: string | null = null;
  for (let dir = path.resolve(cwd); dir !== home && dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const stat = statOf(path.join(dir, ".git"));
    if (!stat) continue;
    root = dir;
    if (stat.isFile()) {
      // A worktree's `.git` is a file pointing into the main checkout.
      const main = safeReadFile(path.join(dir, ".git")).match(
        /^gitdir:\s*(.+)[\\/]\.git[\\/]worktrees[\\/][^\\/]+\s*$/m,
      );
      if (main) root = path.resolve(dir, main[1]);
    }
    break;
  }
  gitRoots.set(cwd, root);
  return root;
}

/**
 * Where a desktop app keeps its data on this platform: `Application Support`
 * on macOS, `%APPDATA%` on Windows, `~/.config` elsewhere.
 */
export function appDataDir(appName: string): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", appName);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), appName);
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), appName);
}

/** A path for display, with the home directory as `~`. */
export function tildePath(target: string): string {
  const home = os.homedir();
  return target.startsWith(home) ? `~${target.slice(home.length)}` : target;
}

/**
 * Set when the app runs in a container that only sees the user's files through
 * mounts: where the home directory, and the desktop apps' data directory, live
 * on the machine the user is sitting at.
 */
const HOST_HOME = process.env.ASI_HOST_HOME;
const HOST_APP_DATA = process.env.ASI_HOST_APP_DATA;

/** Whether paths this process sees are the ones the user sees. */
export const ON_HOST = !HOST_HOME;

/** A path as the user would find it on their own machine. */
export function hostPath(target: string): string {
  if (!HOST_HOME) return target;
  // App data first: it sits inside the home directory here, but need not there.
  const roots: [string, string | undefined][] = [
    [appDataDir(""), HOST_APP_DATA],
    [os.homedir(), HOST_HOME],
  ];
  for (const [seen, real] of roots) {
    const rel = path.relative(seen, target);
    if (real && !rel.startsWith("..") && !path.isAbsolute(rel)) return path.join(real, rel);
  }
  return target;
}

/** Long payloads are previewed in the UI, so cap what is shipped to the client. */
const TEXT_CAP = 20_000;

export function capText(value: unknown): { text: string; chars: number; truncated: boolean } {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  if (text.length <= TEXT_CAP) return { text, chars: text.length, truncated: false };
  return { text: `${text.slice(0, TEXT_CAP)}…`, chars: text.length, truncated: true };
}

const TEXT_PARTS = /^(text|input_text|output_text)$/;
const DATA_URI = /^data:([^;,]+)?(?:;[^,]*)?,/;

/** Decoded size of a base64 payload. */
function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/** An image part in the Anthropic or OpenAI shape; null for anything else. */
function imageOf(part: Record<string, unknown>): ToolImage | null {
  if (part.type === "image") {
    const source = (part.source ?? {}) as { media_type?: string; data?: string };
    return {
      mediaType: source.media_type,
      bytes: typeof source.data === "string" ? base64Bytes(source.data) : undefined,
    };
  }
  if (part.type === "input_image" || part.type === "image_url") {
    const url = part.image_url as string | { url?: string } | undefined;
    const href = typeof url === "string" ? url : (url?.url ?? "");
    const uri = DATA_URI.exec(href);
    if (!uri) return {};
    return { mediaType: uri[1], bytes: base64Bytes(href.slice(uri[0].length)) };
  }
  return null;
}

/** A string that holds a JSON document, indented; null when it is prose. */
function indentJson(text: string): string | null {
  const trimmed = text.trim();
  if (!/^[{[]/.test(trimmed) || !/[}\]]$/.test(trimmed)) return null;
  const parsed = parseJson<unknown>(trimmed);
  return parsed && typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : null;
}

/**
 * Reduces whatever a tool returned to readable text. Agents record a string,
 * a list of typed parts, or a bare object; images are counted, not shipped.
 * Spread the outcome into the event: `resultChars` is the size of the text the
 * model was given, before the display cap and without the images.
 */
export function toolResult(raw: unknown): {
  result: ToolResult;
  resultChars: number;
  truncated: boolean;
} {
  const images: ToolImage[] = [];
  let format: ToolResult["format"] = "text";
  let text: string;
  let chars: number;

  if (typeof raw === "string" || raw == null) {
    text = raw ?? "";
    chars = text.length;
  } else if (Array.isArray(raw)) {
    const texts: string[] = [];
    for (const part of raw) {
      if (typeof part === "string") {
        texts.push(part);
        continue;
      }
      const p = (part ?? {}) as Record<string, unknown>;
      const image = imageOf(p);
      if (image) images.push(image);
      else if (typeof p.text === "string" && (!p.type || TEXT_PARTS.test(String(p.type)))) texts.push(p.text);
      else if (p.type === "tool_reference") texts.push(`[tool reference: ${String(p.tool_name ?? "")}]`);
      else texts.push(JSON.stringify(p));
    }
    text = texts.join("\n");
    chars = text.length;
  } else {
    text = JSON.stringify(raw, null, 2);
    chars = JSON.stringify(raw).length;
    format = "json";
  }

  if (format === "text") {
    const indented = indentJson(text);
    if (indented !== null) {
      text = indented;
      format = "json";
    }
  }

  const capped = capText(text);
  return {
    result: {
      content: capped.text,
      format,
      ...(images.length > 0 ? { images } : {}),
    },
    resultChars: chars,
    truncated: capped.truncated,
  };
}

/** Size of a tool call's arguments as the model wrote them. */
export function argumentChars(args: unknown): number {
  if (typeof args === "string") return args.length;
  return args == null ? 0 : (JSON.stringify(args)?.length ?? 0);
}

/** Epoch milliseconds as the ISO timestamp events carry; empty when unusable. */
export function isoFromMs(ms: unknown): string {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0
    ? new Date(ms).toISOString()
    : "";
}

export function parseJson<T>(text: unknown): T | null {
  if (typeof text !== "string" || !text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
