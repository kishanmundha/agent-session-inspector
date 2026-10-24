/**
 * The files a shell command writes, read off its text: redirections, in-place
 * editors, file-moving commands, and the writes of an inline Python or Node
 * script. A best effort, not a shell: a path built from a variable or a glob is
 * left out rather than guessed at.
 */

interface SimpleCommand {
  words: string[];
  /** Redirection targets. */
  writes: string[];
  /** Words redirected in, among them the references to heredoc bodies. */
  inputs: string[];
}

const HEREDOC = /(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_]\w*)\1/g;

/** Stands in for the nth heredoc body where its delimiter was named. */
const HEREDOC_REF = /^__heredoc_(\d+)__$/;

/** Lifts heredoc bodies out of the command, so that only shell syntax is left. */
function splitHeredocs(command: string): { shell: string; bodies: string[] } {
  const shell: string[] = [];
  const bodies: string[] = [];
  const lines = command.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const delimiters: string[] = [];
    shell.push(
      lines[i].replace(HEREDOC, (_marker, _quote, delimiter: string) => {
        delimiters.push(delimiter);
        return `<<__heredoc_${bodies.length + delimiters.length - 1}__`;
      }),
    );
    for (const delimiter of delimiters) {
      const body: string[] = [];
      while (++i < lines.length && lines[i].trim() !== delimiter) body.push(lines[i]);
      bodies.push(body.join("\n"));
    }
  }
  return { shell: shell.join("\n"), bodies };
}

/** The simple commands of a shell text, with quoting removed from their words. */
function parseShell(text: string): SimpleCommand[] {
  const commands: SimpleCommand[] = [];
  let current: SimpleCommand = { words: [], writes: [], inputs: [] };
  let word: string | null = null;
  let next: keyof SimpleCommand = "words";

  const endWord = () => {
    if (word === null) return;
    current[next].push(word);
    word = null;
    next = "words";
  };
  const endCommand = () => {
    endWord();
    if (current.words.length > 0 || current.writes.length > 0) commands.push(current);
    current = { words: [], writes: [], inputs: [] };
    next = "words";
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      if (text[++i] !== "\n") word = (word ?? "") + (text[i] ?? "");
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      const stop = end < 0 ? text.length : end;
      word = (word ?? "") + text.slice(i + 1, stop);
      i = stop;
    } else if (c === '"') {
      let quoted = "";
      for (i++; i < text.length && text[i] !== '"'; i++) {
        if (text[i] === "\\" && i + 1 < text.length) i++;
        quoted += text[i];
      }
      word = (word ?? "") + quoted;
    } else if (c === " " || c === "\t") {
      endWord();
    } else if (c === "#" && word === null) {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
    } else if (c === "&" && text[i + 1] === ">") {
      endWord(); // `&>file`
    } else if (c === "\n" || c === ";" || c === "|" || c === "&" || c === "(" || c === ")") {
      endCommand();
    } else if (c === ">") {
      // A number right before it is the descriptor, not an argument.
      if (word !== null && /^\d+$/.test(word)) word = null;
      else endWord();
      if (text[i + 1] === ">" || text[i + 1] === "|") i++;
      if (text[i + 1] === "&") {
        i++;
        const descriptor = /^[\d-]+/.exec(text.slice(i + 1));
        if (descriptor) {
          i += descriptor[0].length; // `2>&1` copies a descriptor
          continue;
        }
      }
      next = "writes";
    } else if (c === "<") {
      endWord();
      while (text[i + 1] === "<" || text[i + 1] === "-") i++;
      next = "inputs";
    } else {
      word = (word ?? "") + c;
    }
  }
  endCommand();
  return commands;
}

const WRAPPERS = new Set(["sudo", "command", "env", "time", "nohup", "exec", "xargs"]);
const SHELLS = /^(ba|z|da)?sh$/;
const SCRIPT_RUNNERS = /^(python[\d.]*|node|bun|deno)$/;

const isFlag = (word: string) => word.startsWith("-");

/** Arguments that are files: no flags, and no script given to `-e`. */
function fileArgs(
  args: string[],
  scriptFlags = /^-[a-zA-Z]*[ef]$|^--(expression|file)$/,
): { files: string[]; scripted: boolean } {
  const files: string[] = [];
  let scripted = false;
  for (let i = 0; i < args.length; i++) {
    if (scriptFlags.test(args[i])) {
      scripted = true;
      i++;
    } else if (!isFlag(args[i]) && args[i] !== "") files.push(args[i]);
  }
  return { files, scripted };
}

