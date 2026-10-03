import type { ProviderId, SessionMeta } from "@/lib/providers/types";

/** Filter value that matches every project. */
export const ALL_PROJECTS = "all";

/** All-time totals for one project, summed over its sessions. */
export interface ProjectSummary {
  name: string;
  /** Folder the project lives in; absent when only a repository name is known. */
  path?: string;
  sessions: number;
  /** Estimated list-price cost; a floor when `unpriced` is set. */
  costUSD: number;
  /** Some sessions used a model with no price. */
  unpriced: boolean;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  /** Most recent session update, ISO; empty when no session has a date. */
  lastActive: string;
  providers: ProviderId[];
}

const UNKNOWN = "unknown";

export function projectOf(session: SessionMeta): string {
  return session.project ?? UNKNOWN;
}

/** One row per project, most recently active first. */
export function summarizeProjects(sessions: SessionMeta[]): ProjectSummary[] {
  const projects = new Map<string, ProjectSummary>();
  for (const s of sessions) {
    const name = projectOf(s);
    let project = projects.get(name);
    if (!project) {
      project = {
        name,
        path: s.projectPath,
        sessions: 0,
        costUSD: 0,
        unpriced: false,
        inputTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        lastActive: "",
        providers: [],
      };
      projects.set(name, project);
    }
    project.sessions += 1;
    project.costUSD += s.estimatedCostUSD ?? 0;
    if (s.unpricedModels?.length) project.unpriced = true;
    project.inputTokens += s.totalInputTokens ?? 0;
    project.outputTokens += s.totalOutputTokens ?? 0;
    project.toolCalls += s.toolCallCount ?? 0;
    const updated = s.updated_at ?? s.created_at ?? "";
    if (updated > project.lastActive) project.lastActive = updated;
    if (!project.providers.includes(s.provider)) project.providers.push(s.provider);
  }
  return [...projects.values()].sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}
