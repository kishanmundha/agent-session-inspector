import type { ProviderId } from "@/lib/providers/types";

/**
 * Client-safe presentation data for each provider. Kept apart from the
 * adapters so components never pull `fs` into the browser bundle.
 */
export interface ProviderStyle {
  id: ProviderId;
  label: string;
  shortLabel: string;
  rootDir: string;
  /** Badge/chip colours, light and dark. */
  badgeCls: string;
  /** Solid accent used for dots and active states. */
  dotCls: string;
}

export const PROVIDER_STYLES: Record<ProviderId, ProviderStyle> = {
  copilot: {
    id: "copilot",
    label: "GitHub Copilot CLI",
    shortLabel: "Copilot",
    rootDir: "~/.copilot",
    badgeCls:
      "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  vscode: {
    id: "vscode",
    label: "GitHub Copilot Chat (VS Code)",
    shortLabel: "VS Code",
    rootDir: "VS Code workspace storage",
    badgeCls:
      "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
    dotCls: "bg-blue-500",
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    rootDir: "~/.claude/projects",
    badgeCls:
      "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
    dotCls: "bg-orange-500",
  },
  cowork: {
    id: "cowork",
    label: "Claude Cowork",
    shortLabel: "Cowork",
    rootDir: "Claude desktop app data",
    badgeCls:
      "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex CLI",
    shortLabel: "Codex",
    rootDir: "~/.codex/sessions",
    badgeCls:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  opencode: {
    id: "opencode",
    label: "OpenCode",
    shortLabel: "OpenCode",
    rootDir: "~/.local/share/opencode",
    badgeCls:
      "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300",
    dotCls: "bg-violet-500",
  },
  hermes: {
    id: "hermes",
    label: "Hermes Agent",
    shortLabel: "Hermes",
    rootDir: "~/.hermes",
    badgeCls:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    shortLabel: "Gemini",
    rootDir: "~/.gemini/tmp",
    badgeCls:
      "border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300",
    dotCls: "bg-indigo-500",
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    shortLabel: "Cursor",
    rootDir: "Cursor app data",
    badgeCls:
      "border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300",
    dotCls: "bg-teal-500",
  },
};

export const PROVIDER_ORDER: ProviderId[] = [
  "copilot",
  "vscode",
  "claude",
  "cowork",
  "codex",
  "opencode",
  "hermes",
  "gemini",
  "cursor",
];

/** Every supported agent by name, for telling a new user what to expect. */
export const SUPPORTED_AGENTS = new Intl.ListFormat("en", { type: "disjunction" }).format(
  PROVIDER_ORDER.map((id) => PROVIDER_STYLES[id].label),
);

export function providerStyle(id: string | undefined): ProviderStyle {
  return PROVIDER_STYLES[(id ?? "copilot") as ProviderId] ?? PROVIDER_STYLES.copilot;
}
