import fs from "fs";
import path from "path";
import type { SessionDetail, SessionMeta, SessionProvider } from "./types";
import { quickStatsFromEvents } from "./analysis";
import { parseClaudeTranscript } from "./claude";
import {
  appDataDir,
  createFileCache,
  isoFromMs,
  parseJson,
  safeReadFile,
  safeReaddir,
  statOf,
  tildePath,
  walkFiles,
} from "./fs-utils";

/**
 * Cowork is the agent mode of the Claude desktop app. Each session is a
 * `local_<id>.json` descriptor next to a `local_<id>/` folder, and inside that
 * folder runs a regular Claude Code CLI with its own `.claude/projects`.
 */
const SESSIONS_DIR = path.join(appDataDir("Claude"), "local-agent-mode-sessions");

/** `<account>/<organization>/[agent/]local_<id>.json` */
const DESCRIPTOR_DEPTH = 3;
const DESCRIPTOR = /^local_.+\.json$/;

interface CoworkDescriptor {
  sessionId?: string;
  cliSessionId?: string;
  processName?: string;
  title?: string;
  model?: string;
  createdAt?: number;
  lastActivityAt?: number;
  isArchived?: boolean;
  userSelectedFolders?: string[];
}

const readDescriptor = createFileCache(
  (filePath: string): CoworkDescriptor => parseJson<CoworkDescriptor>(safeReadFile(filePath)) ?? {},
);

/** The CLI transcript of a session: the one its descriptor names, else the newest. */
function transcriptOf(sessionDir: string, cliSessionId?: string): string | null {
  const projectsDir = path.join(sessionDir, ".claude", "projects");
  let newest: { filePath: string; mtimeMs: number } | null = null;
  for (const project of safeReaddir(projectsDir)) {
    for (const entry of safeReaddir(path.join(projectsDir, project))) {
      if (!entry.endsWith(".jsonl")) continue;
      const filePath = path.join(projectsDir, project, entry);
      if (cliSessionId && entry === `${cliSessionId}.jsonl`) return filePath;
      const mtimeMs = statOf(filePath)?.mtimeMs ?? 0;
      if (!newest || mtimeMs > newest.mtimeMs) newest = { filePath, mtimeMs };
    }
  }
  return newest?.filePath ?? null;
}

interface CoworkSession {
  id: string;
  descriptorPath: string;
  transcript: string;
}

function sessions(): CoworkSession[] {
  const out: CoworkSession[] = [];
  for (const descriptorPath of walkFiles(SESSIONS_DIR, (name) => DESCRIPTOR.test(name), DESCRIPTOR_DEPTH)) {
    const sessionDir = descriptorPath.slice(0, -".json".length);
    const transcript = transcriptOf(sessionDir, readDescriptor(descriptorPath).cliSessionId);
    if (transcript) out.push({ id: path.basename(sessionDir), descriptorPath, transcript });
  }
  return out;
}

const parseTranscript = createFileCache((filePath: string) => {
  // The session folder is named after the Cowork id the descriptor carries.
  const id = path.basename(filePath.split(`${path.sep}.claude${path.sep}`)[0]);
  return parseClaudeTranscript(filePath, "cowork", id);
});

function metaOf(session: CoworkSession): SessionMeta {
  const descriptor = readDescriptor(session.descriptorPath);
  const { meta } = parseTranscript(session.transcript);
  return {
    ...meta,
    title: descriptor.title || meta.title,
    model: meta.model ?? descriptor.model,
    // The CLI runs in a sandbox folder that means nothing to the user; the
    // folder they picked for the session, when there is one, is the project.
    cwd: descriptor.userSelectedFolders?.[0],
    created_at: meta.created_at ?? (isoFromMs(descriptor.createdAt) || undefined),
    updated_at: meta.updated_at ?? (isoFromMs(descriptor.lastActivityAt) || undefined),
  };
}

const summarize = createFileCache((transcript: string) =>
  quickStatsFromEvents(parseTranscript(transcript).events),
);

export const coworkProvider: SessionProvider = {
  info: {
    id: "cowork",
    label: "Claude Cowork",
    shortLabel: "Cowork",
    rootDir: tildePath(SESSIONS_DIR),
    supportsLogs: false,
  },

  isAvailable() {
    return fs.existsSync(SESSIONS_DIR);
  },

  listSessions() {
    return sessions().map((session) => ({
      ...metaOf(session),
      ...summarize(session.transcript),
    }));
  },

  getSession(id) {
    const session = sessions().find((s) => s.id === id);
    if (!session) return null;
    const descriptor = readDescriptor(session.descriptorPath);
    const { events, files } = parseTranscript(session.transcript);
    const meta = metaOf(session);

    return {
      meta: { ...meta, ...quickStatsFromEvents(events) },
      events,
      files,
      checkpoints: [],
      research: [],
      rawMeta: {
        name: path.basename(session.descriptorPath),
        content: JSON.stringify(
          {
            descriptor: session.descriptorPath,
            transcript: session.transcript,
            processName: descriptor.processName,
            cliSessionId: descriptor.cliSessionId,
            archived: descriptor.isArchived,
            folders: descriptor.userSelectedFolders,
            ...meta,
          },
          null,
          2,
        ),
        language: "json",
      },
      storagePath: session.descriptorPath.slice(0, -".json".length),
    } satisfies Omit<SessionDetail, "stats" | "tokenAnalysis" | "cost">;
  },

  listLogs() {
    return [];
  },

  getLogContent() {
    return "";
  },
};
