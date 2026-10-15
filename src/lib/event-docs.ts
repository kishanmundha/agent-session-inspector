import type { ProviderId } from "@/lib/providers/types";

/**
 * What the timeline knows about each event type: what it means, which records
 * each agent writes it from, and what the app does to them on the way.
 * Client-safe, so it never imports an adapter.
 */

/** One way an agent records the thing this event stands for. */
export interface EventSource {
  /** The record as the agent writes it, in its own terms. */
  record: string;
  /** Anything the app does to this record beyond the shared changes. */
  note?: string;
}

export interface EventDoc {
  summary: string;
  /** A longer explanation, when one sentence is not enough. */
  detail?: string;
  /** Fields worth explaining, beyond the ones described in `FIELD_DOCS`. */
  fields?: Record<string, string>;
  /** Changes the app makes to this type for every agent. */
  changes?: string[];
  /** Per agent; an agent with no entry is described by its format alone. */
  sources?: Partial<Record<ProviderId, EventSource[]>>;
}

/** How each agent stores a session, and where the app reads it. */
export const PROVIDER_FORMATS: Record<ProviderId, string> = {
  claude:
    "JSONL under ~/.claude/projects/<project>/<session>.jsonl: one JSON record per line, typed user, assistant, system, attachment and so on. Every record carries the Claude Code version that wrote it.",
  cowork:
    "The Claude Code CLI runs inside each Cowork session and writes the same JSONL transcript, so it is read exactly like Claude Code.",
  codex:
    "JSONL under ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: {timestamp, type, payload} lines typed session_meta, event_msg, response_item, turn_context. Only session_meta names the CLI version.",
  copilot:
    "JSONL under ~/.copilot/session-state/<id>/events.jsonl, already written as {type, data, id, timestamp, parentId} in the same category.subCategory vocabulary this app uses. session.start names the format version and the CLI version.",
  vscode:
    "Chat session files (JSON, or JSONL of appended changes) in VS Code's workspace storage, one request/response pair per entry.",
  gemini:
    "Session files under ~/.gemini/tmp/<project>/chats. Each message is typed user, gemini, info, warning or error; a message written again replaces its earlier version.",
  opencode:
    "SQLite (opencode.db): session, message and part rows, each keeping its content in a JSON column.",
  cursor:
    "SQLite stores under ~/.cursor/projects, holding the conversation as bubble rows: 1 for the user, 2 for the agent.",
  hermes: "SQLite (state.db) under ~/.hermes: sessions and their messages as rows.",
};

/** Applies to every event, whatever its type. */
export const SHARED_CHANGES = [
  "The type is renamed to the shared category.subCategory vocabulary, so every agent's events read the same way.",
  "Long text is cut at 20,000 characters. charLength keeps the full length and truncated says it was cut; the original record is uncut.",
  "One record can become several events (a response with text, thinking and tool calls), and some records are skipped as bookkeeping.",
];

/** Fields that mean the same on every event type. */
export const FIELD_DOCS: Record<string, string> = {
  content: "Text of the message, capped at 20,000 characters.",
  charLength: "Full length of the text before it was capped.",
  truncated: "True when the text shown was cut short.",
  model: "Model that produced this, as the agent named it.",
  effort: "Reasoning effort the request ran with.",
  requestId: "API request id, for matching against provider logs.",
  role: "Where the text came from: system_prompt, instructions, developer, user_context, …",
  toolName: "Tool the model called; mcp__server__tool for MCP tools.",
  toolCallId: "Id linking a call to its result.",
  arguments: "Arguments the model passed to the tool, parsed into JSON.",
  argumentChars: "Size of the arguments as the model wrote them, which is what they cost in context.",
  result: "What the tool returned, reduced to {content, format, images?, detail?}.",
  resultChars: "Full length of the result before it was capped.",
  success: "False when the call reported failure.",
  inputTokens: "Input tokens of the request, including tokens written to cache.",
  outputTokens: "Output tokens of the response, thinking included.",
  cacheReadTokens: "Input tokens served from the prompt cache.",
  billedUsage: "Usage split the way it is priced, used for the cost estimate.",
  costUSD: "Estimated cost of this request at API list prices.",
  inherited: "Copied from the session this one was forked from; its cost belongs there.",
  durationMs: "How long it took, in milliseconds.",
  sessionId: "Id of the session.",
  context: "Working directory, branch and repository the session ran in.",
  attachmentType: "The agent's own name for this kind of context.",
  label: "Readable name for the attachment kind.",
  subject: "What the attachment is about: a file, a date, a hook…",
  items: "Names listed by the attachment (tools, skills, agents), at most 200.",
  itemCount: "How many names the attachment listed in full.",
  itemsLabel: "What the listed names are.",
  message: "Error or notice text.",
  reason: "Why it happened.",
  mode: "The mode switched to.",
  trigger: "What started it: manual or auto.",
  preTokens: "Context size before compaction.",
  turnId: "Id of the turn.",
  totalCostUSD: "Session cost the agent itself reported so far.",
  apiDurationMs: "Total time spent waiting on the API so far.",
  premiumRequests: "Premium requests counted so far.",
  sessionTotals: "Session totals the agent reported, used for the session summary.",
  usage: "Usage totals as the agent reported them.",
  selectedModel: "Model chosen when the session began.",
  copilotVersion: "Version of the agent CLI that wrote the session.",
  cliVersion: "Version of the agent CLI that wrote the session.",
  entrypoint: "Where the session ran: cli, claude-desktop, …",
  forkedFrom: "The session this one was forked from.",
};

