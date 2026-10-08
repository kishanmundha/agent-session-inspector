#!/usr/bin/env node
// Bundles src/cli into the single file the launcher loads for report commands
// (usage, stats, sessions). Output defaults to cli/cli.mjs beside bin/, which
// is where bin/agent-session-inspector.mjs looks in a checkout and in the
// packaged build alike.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.resolve(process.argv[2] ?? path.join(ROOT, "cli", "cli.mjs"));

await build({
  entryPoints: [path.join(ROOT, "src", "cli", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  alias: { "@": path.join(ROOT, "src") },
  // Bundled CommonJS dependencies call require() for Node built-ins.
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
