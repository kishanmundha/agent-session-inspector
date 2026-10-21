import { claudeSources, type EventDocs } from "./en";

/** Vietnamese. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Kết quả được rút gọn thành văn bản thuần trong result.content. Hình ảnh chỉ giữ loại và kích thước; điểm ảnh vẫn nằm trên đĩa.",
  "Ở chế độ xem gọn, một lệnh gọi và kết quả của nó hiển thị thành một hàng, nên Raw và Original hiển thị hai bản ghi.",
];

const CLAUDE_TOOL_USE = "Một bản ghi assistant có khối tool_use trong message.content";
const CLAUDE_TOOL_RESULT =
  "Một bản ghi user có khối tool_result, được ghép với lệnh gọi của nó qua tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code ghi một bản ghi cho mỗi khối nội dung của phản hồi dạng stream và lặp lại mức sử dụng của phản hồi trong từng bản ghi. Mức sử dụng chỉ được tính một lần, ở sự kiện đầu tiên của phản hồi.";
const ARGUMENT_CHARS =
  "Thêm argumentChars: kích thước đối số như đã viết, tức chi phí của chúng trong ngữ cảnh.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Loại bản ghi: user, assistant, system, attachment, mode, …",
  subtype: "Loại bản ghi system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id của bản ghi.",
  parentUuid: "Bản ghi mà bản ghi này nối tiếp trong cuộc hội thoại.",
  isSidechain: "Do một tác tử con ghi, không phải cuộc hội thoại chính.",
  timestamp: "Thời điểm ghi, ISO 8601.",
  sessionId: "Phiên chứa bản ghi; bản fork giữ id của phiên cha trên các bản ghi được sao chép.",
  cwd: "Thư mục làm việc.",
  gitBranch: "Nhánh Git tại thời điểm đó.",
  version: "Phiên bản Claude Code đã ghi bản ghi.",
  entrypoint: "Nơi Claude Code chạy: cli, claude-desktop, …",
  userType: "Ai đang điều khiển phiên.",
  requestId: "Id yêu cầu API.",
  promptId: "Prompt chứa bản ghi.",
  effort: "Mức suy luận của yêu cầu.",
  message: "Thông điệp API, như đã gửi hoặc nhận.",
  "message.role": "user hoặc assistant.",
  "message.model": "Mô hình đã trả lời; <synthetic> cho các thông điệp do chính Claude Code viết.",
  "message.id": "Id thông điệp API; dùng chung cho mọi bản ghi của một phản hồi dạng stream.",
  "message.type": "Luôn là message.",
  "message.content": "Một chuỗi, hoặc một danh sách khối nội dung.",
  "message.content[].type": "Loại khối: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Văn bản của khối text.",
  "message.content[].thinking": "Suy luận của khối thinking.",
  "message.content[].signature": "Chữ ký cho phép gửi suy luận ngược lại API.",
  "message.content[].id": "Id của khối tool_use.",
  "message.content[].name": "Công cụ mà khối tool_use gọi.",
  "message.content[].input": "Đối số của khối tool_use.",
  "message.content[].tool_use_id": "Lệnh gọi mà khối tool_result trả lời.",
  "message.content[].content": "Những gì công cụ trả về.",
  "message.content[].is_error": "Công cụ báo lỗi.",
  "message.stop_reason": "Lý do phản hồi kết thúc: end_turn, tool_use, max_tokens, …",
  "message.usage": "Mức dùng token của toàn bộ phản hồi, lặp lại trên từng bản ghi của nó.",
  "message.usage.input_tokens": "Token đầu vào không đọc từ bộ nhớ đệm cũng không ghi vào đó.",
  "message.usage.output_tokens": "Token đầu ra.",
  "message.usage.cache_read_input_tokens": "Token đầu vào đọc từ bộ nhớ đệm.",
  "message.usage.cache_creation_input_tokens": "Token đầu vào ghi vào bộ nhớ đệm.",
  "message.usage.cache_creation": "Lượt ghi bộ nhớ đệm chia theo thời gian tồn tại.",
  "message.usage.speed": "fast khi yêu cầu chạy ở chế độ nhanh.",
  toolUseResult: "Bản sao có cấu trúc của chính Claude Code cho một kết quả công cụ.",
  attachment: "Ngữ cảnh do Claude Code chèn vào; type cho biết loại nào.",
  "attachment.type": "Loại tệp đính kèm: prompt_snapshot, instructions, file, date, …",
  content: "Văn bản của bản ghi system.",
  level: "Mức độ nghiêm trọng của bản ghi system.",
  error: "Chi tiết lỗi của bản ghi api_error.",
};

export const vi: EventDocs = {
  providerFormats: {
    claude:
      "JSONL trong ~/.claude/projects/<project>/<session>.jsonl: mỗi dòng một bản ghi JSON, loại user, assistant, system, attachment, v.v. Mỗi bản ghi mang phiên bản Claude Code đã ghi nó.",
    cowork:
      "CLI Claude Code chạy bên trong mỗi phiên Cowork và ghi cùng một bản ghi JSONL, nên được đọc y như Claude Code.",
    codex:
      "JSONL trong ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: các dòng {timestamp, type, payload} loại session_meta, event_msg, response_item, turn_context. Chỉ session_meta ghi phiên bản CLI.",
    copilot:
      "JSONL trong ~/.copilot/session-state/<id>/events.jsonl, đã được ghi dạng {type, data, id, timestamp, parentId} theo cùng bộ từ vựng category.subCategory mà ứng dụng này dùng. session.start ghi phiên bản định dạng và phiên bản CLI.",
    vscode:
      "Các tệp phiên chat (JSON, hoặc JSONL gồm các thay đổi được nối thêm) trong bộ nhớ workspace của VS Code, mỗi mục một cặp yêu cầu/phản hồi.",
    gemini:
      "Các tệp phiên trong ~/.gemini/tmp/<project>/chats. Mỗi thông điệp có loại user, gemini, info, warning hoặc error; thông điệp được ghi lại sẽ thay thế phiên bản trước.",
    opencode:
      "SQLite (opencode.db): các hàng session, message và part, mỗi hàng giữ nội dung trong một cột JSON.",
    cursor:
      "Các kho SQLite trong ~/.cursor/projects, lưu cuộc hội thoại dưới dạng hàng bubble: 1 cho người dùng, 2 cho tác tử.",
    hermes: "SQLite (state.db) trong ~/.hermes: các phiên và thông điệp của chúng dưới dạng hàng.",
  },

  sharedChanges: [
    "Loại được đổi tên theo bộ từ vựng chung category.subCategory, để sự kiện của mọi tác tử đọc giống nhau.",
    "Văn bản dài bị cắt ở 20.000 ký tự. charLength giữ độ dài đầy đủ và truncated cho biết đã bị cắt; bản ghi gốc không bị cắt.",
    "Một bản ghi có thể thành nhiều sự kiện (một phản hồi có văn bản, suy luận và lệnh gọi công cụ), và một số bản ghi nội bộ bị bỏ qua.",
  ],

  fieldDocs: {
    content: "Văn bản của thông điệp, giới hạn 20.000 ký tự.",
    charLength: "Độ dài đầy đủ của văn bản trước khi bị giới hạn.",
    truncated: "True khi văn bản hiển thị đã bị cắt.",
    model: "Mô hình tạo ra nội dung này, theo tên tác tử đặt.",
    effort: "Mức suy luận mà yêu cầu dùng.",
    requestId: "Id yêu cầu API, để đối chiếu với nhật ký của nhà cung cấp.",
    role: "Nguồn của văn bản: system_prompt, instructions, developer, user_context, …",
    toolName: "Công cụ mô hình đã gọi; mcp__server__tool cho công cụ MCP.",
    toolCallId: "Id nối một lệnh gọi với kết quả của nó.",
    arguments: "Đối số mô hình truyền cho công cụ, đã phân tích thành JSON.",
    argumentChars: "Kích thước đối số như mô hình đã viết, tức chi phí của chúng trong ngữ cảnh.",
    result: "Những gì công cụ trả về, rút gọn thành {content, format, images?, detail?}.",
    resultChars: "Độ dài đầy đủ của kết quả trước khi bị giới hạn.",
    success: "False khi lệnh gọi báo lỗi.",
    inputTokens: "Token đầu vào của yêu cầu, gồm cả token ghi vào bộ nhớ đệm.",
    outputTokens: "Token đầu ra của phản hồi, gồm cả suy luận.",
    cacheReadTokens: "Token đầu vào được phục vụ từ bộ nhớ đệm prompt.",
    billedUsage: "Mức sử dụng chia theo cách tính giá, dùng để ước tính chi phí.",
    costUSD: "Chi phí ước tính của yêu cầu này theo bảng giá API.",
    inherited: "Sao chép từ phiên mà phiên này được fork; chi phí thuộc về phiên đó.",
    durationMs: "Mất bao lâu, tính bằng mili giây.",
    sessionId: "Id của phiên.",
    context: "Thư mục làm việc, nhánh và kho mã mà phiên chạy trong đó.",
    attachmentType: "Tên riêng của tác tử cho loại ngữ cảnh này.",
    label: "Tên dễ đọc của loại tệp đính kèm.",
    subject: "Tệp đính kèm nói về gì: một tệp, một ngày, một hook…",
    items: "Các tên mà tệp đính kèm liệt kê (công cụ, skill, tác tử), tối đa 200.",
    itemCount: "Số tên mà tệp đính kèm liệt kê đầy đủ.",
    itemsLabel: "Các tên được liệt kê là gì.",
    message: "Nội dung lỗi hoặc thông báo.",
    reason: "Vì sao xảy ra.",
    mode: "Chế độ được chuyển sang.",
    trigger: "Điều gì kích hoạt: manual hoặc auto.",
    preTokens: "Kích thước ngữ cảnh trước khi nén.",
    turnId: "Id của lượt.",
    totalCostUSD: "Chi phí phiên đến nay do chính tác tử báo cáo.",
    apiDurationMs: "Tổng thời gian chờ API đến nay.",
    premiumRequests: "Số yêu cầu premium đã tính đến nay.",
    sessionTotals: "Tổng của phiên do tác tử báo cáo, dùng cho phần tóm tắt phiên.",
    usage: "Tổng mức sử dụng như tác tử báo cáo.",
    selectedModel: "Mô hình được chọn khi phiên bắt đầu.",
    copilotVersion: "Phiên bản CLI của tác tử đã ghi phiên.",
    cliVersion: "Phiên bản CLI của tác tử đã ghi phiên.",
    entrypoint: "Nơi phiên chạy: cli, claude-desktop, …",
    forkedFrom: "Phiên mà phiên này được fork từ đó.",
  },

  pathDocs: {
    type: "Loại sự kiện, category.subCategory.",
    data: "Những gì tác tử ghi lại, được chuẩn hóa khi đáng làm.",
    id: "Id duy nhất của sự kiện trong phiên.",
    timestamp: "Thời điểm xảy ra, ISO 8601.",
    parentId: "Sự kiện mà sự kiện này bắt nguồn, khi tác tử có ghi.",
    source: "Vị trí của bản ghi gốc: dòng của nó trong bản ghi, hoặc id riêng của tác tử.",
    category: "Phần đầu của loại, dùng cho bộ lọc.",
    subCategory: "Phần còn lại của loại, dùng cho bộ lọc.",
    subKey: "Loại đầy đủ, dùng cho bộ lọc.",
    "data.result.content": "Văn bản thuần của kết quả, có giới hạn. Kết quả JSON được thụt lề.",
    "data.result.format": "text hoặc json.",
    "data.result.images": "Hình ảnh công cụ trả về: chỉ loại và kích thước.",
    "data.result.detail": "Một cách hiển thị thứ hai mà một số công cụ thêm vào, thường là diff.",
    "data.context.cwd": "Thư mục làm việc.",
    "data.context.branch": "Nhánh Git.",
    "data.context.repository": "Kho Git.",
    "data.billedUsage.model": "Mô hình dùng để tính giá mức sử dụng.",
    "data.billedUsage.inputTokens": "Token đầu vào không đọc từ bộ nhớ đệm cũng không ghi vào đó.",
    "data.billedUsage.outputTokens": "Token đầu ra.",
    "data.billedUsage.cacheReadTokens": "Token đầu vào đọc từ bộ nhớ đệm.",
    "data.billedUsage.cacheWriteTokens": "Token đầu vào ghi vào bộ nhớ đệm 5 phút.",
    "data.billedUsage.cacheWrite1hTokens": "Token đầu vào ghi vào bộ nhớ đệm 1 giờ.",
    "data.billedUsage.fast": "Chạy ở chế độ nhanh, tính phí ở mức cao hơn.",
    "data.billedUsage.local": "Chạy trên mô hình cục bộ, không tính phí.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Thời điểm dòng được ghi, ISO 8601.",
      ordinal: "Vị trí của dòng trong rollout.",
      type: "Loại dòng: session_meta, event_msg, response_item, turn_context, …",
      payload: "Nội dung của dòng; type của chính nó cho biết đó là gì.",
      "payload.type": "Loại payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id của phiên (session_meta) hoặc của mục.",
      "payload.cli_version": "Phiên bản Codex CLI, chỉ có trong session_meta.",
      "payload.originator": "Ứng dụng đã chạy Codex.",
      "payload.cwd": "Thư mục làm việc.",
      "payload.role": "Thông điệp đến từ ai: user, assistant, developer, system.",
      "payload.content": "Các phần nội dung của thông điệp.",
      "payload.content[].type": "Loại phần: input_text, output_text, …",
      "payload.content[].text": "Văn bản của phần.",
      "payload.message": "Văn bản của thông điệp event_msg.",
      "payload.call_id": "Id nối một lệnh gọi công cụ với đầu ra của nó.",
      "payload.name": "Công cụ được gọi.",
      "payload.arguments": "Đối số công cụ, dạng chuỗi JSON.",
      "payload.input": "Đầu vào của lệnh gọi công cụ tùy chỉnh.",
      "payload.output": "Những gì công cụ trả về.",
      "payload.status": "Trạng thái của lệnh gọi.",
      "payload.turn_id": "Lượt chứa dòng này.",
      "payload.info": "Mức dùng token: tổng cộng dồn và của yêu cầu gần nhất.",
    },
    copilot: {
      type: "Loại sự kiện, đã ở dạng category.subCategory.",
      data: "Dữ liệu sự kiện.",
      id: "Id của sự kiện.",
      timestamp: "Thời điểm xảy ra, ISO 8601.",
      parentId: "Sự kiện mà sự kiện này bắt nguồn.",
      "data.version": "Phiên bản của định dạng events.jsonl.",
      "data.copilotVersion": "Phiên bản Copilot CLI.",
      "data.producer": "Thứ đã ghi tệp.",
      "data.toolCallId": "Id nối một lệnh gọi với kết quả của nó.",
      "data.toolName": "Công cụ được gọi.",
      "data.arguments": "Đối số công cụ.",
      "data.result": "Những gì công cụ trả về: content, và detailedContent khi công cụ thêm vào.",
      "data.error": "Vì sao lệnh gọi thất bại.",
    },
  },

  events: {
    "session.start": {
      summary: "Khởi tạo phiên. Ghi lại môi trường chạy và mô hình được chọn khi phiên bắt đầu.",
      sources: {
        ...claudeSources([
          {
            record: "Không có bản ghi: Claude Code không ghi bản ghi bắt đầu",
            note: "Ứng dụng dựng một bản từ cwd, gitBranch, version và entrypoint của các bản ghi, để dòng thời gian của mọi tác tử mở đầu bằng cùng một phần đầu.",
          },
        ]),
        codex: [{ record: "Dòng session_meta đầu tiên", note: "Các dòng session_meta sau đó là luồng của tác tử con và trở thành subagent.session_start." }],
        copilot: [{ record: "session.start, đọc nguyên văn" }],
      },
    },
    "session.resume": { summary: "Phiên được tiếp tục từ trạng thái trước. Cho biết ngữ cảnh được tải lại và tiếp diễn." },
    "session.shutdown": {
      summary: "Tóm tắt khi kết thúc phiên. Thường gồm mức sử dụng, tổng token, yêu cầu premium và thời gian API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Ứng dụng suy ra sessionTotals và usageSummary từ đây. Các tổng là cộng dồn, nên chỉ shutdown cuối cùng được tính giá và phiên được tiếp tục không bị tính hai lần.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Kết quả chọn mô hình ở chế độ tự động. Cho thấy hồ sơ tác vụ dự đoán và cấu hình mô hình đã chọn." },
    "session.binary_asset": { summary: "Dữ liệu nhị phân thu được trong phiên, thường là ảnh chụp màn hình. Có thể chiếm nhiều ngữ cảnh và dung lượng." },
    "session.usage_checkpoint": {
      summary: "Tính mức sử dụng tạm thời khi phiên đang hoạt động.",
      sources: {
        ...claudeSources([{ record: "Một bản ghi cost-state", note: "totalCostUSD và totalAPIDuration được sao chép như đã báo cáo." }]),
        codex: [
          {
            record: "Một dòng event_msg loại token_count",
            note: "Codex báo cáo tổng cộng dồn, nên ứng dụng chỉ tính phần tăng từ điểm kiểm tra trước, và tách token trong bộ nhớ đệm khỏi input_tokens để mỗi token chỉ tính giá một lần.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Chỉ tính premium/AIU, không có tổng token; premiumRequests được sao chép từ totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Cấu hình mô hình thay đổi trong phiên (mô hình, mức suy luận hoặc bậc ngữ cảnh).",
      sources: { codex: [{ record: "Một dòng event_msg loại thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Bắt đầu nén ngữ cảnh. Cuộc hội thoại được tóm tắt để giảm số token gửi trong mỗi yêu cầu.",
      sources: claudeSources([{ record: "Một bản ghi system có subtype compact_boundary", note: "trigger và preTokens lấy từ compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Nén hoàn tất, kèm siêu dữ liệu thành công hoặc thất bại và id yêu cầu." },
    "session.error": {
      summary: "Lỗi API hoặc truyền tải. Mỗi lần thử lại sẽ gửi lại toàn bộ ngữ cảnh yêu cầu.",
      sources: {
        ...claudeSources([{ record: "Một bản ghi system có subtype api_error" }]),
        gemini: [{ record: "Một thông điệp loại error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Lượt bị ngắt trước khi hoàn tất.",
      changes: ["Mỗi tác tử đánh dấu việc ngắt theo cách riêng; tất cả đều trở thành loại duy nhất này."],
      sources: {
        ...claudeSources([
          {
            record: "Một bản ghi user có văn bản bắt đầu bằng “[Request interrupted by user”",
            note: "Claude Code ghi việc ngắt như thể người dùng đã gõ nó; ứng dụng không hiển thị nó như một prompt.",
          },
        ]),
        codex: [{ record: "Một dòng event_msg loại turn_aborted" }],
        copilot: [{ record: "Một sự kiện abort", note: "Đổi tên; dữ liệu giữ nguyên như đã ghi." }],
      },
    },
    "session.mode_change": {
      summary: "Chế độ tương tác hoặc quyền thay đổi trong phiên.",
      sources: claudeSources([{ record: "Một bản ghi mode hoặc permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Cấu hình chạy theo từng lượt: mô hình, mức suy luận, sandbox và chính sách phê duyệt.",
      sources: { codex: [{ record: "Một dòng turn_context" }] },
    },
    "session.world_state": {
      summary: "Ảnh chụp workspace mà môi trường chạy giao cho mô hình.",
      sources: { codex: [{ record: "Một dòng world_state" }] },
    },
    "session.rollback": {
      summary: "Cuộc hội thoại bị lùi lại một số lượt.",
      sources: { codex: [{ record: "Một dòng event_msg loại thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Tác tử đã tạo hoặc cập nhật kế hoạch làm việc." },
    "session.info": {
      summary: "Một thông báo tác tử in ra: thông tin hoặc cảnh báo.",
      sources: { gemini: [{ record: "Một thông điệp loại info hoặc warning" }] },
    },

    "user.message": {
      summary: "Những gì người dùng đã gõ. Nó thúc đẩy lượt tiếp theo của trợ lý.",
      sources: {
        ...claudeSources([
          {
            record: "Một bản ghi user: message.content dạng chuỗi, hoặc từng khối text trong đó",
            note: "Cùng loại bản ghi này cũng mang kết quả công cụ, vốn trở thành tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Một dòng event_msg loại user_message" },
          {
            record: "Một thông điệp response_item có role user, chỉ trong các rollout cũ",
            note: "Các rollout mới chứa cuộc hội thoại hai lần, dưới dạng event_msg (những gì người dùng thấy) và response_item (những gì mô hình thấy). Ứng dụng dùng event_msg để các lượt không bị trùng; bản sao response_item trở thành system.message.",
          },
        ],
        copilot: [{ record: "user.message, đọc nguyên văn" }],
        gemini: [{ record: "Một thông điệp loại user" }],
      },
    },
    "assistant.message": {
      summary: "Văn bản mô hình trả lời, kèm tên mô hình và mức dùng token.",
      fields: {
        phase: "Codex: thông điệp thuộc phần nào của lượt.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Một bản ghi assistant có khối text trong message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Một phản hồi không có văn bản, suy luận hay lệnh gọi công cụ vẫn trở thành một thông điệp rỗng, để mức sử dụng của nó được tính.`,
          },
        ]),
        codex: [
          { record: "Một dòng event_msg loại agent_message" },
          { record: "Một thông điệp response_item có role assistant, chỉ khi không có bản sao event_msg" },
        ],
        copilot: [{ record: "assistant.message, đọc nguyên văn" }],
        gemini: [{ record: "Nội dung của một thông điệp loại gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Suy luận mô hình tạo ra trước khi trả lời. Tính phí như token đầu ra.",
      sources: {
        ...claudeSources([{ record: "Một bản ghi assistant có khối thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Một dòng event_msg loại agent_reasoning" },
          { record: "Một response_item loại reasoning, dùng summary của nó", note: "Suy luận chỉ có dạng mã hóa thì không có gì đọc được và bị bỏ qua." },
        ],
        gemini: [{ record: "Từng mục thoughts trên một thông điệp loại gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Bắt đầu một lượt của trợ lý.",
      sources: { codex: [{ record: "Một dòng event_msg loại task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Kết thúc lượt của trợ lý sau suy luận, lệnh gọi công cụ và đầu ra.",
      sources: {
        ...claudeSources([{ record: "Một bản ghi system có subtype turn_duration" }]),
        codex: [{ record: "Một dòng event_msg loại task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Mô hình gọi một công cụ tích hợp, kèm tên và đối số.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Công cụ tên mcp__… sẽ trở thành external_tool.requested thay vào đó. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "Một response_item loại function_call, custom_tool_call hoặc local_shell_call",
            note: "Đối số viết dưới dạng chuỗi JSON được phân tích thành đối tượng.",
          },
        ],
        copilot: [{ record: "tool.execution_start, đọc nguyên văn" }],
        gemini: [{ record: "Từng mục toolCalls trên một thông điệp loại gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Một lệnh gọi công cụ tích hợp đã xong, kèm trạng thái và kết quả.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Tên công cụ lấy từ lệnh gọi tương ứng. Khi khối không có nội dung, toolUseResult của bản ghi được dùng. success là false khi is_error được đặt.",
          },
        ]),
        codex: [
          {
            record: "Một response_item loại function_call_output, custom_tool_call_output hoặc local_shell_call_output",
            note: "Codex không ghi cờ thành công; ứng dụng đánh dấu lệnh gọi thất bại khi đầu ra báo mã thoát khác không.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content trở thành văn bản kết quả, error.message của lệnh gọi thất bại thay vào chỗ đó, và detailedContent (thường là diff) trở thành result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Mô hình gọi một công cụ do cầu nối bên ngoài cung cấp, thường là máy chủ MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, cho công cụ tên mcp__…` }]),
        copilot: [{ record: "external_tool.requested, đọc nguyên văn" }],
      },
    },
    "external_tool.completed": {
      summary: "Một lệnh gọi công cụ bên ngoài đã xong, kèm trạng thái và kết quả.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, cho công cụ tên mcp__…` }]),
        codex: [{ record: "Một dòng event_msg loại mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Có cùng dạng với tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Môi trường chạy xin phép người dùng cho một hành động (tệp, hệ thống hoặc mạng)." },
    "permission.completed": { summary: "Yêu cầu cấp quyền đã được giải quyết: chấp thuận hoặc từ chối." },
    "hook.start": { summary: "Một hook vòng đời bắt đầu, ví dụ khi gửi prompt." },
    "hook.end": {
      summary: "Một hook vòng đời kết thúc, thành công hoặc thất bại.",
      sources: claudeSources([{ record: "Một bản ghi system có subtype stop_hook_summary", note: "success là false khi bản ghi liệt kê lỗi hook." }]),
    },

    "system.message": {
      summary: "Chỉ dẫn mà môi trường chạy đặt trước mô hình: prompt hệ thống, tệp chỉ dẫn hoặc ngữ cảnh được chèn.",
      detail: "Chúng được gửi kèm mọi yêu cầu, nên kích thước cộng dồn qua cả phiên. Nút gạt trên thanh công cụ ẩn chúng cùng với các ngữ cảnh được chèn khác.",
      sources: {
        ...claudeSources([
          { record: "Một bản ghi attachment loại prompt_snapshot", note: "Claude Code ghi lại prompt hệ thống mỗi khi bất kỳ phần nào thay đổi; ứng dụng chỉ hiển thị khi chính văn bản prompt thay đổi." },
          { record: "Một bản ghi attachment loại instructions (tệp CLAUDE.md và AGENTS.md)" },
          { record: "Một bản ghi system có subtype bất kỳ khác" },
        ]),
        codex: [
          { record: "base_instructions trên dòng session_meta" },
          { record: "Một thông điệp response_item có role developer hoặc system" },
          { record: "Một thông điệp response_item có role user do môi trường chạy chèn vào, hiển thị với role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Ngữ cảnh môi trường chạy tự thêm vào: ảnh chụp tệp, lời nhắc, danh sách công cụ hoặc skill, hình ảnh.",
      changes: ["Mọi loại tệp đính kèm được làm phẳng thành {label, subject, items, content}, để đọc như nội dung thay vì JSON thô."],
      sources: {
        ...claudeSources([
          { record: "Một bản ghi attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Danh sách công cụ của tệp đính kèm prompt_snapshot, hiển thị như định nghĩa công cụ khi thay đổi" },
          { record: "Một khối image trong bản ghi user", note: "Chỉ giữ việc một hình ảnh đã được gửi; điểm ảnh vẫn nằm trên đĩa." },
        ]),
        codex: [{ record: "dynamic_tools trên dòng session_meta, hiển thị như định nghĩa công cụ" }],
      },
    },
    "system.notification": { summary: "Một thông báo của môi trường chạy được thêm vào cuộc hội thoại, chẳng hạn một shell nền chạy xong." },

    "file.patch_applied": {
      summary: "Một bản vá tác tử áp dụng vào workspace, kèm các tệp bị ảnh hưởng.",
      sources: { codex: [{ record: "Một dòng event_msg loại patch_apply_end" }] },
    },
    "web.search": {
      summary: "Một lượt tìm kiếm web mô hình đã chạy; kết quả được thêm vào ngữ cảnh.",
      sources: { codex: [{ record: "Một dòng event_msg loại web_search_end" }] },
    },

    "subagent.deselected": { summary: "Tiêu điểm tác tử con đã bị xóa và quyền điều khiển quay về tác tử chính." },
    "subagent.activity": {
      summary: "Hoạt động do một tác tử con làm việc dưới tác tử chính báo cáo.",
      sources: { codex: [{ record: "Một dòng event_msg loại sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Một thông điệp truyền giữa các tác tử.",
      sources: { codex: [{ record: "Một dòng inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "Một luồng tác tử con đã bắt đầu trong phiên này.",
      sources: { codex: [{ record: "Một dòng session_meta sau dòng đầu tiên" }] },
    },
  },

  unknownSummary: "Một sự kiện thuộc nhóm “{category}” (“{name}”) chưa có mô tả.",
  unknownCategory: "không rõ",
  unknownName: "chung",
  unknownDetail:
    "Tác tử đã ghi một bản ghi mà ứng dụng chưa có ánh xạ. Bản ghi được giữ cùng dữ liệu nguyên văn, nên không mất gì, và hiển thị qua thẻ chung.",

  callAndResult: "Một lệnh gọi và kết quả của nó, hiển thị thành một hàng.",
  recordsInOrder: "Các bản ghi mà hàng này được đọc từ, theo thứ tự bản ghi phiên.",
  recordTitle: "Bản ghi {agent}",
  eventFormat: "Định dạng sự kiện",
};
