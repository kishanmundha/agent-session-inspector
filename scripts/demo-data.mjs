#!/usr/bin/env node
// Writes a fake $HOME with synthetic Claude Code, Codex, Copilot and Gemini CLI transcripts, so the
// UI can be demoed (and README screenshots retaken) without exposing real
// sessions. The launcher's --demo flag imports writeDemoHome; by hand:
//   node scripts/demo-data.mjs /tmp/asi-demo
//   HOME=/tmp/asi-demo pnpm dev
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// The sessions below are dated around this day; writeDemoHome moves them so
// the newest one ended an hour ago, inside every dashboard's default range.
const ANCHOR = Date.UTC(2026, 8, 25);
const NEWEST_END = Date.parse("2026-09-25T09:11:00Z");
let OFFSET = 0;

/** A fixed demo date, moved by the current offset. */
const shift = (iso) => new Date(new Date(iso).getTime() + OFFSET);

const writeJsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(file, text);
  // Some agents date a session by its file's mtime: match the last event, or
  // a freshly written demo would look like it is still running.
  const last = text.match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g)?.sort().at(-1);
  if (last) fs.utimesSync(file, new Date(last), new Date(last));
};

const clock = (start) => {
  let t = shift(start).getTime();
  return (seconds = 3) => new Date((t += seconds * 1000)).toISOString();
};

// ---------------------------------------------------------------- Claude Code

function claudeSession({ id, cwd, branch, title, start, model, turns }) {
  const at = clock(start);
  const base = { sessionId: id, cwd, gitBranch: branch, version: "2.1.4", entrypoint: "cli" };
  const rows = [{ type: "ai-title", aiTitle: title, sessionId: id }];
  let n = 0;
  let parent = null;
  const uid = () => `${id.slice(0, 8)}-${String(n++).padStart(4, "0")}`;
  const add = (rec) => {
    const uuid = uid();
    rows.push({ ...base, ...rec, uuid, parentUuid: parent });
    parent = uuid;
  };
  let cache = 18_000;
  const usage = (out) => {
    const u = {
      input_tokens: 40 + Math.floor(Math.random() * 400),
      cache_creation_input_tokens: 600 + Math.floor(Math.random() * 2500),
      cache_read_input_tokens: cache,
      output_tokens: out,
    };
    cache += u.cache_creation_input_tokens;
    return u;
  };

  let msg = 0;
  for (const turn of turns) {
    const turnStart = Date.now();
    add({ type: "user", timestamp: at(20), message: { role: "user", content: turn.prompt } });
    for (const step of turn.steps) {
      const mid = `msg_${id.slice(0, 6)}${msg++}`;
      if (step.compact) {
        add({ type: "system", subtype: "compact_boundary", timestamp: at(6), compactMetadata: { trigger: "auto", preTokens: cache } });
        cache = 9_000;
        continue;
      }
      if (step.thinking) {
        add({
          type: "assistant",
          timestamp: at(4),
          message: { id: mid, role: "assistant", model, content: [{ type: "thinking", thinking: step.thinking }], usage: usage(180) },
        });
      }
      if (step.tool) {
        const toolId = `toolu_${id.slice(0, 6)}${msg}`;
        add({
          type: "assistant",
          timestamp: at(3),
          message: {
            id: mid,
            role: "assistant",
            model,
            content: [{ type: "tool_use", id: toolId, name: step.tool, input: step.input }],
            usage: usage(90 + Math.floor(Math.random() * 400)),
          },
        });
        add({
          type: "user",
          timestamp: at(step.seconds ?? 2),
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: toolId, content: step.result, is_error: step.error === true }],
          },
        });
      }
      if (step.text) {
        add({
          type: "assistant",
          timestamp: at(5),
          message: { id: mid, role: "assistant", model, content: [{ type: "text", text: step.text }], usage: usage(350) },
        });
      }
    }
    add({ type: "system", subtype: "turn_duration", timestamp: at(1), durationMs: 40_000 + (Date.now() - turnStart) });
  }
  return rows;
}

