#!/usr/bin/env node
// Writes a fake $HOME with synthetic Claude Code, Codex and Copilot transcripts, so the
// UI can be demoed (and README screenshots retaken) without exposing real
// sessions. Usage:
//   node scripts/demo-data.mjs /tmp/asi-demo
//   HOME=/tmp/asi-demo pnpm dev
import fs from "fs";
import path from "path";

const root = path.resolve(process.argv[2] ?? ".demo-home");
fs.rmSync(root, { recursive: true, force: true });

const writeJsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
};

const clock = (start) => {
  let t = new Date(start).getTime();
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
          { thinking: "Off-by-a-cent usually means floating point arithmetic on prices. Let me find where the total is computed." },
          { tool: "Grep", input: { pattern: "total", path: "src/cart" }, result: "src/cart/total.ts:12:export function cartTotal(items: CartItem[]) {\nsrc/cart/total.ts:18:  return total;\nsrc/cart/summary.tsx:31:  const total = cartTotal(items);" },
          { tool: "Read", input: { file_path: `${checkoutCwd}/src/cart/total.ts` }, result: "export function cartTotal(items: CartItem[]) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * item.quantity * (1 - item.discount);\n  }\n  return Math.round(total * 100) / 100;\n}" },
          { text: "The total sums floating-point prices and rounds once at the end, so values like `0.1 + 0.2` drift before rounding. I'll switch to integer cents and round per line item." },
          { tool: "Edit", input: { file_path: `${checkoutCwd}/src/cart/total.ts`, old_string: "total += item.price * item.quantity * (1 - item.discount);", new_string: "total += Math.round(toCents(item.price) * item.quantity * (1 - item.discount));" }, result: "The file src/cart/total.ts has been updated." },
          { tool: "Edit", input: { file_path: `${checkoutCwd}/src/cart/__tests__/total.test.ts`, old_string: "});", new_string: "  it('does not drift on fractional prices', () => {\n    expect(cartTotal([{ price: 0.1, quantity: 3, discount: 0 }])).toBe(0.3);\n  });\n});" }, result: "The file src/cart/__tests__/total.test.ts has been updated." },
          { tool: "Bash", input: { command: "pnpm test src/cart", description: "Run cart tests" }, seconds: 14, result: " PASS  src/cart/__tests__/total.test.ts\n  cartTotal\n    ✓ sums line items (3 ms)\n    ✓ applies discounts (1 ms)\n    ✓ does not drift on fractional prices (1 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       3 passed, 3 total" },
          { text: "Fixed. `cartTotal` now works in integer cents and rounds each line item, so totals no longer drift by a cent. I added a regression test for fractional prices; all 3 cart tests pass." },
        ],
      },
      {
        prompt: "Nice. Does the same bug exist in the order summary on the checkout page?",
        steps: [
          { tool: "Read", input: { file_path: `${checkoutCwd}/src/checkout/summary.tsx` }, result: "import { cartTotal } from '../cart/total';\n\nexport function OrderSummary({ items, shipping }) {\n  const subtotal = cartTotal(items);\n  const total = subtotal + shipping;\n  return <Money value={total} />;\n}" },
          { tool: "Bash", input: { command: "pnpm test src/checkout", description: "Run checkout tests" }, seconds: 9, result: "Tests:       7 passed, 7 total" },
          { text: "The checkout summary calls `cartTotal`, so it picks up the fix automatically. Shipping is already stored in cents, so there's nothing else to change there." },
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
          { tool: "Read", input: { file_path: `${apiCwd}/src/routes/forecast.ts` }, result: "router.get('/forecast', async (req, res) => {\n  const data = await getForecast(req.query.city);\n  res.json(data);\n});" },
          { tool: "Write", input: { file_path: `${apiCwd}/src/middleware/rate-limit.ts`, content: "export function rateLimit(limit: number, windowMs: number) { /* ... */ }" }, result: "File created successfully." },
          { tool: "Edit", input: { file_path: `${apiCwd}/src/routes/forecast.ts`, old_string: "router.get('/forecast',", new_string: "router.get('/forecast', rateLimit(60, 60_000)," }, result: "The file src/routes/forecast.ts has been updated." },
          { tool: "Bash", input: { command: "pnpm test", description: "Run test suite" }, seconds: 11, error: true, result: "FAIL src/routes/__tests__/forecast.test.ts\n  ✕ returns 429 after limit (12 ms)\n    Expected: 429\n    Received: 200" },
          { thinking: "The limiter keys on req.ip, which is undefined behind the test client. Fall back to the socket address." },
          { tool: "Edit", input: { file_path: `${apiCwd}/src/middleware/rate-limit.ts`, old_string: "const key = req.ip;", new_string: "const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';" }, result: "The file src/middleware/rate-limit.ts has been updated." },
          { tool: "Bash", input: { command: "pnpm test", description: "Run test suite" }, seconds: 10, result: "Tests:       18 passed, 18 total" },
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
  writeJsonl(path.join(root, ".codex", "sessions", "2026", "09", "24", `rollout-2026-09-24T17-30-00-${codexId}.jsonl`), [
    {
      type: "session_meta",
      timestamp: at(0),
      payload: { id: codexId, cwd, originator: "codex_cli_rs", cli_version: "0.61.0", git: { branch: "feat/status-json", repository_url: "git@github.com:demo/cli-tools.git" } },
    },
    { type: "turn_context", timestamp: at(1), payload: { model: "gpt-5-codex", effort: "medium", cwd } },
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
  const start = "2026-09-24T12:05:00Z";
  const at = clock(start);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "workspace.yaml"),
    [
      `id: ${id}`,
      `name: Fix broken links in docs sidebar`,
      `cwd: ${cwd}`,
      `repository: demo/docs-site`,
      `branch: fix/sidebar-links`,
      `created_at: ${start}`,
      `updated_at: 2026-09-24T12:07:10Z`,
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
    path.join(root, ".copilot", "logs", "process-1758715500000-4821.log"),
    `${start} [INFO] Starting Copilot CLI 0.0.412\n${start} [INFO] Session ${id} created in ${cwd}\n2026-09-24T12:07:10Z [INFO] Session ${id} shut down\n`,
  );
}

console.log(`Demo home written to ${root}`);
console.log(`Run: HOME=${root} pnpm dev`);
