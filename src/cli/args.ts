import { isProviderId, PROVIDERS } from "@/lib/providers";

/** A mistake in the command line: printed without a stack, exit code 1. */
export class UsageError extends Error {}

export const GROUPINGS = ["day", "week", "month", "project", "model", "agent"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const SORTS = ["recent", "cost"] as const;
export type Sort = (typeof SORTS)[number];

export interface Options {
  /** How many days back from today to include; null for all time. */
  days: number | null;
  /** Provider id, or "all". */
  agent: string;
  project: string;
  model: string;
  by: Grouping;
  sort: Sort;
  limit: number;
  json: boolean;
  help: boolean;
}

const DEFAULTS: Options = {
  days: 30,
  agent: "all",
  project: "all",
  model: "all",
  by: "day",
  sort: "recent",
  limit: 20,
  json: false,
  help: false,
};

function oneOf<T extends string>(flag: string, value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new UsageError(`${flag} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function positiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${flag} needs a whole number above 0`);
  return n;
}

export function parseOptions(argv: string[]): Options {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") ? arg.split("=", 2) : [arg];
    const value = () => {
      const next = inline ?? argv[++i];
      if (next === undefined) throw new UsageError(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "-d":
      case "--days":
        opts.days = positiveInt(flag, value());
        break;
      case "--all":
        opts.days = null;
        break;
      case "-a":
      case "--agent": {
        const id = value().toLowerCase();
        if (!isProviderId(id)) {
          const ids = PROVIDERS.map((p) => p.info.id).join(", ");
          throw new UsageError(`unknown agent "${id}"; use one of: ${ids}`);
        }
        opts.agent = id;
        break;
      }
      case "-P":
      case "--project":
        opts.project = value();
        break;
      case "-m":
      case "--model":
        opts.model = value();
        break;
      case "-b":
      case "--by":
        opts.by = oneOf(flag, value(), GROUPINGS);
        break;
      case "-s":
      case "--sort":
        opts.sort = oneOf(flag, value(), SORTS);
        break;
      case "-n":
      case "--limit":
        opts.limit = positiveInt(flag, value());
        break;
      case "--json":
        opts.json = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        throw new UsageError(`unknown option ${arg}`);
    }
  }
  return opts;
}

/** "last 30 days" / "all time", for report headings. */
export function rangeLabel(days: number | null): string {
  if (days === null) return "all time";
  return days === 1 ? "today" : `last ${days} days`;
}
