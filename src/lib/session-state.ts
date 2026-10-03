import type { SessionMeta } from "@/lib/providers/types";

/**
 * How recently a transcript must have been written for the session to count
 * as running. Agents log nothing while a long tool call is in flight, so this
 * is generous rather than tight.
 */
const RUNNING_WINDOW_MS = 3 * 60_000;

/** Whether the agent wrote to this session in the last few minutes. */
export function isRunning(updatedAt?: string) {
  if (!updatedAt) return false;
  const age = Date.now() - new Date(updatedAt).getTime();
  return Number.isFinite(age) && age < RUNNING_WINDOW_MS;
}

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Shell command that reopens the session in its own CLI. Sessions are looked
 * up relative to the directory they started in, so the command goes there
 * first.
 */
export function resumeCommand(meta: Pick<SessionMeta, "provider" | "id" | "cwd">) {
  const resume =
    meta.provider === "claude"
      ? `claude --resume ${meta.id}`
      : meta.provider === "codex"
        ? `codex resume ${meta.id}`
        : `copilot --resume ${meta.id}`;
  return meta.cwd ? `cd ${quote(meta.cwd)} && ${resume}` : resume;
}
