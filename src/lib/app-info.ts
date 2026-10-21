const REPO_URL = "https://github.com/kishanmundha/agent-session-inspector";

/** What the app says about itself in the header and the About dialog; its description is the `about.description` message. */
export const APP_INFO = {
  name: "Agent Session Inspector",
  // Inlined from package.json at build time (see next.config.ts).
  version: process.env.APP_VERSION ?? "dev",
  author: { name: "Kishan Mundha", url: "https://github.com/kishanmundha" },
  repoUrl: REPO_URL,
  issuesUrl: `${REPO_URL}/issues`,
  releasesUrl: `${REPO_URL}/releases`,
};
