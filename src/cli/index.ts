/**
 * Terminal reports: the same numbers as the web UI, printed without starting
 * the server. Bundled into cli/cli.mjs by scripts/build-cli.mjs and loaded by
 * the launcher in bin/ when the first argument is one of COMMANDS there.
 */
import { GROUPINGS, parseOptions, SORTS, UsageError, type Options } from "./args";
import { sessionsReport, statsReport, usageReport } from "./reports";

const NAME = "agent-session-inspector";

const FILTERS = `  -d, --days <n>       Days back from today to include (default: 30)
      --all            Include all time
  -a, --agent <id>     Only one agent: claude, codex, copilot, …
  -P, --project <name> Only one project
  -m, --model <id>     Only one model
      --json           Print JSON instead of a table
  -h, --help           Show this help`;

const COMMANDS: Record<string, { run: (opts: Options) => void; help: string }> = {
  usage: {
    run: usageReport,
    help: `Usage: ${NAME} usage [options]

Tokens and estimated cost, by day or along another dimension.

Options:
  -b, --by <field>     Group by ${GROUPINGS.join(", ")} (default: day)
${FILTERS}
`,
  },
  stats: {
    run: statsReport,
    help: `Usage: ${NAME} stats [options]

Sessions, messages, tool calls, active time and cost, with a breakdown by
agent, project and tool.

Options:
  -n, --limit <n>      Projects and tools to list (default: 20)
${FILTERS}
`,
  },
  sessions: {
    run: sessionsReport,
    help: `Usage: ${NAME} sessions [options]

Recent sessions with their turns, tool calls, health and estimated cost.

Options:
  -s, --sort <order>   ${SORTS.join(" or ")} (default: recent)
  -n, --limit <n>      Sessions to list (default: 20)
${FILTERS}
`,
  },
};

/** Runs one report command and returns the process exit code. */
export function run(command: string, argv: string[]): number {
  const entry = COMMANDS[command];
  try {
    if (!entry) throw new UsageError(`unknown command ${command}`);
    const opts = parseOptions(argv);
    if (opts.help) {
      console.log(entry.help);
      return 0;
    }
    entry.run(opts);
    return 0;
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`${NAME}: ${error.message}`);
    if (entry) console.error(`\n${entry.help}`);
    return 1;
  }
}
