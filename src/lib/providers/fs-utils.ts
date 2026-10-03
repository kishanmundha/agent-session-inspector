import fs from "fs";
import os from "os";
import path from "path";

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

/** Long payloads are previewed in the UI, so cap what is shipped to the client. */
const TEXT_CAP = 20_000;

export function capText(value: unknown): { text: string; chars: number; truncated: boolean } {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  if (text.length <= TEXT_CAP) return { text, chars: text.length, truncated: false };
  return { text: `${text.slice(0, TEXT_CAP)}…`, chars: text.length, truncated: true };
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
