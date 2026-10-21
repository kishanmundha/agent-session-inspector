import { claudeSources, type EventDocs } from "./en";

/** Korean. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "결과는 result.content의 일반 텍스트로 줄입니다. 이미지는 형식과 크기만 남기고, 픽셀은 디스크에 그대로 둡니다.",
  "간결 보기에서는 호출과 그 결과를 한 행으로 보여 주므로 Raw와 Original에는 레코드 두 개가 나옵니다.",
];

const CLAUDE_TOOL_USE = "message.content에 tool_use 블록이 있는 assistant 레코드";
const CLAUDE_TOOL_RESULT =
  "tool_result 블록이 있는 user 레코드로, tool_use_id로 해당 호출과 연결됩니다";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code는 스트리밍 응답의 콘텐츠 블록마다 레코드를 하나씩 쓰고, 응답의 사용량을 각 레코드에 반복해서 기록합니다. 사용량은 응답의 첫 이벤트에서 한 번만 셉니다.";
const ARGUMENT_CHARS =
  "argumentChars를 추가합니다. 작성된 그대로의 인수 크기로, 컨텍스트에서 차지하는 비용입니다.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "레코드 종류: user, assistant, system, attachment, mode 등",
  subtype: "system 레코드의 종류: api_error, compact_boundary, turn_duration 등",
  uuid: "레코드 ID.",
  parentUuid: "대화에서 이 레코드 바로 앞의 레코드.",
  isSidechain: "메인 대화가 아니라 서브에이전트가 작성함.",
  timestamp: "작성된 시각, ISO 8601.",
  sessionId: "레코드가 속한 세션. 포크는 복사된 레코드에 부모의 ID를 유지합니다.",
  cwd: "작업 디렉터리.",
  gitBranch: "당시의 Git 브랜치.",
  version: "레코드를 작성한 Claude Code 버전.",
  entrypoint: "Claude Code가 실행된 곳: cli, claude-desktop 등",
  userType: "세션을 조작하는 주체.",
  requestId: "API 요청 ID.",
  promptId: "레코드가 속한 프롬프트.",
  effort: "요청의 추론 수준.",
  message: "보내거나 받은 그대로의 API 메시지.",
  "message.role": "user 또는 assistant.",
  "message.model": "응답한 모델. Claude Code가 직접 쓴 메시지는 <synthetic>.",
  "message.id": "API 메시지 ID. 하나의 스트리밍 응답에 속한 모든 레코드가 공유합니다.",
  "message.type": "항상 message.",
  "message.content": "문자열 또는 콘텐츠 블록 목록.",
  "message.content[].type": "블록 종류: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "text 블록의 텍스트.",
  "message.content[].thinking": "thinking 블록의 추론.",
  "message.content[].signature": "추론을 API로 다시 보낼 수 있게 하는 서명.",
  "message.content[].id": "tool_use 블록의 ID.",
  "message.content[].name": "tool_use 블록이 호출하는 도구.",
  "message.content[].input": "tool_use 블록의 인수.",
  "message.content[].tool_use_id": "tool_result 블록이 응답하는 호출.",
  "message.content[].content": "도구가 반환한 내용.",
  "message.content[].is_error": "도구가 실패를 보고함.",
  "message.stop_reason": "응답이 끝난 이유: end_turn, tool_use, max_tokens 등",
  "message.usage": "응답 전체의 토큰 사용량으로, 각 레코드에 반복됩니다.",
  "message.usage.input_tokens": "캐시에서 읽지도, 캐시에 쓰지도 않은 입력 토큰.",
  "message.usage.output_tokens": "출력 토큰.",
  "message.usage.cache_read_input_tokens": "캐시에서 읽은 입력 토큰.",
  "message.usage.cache_creation_input_tokens": "캐시에 쓴 입력 토큰.",
  "message.usage.cache_creation": "유지 시간별로 나눈 캐시 쓰기.",
  "message.usage.speed": "빠른 모드로 실행된 요청이면 fast.",
  toolUseResult: "Claude Code 자체의 구조화된 도구 결과 사본.",
  attachment: "Claude Code가 삽입한 컨텍스트. type으로 종류를 알 수 있습니다.",
  "attachment.type": "첨부 종류: prompt_snapshot, instructions, file, date 등",
  content: "system 레코드의 텍스트.",
  level: "system 레코드의 심각도.",
  error: "api_error 레코드의 오류 세부 정보.",
};

export const ko: EventDocs = {
  providerFormats: {
    claude:
      "~/.claude/projects/<project>/<session>.jsonl의 JSONL. 한 줄에 JSON 레코드 하나이며, 종류는 user, assistant, system, attachment 등입니다. 모든 레코드에 이를 작성한 Claude Code 버전이 들어 있습니다.",
    cowork:
      "Claude Code CLI가 각 Cowork 세션 안에서 실행되며 같은 JSONL 트랜스크립트를 쓰므로, Claude Code와 똑같이 읽습니다.",
    codex:
      "~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl의 JSONL. {timestamp, type, payload} 줄이며 종류는 session_meta, event_msg, response_item, turn_context입니다. CLI 버전은 session_meta에만 있습니다.",
    copilot:
      "~/.copilot/session-state/<id>/events.jsonl의 JSONL. 이 앱과 같은 category.subCategory 용어로 이미 {type, data, id, timestamp, parentId} 형태로 쓰여 있습니다. session.start에 형식 버전과 CLI 버전이 있습니다.",
    vscode:
      "VS Code 워크스페이스 저장소의 채팅 세션 파일(JSON 또는 추가된 변경의 JSONL). 항목마다 요청/응답 한 쌍입니다.",
    gemini:
      "~/.gemini/tmp/<project>/chats의 세션 파일. 각 메시지의 종류는 user, gemini, info, warning, error 중 하나이며, 다시 쓰인 메시지는 이전 버전을 대체합니다.",
    opencode:
      "SQLite(opencode.db). session, message, part 행이며 각 행은 내용을 JSON 열에 보관합니다.",
    cursor:
      "~/.cursor/projects의 SQLite 저장소. 대화를 bubble 행으로 보관하며 1은 사용자, 2는 에이전트입니다.",
    hermes: "~/.hermes의 SQLite(state.db). 세션과 그 메시지를 행으로 보관합니다.",
  },

  sharedChanges: [
    "종류 이름을 공통 category.subCategory 용어로 바꿔, 모든 에이전트의 이벤트를 같은 방식으로 읽을 수 있게 합니다.",
    "긴 텍스트는 20,000자에서 자릅니다. charLength에 전체 길이를, truncated에 잘렸다는 사실을 남기며, 원본 레코드는 자르지 않습니다.",
    "레코드 하나가 여러 이벤트가 될 수 있고(텍스트, 추론, 도구 호출이 있는 응답 등), 관리용 레코드는 건너뜁니다.",
  ],

  fieldDocs: {
    content: "메시지 텍스트. 최대 20,000자.",
    charLength: "잘리기 전 텍스트의 전체 길이.",
    truncated: "표시된 텍스트가 잘렸으면 true.",
    model: "이를 생성한 모델. 에이전트가 부른 이름 그대로.",
    effort: "요청에 쓰인 추론 수준.",
    requestId: "공급자 로그와 대조하기 위한 API 요청 ID.",
    role: "텍스트의 출처: system_prompt, instructions, developer, user_context 등",
    toolName: "모델이 호출한 도구. MCP 도구는 mcp__server__tool.",
    toolCallId: "호출과 그 결과를 잇는 ID.",
    arguments: "모델이 도구에 넘긴 인수를 JSON으로 파싱한 것.",
    argumentChars: "모델이 작성한 그대로의 인수 크기로, 컨텍스트에서 차지하는 비용입니다.",
    result: "도구가 반환한 내용을 {content, format, images?, detail?}로 줄인 것.",
    resultChars: "잘리기 전 결과의 전체 길이.",
    success: "호출이 실패를 보고하면 false.",
    inputTokens: "요청의 입력 토큰. 캐시에 쓴 토큰을 포함합니다.",
    outputTokens: "응답의 출력 토큰. 추론을 포함합니다.",
    cacheReadTokens: "프롬프트 캐시에서 제공된 입력 토큰.",
    billedUsage: "요금 책정 방식대로 나눈 사용량으로, 비용 추정에 쓰입니다.",
    costUSD: "API 정가로 추정한 이 요청의 비용.",
    inherited: "이 세션의 포크 원본에서 복사된 것으로, 비용은 원본에 속합니다.",
    durationMs: "걸린 시간(밀리초).",
    sessionId: "세션 ID.",
    context: "세션이 실행된 작업 디렉터리, 브랜치, 저장소.",
    attachmentType: "이 종류의 컨텍스트에 대한 에이전트 자체의 이름.",
    label: "첨부 종류의 읽기 쉬운 이름.",
    subject: "첨부의 대상: 파일, 날짜, 훅 등",
    items: "첨부에 나열된 이름(도구, 스킬, 에이전트). 최대 200개.",
    itemCount: "첨부가 전부 나열한 이름의 개수.",
    itemsLabel: "나열된 이름이 무엇인지.",
    message: "오류 또는 알림 텍스트.",
    reason: "발생한 이유.",
    mode: "전환된 모드.",
    trigger: "시작한 원인: manual 또는 auto.",
    preTokens: "압축 전 컨텍스트 크기.",
    turnId: "턴 ID.",
    totalCostUSD: "에이전트가 직접 보고한 지금까지의 세션 비용.",
    apiDurationMs: "지금까지 API를 기다린 총 시간.",
    premiumRequests: "지금까지 집계된 프리미엄 요청.",
    sessionTotals: "에이전트가 보고한 세션 합계로, 세션 요약에 쓰입니다.",
    usage: "에이전트가 보고한 사용량 합계.",
    selectedModel: "세션 시작 시 선택된 모델.",
    copilotVersion: "세션을 작성한 에이전트 CLI 버전.",
    cliVersion: "세션을 작성한 에이전트 CLI 버전.",
    entrypoint: "세션이 실행된 곳: cli, claude-desktop 등",
    forkedFrom: "이 세션의 포크 원본 세션.",
  },

  pathDocs: {
    type: "이벤트 종류, category.subCategory.",
    data: "에이전트가 기록한 내용으로, 필요한 곳은 정규화했습니다.",
    id: "세션 안에서 고유한 이벤트 ID.",
    timestamp: "발생 시각, ISO 8601.",
    parentId: "이 이벤트의 바탕이 된 이벤트(에이전트가 기록한 경우).",
    source: "원본 레코드의 위치: 트랜스크립트의 줄 또는 에이전트 자체의 ID.",
    category: "종류의 첫 부분으로, 필터에 쓰입니다.",
    subCategory: "종류의 나머지 부분으로, 필터에 쓰입니다.",
    subKey: "전체 종류로, 필터에 쓰입니다.",
    "data.result.content": "결과의 일반 텍스트(길이 제한). JSON 결과는 들여쓰기합니다.",
    "data.result.format": "text 또는 json.",
    "data.result.images": "도구가 반환한 이미지: 형식과 크기만.",
    "data.result.detail": "일부 도구가 추가하는 두 번째 표현으로, 보통 diff입니다.",
    "data.context.cwd": "작업 디렉터리.",
    "data.context.branch": "Git 브랜치.",
    "data.context.repository": "Git 저장소.",
    "data.billedUsage.model": "사용량 요금을 계산하는 기준 모델.",
    "data.billedUsage.inputTokens": "캐시에서 읽지도, 캐시에 쓰지도 않은 입력 토큰.",
    "data.billedUsage.outputTokens": "출력 토큰.",
    "data.billedUsage.cacheReadTokens": "캐시에서 읽은 입력 토큰.",
    "data.billedUsage.cacheWriteTokens": "5분 캐시에 쓴 입력 토큰.",
    "data.billedUsage.cacheWrite1hTokens": "1시간 캐시에 쓴 입력 토큰.",
    "data.billedUsage.fast": "빠른 모드로 실행되어 더 높은 요금이 부과됨.",
    "data.billedUsage.local": "요금이 없는 로컬 모델에서 실행됨.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "줄이 작성된 시각, ISO 8601.",
      ordinal: "롤아웃에서 줄의 위치.",
      type: "줄 종류: session_meta, event_msg, response_item, turn_context 등",
      payload: "줄의 내용. 자체 type으로 무엇인지 알 수 있습니다.",
      "payload.type": "payload 종류: user_message, agent_message, function_call, token_count 등",
      "payload.id": "세션(session_meta) 또는 항목의 ID.",
      "payload.cli_version": "Codex CLI 버전. session_meta에만 있습니다.",
      "payload.originator": "Codex를 실행한 앱.",
      "payload.cwd": "작업 디렉터리.",
      "payload.role": "메시지를 보낸 쪽: user, assistant, developer, system.",
      "payload.content": "메시지의 콘텐츠 부분.",
      "payload.content[].type": "부분 종류: input_text, output_text 등",
      "payload.content[].text": "부분의 텍스트.",
      "payload.message": "event_msg 메시지의 텍스트.",
      "payload.call_id": "도구 호출과 그 출력을 잇는 ID.",
      "payload.name": "호출된 도구.",
      "payload.arguments": "도구 인수(JSON 문자열).",
      "payload.input": "사용자 정의 도구 호출의 입력.",
      "payload.output": "도구가 반환한 내용.",
      "payload.status": "호출 상태.",
      "payload.turn_id": "줄이 속한 턴.",
      "payload.info": "토큰 사용량: 누적 합계와 마지막 요청의 값.",
    },
    copilot: {
      type: "이벤트 종류. 이미 category.subCategory 형태입니다.",
      data: "이벤트 데이터.",
      id: "이벤트 ID.",
      timestamp: "발생 시각, ISO 8601.",
      parentId: "이 이벤트의 바탕이 된 이벤트.",
      "data.version": "events.jsonl 형식의 버전.",
      "data.copilotVersion": "Copilot CLI 버전.",
      "data.producer": "파일을 작성한 주체.",
      "data.toolCallId": "호출과 그 결과를 잇는 ID.",
      "data.toolName": "호출된 도구.",
      "data.arguments": "도구 인수.",
      "data.result": "도구가 반환한 내용: content와, 도구가 추가한 경우 detailedContent.",
      "data.error": "실패한 호출이 실패한 이유.",
    },
  },

  events: {
    "session.start": {
      summary: "세션 초기화. 세션이 시작될 때의 실행 환경과 선택된 모델을 기록합니다.",
      sources: {
        ...claudeSources([
          {
            record: "레코드 없음: Claude Code는 시작 레코드를 쓰지 않습니다",
            note: "앱이 트랜스크립트 레코드의 cwd, gitBranch, version, entrypoint로 만들어, 모든 에이전트의 타임라인이 같은 머리글로 시작하게 합니다.",
          },
        ]),
        codex: [{ record: "첫 번째 session_meta 줄", note: "이후의 session_meta 줄은 서브에이전트 스레드이며 subagent.session_start가 됩니다." }],
        copilot: [{ record: "session.start, 작성된 그대로 읽음" }],
      },
    },
    "session.resume": { summary: "이전 상태에서 세션을 재개했습니다. 컨텍스트 다시 불러오기와 이어서 진행함을 나타냅니다." },
    "session.shutdown": {
      summary: "세션 종료 요약. 보통 사용량, 토큰 합계, 프리미엄 요청, API 시간을 포함합니다.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "앱은 여기서 sessionTotals와 usageSummary를 도출합니다. 합계는 누적값이므로 마지막 shutdown만 비용을 계산하고, 재개한 세션을 두 번 세지 않습니다.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "자동 모드의 모델 선택 결과. 예측한 작업 유형과 선택된 모델 설정을 보여 줍니다." },
    "session.binary_asset": { summary: "세션에 캡처된 바이너리 데이터로, 보통 스크린샷입니다. 컨텍스트와 저장 공간을 많이 차지할 수 있습니다." },
    "session.usage_checkpoint": {
      summary: "세션이 진행되는 동안의 중간 사용량 집계.",
      sources: {
        ...claudeSources([{ record: "cost-state 레코드", note: "totalCostUSD와 totalAPIDuration은 보고된 그대로 복사합니다." }]),
        codex: [
          {
            record: "token_count 종류의 event_msg 줄",
            note: "Codex는 누적 합계를 보고하므로 앱은 이전 체크포인트 이후의 차이만 청구하고, 캐시된 토큰을 input_tokens에서 빼서 각각 한 번만 비용을 계산합니다.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "프리미엄/AIU 집계만 있고 토큰 합계는 없습니다. premiumRequests는 totalPremiumRequests에서 복사합니다." }],
      },
    },
    "session.model_change": {
      summary: "세션 중에 모델 구성(모델, 추론 수준, 컨텍스트 등급)이 바뀌었습니다.",
      sources: { codex: [{ record: "thread_settings_applied 종류의 event_msg 줄" }] },
    },
    "session.compaction_start": {
      summary: "컨텍스트 압축을 시작했습니다. 요청마다 보내는 토큰을 줄이기 위해 대화를 요약합니다.",
      sources: claudeSources([{ record: "subtype이 compact_boundary인 system 레코드", note: "trigger와 preTokens는 compactMetadata에서 가져옵니다." }]),
    },
    "session.compaction_complete": { summary: "압축이 끝났습니다. 성공 또는 실패 메타데이터와 요청 ID를 포함합니다." },
    "session.error": {
      summary: "API 또는 전송 오류. 재시도할 때마다 요청 컨텍스트 전체를 다시 보냅니다.",
      sources: {
        ...claudeSources([{ record: "subtype이 api_error인 system 레코드" }]),
        gemini: [{ record: "error 종류의 메시지" }],
      },
    },
    "session.turn_aborted": {
      summary: "턴이 완료되기 전에 중단되었습니다.",
      changes: ["에이전트마다 중단을 다르게 표시하지만, 모두 이 한 가지 종류가 됩니다."],
      sources: {
        ...claudeSources([
          {
            record: "텍스트가 “[Request interrupted by user”로 시작하는 user 레코드",
            note: "Claude Code는 중단을 사용자가 입력한 것처럼 기록합니다. 앱은 이를 프롬프트로 표시하지 않습니다.",
          },
        ]),
        codex: [{ record: "turn_aborted 종류의 event_msg 줄" }],
        copilot: [{ record: "abort 이벤트", note: "이름만 바꾸고 데이터는 작성된 그대로 둡니다." }],
      },
    },
    "session.mode_change": {
      summary: "세션 중에 상호작용 모드나 권한 모드가 바뀌었습니다.",
      sources: claudeSources([{ record: "mode 또는 permission-mode 레코드" }]),
    },
    "session.turn_context": {
      summary: "턴별 실행 구성: 모델, 추론 수준, 샌드박스, 승인 정책.",
      sources: { codex: [{ record: "turn_context 줄" }] },
    },
    "session.world_state": {
      summary: "실행 환경이 모델에 넘긴 워크스페이스 스냅숏.",
      sources: { codex: [{ record: "world_state 줄" }] },
    },
    "session.rollback": {
      summary: "대화가 몇 턴 되돌려졌습니다.",
      sources: { codex: [{ record: "thread_rolled_back 종류의 event_msg 줄" }] },
    },
    "session.plan_changed": { summary: "에이전트가 작업 계획을 만들거나 업데이트했습니다." },
    "session.info": {
      summary: "에이전트가 출력한 알림: 정보 또는 경고.",
      sources: { gemini: [{ record: "info 또는 warning 종류의 메시지" }] },
    },

    "user.message": {
      summary: "사용자가 입력한 내용. 어시스턴트의 다음 턴을 이끕니다.",
      sources: {
        ...claudeSources([
          {
            record: "user 레코드: 문자열인 message.content 또는 그 안의 각 text 블록",
            note: "같은 종류의 레코드가 도구 결과도 담으며, 이는 tool.execution_complete가 됩니다.",
          },
        ]),
        codex: [
          { record: "user_message 종류의 event_msg 줄" },
          {
            record: "role이 user인 response_item 메시지(이전 롤아웃에만 해당)",
            note: "최신 롤아웃은 대화를 event_msg(사용자가 본 것)와 response_item(모델이 본 것)으로 두 번 담습니다. 앱은 턴이 중복되지 않도록 event_msg를 쓰고, response_item 사본은 system.message가 됩니다.",
          },
        ],
        copilot: [{ record: "user.message, 작성된 그대로 읽음" }],
        gemini: [{ record: "user 종류의 메시지" }],
      },
    },
    "assistant.message": {
      summary: "모델이 답한 텍스트. 모델 이름과 토큰 사용량을 포함합니다.",
      fields: {
        phase: "Codex: 메시지가 턴의 어느 부분에 속하는지.",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content에 text 블록이 있는 assistant 레코드",
            note: `${CLAUDE_ASSISTANT_NOTE} 텍스트, 추론, 도구 호출이 없는 응답도 사용량을 세기 위해 빈 메시지가 됩니다.`,
          },
        ]),
        codex: [
          { record: "agent_message 종류의 event_msg 줄" },
          { record: "role이 assistant인 response_item 메시지(event_msg 사본이 없을 때만)" },
        ],
        copilot: [{ record: "assistant.message, 작성된 그대로 읽음" }],
        gemini: [{ record: "gemini 종류 메시지의 내용" }],
      },
    },
    "assistant.thinking": {
      summary: "모델이 답하기 전에 만든 추론. 출력 토큰으로 청구됩니다.",
      sources: {
        ...claudeSources([{ record: "thinking 블록이 있는 assistant 레코드", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "agent_reasoning 종류의 event_msg 줄" },
          { record: "reasoning 종류의 response_item(summary 사용)", note: "암호화된 추론만 있으면 읽을 내용이 없어 건너뜁니다." },
        ],
        gemini: [{ record: "gemini 종류 메시지의 thoughts 각 항목" }],
      },
    },
    "assistant.turn_start": {
      summary: "어시스턴트 턴 하나의 시작.",
      sources: { codex: [{ record: "task_started 종류의 event_msg 줄" }] },
    },
    "assistant.turn_end": {
      summary: "추론, 도구 호출, 출력을 마친 어시스턴트 턴의 끝.",
      sources: {
        ...claudeSources([{ record: "subtype이 turn_duration인 system 레코드" }]),
        codex: [{ record: "task_complete 종류의 event_msg 줄" }],
      },
    },

    "tool.execution_start": {
      summary: "모델이 기본 제공 도구를 이름과 인수와 함께 호출했습니다.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `mcp__…라는 이름의 도구는 대신 external_tool.requested가 됩니다. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "function_call, custom_tool_call, local_shell_call 종류의 response_item",
            note: "JSON 문자열로 작성된 인수는 객체로 파싱합니다.",
          },
        ],
        copilot: [{ record: "tool.execution_start, 작성된 그대로 읽음" }],
        gemini: [{ record: "gemini 종류 메시지의 toolCalls 각 항목" }],
      },
    },
    "tool.execution_complete": {
      summary: "기본 제공 도구 호출이 끝났습니다. 상태와 결과를 포함합니다.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "도구 이름은 대응하는 호출에서 가져옵니다. 블록에 내용이 없으면 레코드의 toolUseResult를 씁니다. is_error가 설정되어 있으면 success는 false입니다.",
          },
        ]),
        codex: [
          {
            record: "function_call_output, custom_tool_call_output, local_shell_call_output 종류의 response_item",
            note: "Codex는 성공 플래그를 기록하지 않으므로, 출력이 0이 아닌 종료 코드를 보고하면 앱이 실패로 표시합니다.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content가 결과 텍스트가 되고, 실패한 호출에서는 error.message가 그 자리를 대신하며, detailedContent(보통 diff)는 result.detail이 됩니다.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "모델이 외부 브리지(보통 MCP 서버)가 제공하는 도구를 호출했습니다.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, mcp__…라는 이름의 도구인 경우` }]),
        copilot: [{ record: "external_tool.requested, 작성된 그대로 읽음" }],
      },
    },
    "external_tool.completed": {
      summary: "외부 도구 호출이 끝났습니다. 상태와 결과를 포함합니다.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, mcp__…라는 이름의 도구인 경우` }]),
        codex: [{ record: "mcp_tool_call_end 종류의 event_msg 줄" }],
        copilot: [{ record: "external_tool.completed", note: "tool.execution_complete와 같은 형태입니다." }],
      },
    },

    "permission.requested": { summary: "실행 환경이 작업(파일, 시스템, 네트워크)에 대한 권한을 사용자에게 요청했습니다." },
    "permission.completed": { summary: "권한 요청이 승인 또는 거부로 처리되었습니다." },
    "hook.start": { summary: "수명 주기 훅이 시작되었습니다. 예를 들어 프롬프트를 제출할 때." },
    "hook.end": {
      summary: "수명 주기 훅이 성공 또는 실패로 끝났습니다.",
      sources: claudeSources([{ record: "subtype이 stop_hook_summary인 system 레코드", note: "레코드에 훅 오류가 나열되어 있으면 success는 false입니다." }]),
    },

    "system.message": {
      summary: "실행 환경이 모델 앞에 둔 지시: 시스템 프롬프트, 지시 파일, 삽입된 컨텍스트.",
      detail: "요청마다 함께 전송되므로 세션 동안 크기가 계속 쌓입니다. 도구 모음의 토글로 다른 삽입 컨텍스트와 함께 숨길 수 있습니다.",
      sources: {
        ...claudeSources([
          { record: "prompt_snapshot 종류의 attachment 레코드", note: "Claude Code는 시스템 프롬프트의 어느 부분이든 바뀔 때마다 다시 기록합니다. 앱은 프롬프트 텍스트 자체가 바뀌었을 때만 표시합니다." },
          { record: "instructions 종류의 attachment 레코드(CLAUDE.md 및 AGENTS.md 파일)" },
          { record: "그 밖의 subtype을 가진 system 레코드" },
        ]),
        codex: [
          { record: "session_meta 줄의 base_instructions" },
          { record: "role이 developer 또는 system인 response_item 메시지" },
          { record: "실행 환경이 삽입한 role이 user인 response_item 메시지(role user_context로 표시)" },
        ],
      },
    },
    "context.attachment": {
      summary: "실행 환경이 스스로 추가한 컨텍스트: 파일 스냅숏, 알림, 도구나 스킬 목록, 이미지.",
      changes: ["모든 종류의 첨부를 {label, subject, items, content}로 평탄화해, 원시 JSON이 아닌 내용으로 읽히게 합니다."],
      sources: {
        ...claudeSources([
          { record: "attachment 레코드(date, file, skill_listing, deferred_tools_delta 등)" },
          { record: "prompt_snapshot 첨부의 도구 목록. 바뀔 때 도구 정의로 표시" },
          { record: "user 레코드의 image 블록", note: "이미지를 보냈다는 사실만 남기고, 픽셀은 디스크에 그대로 둡니다." },
        ]),
        codex: [{ record: "session_meta 줄의 dynamic_tools. 도구 정의로 표시" }],
      },
    },
    "system.notification": { summary: "대화에 추가된 실행 환경 알림. 예를 들어 백그라운드 셸이 끝났을 때." },

    "file.patch_applied": {
      summary: "에이전트가 워크스페이스에 적용한 패치와 변경한 파일.",
      sources: { codex: [{ record: "patch_apply_end 종류의 event_msg 줄" }] },
    },
    "web.search": {
      summary: "모델이 실행한 웹 검색. 결과는 컨텍스트에 추가됩니다.",
      sources: { codex: [{ record: "web_search_end 종류의 event_msg 줄" }] },
    },

    "subagent.deselected": { summary: "서브에이전트 포커스가 해제되고 제어가 메인 에이전트로 돌아갔습니다." },
    "subagent.activity": {
      summary: "메인 에이전트 아래에서 일하는 서브에이전트가 보고한 활동.",
      sources: { codex: [{ record: "sub_agent_activity 종류의 event_msg 줄" }] },
    },
    "subagent.message": {
      summary: "에이전트 사이에 오간 메시지.",
      sources: { codex: [{ record: "inter_agent_communication_metadata 줄" }] },
    },
    "subagent.session_start": {
      summary: "이 세션 안에서 서브에이전트 스레드가 시작되었습니다.",
      sources: { codex: [{ record: "첫 번째 이후의 session_meta 줄" }] },
    },
  },

  unknownSummary: "“{category}” 카테고리(“{name}”)의 이벤트로, 아직 설명이 없습니다.",
  unknownCategory: "알 수 없음",
  unknownName: "일반",
  unknownDetail:
    "에이전트가 앱에 매핑이 없는 레코드를 작성했습니다. 데이터는 작성된 그대로 보존되어 잃는 것이 없으며, 일반 카드로 표시됩니다.",

  callAndResult: "호출과 그 결과를 한 행으로 표시합니다.",
  recordsInOrder: "이 행을 읽어 온 레코드(트랜스크립트 순서).",
  recordTitle: "{agent} 레코드",
  eventFormat: "이벤트 형식",
};