export function writeDemoHome(root, now = new Date()) {
  fs.rmSync(root, { recursive: true, force: true });
  OFFSET = now.getTime() - 3_600_000 - NEWEST_END;

  const claudeProjects = path.join(root, ".claude", "projects");

  const checkoutCwd = "/Users/demo/code/acme-shop";
  writeJsonl(
    path.join(claudeProjects, "-Users-demo-code-acme-shop", "7f3c2a10-5b1e-4c8d-9a42-1d6e8b0f3c21.jsonl"),
    claudeSession({
      id: "7f3c2a10-5b1e-4c8d-9a42-1d6e8b0f3c21",
      cwd: checkoutCwd,
      branch: "fix/cart-total-rounding",
      title: "Fix cart total rounding bug",
      start: "2026-09-24T09:12:00Z",
      model: "claude-opus-5-5",
      turns: [
        {
          prompt:
            "Customers are reporting the cart total is sometimes off by a cent. Can you find out why and fix it? Tests are in src/cart/__tests__.",
          steps: [
            { tool: "mcp__sentry__search_issues", input: { query: "cart total mismatch", project: "acme-shop" }, result: "1 issue: ACME-412 \"Order total differs from cart total by $0.01\" (38 events, last seen 2h ago)" },
            { thinking: "Off-by-a-cent usually means floating point arithmetic on prices. Let me find where the total is computed." },
            { tool: "Grep", input: { pattern: "total", path: "src/cart" }, result: "src/cart/total.ts:12:export function cartTotal(items: CartItem[]) {\nsrc/cart/total.ts:18:  return total;\nsrc/cart/summary.tsx:31:  const total = cartTotal(items);" },
            { tool: "Read", input: { file_path: `${checkoutCwd}/src/cart/total.ts` }, result: "export function cartTotal(items: CartItem[]) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * item.quantity * (1 - item.discount);\n  }\n  return Math.round(total * 100) / 100;\n}" },
            { text: "The total sums floating-point prices and rounds once at the end, so values like `0.1 + 0.2` drift before rounding. I'll switch to integer cents and round per line item." },
            { tool: "Edit", input: { file_path: `${checkoutCwd}/src/cart/total.ts`, old_string: "total += item.price * item.quantity * (1 - item.discount);", new_string: "total += Math.round(toCents(item.price) * item.quantity * (1 - item.discount));" }, result: "The file src/cart/total.ts has been updated." },
            { tool: "Edit", input: { file_path: `${checkoutCwd}/src/cart/__tests__/total.test.ts`, old_string: "});", new_string: "  it('does not drift on fractional prices', () => {\n    expect(cartTotal([{ price: 0.1, quantity: 3, discount: 0 }])).toBe(0.3);\n  });\n});" }, result: "The file src/cart/__tests__/total.test.ts has been updated." },
            { tool: "Bash", input: { command: "pnpm test src/cart", description: "Run cart tests" }, seconds: 14, result: " PASS  src/cart/__tests__/total.test.ts\n  cartTotal\n    ✓ sums line items (3 ms)\n    ✓ applies discounts (1 ms)\n    ✓ does not drift on fractional prices (1 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       3 passed, 3 total" },
            { tool: "Skill", input: { skill: "code-review" }, result: "Launching skill: code-review" },
            { text: "Fixed. `cartTotal` now works in integer cents and rounds each line item, so totals no longer drift by a cent. I added a regression test for fractional prices; all 3 cart tests pass." },
          ],
        },
        {
          prompt: "Nice. Does the same bug exist in the order summary on the checkout page?",
          steps: [
            { tool: "Read", input: { file_path: `${checkoutCwd}/src/checkout/summary.tsx` }, result: "import { cartTotal } from '../cart/total';\n\nexport function OrderSummary({ items, shipping }) {\n  const subtotal = cartTotal(items);\n  const total = subtotal + shipping;\n  return <Money value={total} />;\n}" },
            { tool: "Bash", input: { command: "pnpm test src/checkout", description: "Run checkout tests" }, seconds: 9, result: [{ type: "text", text: "Tests:       7 passed, 7 total" }] },
            { text: "The checkout summary calls `cartTotal`, so it picks up the fix automatically. Shipping is already stored in cents, so there's nothing else to change there." },
          ],
        },
        {
          prompt: "Great, open a PR and link the Sentry issue.",
          steps: [
            { compact: true },
            { tool: "Bash", input: { command: "git push -u origin fix/cart-total-rounding", description: "Push branch" }, seconds: 3, result: "branch 'fix/cart-total-rounding' set up to track 'origin/fix/cart-total-rounding'." },
            { tool: "mcp__github__create_pull_request", input: { owner: "demo", repo: "acme-shop", head: "fix/cart-total-rounding", base: "main", title: "Fix cart total rounding", body: "Fixes ACME-412." }, result: "Created pull request #128: https://github.com/demo/acme-shop/pull/128" },
            { tool: "mcp__sentry__update_issue", input: { issueId: "ACME-412", status: "resolvedInNextRelease" }, result: "ACME-412 marked resolved in next release." },
            { text: "Opened demo/acme-shop#128 and marked ACME-412 as resolved in the next release." },
          ],
        },
      ],
    }),
  );

  const apiCwd = "/Users/demo/code/weather-api";
  writeJsonl(
    path.join(claudeProjects, "-Users-demo-code-weather-api", "c1d9e4b2-8a7f-4e21-b3c5-6f0a2d9e7b14.jsonl"),
    claudeSession({
      id: "c1d9e4b2-8a7f-4e21-b3c5-6f0a2d9e7b14",
      cwd: apiCwd,
      branch: "main",
      title: "Add rate limiting to forecast endpoint",
      start: "2026-09-23T15:40:00Z",
      model: "claude-sonnet-5",
      turns: [
        {
          prompt: "Add a simple per-IP rate limit (60 requests/minute) to GET /forecast.",
          steps: [
            { tool: "Glob", input: { pattern: "src/routes/**/*.ts" }, result: "src/routes/forecast.ts\nsrc/routes/health.ts" },
            { tool: "mcp__context7__get_library_docs", input: { libraryId: "/expressjs/express", topic: "middleware" }, result: "Middleware functions have access to req, res and next. Call next() to pass control…" },
            // A result of typed parts: the image is counted on the timeline, not shown.
            { tool: "Read", input: { file_path: `${apiCwd}/docs/rate-limit.png` }, result: [{ type: "text", text: "Diagram of the token bucket: 60 requests refill every minute." }, { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" } }] },
            { tool: "Read", input: { file_path: `${apiCwd}/src/routes/forecast.ts` }, result: "router.get('/forecast', async (req, res) => {\n  const data = await getForecast(req.query.city);\n  res.json(data);\n});" },
            { tool: "Write", input: { file_path: `${apiCwd}/src/middleware/rate-limit.ts`, content: "export function rateLimit(limit: number, windowMs: number) { /* ... */ }" }, result: "File created successfully." },
            { tool: "Edit", input: { file_path: `${apiCwd}/src/routes/forecast.ts`, old_string: "router.get('/forecast',", new_string: "router.get('/forecast', rateLimit(60, 60_000)," }, result: "The file src/routes/forecast.ts has been updated." },
            { tool: "Bash", input: { command: "pnpm test", description: "Run test suite" }, seconds: 11, error: true, result: "FAIL src/routes/__tests__/forecast.test.ts\n  ✕ returns 429 after limit (12 ms)\n    Expected: 429\n    Received: 200" },
            { thinking: "The limiter keys on req.ip, which is undefined behind the test client. Fall back to the socket address." },
            { tool: "Edit", input: { file_path: `${apiCwd}/src/middleware/rate-limit.ts`, old_string: "const key = req.ip;", new_string: "const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';" }, result: "The file src/middleware/rate-limit.ts has been updated." },
            { tool: "Bash", input: { command: "pnpm test", description: "Run test suite" }, seconds: 10, result: "Tests:       18 passed, 18 total" },
            { tool: "Skill", input: { skill: "security-review" }, result: "Launching skill: security-review" },
            { text: "Added a `rateLimit` middleware (fixed window, keyed by client IP) and applied it to `GET /forecast` at 60 requests/minute. Clients over the limit get a 429 with a `Retry-After` header. All 18 tests pass." },
          ],
        },
      ],
    }),
  );

  writeJsonl(
    path.join(claudeProjects, "-Users-demo-code-acme-shop", "a8e2f7c3-1d4b-4f9e-8c6a-3b5d7e9f1a02.jsonl"),
    claudeSession({
      id: "a8e2f7c3-1d4b-4f9e-8c6a-3b5d7e9f1a02",
      cwd: checkoutCwd,
      branch: "main",
      title: "Explain the checkout flow",
      start: "2026-09-22T11:05:00Z",
      model: "claude-haiku-4-5-20251001",
      turns: [
        {
          prompt: "Give me a quick tour of how checkout works in this repo.",
          steps: [
            { tool: "Glob", input: { pattern: "src/checkout/**" }, result: "src/checkout/page.tsx\nsrc/checkout/summary.tsx\nsrc/checkout/payment.ts\nsrc/checkout/confirm.ts" },
            { tool: "Read", input: { file_path: `${checkoutCwd}/src/checkout/page.tsx` }, result: "export default function CheckoutPage() { /* address → payment → confirm */ }" },
            { text: "Checkout is a three-step flow in `src/checkout/page.tsx`: address, payment, confirm. `payment.ts` creates a payment intent, `confirm.ts` finalizes the order, and `summary.tsx` shows the running total using `cartTotal`." },
          ],
        },
      ],
    }),
  );

  // ---------------------------------------------------------------------- Codex

  const codexId = "0199a3f2-7c41-7d20-9e8b-5a4c3b2d1e0f";
  {
    const at = clock("2026-09-24T17:30:00Z");
    const cwd = "/Users/demo/code/cli-tools";
    writeJsonl(path.join(root, ".codex", "session_index.jsonl"), [
      { id: codexId, thread_name: "Add --json flag to status command" },
    ]);
    const tokens = (input, cached, output) => ({
      type: "event_msg",
      timestamp: at(1),
      payload: {
        type: "token_count",
        info: {
          total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, total_tokens: input + output },
          last_token_usage: { total_tokens: 9_000 },
          model_context_window: 272_000,
        },
      },
    });
    const day = shift("2026-09-24T17:30:00Z").toISOString();
    const [y, m, d] = day.slice(0, 10).split("-");
    writeJsonl(path.join(root, ".codex", "sessions", y, m, d, `rollout-${day.slice(0, 19).replace(/:/g, "-")}-${codexId}.jsonl`), [
      {
        type: "session_meta",
        timestamp: at(0),
        payload: { id: codexId, cwd, originator: "codex_cli_rs", cli_version: "0.61.0", git: { branch: "feat/status-json", repository_url: "git@github.com:demo/cli-tools.git" } },
      },
      { type: "turn_context", timestamp: at(1), payload: { model: "gpt-5.3-codex", effort: "medium", cwd } },
      { type: "event_msg", timestamp: at(1), payload: { type: "task_started", turn_id: "t1", model_context_window: 272_000 } },
      { type: "event_msg", timestamp: at(2), payload: { type: "user_message", message: "Add a --json flag to `status` that prints machine-readable output." } },
      { type: "event_msg", timestamp: at(4), payload: { type: "agent_reasoning", text: "Find the status command definition and its output formatter." } },
      { type: "response_item", timestamp: at(1), payload: { type: "function_call", name: "shell", call_id: "c1", arguments: JSON.stringify({ command: ["rg", "-n", "fn status", "src"] }) } },
      { type: "response_item", timestamp: at(2), payload: { type: "function_call_output", call_id: "c1", output: "src/commands/status.rs:14:pub fn status(args: StatusArgs) -> Result<()> {" } },
      tokens(21_400, 12_800, 1_150),
      { type: "event_msg", timestamp: at(8), payload: { type: "patch_apply_end", call_id: "p1", success: true, stdout: "Success. Updated the following files:\nM src/commands/status.rs\nM src/cli.rs", stderr: "", changes: { [`${cwd}/src/commands/status.rs`]: { type: "update" }, [`${cwd}/src/cli.rs`]: { type: "update" } } } },
      { type: "response_item", timestamp: at(1), payload: { type: "function_call", name: "shell", call_id: "c2", arguments: JSON.stringify({ command: ["cargo", "test", "status"] }) } },
      { type: "response_item", timestamp: at(18), payload: { type: "function_call_output", call_id: "c2", output: "running 4 tests\ntest status::plain_output ... ok\ntest status::json_output ... ok\n\ntest result: ok. 4 passed; 0 failed" } },
      tokens(48_900, 36_100, 2_870),
      { type: "event_msg", timestamp: at(4), payload: { type: "agent_message", message: "`status --json` now serializes the status struct with serde and prints it to stdout. Plain output is unchanged. Added a test for the JSON shape; all 4 status tests pass." } },
      { type: "event_msg", timestamp: at(1), payload: { type: "task_complete", turn_id: "t1", duration_ms: 44_000 } },
    ]);
  }

  // -------------------------------------------------------------------- Copilot

  {
    const id = "5e2b9c14-3f8a-4d61-a7e0-9c3d2b1f6a85";
    const dir = path.join(root, ".copilot", "session-state", id);
    const cwd = "/Users/demo/code/docs-site";
    const at = clock("2026-09-24T12:05:00Z");
    const start = shift("2026-09-24T12:05:00Z").toISOString();
    const end = shift("2026-09-24T12:07:10Z").toISOString();
    fs.mkdirSync(dir, { recursive: true });
    // What Copilot keeps beside the transcript: workspace files it saved,
    // progress checkpoints and research notes.
    const notes = {
      "files/link-report.md": "# Broken sidebar links\n\n| Link | Old file | New file |\n| --- | --- | --- |\n| /guides/setup | guides/setup.md | getting-started/setup.md |\n| /guides/deploy | guides/deploy.md | getting-started/deploy.md |\n| /api/auth | api/auth.md | reference/auth.md |\n",
      "files/sidebar.diff": '-  "guides/setup",\n+  "getting-started/setup",\n-  "guides/deploy",\n+  "getting-started/deploy",\n-  "api/auth",\n+  "reference/auth",\n',
      "checkpoints/001-find-broken-links.md": "## Checkpoint 1: find broken links\n\nRan the link checker against sidebar.json: 3 entries point at files moved by the folder rename.\n",
      "checkpoints/002-update-sidebar.md": "## Checkpoint 2: update sidebar\n\nRewrote the three entries to the new getting-started/ and reference/ paths. Link checker reports 24/24 OK.\n",
      "research/folder-rename.md": "# Folder rename\n\nCommit 4e1a9c moved docs/guides to docs/getting-started and docs/api to docs/reference without redirects.\nConsider adding redirects for external links.\n",
    };
    for (const [file, content] of Object.entries(notes)) {
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    }
    fs.writeFileSync(
      path.join(dir, "workspace.yaml"),
      [
        `id: ${id}`,
        `name: Fix broken links in docs sidebar`,
        `cwd: ${cwd}`,
        `repository: demo/docs-site`,
        `branch: fix/sidebar-links`,
        `created_at: ${start}`,
        `updated_at: ${end}`,
        `host_type: cli`,
        `client_name: copilot-cli`,
        `user_named: true`,
      ].join("\n") + "\n",
    );

    let n = 0;
    const ev = (type, data, seconds) => ({ type, data, id: `cp-${n++}`, timestamp: at(seconds), parentId: null });
    const tool = (name, args, result, seconds = 2) => {
      const toolCallId = `call_${n}`;
      return [
        ev("tool.execution_start", { toolName: name, toolCallId, arguments: args }, 3),
        ev("tool.execution_complete", { toolName: name, toolCallId, success: true, result: { content: result } }, seconds),
      ];
    };
    writeJsonl(path.join(dir, "events.jsonl"), [
      ev("session.start", { sessionId: id, selectedModel: "gpt-5.1", copilotVersion: "0.0.412", context: { cwd, branch: "fix/sidebar-links", repository: "demo/docs-site" } }, 0),
      ev("user.message", { content: "Some links in the docs sidebar 404 after the folder rename. Find and fix them." }, 5),
      ev("assistant.message", { content: "I'll check the sidebar config against the files that actually exist.", outputTokens: 120, inputTokens: 9_800 }, 4),
      ...tool("bash", { command: "node scripts/check-links.js sidebar.json" }, "3 broken links:\n  /guides/setup -> guides/setup.md (missing)\n  /guides/deploy -> guides/deploy.md (missing)\n  /api/auth -> api/auth.md (missing)", 6),
      ...tool("glob", { pattern: "docs/**/*.md" }, "docs/getting-started/setup.md\ndocs/getting-started/deploy.md\ndocs/reference/auth.md\ndocs/index.md"),
      ...tool("edit", { path: `${cwd}/sidebar.json`, old_str: '"guides/setup"', new_str: '"getting-started/setup"' }, "File updated."),
      ...tool("bash", { command: "node scripts/check-links.js sidebar.json" }, "All links OK (24 checked).", 5),
      ev("assistant.message", { content: "Updated three sidebar entries to the new `getting-started/` and `reference/` paths. The link checker now reports all 24 links OK.", outputTokens: 210, inputTokens: 14_600 }, 4),
      ev("session.shutdown", {
        totalApiDurationMs: 21_400,
        totalPremiumRequests: 2,
        modelMetrics: { "gpt-5.1": { usage: { inputTokens: 38_900, outputTokens: 1_640, cacheReadTokens: 27_300 } } },
      }, 2),
    ]);

    fs.mkdirSync(path.join(root, ".copilot", "logs"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".copilot", "logs", `process-${new Date(start).getTime()}-4821.log`),
      `${start} [INFO] Starting Copilot CLI 0.0.412\n${start} [INFO] Session ${id} created in ${cwd}\n${end} [INFO] Session ${id} shut down\n`,
    );
  }

  // ----------------------------------------------------------------- Gemini CLI

  {
    const id = "7c1e4a92-5b3d-4f08-9a6e-2d8f0b3c5e71";
    const cwd = "/Users/demo/code/weather-api";
    const at = clock("2026-09-25T09:10:00Z");
    const start = shift("2026-09-25T09:10:00Z").toISOString();
    const project = path.join(root, ".gemini", "tmp", "weather-api");
    const model = "gemini-3.7-flash";
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, ".project_root"), cwd);

    const tool = (callId, name, args, output) => ({
      id: callId,
      name,
      args,
      status: "success",
      timestamp: at(2),
      result: [{ functionResponse: { id: callId, name, response: { output } } }],
    });
    const reply = (messageId, fields) => ({ id: messageId, timestamp: at(4), type: "gemini", content: "", model, ...fields });
    const prompt = { id: "m1", timestamp: at(3), type: "user", content: [{ text: "Forecast responses are cached for an hour. Make the TTL configurable." }] };
    const grep = reply("m2", {
      thoughts: [{ subject: "Locating the cache", description: "The forecast handler should own the TTL; search for it first.", timestamp: at(1) }],
      tokens: { input: 11_200, output: 140, cached: 0, thoughts: 220, tool: 0, total: 11_560 },
    });
    writeJsonl(path.join(project, "chats", `session-${start.slice(0, 16).replace(":", "-")}-${id.slice(0, 8)}.jsonl`), [
      { sessionId: id, projectHash: "3f9a1c", startTime: start, lastUpdated: start },
      prompt,
      grep,
      // The CLI writes a message again as its tool calls come in; the last copy wins.
      { ...grep, toolCalls: [tool("g1", "search_file_content", { pattern: "CACHE_TTL" }, "src/forecast/cache.ts:4:const CACHE_TTL = 3600;")] },
      reply("m3", {
        toolCalls: [
          tool("g2", "replace", { file_path: `${cwd}/src/forecast/cache.ts`, old_string: "const CACHE_TTL = 3600;", new_string: "const CACHE_TTL = Number(process.env.FORECAST_TTL ?? 3600);" }, "Successfully modified file."),
          tool("g3", "run_shell_command", { command: "npm test -- forecast" }, "Tests: 12 passed, 12 total"),
        ],
        tokens: { input: 12_900, output: 310, cached: 10_400, thoughts: 90, tool: 0, total: 13_300 },
      }),
      reply("m4", {
        content: "The TTL now reads `FORECAST_TTL` (seconds) and falls back to one hour. All 12 forecast tests pass.",
        tokens: { input: 13_600, output: 95, cached: 12_100, thoughts: 0, tool: 0, total: 13_695 },
      }),
      { $set: { lastUpdated: at(0), summary: "Make forecast cache TTL configurable" } },
    ]);
  }

  extraSessions(root);
  return root;
}