/** The files a file-handling command writes, moves or removes. */
function commandWrites(name: string, args: string[]): string[] {
  if (name === "git" && (args[0] === "mv" || args[0] === "rm")) {
    name = args[0];
    args = args.slice(1);
  }
  const recursive = args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === "--recursive");

  switch (name) {
    case "tee":
    case "touch":
    case "mv":
      return fileArgs(args).files;
    case "sed":
    case "gsed": {
      if (!args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))) return [];
      const { files, scripted } = fileArgs(args);
      return scripted ? files : files.slice(1);
    }
    case "perl":
      if (!args.some((a) => /^-[a-zA-Z]*i/.test(a))) return [];
      return fileArgs(args, /^-[a-zA-Z]*e$/).files;
    case "rm":
      return recursive ? [] : fileArgs(args).files;
    case "cp":
      return recursive ? [] : fileArgs(args).files.slice(-1);
    default:
      return [];
  }
}

const ARG = String.raw`(?:(['"\`])([^'"\`\n]+)\1|([A-Za-z_$][\w$]*))`;

/** File writes in Python and Node source; the path is a literal or a variable. */
const SCRIPT_WRITES = [
  new RegExp(String.raw`\bopen\(\s*${ARG}\s*,\s*(?:mode\s*=\s*)?['"](?=[^'"]*[wax+])[rwaxbt+]+['"]`, "g"),
  new RegExp(String.raw`\bPath\(\s*${ARG}\s*\)\s*\.write_(?:text|bytes)\(`, "g"),
  new RegExp(String.raw`\b(?:write|append)File(?:Sync)?\(\s*${ARG}`, "g"),
];

/** The string a variable was last assigned before `index`, if it was a literal. */
function assignedString(source: string, name: string, index: number): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const assignment = new RegExp(String.raw`(?<![\w$.])${escaped}\s*=\s*(['"])([^'"\n]+)\1`, "g");
  let value: string | undefined;
  for (const m of source.slice(0, index).matchAll(assignment)) value = m[2];
  return value;
}

