import { claudeSources, type EventDocs } from "./en";

/** Traditional Chinese (Taiwan). Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "結果會簡化為 result.content 中的純文字。圖片只保留類型和大小，像素資料仍留在磁碟上。",
  "在精簡檢視中，呼叫和其結果顯示為一列，因此 Raw 和 Original 會顯示兩筆紀錄。",
];

const CLAUDE_TOOL_USE = "message.content 中含 tool_use 區塊的 assistant 紀錄";
const CLAUDE_TOOL_RESULT =
  "含 tool_result 區塊的 user 紀錄，透過 tool_use_id 與其呼叫對應";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code 會為串流回應的每個內容區塊各寫一筆紀錄，並在每筆紀錄中重複該回應的用量。用量只在回應的第一個事件上計算一次。";
const ARGUMENT_CHARS =
  "新增 argumentChars：引數按原樣寫出時的大小，也就是它們在脈絡中的成本。";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "紀錄種類：user、assistant、system、attachment、mode 等",
  subtype: "system 紀錄的種類：api_error、compact_boundary、turn_duration 等",
  uuid: "紀錄的 id。",
  parentUuid: "對話中這筆紀錄所接續的紀錄。",
  isSidechain: "由子代理程式而非主對話寫入。",
  timestamp: "寫入時間，ISO 8601。",
  sessionId: "紀錄所屬的工作階段；分支會在複製的紀錄上保留父工作階段的 id。",
  cwd: "工作目錄。",
  gitBranch: "當時的 Git 分支。",
  version: "寫入該紀錄的 Claude Code 版本。",
  entrypoint: "Claude Code 的執行位置：cli、claude-desktop 等",
  userType: "操作工作階段的主體。",
  requestId: "API 請求 id。",
  promptId: "紀錄所屬的提示。",
  effort: "請求的推理強度。",
  message: "按送出或接收原樣保存的 API 訊息。",
  "message.role": "user 或 assistant。",
  "message.model": "回答的模型；Claude Code 自己寫的訊息為 <synthetic>。",
  "message.id": "API 訊息 id；同一串流回應的所有紀錄共用。",
  "message.type": "一律為 message。",
  "message.content": "字串或內容區塊清單。",
  "message.content[].type": "區塊種類：text、thinking、tool_use、tool_result、image。",
  "message.content[].text": "text 區塊的文字。",
  "message.content[].thinking": "thinking 區塊的推理內容。",
  "message.content[].signature": "讓推理內容能回傳給 API 的簽章。",
  "message.content[].id": "tool_use 區塊的 id。",
  "message.content[].name": "tool_use 區塊呼叫的工具。",
  "message.content[].input": "tool_use 區塊的引數。",
  "message.content[].tool_use_id": "tool_result 區塊所回應的呼叫。",
  "message.content[].content": "工具傳回的內容。",
  "message.content[].is_error": "工具回報了失敗。",
  "message.stop_reason": "回應結束的原因：end_turn、tool_use、max_tokens 等",
  "message.usage": "整個回應的 token 用量，在其每筆紀錄中重複。",
  "message.usage.input_tokens": "既未從快取讀取、也未寫入快取的輸入 token。",
  "message.usage.output_tokens": "輸出 token。",
  "message.usage.cache_read_input_tokens": "從快取讀取的輸入 token。",
  "message.usage.cache_creation_input_tokens": "寫入快取的輸入 token。",
  "message.usage.cache_creation": "依存活時間拆分的快取寫入。",
  "message.usage.speed": "請求以快速模式執行時為 fast。",
  toolUseResult: "Claude Code 自己保存的結構化工具結果副本。",
  attachment: "Claude Code 注入的脈絡；其 type 說明種類。",
  "attachment.type": "附件種類：prompt_snapshot、instructions、file、date 等",
  content: "system 紀錄的文字。",
  level: "system 紀錄的嚴重程度。",
  error: "api_error 紀錄的錯誤詳細資料。",
};

export const zhTW: EventDocs = {
  providerFormats: {
    claude:
      "位於 ~/.claude/projects/<project>/<session>.jsonl 的 JSONL：每行一筆 JSON 紀錄，類型為 user、assistant、system、attachment 等。每筆紀錄都帶有寫入它的 Claude Code 版本。",
    cowork:
      "Claude Code CLI 在每個 Cowork 工作階段中執行，並寫入相同的 JSONL 紀錄，因此與 Claude Code 的讀取方式完全相同。",
    codex:
      "位於 ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl 的 JSONL：{timestamp, type, payload} 行，類型為 session_meta、event_msg、response_item、turn_context。只有 session_meta 註明 CLI 版本。",
    copilot:
      "位於 ~/.copilot/session-state/<id>/events.jsonl 的 JSONL，已按本應用程式使用的 category.subCategory 詞彙寫成 {type, data, id, timestamp, parentId}。session.start 註明格式版本和 CLI 版本。",
    vscode:
      "VS Code 工作區儲存空間中的聊天工作階段檔案（JSON，或附加變更的 JSONL），每個項目一組請求／回應。",
    gemini:
      "位於 ~/.gemini/tmp/<project>/chats 的工作階段檔案。每則訊息的類型為 user、gemini、info、warning 或 error；重新寫入的訊息會取代先前的版本。",
    opencode:
      "SQLite（opencode.db）：session、message 和 part 列，各自把內容保存在一個 JSON 欄位中。",
    cursor:
      "位於 ~/.cursor/projects 的 SQLite 儲存區，以 bubble 列保存對話：1 代表使用者，2 代表代理程式。",
    hermes: "位於 ~/.hermes 的 SQLite（state.db）：工作階段及其訊息以列保存。",
  },

  sharedChanges: [
    "類型會重新命名為統一的 category.subCategory 詞彙，讓所有代理程式的事件讀起來一致。",
    "長文字會在 20,000 個字元處截斷。charLength 保留完整長度，truncated 表示已截斷；原始紀錄不截斷。",
    "一筆紀錄可能變成多個事件（包含文字、推理和工具呼叫的回應），部分僅供內部記帳的紀錄會被略過。",
  ],

  fieldDocs: {
    content: "訊息文字，上限 20,000 個字元。",
    charLength: "截斷前文字的完整長度。",
    truncated: "顯示的文字被截短時為 true。",
    model: "產生此內容的模型，沿用代理程式給的名稱。",
    effort: "請求所用的推理強度。",
    requestId: "API 請求 id，用於與服務供應商的記錄對照。",
    role: "文字來源：system_prompt、instructions、developer、user_context 等",
    toolName: "模型呼叫的工具；MCP 工具為 mcp__server__tool。",
    toolCallId: "把呼叫與其結果關聯起來的 id。",
    arguments: "模型傳給工具的引數，已解析為 JSON。",
    argumentChars: "模型寫出的引數大小，也就是它們在脈絡中的成本。",
    result: "工具傳回的內容，簡化為 {content, format, images?, detail?}。",
    resultChars: "截斷前結果的完整長度。",
    success: "呼叫回報失敗時為 false。",
    inputTokens: "請求的輸入 token，包括寫入快取的部分。",
    outputTokens: "回應的輸出 token，包括推理。",
    cacheReadTokens: "由提示快取提供的輸入 token。",
    billedUsage: "依計價方式拆分的用量，用於估算費用。",
    costUSD: "依 API 牌價估算的本次請求費用。",
    inherited: "複製自分支來源工作階段；費用屬於那個工作階段。",
    durationMs: "耗時，單位為毫秒。",
    sessionId: "工作階段的 id。",
    context: "工作階段執行時的工作目錄、分支和存放庫。",
    attachmentType: "代理程式自己對這類脈絡的命名。",
    label: "附件種類的易讀名稱。",
    subject: "附件涉及的對象：檔案、日期、掛鉤……",
    items: "附件列出的名稱（工具、技能、代理程式），最多 200 個。",
    itemCount: "附件完整列出的名稱數量。",
    itemsLabel: "所列名稱是什麼。",
    message: "錯誤或通知文字。",
    reason: "發生的原因。",
    mode: "切換到的模式。",
    trigger: "觸發方式：manual 或 auto。",
    preTokens: "壓縮前的脈絡大小。",
    turnId: "回合的 id。",
    totalCostUSD: "代理程式自己回報的截至目前的工作階段費用。",
    apiDurationMs: "截至目前等待 API 的總時間。",
    premiumRequests: "截至目前計入的進階請求數。",
    sessionTotals: "代理程式回報的工作階段合計，用於工作階段摘要。",
    usage: "代理程式回報的用量合計。",
    selectedModel: "工作階段開始時選擇的模型。",
    copilotVersion: "寫入該工作階段的代理程式 CLI 版本。",
    cliVersion: "寫入該工作階段的代理程式 CLI 版本。",
    entrypoint: "工作階段的執行位置：cli、claude-desktop 等",
    forkedFrom: "本工作階段分支自的工作階段。",
  },

  pathDocs: {
    type: "事件類型，category.subCategory。",
    data: "代理程式記錄的內容，在值得的地方做了正規化。",
    id: "事件在工作階段內的唯一 id。",
    timestamp: "發生時間，ISO 8601。",
    parentId: "此事件所源自的事件（若代理程式有記錄）。",
    source: "原始紀錄的位置：在紀錄檔中的行號，或代理程式自己的 id。",
    category: "類型的第一部分，供篩選器使用。",
    subCategory: "類型的其餘部分，供篩選器使用。",
    subKey: "完整類型，供篩選器使用。",
    "data.result.content": "結果的純文字，有長度上限。JSON 結果會縮排。",
    "data.result.format": "text 或 json。",
    "data.result.images": "工具傳回的圖片：僅類型和大小。",
    "data.result.detail": "部分工具附加的第二種呈現，通常是 diff。",
    "data.context.cwd": "工作目錄。",
    "data.context.branch": "Git 分支。",
    "data.context.repository": "Git 存放庫。",
    "data.billedUsage.model": "用量計價所依據的模型。",
    "data.billedUsage.inputTokens": "既未從快取讀取、也未寫入快取的輸入 token。",
    "data.billedUsage.outputTokens": "輸出 token。",
    "data.billedUsage.cacheReadTokens": "從快取讀取的輸入 token。",
    "data.billedUsage.cacheWriteTokens": "寫入 5 分鐘快取的輸入 token。",
    "data.billedUsage.cacheWrite1hTokens": "寫入 1 小時快取的輸入 token。",
    "data.billedUsage.fast": "以快速模式執行，按較高費率計費。",
    "data.billedUsage.local": "在本機模型上執行，不產生費用。",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "該行的寫入時間，ISO 8601。",
      ordinal: "該行在 rollout 中的位置。",
      type: "行的種類：session_meta、event_msg、response_item、turn_context 等",
      payload: "該行的內容；它自己的 type 說明是什麼。",
      "payload.type": "payload 種類：user_message、agent_message、function_call、token_count 等",
      "payload.id": "工作階段（session_meta）或項目的 id。",
      "payload.cli_version": "Codex CLI 版本，僅出現在 session_meta 中。",
      "payload.originator": "執行 Codex 的應用程式。",
      "payload.cwd": "工作目錄。",
      "payload.role": "訊息的傳送方：user、assistant、developer、system。",
      "payload.content": "訊息的內容部分。",
      "payload.content[].type": "部分的種類：input_text、output_text 等",
      "payload.content[].text": "該部分的文字。",
      "payload.message": "event_msg 訊息的文字。",
      "payload.call_id": "把工具呼叫與其輸出關聯起來的 id。",
      "payload.name": "被呼叫的工具。",
      "payload.arguments": "工具引數，JSON 字串形式。",
      "payload.input": "自訂工具呼叫的輸入。",
      "payload.output": "工具傳回的內容。",
      "payload.status": "呼叫的狀態。",
      "payload.turn_id": "該行所屬的回合。",
      "payload.info": "token 用量：累計合計和最近一次請求的用量。",
    },
    copilot: {
      type: "事件類型，已是 category.subCategory 形式。",
      data: "事件資料。",
      id: "事件的 id。",
      timestamp: "發生時間，ISO 8601。",
      parentId: "此事件所源自的事件。",
      "data.version": "events.jsonl 格式的版本。",
      "data.copilotVersion": "Copilot CLI 版本。",
      "data.producer": "寫入該檔案的程式。",
      "data.toolCallId": "把呼叫與其結果關聯起來的 id。",
      "data.toolName": "被呼叫的工具。",
      "data.arguments": "工具引數。",
      "data.result": "工具傳回的內容：content，以及工具附加時的 detailedContent。",
      "data.error": "失敗呼叫失敗的原因。",
    },
  },

  events: {
    "session.start": {
      summary: "工作階段初始化。記錄工作階段開始時的執行環境和所選模型。",
      sources: {
        ...claudeSources([
          {
            record: "沒有紀錄：Claude Code 不寫開始紀錄",
            note: "應用程式根據紀錄中的 cwd、gitBranch、version 和 entrypoint 建立一筆，讓每個代理程式的時間軸都以相同的標頭開始。",
          },
        ]),
        codex: [{ record: "第一行 session_meta", note: "之後的 session_meta 行是子代理程式執行緒，會變成 subagent.session_start。" }],
        copilot: [{ record: "session.start，按原樣讀取" }],
      },
    },
    "session.resume": { summary: "工作階段從先前的狀態繼續。表示重新載入脈絡並接續進行。" },
    "session.shutdown": {
      summary: "工作階段結束摘要。通常包括用量、token 合計、進階請求和 API 耗時。",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "應用程式從中得出 sessionTotals 和 usageSummary。合計是累計值，所以只對最後一次 shutdown 計價，繼續的工作階段不會重複計算。",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "自動模式下的模型選擇結果。顯示預測的任務特徵和所選的模型設定。" },
    "session.binary_asset": { summary: "工作階段中擷取的二進位資料，通常是螢幕截圖。可能占用大量脈絡和儲存空間。" },
    "session.usage_checkpoint": {
      summary: "工作階段進行中的階段性用量統計。",
      sources: {
        ...claudeSources([{ record: "cost-state 紀錄", note: "totalCostUSD 和 totalAPIDuration 按回報值複製。" }]),
        codex: [
          {
            record: "類型為 token_count 的 event_msg 行",
            note: "Codex 回報的是累計合計，因此應用程式只對自上一個檢查點以來的增量計費，並把快取 token 從 input_tokens 中移出，讓每個 token 只計價一次。",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "只有進階請求／AIU 統計，沒有 token 合計；premiumRequests 複製自 totalPremiumRequests。" }],
      },
    },
    "session.model_change": {
      summary: "工作階段期間模型設定有所變更（模型、推理強度或脈絡層級）。",
      sources: { codex: [{ record: "類型為 thread_settings_applied 的 event_msg 行" }] },
    },
    "session.compaction_start": {
      summary: "脈絡壓縮開始。對話會被摘要，以減少每次請求送出的 token。",
      sources: claudeSources([{ record: "subtype 為 compact_boundary 的 system 紀錄", note: "trigger 和 preTokens 取自 compactMetadata。" }]),
    },
    "session.compaction_complete": { summary: "壓縮完成，附帶成功或失敗中繼資料和請求 id。" },
    "session.error": {
      summary: "API 或傳輸錯誤。每次重試都會重新送出完整的請求脈絡。",
      sources: {
        ...claudeSources([{ record: "subtype 為 api_error 的 system 紀錄" }]),
        gemini: [{ record: "類型為 error 的訊息" }],
      },
    },
    "session.turn_aborted": {
      summary: "該回合在完成前被中斷。",
      changes: ["每個代理程式標記中斷的方式不同，最後都統一為這一類型。"],
      sources: {
        ...claudeSources([
          {
            record: "文字以「[Request interrupted by user」開頭的 user 紀錄",
            note: "Claude Code 把中斷記錄得像使用者輸入的一樣；應用程式不會把它顯示為提示。",
          },
        ]),
        codex: [{ record: "類型為 turn_aborted 的 event_msg 行" }],
        copilot: [{ record: "abort 事件", note: "僅重新命名，資料按原樣保留。" }],
      },
    },
    "session.mode_change": {
      summary: "工作階段期間互動模式或權限模式有所切換。",
      sources: claudeSources([{ record: "mode 或 permission-mode 紀錄" }]),
    },
    "session.turn_context": {
      summary: "每回合的執行設定：模型、推理強度、沙箱和核准政策。",
      sources: { codex: [{ record: "turn_context 行" }] },
    },
    "session.world_state": {
      summary: "執行環境交給模型的工作區快照。",
      sources: { codex: [{ record: "world_state 行" }] },
    },
    "session.rollback": {
      summary: "對話被倒回了若干回合。",
      sources: { codex: [{ record: "類型為 thread_rolled_back 的 event_msg 行" }] },
    },
    "session.plan_changed": { summary: "代理程式建立或更新了工作計畫。" },
    "session.info": {
      summary: "代理程式輸出的通知：資訊或警告。",
      sources: { gemini: [{ record: "類型為 info 或 warning 的訊息" }] },
    },

    "user.message": {
      summary: "使用者輸入的內容。它驅動助理的下一回合。",
      sources: {
        ...claudeSources([
          {
            record: "user 紀錄：字串形式的 message.content，或其中的每個 text 區塊",
            note: "同一類紀錄也承載工具結果，這些會變成 tool.execution_complete。",
          },
        ]),
        codex: [
          { record: "類型為 user_message 的 event_msg 行" },
          {
            record: "role 為 user 的 response_item 訊息（僅舊版 rollout）",
            note: "新版 rollout 會把對話存兩份：event_msg（使用者看到的）和 response_item（模型看到的）。應用程式使用 event_msg 以免回合重複；response_item 副本會變成 system.message。",
          },
        ],
        copilot: [{ record: "user.message，按原樣讀取" }],
        gemini: [{ record: "類型為 user 的訊息" }],
      },
    },
    "assistant.message": {
      summary: "模型回覆的文字，附帶模型名稱和 token 用量。",
      fields: {
        phase: "Codex：訊息屬於該回合的哪個階段。",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content 中含 text 區塊的 assistant 紀錄",
            note: `${CLAUDE_ASSISTANT_NOTE}沒有文字、推理或工具呼叫的回應仍會變成一則空訊息，以便計入其用量。`,
          },
        ]),
        codex: [
          { record: "類型為 agent_message 的 event_msg 行" },
          { record: "role 為 assistant 的 response_item 訊息（僅當沒有 event_msg 副本時）" },
        ],
        copilot: [{ record: "assistant.message，按原樣讀取" }],
        gemini: [{ record: "類型為 gemini 的訊息內容" }],
      },
    },
    "assistant.thinking": {
      summary: "模型在回答前產生的推理。以輸出 token 計費。",
      sources: {
        ...claudeSources([{ record: "含 thinking 區塊的 assistant 紀錄", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "類型為 agent_reasoning 的 event_msg 行" },
          { record: "類型為 reasoning 的 response_item，使用其 summary", note: "只有加密推理的項目沒有可讀內容，會被略過。" },
        ],
        gemini: [{ record: "類型為 gemini 的訊息中 thoughts 的每一項" }],
      },
    },
    "assistant.turn_start": {
      summary: "助理一個回合的開始。",
      sources: { codex: [{ record: "類型為 task_started 的 event_msg 行" }] },
    },
    "assistant.turn_end": {
      summary: "助理完成推理、工具呼叫和輸出後的回合結束。",
      sources: {
        ...claudeSources([{ record: "subtype 為 turn_duration 的 system 紀錄" }]),
        codex: [{ record: "類型為 task_complete 的 event_msg 行" }],
      },
    },

    "tool.execution_start": {
      summary: "模型呼叫了內建工具，附帶名稱和引數。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `名為 mcp__… 的工具會改為 external_tool.requested。${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "類型為 function_call、custom_tool_call 或 local_shell_call 的 response_item",
            note: "以 JSON 字串寫出的引數會被解析為物件。",
          },
        ],
        copilot: [{ record: "tool.execution_start，按原樣讀取" }],
        gemini: [{ record: "類型為 gemini 的訊息中 toolCalls 的每一項" }],
      },
    },
    "tool.execution_complete": {
      summary: "內建工具呼叫結束，附帶狀態和結果。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "工具名稱取自對應的呼叫。區塊中沒有內容時，使用紀錄的 toolUseResult。設定了 is_error 時 success 為 false。",
          },
        ]),
        codex: [
          {
            record: "類型為 function_call_output、custom_tool_call_output 或 local_shell_call_output 的 response_item",
            note: "Codex 不記錄成功旗標；當輸出回報非零結束代碼時，應用程式把呼叫標記為失敗。",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content 成為結果文字，失敗呼叫由 error.message 代替，detailedContent（通常是 diff）成為 result.detail。",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "模型呼叫了由外部橋接（通常是 MCP 伺服器）提供的工具。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}，針對名為 mcp__… 的工具` }]),
        copilot: [{ record: "external_tool.requested，按原樣讀取" }],
      },
    },
    "external_tool.completed": {
      summary: "外部工具呼叫結束，附帶狀態和結果。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}，針對名為 mcp__… 的工具` }]),
        codex: [{ record: "類型為 mcp_tool_call_end 的 event_msg 行" }],
        copilot: [{ record: "external_tool.completed", note: "結構與 tool.execution_complete 相同。" }],
      },
    },

    "permission.requested": { summary: "執行環境請求使用者允許某個操作（檔案、系統或網路）。" },
    "permission.completed": { summary: "權限請求已處理：核准或拒絕。" },
    "hook.start": { summary: "生命週期掛鉤開始執行，例如在送出提示時。" },
    "hook.end": {
      summary: "生命週期掛鉤結束，成功或失敗。",
      sources: claudeSources([{ record: "subtype 為 stop_hook_summary 的 system 紀錄", note: "紀錄列出掛鉤錯誤時 success 為 false。" }]),
    },

    "system.message": {
      summary: "執行環境放在模型前面的指示：系統提示、指示檔案或注入的脈絡。",
      detail: "它們會隨每次請求送出，因此大小會在工作階段中不斷累積。工具列上的切換開關會把它們與其他注入的脈絡一起隱藏。",
      sources: {
        ...claudeSources([
          { record: "類型為 prompt_snapshot 的 attachment 紀錄", note: "系統提示任何部分變更時，Claude Code 都會重新記錄；應用程式只在提示文字本身變更時顯示。" },
          { record: "類型為 instructions 的 attachment 紀錄（CLAUDE.md 和 AGENTS.md 檔案）" },
          { record: "任何其他 subtype 的 system 紀錄" },
        ]),
        codex: [
          { record: "session_meta 行上的 base_instructions" },
          { record: "role 為 developer 或 system 的 response_item 訊息" },
          { record: "執行環境注入的 role 為 user 的 response_item 訊息，顯示為 role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "執行環境自行加入的脈絡：檔案快照、提醒、工具或技能清單、圖片。",
      changes: ["各類附件都會攤平為 {label, subject, items, content}，讀起來是內容而不是原始 JSON。"],
      sources: {
        ...claudeSources([
          { record: "attachment 紀錄（date、file、skill_listing、deferred_tools_delta 等）" },
          { record: "prompt_snapshot 附件中的工具清單，變更時顯示為工具定義" },
          { record: "user 紀錄中的 image 區塊", note: "只保留傳送過圖片這件事，像素資料仍留在磁碟上。" },
        ]),
        codex: [{ record: "session_meta 行上的 dynamic_tools，顯示為工具定義" }],
      },
    },
    "system.notification": { summary: "加入對話中的執行環境通知，例如背景 shell 執行完畢。" },

    "file.patch_applied": {
      summary: "代理程式套用到工作區的修補程式，以及它變更的檔案。",
      sources: { codex: [{ record: "類型為 patch_apply_end 的 event_msg 行" }] },
    },
    "web.search": {
      summary: "模型執行的網頁搜尋；結果會加入脈絡。",
      sources: { codex: [{ record: "類型為 web_search_end 的 event_msg 行" }] },
    },

    "subagent.deselected": { summary: "子代理程式焦點已清除，控制權回到主代理程式。" },
    "subagent.activity": {
      summary: "在主代理程式之下工作的子代理程式回報的活動。",
      sources: { codex: [{ record: "類型為 sub_agent_activity 的 event_msg 行" }] },
    },
    "subagent.message": {
      summary: "代理程式之間傳遞的訊息。",
      sources: { codex: [{ record: "inter_agent_communication_metadata 行" }] },
    },
    "subagent.session_start": {
      summary: "本工作階段中啟動了一個子代理程式執行緒。",
      sources: { codex: [{ record: "第一行之後的 session_meta 行" }] },
    },
  },

  unknownSummary: "「{category}」類別（「{name}」）中尚無說明的事件。",
  unknownCategory: "未知",
  unknownName: "一般",
  unknownDetail:
    "代理程式寫入了一筆應用程式尚無對應的紀錄。它連同資料按原樣保留，不會遺失任何內容，並透過通用卡片顯示。",

  callAndResult: "一次呼叫和其結果，顯示為一列。",
  recordsInOrder: "這一列讀取自的紀錄，依紀錄檔順序排列。",
  recordTitle: "{agent} 紀錄",
  eventFormat: "事件格式",
};