// ------------------------------------------------- A month of smaller sessions

// Short Claude Code tasks spread over the four weeks before the anchor, so the
// analytics, usage and activity charts have a history to draw.
const EXTRA_TASKS = [
  ["acme-shop", "Add coupon code field to checkout", "src/checkout/coupon.ts", "claude-sonnet-5"],
  ["acme-shop", "Speed up product search query", "src/search/query.ts", "claude-opus-5-5"],
  ["acme-shop", "Fix flaky cart snapshot test", "src/cart/__tests__/cart.test.ts", "claude-sonnet-5", true],
  ["weather-api", "Return 404 for unknown cities", "src/routes/forecast.ts", "claude-haiku-4-5-20251001"],
  ["weather-api", "Add OpenAPI docs for /forecast", "openapi.yaml", "claude-sonnet-5"],
  ["weather-api", "Migrate config to zod schema", "src/config.ts", "claude-opus-5-5", true],
  ["cli-tools", "Colorize status output", "src/commands/status.rs", "claude-sonnet-5"],
  ["cli-tools", "Add shell completions", "src/completions.rs", "claude-haiku-4-5-20251001"],
  ["docs-site", "Add dark mode to docs theme", "theme/colors.css", "claude-sonnet-5"],
  ["docs-site", "Generate sitemap on build", "scripts/sitemap.mjs", "claude-haiku-4-5-20251001"],
  ["mobile-app", "Fix login screen keyboard overlap", "src/screens/Login.tsx", "claude-opus-5-5", true],
  ["mobile-app", "Cache avatars on disk", "src/lib/avatar-cache.ts", "claude-sonnet-5"],
  ["mobile-app", "Upgrade navigation library", "package.json", "claude-sonnet-5"],
  ["acme-shop", "Write release notes for v2.4", "CHANGELOG.md", "claude-haiku-4-5-20251001"],
  ["weather-api", "Add retry to upstream fetch", "src/upstream.ts", "claude-opus-5-5"],
  ["cli-tools", "Explain the plugin loader", "src/plugins/mod.rs", "claude-haiku-4-5-20251001"],
];

