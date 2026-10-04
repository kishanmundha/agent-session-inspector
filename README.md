# Agent Session Inspector

[![npm version](https://img.shields.io/npm/v/agent-session-inspector)](https://www.npmjs.com/package/agent-session-inspector)
[![CI](https://github.com/kishanmundha/agent-session-inspector/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kishanmundha/agent-session-inspector/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/agent-session-inspector)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/agent-session-inspector)](LICENSE)

A local web UI for reading coding-agent transcripts (Claude Code, Codex, GitHub
Copilot, OpenCode, Hermes): what the agent did, how long it took, and where the
tokens went.

> **Your sessions never leave your machine.** The app collects nothing: no
> telemetry, no analytics, no account, no cloud. It reads the transcript files
> already on your disk, read-only, and serves them to your own browser on
> `127.0.0.1`. See [Privacy](#privacy) for the details and how to check.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/session-overview-dark.png">
  <img alt="Session overview: token, cost, health and timing stats above the event timeline" src="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/session-overview.png">
</picture>

## Quick start

Run it with [Node.js](https://nodejs.org) 22.13 or newer, nothing to install:

```bash
npx agent-session-inspector
```

It serves on [http://localhost:3000](http://localhost:3000) (or the next free
port), bound to `127.0.0.1` only, and opens your browser. `--port`, `--host` and
`--no-open` change that; `--help` lists everything.

`npx agent-session-inspector@latest` picks up a new release. To keep the command
around instead, install it globally:

```bash
npm install -g agent-session-inspector
```

### Install script

The same build is on GitHub Releases, with an installer that needs only Node,
`curl` and `tar`:

```bash
curl -fsSL https://github.com/kishanmundha/agent-session-inspector/releases/latest/download/install.sh | bash
```

It puts the app in `~/.agent-session-inspector` and links an
`agent-session-inspector` command into `~/.local/bin`. Re-run the install
command to update. To uninstall:

```bash
rm -rf ~/.agent-session-inspector ~/.local/bin/agent-session-inspector
```

The install script needs bash, so it covers macOS, Linux and WSL. On Windows
use `npx`.

## Supported agents

| Agent                         | Reads from                                     | Session titles        | Logs |
| ----------------------------- | ---------------------------------------------- | --------------------- | ---- |
| GitHub Copilot CLI            | `~/.copilot/session-state`, `~/.copilot/logs`  | checkpoint DB         | yes  |
| GitHub Copilot Chat (VS Code) | `<Code>/User/workspaceStorage/*/chatSessions`  | chat title            | no   |
| Claude Code                   | `~/.claude/projects/<project>/<session>.jsonl` | `custom`/`ai` titles  | no   |
| Claude Cowork                 | `<Claude>/local-agent-mode-sessions`           | session descriptor    | no   |
| OpenAI Codex CLI              | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | `session_index.jsonl` | no   |
| OpenCode                      | `~/.local/share/opencode/opencode.db`          | `session` table       | no   |
| Hermes Agent                  | `~/.hermes/state.db`                           | `sessions` table      | no   |

`<Code>` and `<Claude>` are the desktop apps' data folders: `~/Library/Application
Support/…` on macOS, `%APPDATA%\…` on Windows, `~/.config/…` on Linux. VS Code
Insiders is read too. The two SQLite stores are opened read-only.

Two things differ from the CLIs that log every request:

- **Copilot Chat** meters a whole request, and its prompt count is that of the
  last model round. For a request that called tools, input tokens and cost are a
  floor.
- **Hermes** counts tokens per session, so its usage appears as one checkpoint at
  the end of the timeline rather than per message.

Whichever directories exist on the machine show up; the rest are hidden.

## Privacy

Transcripts hold your prompts, code and file contents, so the app is built to
keep them on the machine. Nothing about you or your sessions is collected, by
this project or anyone else:

- **No data collection.** There is no telemetry, analytics, crash reporting,
  account or sync, and Next.js's own telemetry is switched off.
- **No outbound requests.** The app reads the session files in place and talks
  only to your browser. Fonts and the price table used for cost estimates are
  bundled, not fetched. The one download is the app itself, when `npx` or the
  install script fetches it.
- **Local only.** The server binds to `127.0.0.1`, so other machines on your
  network cannot reach it unless you pass `--host`.
- **Read-only.** Session files are only read, and the SQLite stores are opened
  read-only. The app never edits or deletes a transcript.

You don't have to take this on trust. The code is open, and the browser's
Network tab shows every request going to `localhost` and nowhere else; the app
works the same with the network disconnected.

## Features

**Analytics across sessions.** Cost, messages, tool calls and active time for
the selected range, with an activity calendar and filters for project, agent
and model.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/analytics-dark.png">
  <img alt="Analytics tab: cost, session and token totals above an activity calendar" src="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/analytics.png">
</picture>

**All sessions in one place.** Every session of every supported agent on the
machine, filterable by agent and searchable by title, repo, branch or id.
Each card shows turns, tool calls, health grade, cost and tokens in/out at a
glance.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/sessions-dark.png">
  <img alt="Session list with agent filters, search and per-session health, cost and token counts" src="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/sessions.png">
</picture>

**Step-by-step timeline.** Prompts, reasoning, tool calls and their results in
order, with per-step token counts and cost. Expand any event to see its content, or open
the raw record.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/timeline-dark.png">
  <img alt="Event timeline showing user prompt, thinking, and Grep/Read tool calls" src="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/timeline.png">
</picture>

**Token Optimizer.** What the session cost by token class, model and turn, where
the context went (system prompt vs. tool results vs. replies), which tools ran
most, and hints for trimming expensive sessions.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/token-optimizer-dark.png">
  <img alt="Token Optimizer: estimated cost by token class and model, and a cost-by-turn chart" src="https://raw.githubusercontent.com/kishanmundha/agent-session-inspector/main/docs/screenshots/token-optimizer.png">
</picture>

**Projects.** Sessions are grouped by the repository they ran in, so work
started from a subfolder or a git worktree lands in the same project. The
Projects tab lists each one with its sessions, cost and tokens, and picking a
project filters Analytics, Usage and Sessions together. Outside a repository,
the working directory is the project; the dated scratch folders the Codex app
creates for project-less chats count as one project.

**Activity.** One day at a time: how many sessions were working at once in each
15-minute slot, the agent time and cost of each session, and the day's split by
project, model and agent.

**Edits per turn.** A session's Edits tab lists each prompt with the files the
agent wrote, edited or patched in response, linked to the event in the timeline.

**Skills and MCP tools.** The Analytics tab counts which skills were loaded and
which MCP servers and tools were called, for the selected range.

> Screenshots use synthetic demo data. To reproduce them locally, see
> [CONTRIBUTING.md](CONTRIBUTING.md#demo-data).

## How it works

Every agent writes a different transcript format, so the app normalizes them into
one canonical event vocabulary and the UI only ever sees that.

```
src/lib/providers/
  types.ts      canonical model: SessionMeta, AgentEvent, SessionDetail, SessionProvider
  analysis.ts   provider-agnostic stats + token-cost hints
  pricing.ts    dated price table lookup, per-event and per-session cost
  prices.json   bundled list prices, USD per million tokens
  fs-utils.ts   jsonl reading, directory walking, mtime-keyed caching
  sqlite-utils.ts  read-only access to agents that keep sessions in SQLite
  copilot.ts    ~/.copilot adapter
  vscode.ts     Copilot Chat in VS Code: replays the editor's chat change logs
  claude.ts     ~/.claude adapter
  cowork.ts     Claude desktop agent mode; reuses the Claude transcript parser
  codex.ts      ~/.codex adapter
  opencode.ts   OpenCode's opencode.db
  hermes.ts     Hermes Agent's state.db
  index.ts      registry: listSessions / getSession / listLogs across providers
```

Events are typed `category.subCategory` — `user.message`, `assistant.message`,
`assistant.thinking`, `tool.execution_start`, `tool.execution_complete`,
`external_tool.requested`, `context.attachment`, `file.patch_applied`,
`web.search`, `session.*`. Anything an adapter emits outside that list still
renders through a generic card, so a new record type is never a crash.

Token accounting is centralized: adapters put per-message usage on the event
(`inputTokens` / `outputTokens` / `cacheReadTokens`) or, when a provider reports
running totals, attach `data.sessionTotals`. The latest `sessionTotals` wins over
summation.

### Cost estimates

Each session, and each request in the timeline, shows an estimated cost in
dollars. Adapters attach `data.billedUsage` to the events that carry usage, with
uncached input, cache reads, cache writes and output kept as separate,
non-overlapping counts, and `pricing.ts` multiplies them by the model's list
price. The Token Optimizer tab splits the total by token class and by model.

The figure is an API-equivalent estimate, not a bill: subscription and
request-based plans charge differently, and requests an agent makes outside the
transcript (title generation, for example) are not counted.

Prices are never stored with a session; cost is computed on every load. To
correct a price, add a model the bundled table does not know, or record a price
change, create `~/.agent-session-inspector/pricing.json`. It is merged over
[`prices.json`](src/lib/providers/prices.json) per model and picked up without a
restart:

```json
{
  "my-local-model": { "input": 0, "output": 0 },
  "claude-opus-5-5": [
    {
      "input": 4,
      "output": 20,
      "cacheRead": 0.2,
      "cacheWrite": 5,
      "cacheWrite1h": 8
    },
    {
      "from": "2027-01-01",
      "input": 3,
      "output": 15,
      "cacheRead": 0.15,
      "cacheWrite": 3.75,
      "cacheWrite1h": 6
    }
  ]
}
```

A model with several entries is priced by date: each request uses the entry
whose `from` day is the latest one on or before the request, so a price change
does not rewrite the cost of older sessions. Models with no price show as
unpriced and are left out of the total rather than counted as free.

### Session health

Every session gets a score out of 100 and a grade (A to F), shown on its card
and in its header. The score is rule-based and read straight off the transcript
by `health.ts`: it measures how smoothly the session ran, not whether the result
was any good. A session starts at 100 and loses points for:

| Signal            | What it means                                        | Points         |
| ----------------- | ---------------------------------------------------- | -------------- |
| Unfinished        | Ends on an API error, or stops without a final reply | 25 / 15        |
| Tool failures     | Share of tool results that failed                    | up to 25       |
| Retry loops       | The same tool failing three times in a row           | 6 each, max 18 |
| API errors        | Errors and retried requests                          | 2 each, max 10 |
| Interrupted turns | Turns stopped before the agent finished              | 4 each, max 12 |
| Compactions       | Context summarized mid-session                       | 3 each, max 9  |

90 and up is an A, 80 a B, 70 a C, 60 a D. A session that is still running is not
marked down for being unfinished. Click the Health card on a session to see what
it lost points for and jump to those events; the Quality tab on the home page
shows grades, outcomes and the most common problems across sessions.

## Contributing

Bug reports and pull requests are welcome; open an
[issue](https://github.com/kishanmundha/agent-session-inspector/issues) for anything that looks wrong, ideally with the
agent, OS and Node version. [CONTRIBUTING.md](CONTRIBUTING.md) covers running
from source, demo data, adding a provider and releasing.

## License

[MIT](LICENSE) © Kishan Mundha
