const REPO_URL = "https://github.com/kishanmundha/agent-session-visualizer";

/** What the app says about itself in the header and the About dialog. */
export const APP_INFO = {
  name: "Agent Session Visualizer",
  description:
    "A local web UI for reading agent CLI transcripts: what the agent did, how long it took, and where the tokens went. It reads the session files on this machine and never sends them anywhere.",
  // Inlined from package.json at build time (see next.config.ts).
  version: process.env.APP_VERSION ?? "dev",
  author: { name: "Kishan Mundha", url: "https://github.com/kishanmundha" },
  repoUrl: REPO_URL,
  issuesUrl: `${REPO_URL}/issues`,
  releasesUrl: `${REPO_URL}/releases`,
};