function extraSessions(root) {
  const projects = path.join(root, ".claude", "projects");
  EXTRA_TASKS.forEach(([repo, title, file, model, failsFirst], i) => {
    const cwd = `/Users/demo/code/${repo}`;
    const id = `${(0x3a000000 + i * 7919).toString(16)}-${String(1000 + i)}-4a00-8b00-${String(i).padStart(12, "0")}`;
    // Two days apart going back from the anchor, at varying times of day.
    const start = new Date(ANCHOR - (i + 1) * 1.7 * 86_400_000 + (8 + (i * 5) % 10) * 3_600_000).toISOString();
    const test = repo === "cli-tools" ? "cargo test" : "pnpm test";
    const ui = repo === "docs-site" || repo === "mobile-app";
    // A spread of skills and MCP servers, so those dashboards have rows.
    const steps = [];
    if (i % 4 === 0) {
      steps.push({ tool: "mcp__linear__get_issue", input: { id: `DEV-${210 + i}` }, result: `DEV-${210 + i}: ${title} (priority: medium, status: In Progress)` });
    }
    if (ui) steps.push({ tool: "Skill", input: { skill: "frontend-design" }, result: "Launching skill: frontend-design" });
    if (i % 5 === 1) {
      steps.push({ tool: "mcp__context7__get_library_docs", input: { libraryId: "/vercel/next.js", topic: "caching" }, result: "Fetch requests are not cached by default. Use { cache: 'force-cache' } to opt in…" });
    }
    steps.push(
      { tool: "Grep", input: { pattern: path.basename(file, path.extname(file)), path: "." }, result: `${file}:1:` },
      { tool: "Read", input: { file_path: `${cwd}/${file}` }, result: `// ${file}\n// …existing code…` },
      { tool: "Edit", input: { file_path: `${cwd}/${file}`, old_string: "// …existing code…", new_string: `// ${title}` }, result: `The file ${file} has been updated.` },
    );
    if (i % 3 === 2) steps.push({ tool: "Skill", input: { skill: "writing-tests" }, result: "Launching skill: writing-tests" });
    if (failsFirst) {
      steps.push(
        { tool: "Bash", input: { command: test, description: "Run tests" }, seconds: 12, error: true, result: "1 failed, 23 passed" },
        { thinking: "One assertion still expects the old behaviour; update it alongside the change." },
        { tool: "Edit", input: { file_path: `${cwd}/${file}`, old_string: `// ${title}`, new_string: `// ${title} (fixed)` }, result: `The file ${file} has been updated.` },
      );
    }
    steps.push(
      { tool: "Bash", input: { command: test, description: "Run tests" }, seconds: 10, result: "24 passed" },
    );
    if (ui) {
      steps.push(
        { tool: "mcp__playwright__browser_navigate", input: { url: "http://localhost:3000" }, result: "Navigated to http://localhost:3000" },
        { tool: "mcp__playwright__browser_take_screenshot", input: { fullPage: true }, result: "Screenshot saved to .playwright/home.png" },
      );
    }
    if (i % 4 === 3) {
      steps.push({ tool: "mcp__github__create_pull_request", input: { owner: "demo", repo, title }, result: `Created pull request #${40 + i}: https://github.com/demo/${repo}/pull/${40 + i}` });
    }
    steps.push(
      { text: `Done: ${title.toLowerCase()}. The change is in \`${file}\` and the test suite passes.` },
    );
    writeJsonl(
      path.join(projects, `-Users-demo-code-${repo}`, `${id}.jsonl`),
      claudeSession({ id, cwd, branch: i % 3 ? "main" : `chore/${repo}-${i}`, title, start, model, turns: [{ prompt: `${title}.`, steps }] }),
    );
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = writeDemoHome(path.resolve(process.argv[2] ?? ".demo-home"));
  console.log(`Demo home written to ${root}`);
  console.log(`Run: HOME=${root} pnpm dev`);
}