/** The envelope every event shares, and nested fields worth naming. */
const EVENT_PATH_DOCS: Record<string, string> = {
  type: "Event type, category.subCategory.",
  data: "What the agent recorded, normalized where it is worth normalizing.",
  id: "Unique id of the event within the session.",
  timestamp: "When it happened, ISO 8601.",
  parentId: "Event this one follows from, when the agent records it.",
  source: "Where the original record is: its line in the transcript, or the agent's own id.",
  category: "First part of the type, used by the filters.",
  subCategory: "Rest of the type, used by the filters.",
  subKey: "Full type, used by the filters.",
  "data.result.content": "Plain text of the result, capped. JSON results are indented.",
  "data.result.format": "text or json.",
  "data.result.images": "Images the tool returned: type and size only.",
  "data.result.detail": "A second rendering some tools add, usually a diff.",
  "data.context.cwd": "Working directory.",
  "data.context.branch": "Git branch.",
  "data.context.repository": "Git repository.",
  "data.billedUsage.model": "Model the usage is priced as.",
  "data.billedUsage.inputTokens": "Input tokens not read from or written to cache.",
  "data.billedUsage.outputTokens": "Output tokens.",
  "data.billedUsage.cacheReadTokens": "Input tokens read from cache.",
  "data.billedUsage.cacheWriteTokens": "Input tokens written to the 5-minute cache.",
  "data.billedUsage.cacheWrite1hTokens": "Input tokens written to the 1-hour cache.",
  "data.billedUsage.fast": "Ran in fast mode, billed at a higher rate.",
  "data.billedUsage.local": "Ran on a local model, which bills nothing.",
};

/** Describes a property of the event as the app holds it, by dotted path. */
export function describeEventPath(doc: EventDoc, path: string): string | undefined {
  if (EVENT_PATH_DOCS[path]) return EVENT_PATH_DOCS[path];
  const field = /^data\.([^.[\]]+)$/.exec(path)?.[1];
  return field ? doc.fields?.[field] ?? FIELD_DOCS[field] : undefined;
}