function scriptWrites(source: string): string[] {
  const found: { index: number; path: string }[] = [];
  for (const pattern of SCRIPT_WRITES) {
    for (const m of source.matchAll(pattern)) {
      const path = m[2] ?? assignedString(source, m[3], m.index);
      if (path) found.push({ index: m.index, path });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.path);
}

const SCRATCH = /^(\/dev\/|\/tmp\/|\/private\/tmp\/|\/var\/folders\/|\/private\/var\/folders\/)/;

/** A path that can be named: no expansion left in it, and not a device or temp file. */
const isNameable = (path: string) =>
  path !== "" && path !== "-" && !/[$`*?{}]/.test(path) && !path.startsWith("~") && !SCRATCH.test(path);

function resolve(dir: string | undefined, path: string): string {
  if (path.startsWith("/") || !dir) return path.replace(/^(\.\/)+/, "");
  const parts = dir.split("/");
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

/**
 * The files `command` writes, in the order it writes them. Relative paths are
 * resolved against `cwd`, following any `cd` the command makes on the way.
 */
export function shellWrittenPaths(command: string, cwd?: string): string[] {
  const { shell, bodies } = splitHeredocs(command);
  const paths = new Set<string>();
  let dir = cwd?.replace(/\/+$/, "");
  const add = (path: string) => {
    if (!isNameable(path)) return;
    const resolved = resolve(dir, path);
    if (!SCRATCH.test(resolved)) paths.add(resolved);
  };

  for (const { words, writes, inputs } of parseShell(shell)) {
    let start = 0;
    while (start < words.length && (/^\w+=/.test(words[start]) || WRAPPERS.has(words[start]))) start++;
    const name = words[start]?.split("/").pop() ?? "";
    const args = words.slice(start + 1);
    const heredocs = inputs.flatMap((input) => bodies[Number(HEREDOC_REF.exec(input)?.[1])] ?? []);

    if (name === "cd") {
      if (args[0] && isNameable(args[0]) && (args[0].startsWith("/") || dir)) dir = resolve(dir, args[0]);
    } else if (SHELLS.test(name)) {
      // `bash -lc '<script>'`, or a script on stdin.
      const flag = args.findIndex((a) => /^-[a-zA-Z]*c$/.test(a));
      const scripts = flag >= 0 ? [args[flag + 1] ?? ""] : heredocs;
      for (const script of scripts) shellWrittenPaths(script, dir).forEach((path) => paths.add(path));
    } else if (SCRIPT_RUNNERS.test(name)) {
      for (const source of [...args, ...heredocs]) scriptWrites(source).forEach(add);
    } else {
      commandWrites(name, args).forEach(add);
    }
    writes.forEach(add);
  }
  return [...paths];
}

/** Commands that set up the shell rather than do the work. */
const SETUP = new Set(["cd", "pushd", "popd", "export", "source", ".", "set", "unset", "true", ":", "read", "local"]);

/** Keywords that open a segment whose own command follows them: `do cat x`, `if grep …`. */
const LEADING_KEYWORDS = new Set(["do", "then", "else", "elif", "if", "while", "until", "!", "{"]);

/** Segments that are only shell syntax: a loop header, a closing keyword. */
const SYNTAX_ONLY = new Set(["for", "select", "case", "esac", "done", "fi", "}", "function"]);

/**
 * Commands that only print a label or prepare a folder; another command in
 * the same line names it better: `mkdir -p src && cat > src/a.ts`.
 */
const PREAMBLE = new Set(["echo", "printf", "mkdir", "touch"]);

/** Commands that write a file when redirected, told apart from reading: `cat >` vs `cat`. */
const REDIRECT_WRITERS = new Set(["cat", "echo", "printf", "tee"]);

/** Programs whose first argument names what they do: `git diff`, `docker ps`. */
const SUBCOMMANDS =
  /^(git|gh|npm|pnpm|yarn|bun|npx|pnpx|bunx|deno|cargo|go|docker|podman|kubectl|helm|terraform|brew|apt|apt-get|pip[\d.]*|uv|poetry|dotnet|gradle|gradlew|mvn|make|just|turbo|nx|swift|xcodebuild|xcrun|aws|gcloud|az|vercel|supabase|firebase|wrangler|prisma|rails|bundle|mix|composer|php|artisan)$/;

/** Package-manager verbs followed by the script or tool that really runs. */
const RUNNERS = new Set(["run", "exec", "dlx", "x", "test"]);

/** Flags that take the next word as their value, so it is not the subcommand. */
const VALUE_FLAGS = /^(-C|-c|--prefix|--dir|--cwd|--filter|-F|--workspace|-w|--git-dir|--work-tree|--manifest-path|--project|--context|-n|--namespace)$/;

/** The first argument that is neither a flag nor a flag's value. */
function firstOperand(args: string[]): number {
  for (let i = 0; i < args.length; i++) {
    if (VALUE_FLAGS.test(args[i])) i++;
    else if (!args[i].startsWith("-")) return i;
  }
  return -1;
}

const isWord = (word: string | undefined): word is string =>
  !!word && word.length <= 40 && /^[\w@][\w@:./+-]*$/.test(word) && !word.startsWith("-");

/**
 * What a shell command runs, short enough to group calls by: the program and,
 * for tools with subcommands, the subcommand (`git diff`, `npm run build`,
 * `python -m pytest`), and `cat >` for a file written through a redirect.
 * Setup like `cd dir &&`, wrappers like `sudo`, loop
 * syntax, `echo` labels and `mkdir` are skipped; pipes keep the first program. "other"
 * when nothing can be named.
 */
export function commandSignature(command: string): string {
  const { shell, bodies } = splitHeredocs(command);
  let preamble: string | undefined;
  for (const { words, inputs, writes } of parseShell(shell)) {
    let start = 0;
    while (
      start < words.length &&
      (/^\w+=/.test(words[start]) || WRAPPERS.has(words[start]) || LEADING_KEYWORDS.has(words[start]))
    ) {
      start++;
    }
    const name = words[start]?.split("/").pop() ?? "";
    if (!name || SETUP.has(name) || SYNTAX_ONLY.has(name)) continue;
    // `cat > file <<EOF` writes a whole file through the shell: worth its own row.
    if (REDIRECT_WRITERS.has(name) && (writes.length > 0 || name === "tee")) return `${name} >`;
    if (PREAMBLE.has(name)) {
      preamble ??= name;
      continue;
    }
    const args = words.slice(start + 1);

    if (SHELLS.test(name)) {
      const flag = args.findIndex((a) => /^-[a-zA-Z]*c$/.test(a));
      const heredocs = inputs.flatMap((input) => bodies[Number(HEREDOC_REF.exec(input)?.[1])] ?? []);
      const script = flag >= 0 ? args[flag + 1] : heredocs[0];
      return script ? commandSignature(script) : name;
    }
    if (!isWord(name)) return "other";
    if (/^python[\d.]*$/.test(name) && args[0] === "-m" && isWord(args[1])) return `${name} -m ${args[1]}`;
    if (!SUBCOMMANDS.test(name)) return name;
    const at = firstOperand(args);
    const sub = args[at];
    if (!isWord(sub)) return name;
    if (RUNNERS.has(sub)) {
      const rest = args.slice(at + 1);
      const target = rest[firstOperand(rest)];
      if (isWord(target)) return `${name} ${sub} ${target}`;
    }
    return `${name} ${sub}`;
  }
  return preamble ?? "other";
}
