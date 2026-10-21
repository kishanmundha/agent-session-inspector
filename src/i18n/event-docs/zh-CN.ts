import { claudeSources, type EventDocs } from "./en";

/** Simplified Chinese. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "结果被简化为 result.content 中的纯文本。图片只保留类型和大小，像素数据仍留在磁盘上。",
  "在紧凑视图中，调用及其结果显示为一行，因此 Raw 和 Original 会显示两条记录。",
];

const CLAUDE_TOOL_USE = "message.content 中含 tool_use 块的 assistant 记录";
const CLAUDE_TOOL_RESULT =
  "含 tool_result 块的 user 记录，通过 tool_use_id 与其调用对应";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code 为流式响应的每个内容块各写一条记录，并在每条记录中重复该响应的用量。用量只在响应的第一个事件上计一次。";
const ARGUMENT_CHARS =
  "新增 argumentChars：参数按原样写出时的大小，即它们在上下文中的开销。";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "记录种类：user、assistant、system、attachment、mode 等",
  subtype: "system 记录的种类：api_error、compact_boundary、turn_duration 等",
  uuid: "记录的 id。",
  parentUuid: "对话中这条记录所接续的记录。",
  isSidechain: "由子代理而非主对话写入。",
  timestamp: "写入时间，ISO 8601。",
  sessionId: "记录所属的会话；分叉会在复制的记录上保留父会话的 id。",
  cwd: "工作目录。",
  gitBranch: "当时的 Git 分支。",
  version: "写入该记录的 Claude Code 版本。",
  entrypoint: "Claude Code 的运行位置：cli、claude-desktop 等",
  userType: "操作会话的主体。",
  requestId: "API 请求 id。",
  promptId: "记录所属的提示词。",
  effort: "请求的推理强度。",
  message: "按发送或接收原样保存的 API 消息。",
  "message.role": "user 或 assistant。",
  "message.model": "作答的模型；Claude Code 自己写的消息为 <synthetic>。",
  "message.id": "API 消息 id；同一流式响应的所有记录共用。",
  "message.type": "始终为 message。",
  "message.content": "字符串或内容块列表。",
  "message.content[].type": "块种类：text、thinking、tool_use、tool_result、image。",
  "message.content[].text": "text 块的文本。",
  "message.content[].thinking": "thinking 块的推理内容。",
  "message.content[].signature": "使推理内容能回传给 API 的签名。",
  "message.content[].id": "tool_use 块的 id。",
  "message.content[].name": "tool_use 块调用的工具。",
  "message.content[].input": "tool_use 块的参数。",
  "message.content[].tool_use_id": "tool_result 块所回应的调用。",
  "message.content[].content": "工具返回的内容。",
  "message.content[].is_error": "工具报告了失败。",
  "message.stop_reason": "响应结束的原因：end_turn、tool_use、max_tokens 等",
  "message.usage": "整个响应的 token 用量，在其每条记录中重复。",
  "message.usage.input_tokens": "既未从缓存读取、也未写入缓存的输入 token。",
  "message.usage.output_tokens": "输出 token。",
  "message.usage.cache_read_input_tokens": "从缓存读取的输入 token。",
  "message.usage.cache_creation_input_tokens": "写入缓存的输入 token。",
  "message.usage.cache_creation": "按存活时间拆分的缓存写入。",
  "message.usage.speed": "请求以快速模式运行时为 fast。",
  toolUseResult: "Claude Code 自己保存的结构化工具结果副本。",
  attachment: "Claude Code 注入的上下文；其 type 说明种类。",
  "attachment.type": "附件种类：prompt_snapshot、instructions、file、date 等",
  content: "system 记录的文本。",
  level: "system 记录的严重级别。",
  error: "api_error 记录的错误详情。",
};

export const zhCN: EventDocs = {
  providerFormats: {
    claude:
      "位于 ~/.claude/projects/<project>/<session>.jsonl 的 JSONL：每行一条 JSON 记录，类型为 user、assistant、system、attachment 等。每条记录都带有写入它的 Claude Code 版本。",
    cowork:
      "Claude Code CLI 在每个 Cowork 会话中运行，并写入相同的 JSONL 记录，因此与 Claude Code 的读取方式完全一致。",
    codex:
      "位于 ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl 的 JSONL：{timestamp, type, payload} 行，类型为 session_meta、event_msg、response_item、turn_context。只有 session_meta 注明 CLI 版本。",
    copilot:
      "位于 ~/.copilot/session-state/<id>/events.jsonl 的 JSONL，已按本应用使用的 category.subCategory 词汇写成 {type, data, id, timestamp, parentId}。session.start 注明格式版本和 CLI 版本。",
    vscode:
      "VS Code 工作区存储中的聊天会话文件（JSON，或追加变更的 JSONL），每个条目一对请求/响应。",
    gemini:
      "位于 ~/.gemini/tmp/<project>/chats 的会话文件。每条消息的类型为 user、gemini、info、warning 或 error；重新写入的消息会替换之前的版本。",
    opencode:
      "SQLite（opencode.db）：session、message 和 part 行，各自把内容保存在一个 JSON 列中。",
    cursor:
      "位于 ~/.cursor/projects 的 SQLite 存储，以 bubble 行保存对话：1 表示用户，2 表示代理。",
    hermes: "位于 ~/.hermes 的 SQLite（state.db）：会话及其消息以行保存。",
  },

  sharedChanges: [
    "类型被重命名为统一的 category.subCategory 词汇，使所有代理的事件读起来一致。",
    "长文本在 20,000 个字符处截断。charLength 保留完整长度，truncated 表示已截断；原始记录不截断。",
    "一条记录可能变成多个事件（包含文本、推理和工具调用的响应），部分仅用于内部记账的记录会被跳过。",
  ],

  fieldDocs: {
    content: "消息文本，上限 20,000 个字符。",
    charLength: "截断前文本的完整长度。",
    truncated: "显示的文本被截短时为 true。",
    model: "生成此内容的模型，沿用代理给出的名称。",
    effort: "请求所用的推理强度。",
    requestId: "API 请求 id，用于与服务商日志对照。",
    role: "文本来源：system_prompt、instructions、developer、user_context 等",
    toolName: "模型调用的工具；MCP 工具为 mcp__server__tool。",
    toolCallId: "把调用与其结果关联起来的 id。",
    arguments: "模型传给工具的参数，已解析为 JSON。",
    argumentChars: "模型写出的参数大小，即它们在上下文中的开销。",
    result: "工具返回的内容，简化为 {content, format, images?, detail?}。",
    resultChars: "截断前结果的完整长度。",
    success: "调用报告失败时为 false。",
    inputTokens: "请求的输入 token，包括写入缓存的部分。",
    outputTokens: "响应的输出 token，包括推理。",
    cacheReadTokens: "由提示词缓存提供的输入 token。",
    billedUsage: "按计价方式拆分的用量，用于估算费用。",
    costUSD: "按 API 标价估算的本次请求费用。",
    inherited: "复制自分叉来源会话；费用属于那个会话。",
    durationMs: "耗时，单位毫秒。",
    sessionId: "会话的 id。",
    context: "会话运行时的工作目录、分支和仓库。",
    attachmentType: "代理自己对这类上下文的命名。",
    label: "附件种类的易读名称。",
    subject: "附件涉及的对象：文件、日期、钩子……",
    items: "附件列出的名称（工具、技能、代理），最多 200 个。",
    itemCount: "附件完整列出的名称数量。",
    itemsLabel: "所列名称是什么。",
    message: "错误或通知文本。",
    reason: "发生的原因。",
    mode: "切换到的模式。",
    trigger: "触发方式：manual 或 auto。",
    preTokens: "压缩前的上下文大小。",
    turnId: "轮次的 id。",
    totalCostUSD: "代理自己报告的截至目前的会话费用。",
    apiDurationMs: "截至目前等待 API 的总时间。",
    premiumRequests: "截至目前计入的高级请求数。",
    sessionTotals: "代理报告的会话合计，用于会话摘要。",
    usage: "代理报告的用量合计。",
    selectedModel: "会话开始时选择的模型。",
    copilotVersion: "写入该会话的代理 CLI 版本。",
    cliVersion: "写入该会话的代理 CLI 版本。",
    entrypoint: "会话的运行位置：cli、claude-desktop 等",
    forkedFrom: "本会话分叉自的会话。",
  },

  pathDocs: {
    type: "事件类型，category.subCategory。",
    data: "代理记录的内容，在值得的地方做了规范化。",
    id: "事件在会话内的唯一 id。",
    timestamp: "发生时间，ISO 8601。",
    parentId: "此事件所源自的事件（若代理有记录）。",
    source: "原始记录的位置：在记录文件中的行号，或代理自己的 id。",
    category: "类型的第一部分，供筛选器使用。",
    subCategory: "类型的其余部分，供筛选器使用。",
    subKey: "完整类型，供筛选器使用。",
    "data.result.content": "结果的纯文本，有长度上限。JSON 结果会缩进。",
    "data.result.format": "text 或 json。",
    "data.result.images": "工具返回的图片：仅类型和大小。",
    "data.result.detail": "部分工具附加的第二种呈现，通常是 diff。",
    "data.context.cwd": "工作目录。",
    "data.context.branch": "Git 分支。",
    "data.context.repository": "Git 仓库。",
    "data.billedUsage.model": "用量计价所依据的模型。",
    "data.billedUsage.inputTokens": "既未从缓存读取、也未写入缓存的输入 token。",
    "data.billedUsage.outputTokens": "输出 token。",
    "data.billedUsage.cacheReadTokens": "从缓存读取的输入 token。",
    "data.billedUsage.cacheWriteTokens": "写入 5 分钟缓存的输入 token。",
    "data.billedUsage.cacheWrite1hTokens": "写入 1 小时缓存的输入 token。",
    "data.billedUsage.fast": "以快速模式运行，按更高费率计费。",
    "data.billedUsage.local": "在本地模型上运行，不产生费用。",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "该行的写入时间，ISO 8601。",
      ordinal: "该行在 rollout 中的位置。",
      type: "行的种类：session_meta、event_msg、response_item、turn_context 等",
      payload: "该行的内容；它自己的 type 说明是什么。",
      "payload.type": "payload 种类：user_message、agent_message、function_call、token_count 等",
      "payload.id": "会话（session_meta）或条目的 id。",
      "payload.cli_version": "Codex CLI 版本，仅出现在 session_meta 中。",
      "payload.originator": "运行 Codex 的应用。",
      "payload.cwd": "工作目录。",
      "payload.role": "消息的发送方：user、assistant、developer、system。",
      "payload.content": "消息的内容部分。",
      "payload.content[].type": "部分的种类：input_text、output_text 等",
      "payload.content[].text": "该部分的文本。",
      "payload.message": "event_msg 消息的文本。",
      "payload.call_id": "把工具调用与其输出关联起来的 id。",
      "payload.name": "被调用的工具。",
      "payload.arguments": "工具参数，JSON 字符串形式。",
      "payload.input": "自定义工具调用的输入。",
      "payload.output": "工具返回的内容。",
      "payload.status": "调用的状态。",
      "payload.turn_id": "该行所属的轮次。",
      "payload.info": "token 用量：累计合计和最近一次请求的用量。",
    },
    copilot: {
      type: "事件类型，已是 category.subCategory 形式。",
      data: "事件数据。",
      id: "事件的 id。",
      timestamp: "发生时间，ISO 8601。",
      parentId: "此事件所源自的事件。",
      "data.version": "events.jsonl 格式的版本。",
      "data.copilotVersion": "Copilot CLI 版本。",
      "data.producer": "写入该文件的程序。",
      "data.toolCallId": "把调用与其结果关联起来的 id。",
      "data.toolName": "被调用的工具。",
      "data.arguments": "工具参数。",
      "data.result": "工具返回的内容：content，以及工具附加时的 detailedContent。",
      "data.error": "失败调用失败的原因。",
    },
  },

  events: {
    "session.start": {
      summary: "会话初始化。记录会话开始时的运行环境和所选模型。",
      sources: {
        ...claudeSources([
          {
            record: "无记录：Claude Code 不写开始记录",
            note: "应用根据记录中的 cwd、gitBranch、version 和 entrypoint 构建一条，使每个代理的时间线都以相同的标题开头。",
          },
        ]),
        codex: [{ record: "第一行 session_meta", note: "之后的 session_meta 行是子代理线程，会变成 subagent.session_start。" }],
        copilot: [{ record: "session.start，按原样读取" }],
      },
    },
    "session.resume": { summary: "会话从之前的状态恢复。表示重新加载上下文并继续。" },
    "session.shutdown": {
      summary: "会话结束摘要。通常包括用量、token 合计、高级请求和 API 耗时。",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "应用从中得出 sessionTotals 和 usageSummary。合计是累计值，所以只对最后一次 shutdown 计价，恢复的会话不会被重复计算。",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "自动模式下的模型选择结果。显示预测的任务特征和所选的模型设置。" },
    "session.binary_asset": { summary: "会话中捕获的二进制数据，通常是截图。可能占用大量上下文和存储空间。" },
    "session.usage_checkpoint": {
      summary: "会话进行中的阶段性用量统计。",
      sources: {
        ...claudeSources([{ record: "cost-state 记录", note: "totalCostUSD 和 totalAPIDuration 按报告值复制。" }]),
        codex: [
          {
            record: "类型为 token_count 的 event_msg 行",
            note: "Codex 报告的是累计合计，因此应用只对自上一个检查点以来的增量计费，并把缓存 token 从 input_tokens 中移出，使每个 token 只计价一次。",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "只有高级请求/AIU 统计，没有 token 合计；premiumRequests 复制自 totalPremiumRequests。" }],
      },
    },
    "session.model_change": {
      summary: "会话期间模型配置发生变化（模型、推理强度或上下文档位）。",
      sources: { codex: [{ record: "类型为 thread_settings_applied 的 event_msg 行" }] },
    },
    "session.compaction_start": {
      summary: "上下文压缩开始。对话会被总结，以减少每次请求发送的 token。",
      sources: claudeSources([{ record: "subtype 为 compact_boundary 的 system 记录", note: "trigger 和 preTokens 取自 compactMetadata。" }]),
    },
    "session.compaction_complete": { summary: "压缩完成，附带成功或失败元数据和请求 id。" },
    "session.error": {
      summary: "API 或传输错误。每次重试都会重新发送完整的请求上下文。",
      sources: {
        ...claudeSources([{ record: "subtype 为 api_error 的 system 记录" }]),
        gemini: [{ record: "类型为 error 的消息" }],
      },
    },
    "session.turn_aborted": {
      summary: "该轮在完成前被中断。",
      changes: ["每个代理标记中断的方式不同，最终都统一为这一类型。"],
      sources: {
        ...claudeSources([
          {
            record: "文本以“[Request interrupted by user”开头的 user 记录",
            note: "Claude Code 把中断记录得像用户输入的一样；应用不会把它显示为提示词。",
          },
        ]),
        codex: [{ record: "类型为 turn_aborted 的 event_msg 行" }],
        copilot: [{ record: "abort 事件", note: "仅重命名，数据按原样保留。" }],
      },
    },
    "session.mode_change": {
      summary: "会话期间交互模式或权限模式发生切换。",
      sources: claudeSources([{ record: "mode 或 permission-mode 记录" }]),
    },
    "session.turn_context": {
      summary: "每轮的运行配置：模型、推理强度、沙盒和审批策略。",
      sources: { codex: [{ record: "turn_context 行" }] },
    },
    "session.world_state": {
      summary: "运行环境交给模型的工作区快照。",
      sources: { codex: [{ record: "world_state 行" }] },
    },
    "session.rollback": {
      summary: "对话被回退了若干轮。",
      sources: { codex: [{ record: "类型为 thread_rolled_back 的 event_msg 行" }] },
    },
    "session.plan_changed": { summary: "代理创建或更新了工作计划。" },
    "session.info": {
      summary: "代理输出的通知：信息或警告。",
      sources: { gemini: [{ record: "类型为 info 或 warning 的消息" }] },
    },

    "user.message": {
      summary: "用户输入的内容。它驱动助手的下一轮。",
      sources: {
        ...claudeSources([
          {
            record: "user 记录：字符串形式的 message.content，或其中的每个 text 块",
            note: "同一类记录也承载工具结果，这些会变成 tool.execution_complete。",
          },
        ]),
        codex: [
          { record: "类型为 user_message 的 event_msg 行" },
          {
            record: "role 为 user 的 response_item 消息（仅旧版 rollout）",
            note: "新版 rollout 会把对话存两份：event_msg（用户看到的）和 response_item（模型看到的）。应用使用 event_msg 以免轮次重复；response_item 副本变成 system.message。",
          },
        ],
        copilot: [{ record: "user.message，按原样读取" }],
        gemini: [{ record: "类型为 user 的消息" }],
      },
    },
    "assistant.message": {
      summary: "模型回复的文本，附带模型名称和 token 用量。",
      fields: {
        phase: "Codex：消息属于该轮的哪个阶段。",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content 中含 text 块的 assistant 记录",
            note: `${CLAUDE_ASSISTANT_NOTE}没有文本、推理或工具调用的响应仍会变成一条空消息，以便计入其用量。`,
          },
        ]),
        codex: [
          { record: "类型为 agent_message 的 event_msg 行" },
          { record: "role 为 assistant 的 response_item 消息（仅当没有 event_msg 副本时）" },
        ],
        copilot: [{ record: "assistant.message，按原样读取" }],
        gemini: [{ record: "类型为 gemini 的消息内容" }],
      },
    },
    "assistant.thinking": {
      summary: "模型在回答前产生的推理。按输出 token 计费。",
      sources: {
        ...claudeSources([{ record: "含 thinking 块的 assistant 记录", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "类型为 agent_reasoning 的 event_msg 行" },
          { record: "类型为 reasoning 的 response_item，使用其 summary", note: "只有加密推理的条目没有可读内容，会被跳过。" },
        ],
        gemini: [{ record: "类型为 gemini 的消息中 thoughts 的每一项" }],
      },
    },
    "assistant.turn_start": {
      summary: "助手一轮的开始。",
      sources: { codex: [{ record: "类型为 task_started 的 event_msg 行" }] },
    },
    "assistant.turn_end": {
      summary: "助手完成推理、工具调用和输出后的一轮结束。",
      sources: {
        ...claudeSources([{ record: "subtype 为 turn_duration 的 system 记录" }]),
        codex: [{ record: "类型为 task_complete 的 event_msg 行" }],
      },
    },

    "tool.execution_start": {
      summary: "模型调用了内置工具，附带名称和参数。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `名为 mcp__… 的工具会改为 external_tool.requested。${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "类型为 function_call、custom_tool_call 或 local_shell_call 的 response_item",
            note: "以 JSON 字符串写出的参数会被解析为对象。",
          },
        ],
        copilot: [{ record: "tool.execution_start，按原样读取" }],
        gemini: [{ record: "类型为 gemini 的消息中 toolCalls 的每一项" }],
      },
    },
    "tool.execution_complete": {
      summary: "内置工具调用结束，附带状态和结果。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "工具名称取自对应的调用。块中没有内容时，使用记录的 toolUseResult。设置了 is_error 时 success 为 false。",
          },
        ]),
        codex: [
          {
            record: "类型为 function_call_output、custom_tool_call_output 或 local_shell_call_output 的 response_item",
            note: "Codex 不记录成功标志；当输出报告非零退出码时，应用把调用标记为失败。",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content 成为结果文本，失败调用由 error.message 代替，detailedContent（通常是 diff）成为 result.detail。",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "模型调用了由外部桥接（通常是 MCP 服务器）提供的工具。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}，针对名为 mcp__… 的工具` }]),
        copilot: [{ record: "external_tool.requested，按原样读取" }],
      },
    },
    "external_tool.completed": {
      summary: "外部工具调用结束，附带状态和结果。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}，针对名为 mcp__… 的工具` }]),
        codex: [{ record: "类型为 mcp_tool_call_end 的 event_msg 行" }],
        copilot: [{ record: "external_tool.completed", note: "结构与 tool.execution_complete 相同。" }],
      },
    },

    "permission.requested": { summary: "运行环境请求用户允许某个操作（文件、系统或网络）。" },
    "permission.completed": { summary: "权限请求已处理：批准或拒绝。" },
    "hook.start": { summary: "生命周期钩子开始运行，例如在提交提示词时。" },
    "hook.end": {
      summary: "生命周期钩子结束，成功或失败。",
      sources: claudeSources([{ record: "subtype 为 stop_hook_summary 的 system 记录", note: "记录列出钩子错误时 success 为 false。" }]),
    },

    "system.message": {
      summary: "运行环境放在模型前面的指令：系统提示词、指令文件或注入的上下文。",
      detail: "它们随每次请求发送，因此大小会在会话中不断累积。工具栏上的开关会把它们与其他注入的上下文一起隐藏。",
      sources: {
        ...claudeSources([
          { record: "类型为 prompt_snapshot 的 attachment 记录", note: "系统提示词任何部分变化时，Claude Code 都会重新记录；应用只在提示词文本本身变化时显示。" },
          { record: "类型为 instructions 的 attachment 记录（CLAUDE.md 和 AGENTS.md 文件）" },
          { record: "任何其他 subtype 的 system 记录" },
        ]),
        codex: [
          { record: "session_meta 行上的 base_instructions" },
          { record: "role 为 developer 或 system 的 response_item 消息" },
          { record: "运行环境注入的 role 为 user 的 response_item 消息，显示为 role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "运行环境自行添加的上下文：文件快照、提醒、工具或技能列表、图片。",
      changes: ["各类附件都被展平为 {label, subject, items, content}，读起来是内容而不是原始 JSON。"],
      sources: {
        ...claudeSources([
          { record: "attachment 记录（date、file、skill_listing、deferred_tools_delta 等）" },
          { record: "prompt_snapshot 附件中的工具列表，变化时显示为工具定义" },
          { record: "user 记录中的 image 块", note: "只保留发送过图片这一事实，像素数据仍留在磁盘上。" },
        ]),
        codex: [{ record: "session_meta 行上的 dynamic_tools，显示为工具定义" }],
      },
    },
    "system.notification": { summary: "添加到对话中的运行环境通知，例如后台 shell 运行结束。" },

    "file.patch_applied": {
      summary: "代理应用到工作区的补丁，以及它改动的文件。",
      sources: { codex: [{ record: "类型为 patch_apply_end 的 event_msg 行" }] },
    },
    "web.search": {
      summary: "模型执行的网页搜索；结果会加入上下文。",
      sources: { codex: [{ record: "类型为 web_search_end 的 event_msg 行" }] },
    },

    "subagent.deselected": { summary: "子代理焦点已清除，控制权回到主代理。" },
    "subagent.activity": {
      summary: "在主代理之下工作的子代理报告的活动。",
      sources: { codex: [{ record: "类型为 sub_agent_activity 的 event_msg 行" }] },
    },
    "subagent.message": {
      summary: "代理之间传递的消息。",
      sources: { codex: [{ record: "inter_agent_communication_metadata 行" }] },
    },
    "subagent.session_start": {
      summary: "本会话中启动了一个子代理线程。",
      sources: { codex: [{ record: "第一行之后的 session_meta 行" }] },
    },
  },

  unknownSummary: "“{category}”类别（“{name}”）中尚无说明的事件。",
  unknownCategory: "未知",
  unknownName: "通用",
  unknownDetail:
    "代理写入了一条应用尚无映射的记录。它连同数据按原样保留，不会丢失任何内容，并通过通用卡片显示。",

  callAndResult: "一次调用及其结果，显示为一行。",
  recordsInOrder: "这一行读取自的记录，按记录文件顺序排列。",
  recordTitle: "{agent} 记录",
  eventFormat: "事件格式",
};