const CLAUDE_RECORD_DOCS: Record<string, string> = {
  type: "Record kind: user, assistant, system, attachment, mode, …",
  subtype: "Kind of system record: api_error, compact_boundary, turn_duration, …",
  uuid: "Id of the record.",
  parentUuid: "Record this one follows in the conversation.",
  isSidechain: "Written by a subagent rather than the main conversation.",
  timestamp: "When it was written, ISO 8601.",
  sessionId: "Session the record belongs to; a fork keeps its parent's id on copied records.",
  cwd: "Working directory.",
  gitBranch: "Git branch at the time.",
  version: "Claude Code version that wrote the record.",
  entrypoint: "Where Claude Code ran: cli, claude-desktop, …",
  userType: "Who is driving the session.",
  requestId: "API request id.",
  promptId: "Prompt the record belongs to.",
  effort: "Reasoning effort of the request.",
  message: "The API message, as sent or received.",
  "message.role": "user or assistant.",
  "message.model": "Model that answered; <synthetic> for messages Claude Code wrote itself.",
  "message.id": "API message id; shared by every record of one streamed response.",
  "message.type": "Always message.",
  "message.content": "A string, or a list of content blocks.",
  "message.content[].type": "Block kind: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Text of a text block.",
  "message.content[].thinking": "Reasoning of a thinking block.",
  "message.content[].signature": "Signature that lets the thinking be sent back to the API.",
  "message.content[].id": "Id of a tool_use block.",
  "message.content[].name": "Tool a tool_use block calls.",
  "message.content[].input": "Arguments of a tool_use block.",
  "message.content[].tool_use_id": "Call a tool_result block answers.",
  "message.content[].content": "What the tool returned.",
  "message.content[].is_error": "The tool reported failure.",
  "message.stop_reason": "Why the response ended: end_turn, tool_use, max_tokens, …",
  "message.usage": "Token usage of the whole response, repeated on each of its records.",
  "message.usage.input_tokens": "Input tokens not read from or written to cache.",
  "message.usage.output_tokens": "Output tokens.",
  "message.usage.cache_read_input_tokens": "Input tokens read from cache.",
  "message.usage.cache_creation_input_tokens": "Input tokens written to cache.",
  "message.usage.cache_creation": "Cache writes split by time to live.",
  "message.usage.speed": "fast when the request ran in fast mode.",
  toolUseResult: "Claude Code's own structured copy of a tool result.",
  attachment: "Context Claude Code injected; its type says which kind.",
  "attachment.type": "Kind of attachment: prompt_snapshot, instructions, file, date, …",
  content: "Text of a system record.",
  level: "Severity of a system record.",
  error: "Error details of an api_error record.",
};

const CODEX_RECORD_DOCS: Record<string, string> = {
  timestamp: "When the line was written, ISO 8601.",
  ordinal: "Position of the line in the rollout.",
  type: "Line kind: session_meta, event_msg, response_item, turn_context, …",
  payload: "The line's content; its own type says what it is.",
  "payload.type": "Kind of payload: user_message, agent_message, function_call, token_count, …",
  "payload.id": "Id of the session (session_meta) or the item.",
  "payload.cli_version": "Codex CLI version, on session_meta only.",
  "payload.originator": "App that ran Codex.",
  "payload.cwd": "Working directory.",
  "payload.role": "Who a message is from: user, assistant, developer, system.",
  "payload.content": "Content parts of a message.",
  "payload.content[].type": "Part kind: input_text, output_text, …",
  "payload.content[].text": "Text of the part.",
  "payload.message": "Text of an event_msg message.",
  "payload.call_id": "Id linking a tool call to its output.",
  "payload.name": "Tool called.",
  "payload.arguments": "Tool arguments, as a JSON string.",
  "payload.input": "Input of a custom tool call.",
  "payload.output": "What the tool returned.",
  "payload.status": "Status of the call.",
  "payload.turn_id": "Turn the line belongs to.",
  "payload.info": "Token usage: cumulative totals and the last request's.",
};

const COPILOT_RECORD_DOCS: Record<string, string> = {
  type: "Event type, already in category.subCategory form.",
  data: "Event data.",
  id: "Id of the event.",
  timestamp: "When it happened, ISO 8601.",
  parentId: "Event this one follows from.",
  "data.version": "Version of the events.jsonl format.",
  "data.copilotVersion": "Copilot CLI version.",
  "data.producer": "What wrote the file.",
  "data.toolCallId": "Id linking a call to its result.",
  "data.toolName": "Tool called.",
  "data.arguments": "Tool arguments.",
  "data.result": "What the tool returned: content, and detailedContent when the tool adds one.",
  "data.error": "Why a failed call failed.",
};

const RECORD_DOCS: Partial<Record<ProviderId, Record<string, string>>> = {
  claude: CLAUDE_RECORD_DOCS,
  cowork: CLAUDE_RECORD_DOCS,
  codex: CODEX_RECORD_DOCS,
  copilot: COPILOT_RECORD_DOCS,
};

/** Describes a property of an agent's raw record, by dotted path. */
export function describeRecordPath(provider: ProviderId, path: string): string | undefined {
  return RECORD_DOCS[provider]?.[path];
}

const TOOL_RESULT_CHANGES = [
  "The result is reduced to plain text in result.content. Images keep only their type and size; the pixels stay on disk.",
  "In the compact view a call and its result are shown as one row, so Raw and Original show two records.",
];

const CLAUDE_TOOL_USE = "An assistant record with a tool_use block in message.content";
const CLAUDE_TOOL_RESULT =
  "A user record with a tool_result block, matched to its call by tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code writes one record per content block of a streamed response, and repeats the response's usage on each. The usage is counted once, on the first event of the response.";

