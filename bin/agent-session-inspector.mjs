#!/usr/bin/env node
// Launcher for the packaged (standalone) build, run by npx or the installed
// command. Lives at <package>/bin/ beside app/, which holds the server.js that
// `next build` emits; see scripts/package-release.sh.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NAME = "agent-session-inspector";
const MIN_NODE = [22, 13];
const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(PKG_DIR, "app", "server.js");

const HELP = `Usage: ${NAME} [options]

Browse Claude Code, Codex, Copilot, OpenCode and Hermes session transcripts in a
local web UI.

Options:
  -p, --port <port>   Port to listen on (default: 3000, or the next free one)
  -H, --host <host>   Interface to bind (default: 127.0.0.1)
      --no-open       Don't open the browser
  -v, --version       Print the version
  -h, --help          Show this help
`;

function fail(message) {
  console.error(`${NAME}: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { port: null, host: "127.0.0.1", open: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") ? arg.split("=", 2) : [arg];
    const value = () => inline ?? argv[++i] ?? fail(`${flag} needs a value`);
    switch (flag) {
      case "-p":
      case "--port": {
        const port = Number(value());
        if (!Number.isInteger(port) || port < 1 || port > 65535) fail("invalid port");
        opts.port = port;
        break;
      }
      case "-H":
      case "--host":
        opts.host = value();
        break;
      case "--no-open":
        opts.open = false;
        break;
      case "-v":
      case "--version":
        console.log(readVersion());
        process.exit(0);
        break;
      case "-h":
      case "--help":
        console.log(HELP);
        process.exit(0);
        break;
      default:
        fail(`unknown option ${arg}\n\n${HELP}`);
    }
  }
  return opts;
}

function readVersion() {
  try {
    return readFileSync(path.join(PKG_DIR, "VERSION"), "utf8").trim();
  } catch {
    return "dev";
  }
}

function isFree(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}

async function pickPort(preferred, host) {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await isFree(port, host)) return port;
  }
  fail(`no free port between ${preferred} and ${preferred + 19}; pass --port`);
}

async function waitUntilUp(url) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url, { method: "HEAD" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  // No browser (ssh, container) is fine; the URL is already printed.
  spawn(cmd, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}

const opts = parseArgs(process.argv.slice(2));

// npx only warns about package.json "engines", and the app needs node:sqlite.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  fail(`Node.js ${MIN_NODE.join(".")} or newer is required (found ${process.version}).`);
}

if (!existsSync(SERVER)) {
  fail(`no build found at ${SERVER}\nRun scripts/package-release.sh and use dist/${NAME}/bin/${NAME}.mjs.`);
}

let port = opts.port;
if (port === null) {
  port = await pickPort(Number(process.env.PORT) || 3000, opts.host);
} else if (!(await isFree(port, opts.host))) {
  fail(`port ${port} is already in use`);
}

process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.PORT = String(port);
process.env.HOSTNAME = opts.host;

// node:sqlite still announces itself as experimental on Node 22; not useful here.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning).includes("SQLite is an experimental feature")) return;
  emitWarning.call(process, warning, ...rest);
};

// server.js is CommonJS and starts listening on load.
createRequire(import.meta.url)(SERVER);

if (opts.open) {
  const browseHost = opts.host === "0.0.0.0" || opts.host === "::" ? "localhost" : opts.host;
  const url = `http://${browseHost.includes(":") ? `[${browseHost}]` : browseHost}:${port}`;
  if (await waitUntilUp(url)) openBrowser(url);
}