const claudeSources = (sources: EventSource[]) => ({ claude: sources, cowork: sources });

export const EVENT_DOCS: Record<string, EventDoc> = {
  "session.start": {
    summary: "Session initialization. Captures the runtime context and selected model when a session begins.",
    sources: {
      ...claudeSources([
        {
          record: "No record: Claude Code writes no start record",
          note: "The app builds one from the cwd, gitBranch, version and entrypoint of the transcript's records, so the timeline opens with the same header for every agent.",
        },
      ]),
      codex: [{ record: "The first session_meta line", note: "Later session_meta lines are sub-agent threads and become subagent.session_start." }],
      copilot: [{ record: "session.start, read as written" }],
    },
  },
  "session.resume": { summary: "Session resumed from a previous state. Indicates context reload and continuation." },
  "session.shutdown": {
    summary: "Session end summary. Usually includes usage, token totals, premium requests and API timing.",
    sources: {
      copilot: [
        {
          record: "session.shutdown",
          note: "The app derives sessionTotals and usageSummary from it. Totals are cumulative, so only the last shutdown is priced and a resumed session is not counted twice.",
        },
      ],
    },
  },
  "session.auto_mode_resolved": { summary: "Auto-mode model selection result. Shows the predicted task profile and the chosen model settings." },
  "session.binary_asset": { summary: "Binary payload captured in the session, typically screenshots. Can take up significant context and storage." },
  "session.usage_checkpoint": {
    summary: "Interim usage accounting while the session is active.",
    sources: {
      ...claudeSources([{ record: "A cost-state record", note: "totalCostUSD and totalAPIDuration are copied as reported." }]),
      codex: [
        {
          record: "An event_msg line of type token_count",
          note: "Codex reports cumulative totals, so the app bills only the step since the previous checkpoint, and moves cached tokens out of input_tokens so each is priced once.",
        },
      ],
      copilot: [{ record: "session.usage_checkpoint", note: "Premium/AIU accounting only, no token totals; premiumRequests is copied from totalPremiumRequests." }],
    },
  },
  "session.model_change": {
    summary: "Model configuration switched during the session (model, effort or context tier).",
    sources: { codex: [{ record: "An event_msg line of type thread_settings_applied" }] },
  },
  "session.compaction_start": {
    summary: "Context compaction started. The conversation is summarized to reduce the tokens sent on every request.",
    sources: claudeSources([{ record: "A system record with subtype compact_boundary", note: "trigger and preTokens come from compactMetadata." }]),
  },
  "session.compaction_complete": { summary: "Compaction finished, with success or failure metadata and request ids." },
  "session.error": {
    summary: "API or transport error. Each retry sends the full request context again.",
    sources: {
      ...claudeSources([{ record: "A system record with subtype api_error" }]),
      gemini: [{ record: "A message of type error" }],
    },
  },
  "session.turn_aborted": {
    summary: "The turn was interrupted before it completed.",
    changes: ["Each agent marks an interruption differently; they all become this one type."],
    sources: {
      ...claudeSources([
        {
          record: "A user record whose text starts with “[Request interrupted by user”",
          note: "Claude Code logs the interruption as if the user had typed it; the app does not show it as a prompt.",
        },
      ]),
      codex: [{ record: "An event_msg line of type turn_aborted" }],
      copilot: [{ record: "An abort event", note: "Renamed; the data is kept as written." }],
    },
  },
  "session.mode_change": {
    summary: "Interaction or permission mode switched during the session.",
    sources: claudeSources([{ record: "A mode or permission-mode record" }]),
  },
  "session.turn_context": {
    summary: "Per-turn runtime configuration: model, effort, sandbox and approval policy.",
    sources: { codex: [{ record: "A turn_context line" }] },
  },
  "session.world_state": {
    summary: "Snapshot of the workspace the runtime handed to the model.",
    sources: { codex: [{ record: "A world_state line" }] },
  },
  "session.rollback": {
    summary: "The conversation was rolled back by a number of turns.",
    sources: { codex: [{ record: "An event_msg line of type thread_rolled_back" }] },
  },
  "session.plan_changed": { summary: "The agent created or updated its working plan." },
  "session.info": {
    summary: "A notice the agent printed: information or a warning.",
    sources: { gemini: [{ record: "A message of type info or warning" }] },
  },

  "user.message": {
    summary: "What the user typed. It drives the next assistant turn.",
    sources: {
      ...claudeSources([
        {
          record: "A user record: message.content as a string, or each text block in it",
          note: "The same record type also carries tool results, which become tool.execution_complete.",
        },
      ]),
      codex: [
        { record: "An event_msg line of type user_message" },
        {
          record: "A response_item message with role user, only in older rollouts",
          note: "Newer rollouts carry the conversation twice, as event_msg (what the user saw) and response_item (what the model saw). The app uses event_msg so turns are not doubled; the response_item copy becomes system.message.",
        },
      ],
      copilot: [{ record: "user.message, read as written" }],
      gemini: [{ record: "A message of type user" }],
    },
  },
  "assistant.message": {
    summary: "Text the model wrote back, with the model name and token usage.",
    fields: {
      phase: "Codex: which part of the turn the message belongs to.",
    },
    sources: {
      ...claudeSources([
        {
          record: "An assistant record with a text block in message.content",
          note: `${CLAUDE_ASSISTANT_NOTE} A response with no text, thinking or tool call still becomes an empty message, so its usage is counted.`,
        },
      ]),
      codex: [
        { record: "An event_msg line of type agent_message" },
        { record: "A response_item message with role assistant, only when there is no event_msg copy" },
      ],
      copilot: [{ record: "assistant.message, read as written" }],
      gemini: [{ record: "The content of a message of type gemini" }],
    },
  },
  "assistant.thinking": {
    summary: "Reasoning the model produced before answering. Billed as output tokens.",
    sources: {
      ...claudeSources([{ record: "An assistant record with a thinking block", note: CLAUDE_ASSISTANT_NOTE }]),
      codex: [
        { record: "An event_msg line of type agent_reasoning" },
        { record: "A response_item of type reasoning, using its summary", note: "Encrypted-only reasoning has nothing readable and is skipped." },
      ],
      gemini: [{ record: "Each entry of thoughts on a message of type gemini" }],
    },
  },
  "assistant.turn_start": {
    summary: "Start of one assistant turn.",
    sources: { codex: [{ record: "An event_msg line of type task_started" }] },
  },
  "assistant.turn_end": {
    summary: "End of the assistant turn after its reasoning, tool calls and output.",
    sources: {
      ...claudeSources([{ record: "A system record with subtype turn_duration" }]),
      codex: [{ record: "An event_msg line of type task_complete" }],
    },
  },

  "tool.execution_start": {
    summary: "The model called a built-in tool, with its name and arguments.",
    changes: ["argumentChars is added: the size of the arguments as written, which is what they cost in context."],
    sources: {
      ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Tools named mcp__… become external_tool.requested instead. ${CLAUDE_ASSISTANT_NOTE}` }]),
      codex: [
        {
          record: "A response_item of type function_call, custom_tool_call or local_shell_call",
          note: "Arguments written as a JSON string are parsed into an object.",
        },
      ],
      copilot: [{ record: "tool.execution_start, read as written" }],
      gemini: [{ record: "Each entry of toolCalls on a message of type gemini" }],
    },
  },
  "tool.execution_complete": {
    summary: "A built-in tool call finished, with its status and result.",
    changes: TOOL_RESULT_CHANGES,
    sources: {
      ...claudeSources([
        {
          record: CLAUDE_TOOL_RESULT,
          note: "The tool name comes from the matching call. When the block has no content, the record's toolUseResult is used. success is false when is_error is set.",
        },
      ]),
      codex: [
        {
          record: "A response_item of type function_call_output, custom_tool_call_output or local_shell_call_output",
          note: "Codex records no success flag; the app marks a call failed when its output reports a non-zero exit code.",
        },
      ],
      copilot: [
        {
          record: "tool.execution_complete",
          note: "result.content becomes the result text, a failed call's error.message stands in for it, and detailedContent (usually a diff) becomes result.detail.",
        },
      ],
    },
  },
  "external_tool.requested": {
    summary: "The model called a tool served by an external bridge, usually an MCP server.",
    changes: ["argumentChars is added: the size of the arguments as written, which is what they cost in context."],
    sources: {
      ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, for a tool named mcp__…` }]),
      copilot: [{ record: "external_tool.requested, read as written" }],
    },
  },
  "external_tool.completed": {
    summary: "An external tool call finished, with its status and result.",
    changes: TOOL_RESULT_CHANGES,
    sources: {
      ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, for a tool named mcp__…` }]),
      codex: [{ record: "An event_msg line of type mcp_tool_call_end" }],
      copilot: [{ record: "external_tool.completed", note: "Shaped like tool.execution_complete." }],
    },
  },

  "permission.requested": { summary: "The runtime asked the user for permission for an action (file, system or network)." },
  "permission.completed": { summary: "The permission request was resolved: approved or denied." },
  "hook.start": { summary: "A lifecycle hook started, for example on prompt submission." },
  "hook.end": {
    summary: "A lifecycle hook finished, with success or failure.",
    sources: claudeSources([{ record: "A system record with subtype stop_hook_summary", note: "success is false when the record lists hook errors." }]),
  },

  "system.message": {
    summary: "Instructions the runtime put in front of the model: the system prompt, instruction files or injected context.",
    detail: "These are sent with every request, so their size adds up over a session. Hidden with the other injected context by the toolbar toggle.",
    sources: {
      ...claudeSources([
        { record: "An attachment record of type prompt_snapshot", note: "Claude Code records the system prompt again whenever any part of it changes; the app shows it only when the prompt text itself changed." },
        { record: "An attachment record of type instructions (CLAUDE.md and AGENTS.md files)" },
        { record: "A system record of any other subtype" },
      ]),
      codex: [
        { record: "base_instructions on the session_meta line" },
        { record: "A response_item message with role developer or system" },
        { record: "A response_item message with role user that the runtime injected, shown as role user_context" },
      ],
    },
  },
  "context.attachment": {
    summary: "Context the runtime added on its own: file snapshots, reminders, tool or skill listings, images.",
    changes: ["Every kind of attachment is flattened to {label, subject, items, content}, so it reads as content rather than raw JSON."],
    sources: {
      ...claudeSources([
        { record: "An attachment record (date, file, skill_listing, deferred_tools_delta, …)" },
        { record: "The tools list of a prompt_snapshot attachment, shown as tool definitions when it changes" },
        { record: "An image block in a user record", note: "Only that an image was sent is kept; the pixels stay on disk." },
      ]),
      codex: [{ record: "dynamic_tools on the session_meta line, shown as tool definitions" }],
    },
  },
  "system.notification": { summary: "A runtime notification added to the conversation, such as a background shell finishing." },

  "file.patch_applied": {
    summary: "A patch the agent applied to the workspace, with the files it touched.",
    sources: { codex: [{ record: "An event_msg line of type patch_apply_end" }] },
  },
  "web.search": {
    summary: "A web search the model ran; its results are added to the context.",
    sources: { codex: [{ record: "An event_msg line of type web_search_end" }] },
  },

  "subagent.deselected": { summary: "Subagent focus was cleared and control returned to the main agent." },
  "subagent.activity": {
    summary: "Activity reported by a subagent working under the main agent.",
    sources: { codex: [{ record: "An event_msg line of type sub_agent_activity" }] },
  },
  "subagent.message": {
    summary: "A message passed between agents.",
    sources: { codex: [{ record: "An inter_agent_communication_metadata line" }] },
  },
  "subagent.session_start": {
    summary: "A subagent thread started inside this session.",
    sources: { codex: [{ record: "A session_meta line after the first one" }] },
  },
};

/** The doc for a type; types with no entry still get a readable one. */
export function eventDoc(type: string): EventDoc {
  const known = EVENT_DOCS[type];
  if (known) return known;
  const [category, ...rest] = type.split(".");
  return {
    summary: `An event in the “${category || "unknown"}” category (“${rest.join(".") || "general"}”) that has no description yet.`,
    detail:
      "The agent wrote a record the app has no mapping for. It is kept with its data as written, so nothing is lost, and shown through the generic card.",
  };
}

/**
 * The version an agent stamped on a raw record, in the agent's own terms.
 * Returns null when this record names none.
 */
export function recordVersion(
  provider: ProviderId,
  record: unknown,
): { label: string; value: string }[] | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
  const found: { label: string; value: string }[] = [];
  switch (provider) {
    case "claude":
    case "cowork": {
      const v = str(rec.version);
      if (v) found.push({ label: "Claude Code", value: v });
      break;
    }
    case "codex": {
      const v = str((rec.payload as Record<string, unknown> | undefined)?.cli_version);
      if (v) found.push({ label: "Codex CLI", value: v });
      break;
    }
    case "copilot": {
      const data = (rec.data as Record<string, unknown> | undefined) ?? {};
      const cli = str(data.copilotVersion);
      const format = str(data.version);
      if (cli) found.push({ label: "Copilot CLI", value: cli });
      if (format) found.push({ label: "Event format", value: format });
      break;
    }
  }
  return found.length > 0 ? found : null;
}
