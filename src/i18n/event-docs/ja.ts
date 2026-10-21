import { claudeSources, type EventDocs } from "./en";

/** Japanese. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "結果は result.content のプレーンテキストにまとめられます。画像は種類とサイズのみを残し、ピクセルはディスク上に残ります。",
  "コンパクト表示では呼び出しとその結果を 1 行で表示するため、Raw と Original には 2 つのレコードが表示されます。",
];

const CLAUDE_TOOL_USE = "message.content に tool_use ブロックを含む assistant レコード";
const CLAUDE_TOOL_RESULT =
  "tool_result ブロックを含む user レコード。tool_use_id で呼び出しと対応付けられる";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code はストリーミング応答のコンテンツブロックごとに 1 レコードを書き込み、応答の使用量を各レコードに繰り返し記録します。使用量は応答の最初のイベントで 1 回だけ数えます。";
const ARGUMENT_CHARS =
  "argumentChars を追加します。書かれたとおりの引数のサイズで、コンテキスト上のコストにあたります。";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "レコードの種類: user、assistant、system、attachment、mode など",
  subtype: "system レコードの種類: api_error、compact_boundary、turn_duration など",
  uuid: "レコードの ID。",
  parentUuid: "会話上でこのレコードの直前にあるレコード。",
  isSidechain: "メインの会話ではなくサブエージェントが書き込んだもの。",
  timestamp: "書き込まれた日時(ISO 8601)。",
  sessionId: "レコードが属するセッション。フォークではコピーされたレコードに親の ID が残ります。",
  cwd: "作業ディレクトリ。",
  gitBranch: "その時点の Git ブランチ。",
  version: "レコードを書き込んだ Claude Code のバージョン。",
  entrypoint: "Claude Code の実行場所: cli、claude-desktop など",
  userType: "セッションを操作している主体。",
  requestId: "API リクエストの ID。",
  promptId: "レコードが属するプロンプト。",
  effort: "リクエストの推論レベル。",
  message: "送受信されたままの API メッセージ。",
  "message.role": "user または assistant。",
  "message.model": "応答したモデル。Claude Code 自身が書いたメッセージは <synthetic>。",
  "message.id": "API メッセージの ID。1 つのストリーミング応答の全レコードで共通。",
  "message.type": "常に message。",
  "message.content": "文字列、またはコンテンツブロックのリスト。",
  "message.content[].type": "ブロックの種類: text、thinking、tool_use、tool_result、image。",
  "message.content[].text": "text ブロックのテキスト。",
  "message.content[].thinking": "thinking ブロックの推論。",
  "message.content[].signature": "推論を API に送り返すための署名。",
  "message.content[].id": "tool_use ブロックの ID。",
  "message.content[].name": "tool_use ブロックが呼び出すツール。",
  "message.content[].input": "tool_use ブロックの引数。",
  "message.content[].tool_use_id": "tool_result ブロックが応答する呼び出し。",
  "message.content[].content": "ツールが返した内容。",
  "message.content[].is_error": "ツールが失敗を報告した。",
  "message.stop_reason": "応答が終わった理由: end_turn、tool_use、max_tokens など",
  "message.usage": "応答全体のトークン使用量。各レコードに繰り返し記録されます。",
  "message.usage.input_tokens": "キャッシュから読まれず、キャッシュにも書かれなかった入力トークン。",
  "message.usage.output_tokens": "出力トークン。",
  "message.usage.cache_read_input_tokens": "キャッシュから読まれた入力トークン。",
  "message.usage.cache_creation_input_tokens": "キャッシュに書かれた入力トークン。",
  "message.usage.cache_creation": "有効期間ごとのキャッシュ書き込み内訳。",
  "message.usage.speed": "高速モードで実行された場合は fast。",
  toolUseResult: "Claude Code 独自の、ツール結果の構造化コピー。",
  attachment: "Claude Code が挿入したコンテキスト。type で種類がわかります。",
  "attachment.type": "添付の種類: prompt_snapshot、instructions、file、date など",
  content: "system レコードのテキスト。",
  level: "system レコードの重要度。",
  error: "api_error レコードのエラー詳細。",
};

export const ja: EventDocs = {
  providerFormats: {
    claude:
      "~/.claude/projects/<project>/<session>.jsonl の JSONL。1 行に 1 つの JSON レコードで、種類は user、assistant、system、attachment など。各レコードには書き込んだ Claude Code のバージョンが含まれます。",
    cowork:
      "Claude Code CLI が各 Cowork セッション内で動作し、同じ JSONL トランスクリプトを書き込むため、Claude Code とまったく同じように読み込みます。",
    codex:
      "~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl の JSONL。{timestamp, type, payload} の行で、種類は session_meta、event_msg、response_item、turn_context。CLI のバージョンは session_meta にのみ記録されます。",
    copilot:
      "~/.copilot/session-state/<id>/events.jsonl の JSONL。このアプリと同じ category.subCategory の語彙で、すでに {type, data, id, timestamp, parentId} の形で書かれています。session.start にフォーマットと CLI のバージョンが記録されます。",
    vscode:
      "VS Code のワークスペースストレージにあるチャットセッションファイル(JSON、または追記された変更の JSONL)。1 エントリに 1 組のリクエストと応答。",
    gemini:
      "~/.gemini/tmp/<project>/chats のセッションファイル。各メッセージの種類は user、gemini、info、warning、error のいずれかで、再度書き込まれたメッセージは以前の版を置き換えます。",
    opencode:
      "SQLite(opencode.db)。session、message、part の行で、それぞれ内容を JSON 列に保持します。",
    cursor:
      "~/.cursor/projects の SQLite ストア。会話を bubble 行として保持し、1 がユーザー、2 がエージェントです。",
    hermes: "~/.hermes の SQLite(state.db)。セッションとそのメッセージを行として保持します。",
  },

  sharedChanges: [
    "種類は共通の category.subCategory の語彙に名前を変え、どのエージェントのイベントも同じように読めるようにします。",
    "長いテキストは 20,000 文字で切り詰めます。charLength に元の長さを、truncated に切り詰めたことを記録します。元のレコードは切り詰めません。",
    "1 つのレコードが複数のイベントになることがあり(テキスト、推論、ツール呼び出しを含む応答など)、管理用のレコードは読み飛ばします。",
  ],

  fieldDocs: {
    content: "メッセージのテキスト。上限は 20,000 文字。",
    charLength: "上限で切る前のテキストの全長。",
    truncated: "表示しているテキストが切り詰められている場合は true。",
    model: "これを生成したモデル。エージェントが付けた名前のまま。",
    effort: "リクエストの推論レベル。",
    requestId: "API リクエストの ID。プロバイダーのログと照合するためのもの。",
    role: "テキストの出どころ: system_prompt、instructions、developer、user_context など",
    toolName: "モデルが呼び出したツール。MCP ツールは mcp__server__tool。",
    toolCallId: "呼び出しとその結果を結び付ける ID。",
    arguments: "モデルがツールに渡した引数。JSON として解析済み。",
    argumentChars: "モデルが書いたとおりの引数のサイズ。コンテキスト上のコストにあたります。",
    result: "ツールが返した内容。{content, format, images?, detail?} にまとめたもの。",
    resultChars: "上限で切る前の結果の全長。",
    success: "呼び出しが失敗を報告した場合は false。",
    inputTokens: "リクエストの入力トークン。キャッシュに書き込まれたものを含みます。",
    outputTokens: "応答の出力トークン。推論を含みます。",
    cacheReadTokens: "プロンプトキャッシュから提供された入力トークン。",
    billedUsage: "料金体系に合わせて分けた使用量。コスト見積もりに使います。",
    costUSD: "API の定価で見積もったこのリクエストのコスト。",
    inherited: "フォーク元のセッションからコピーされたもの。コストはフォーク元に属します。",
    durationMs: "所要時間(ミリ秒)。",
    sessionId: "セッションの ID。",
    context: "セッションが実行された作業ディレクトリ、ブランチ、リポジトリ。",
    attachmentType: "この種類のコンテキストに対するエージェント独自の名前。",
    label: "添付の種類の読みやすい名前。",
    subject: "添付の対象: ファイル、日付、フックなど",
    items: "添付に列挙された名前(ツール、スキル、エージェント)。最大 200 件。",
    itemCount: "添付が列挙した名前の総数。",
    itemsLabel: "列挙された名前が何であるか。",
    message: "エラーまたは通知のテキスト。",
    reason: "発生した理由。",
    mode: "切り替え先のモード。",
    trigger: "きっかけ: manual または auto。",
    preTokens: "圧縮前のコンテキストサイズ。",
    turnId: "ターンの ID。",
    totalCostUSD: "エージェント自身が報告した、これまでのセッションのコスト。",
    apiDurationMs: "これまでに API を待った合計時間。",
    premiumRequests: "これまでに数えたプレミアムリクエスト。",
    sessionTotals: "エージェントが報告したセッションの合計。セッションの概要に使います。",
    usage: "エージェントが報告した使用量の合計。",
    selectedModel: "セッション開始時に選ばれたモデル。",
    copilotVersion: "セッションを書き込んだエージェント CLI のバージョン。",
    cliVersion: "セッションを書き込んだエージェント CLI のバージョン。",
    entrypoint: "セッションの実行場所: cli、claude-desktop など",
    forkedFrom: "このセッションのフォーク元。",
  },

  pathDocs: {
    type: "イベントの種類。category.subCategory。",
    data: "エージェントが記録した内容。必要に応じて正規化しています。",
    id: "セッション内で一意なイベント ID。",
    timestamp: "発生した日時(ISO 8601)。",
    parentId: "このイベントの元になったイベント(エージェントが記録している場合)。",
    source: "元のレコードの場所: トランスクリプト内の行、またはエージェント独自の ID。",
    category: "種類の前半部分。フィルターで使います。",
    subCategory: "種類の残りの部分。フィルターで使います。",
    subKey: "種類の全体。フィルターで使います。",
    "data.result.content": "結果のプレーンテキスト(上限あり)。JSON の結果はインデントされます。",
    "data.result.format": "text または json。",
    "data.result.images": "ツールが返した画像。種類とサイズのみ。",
    "data.result.detail": "一部のツールが付け加える別の表現。たいていは diff。",
    "data.context.cwd": "作業ディレクトリ。",
    "data.context.branch": "Git ブランチ。",
    "data.context.repository": "Git リポジトリ。",
    "data.billedUsage.model": "使用量の料金計算に使うモデル。",
    "data.billedUsage.inputTokens": "キャッシュから読まれず、キャッシュにも書かれなかった入力トークン。",
    "data.billedUsage.outputTokens": "出力トークン。",
    "data.billedUsage.cacheReadTokens": "キャッシュから読まれた入力トークン。",
    "data.billedUsage.cacheWriteTokens": "5 分キャッシュに書かれた入力トークン。",
    "data.billedUsage.cacheWrite1hTokens": "1 時間キャッシュに書かれた入力トークン。",
    "data.billedUsage.fast": "高速モードで実行され、高い料金で課金されたもの。",
    "data.billedUsage.local": "ローカルモデルで実行され、料金がかからないもの。",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "行が書き込まれた日時(ISO 8601)。",
      ordinal: "ロールアウト内での行の位置。",
      type: "行の種類: session_meta、event_msg、response_item、turn_context など",
      payload: "行の内容。payload 自身の type で何かがわかります。",
      "payload.type": "payload の種類: user_message、agent_message、function_call、token_count など",
      "payload.id": "セッション(session_meta)または項目の ID。",
      "payload.cli_version": "Codex CLI のバージョン。session_meta のみ。",
      "payload.originator": "Codex を実行したアプリ。",
      "payload.cwd": "作業ディレクトリ。",
      "payload.role": "メッセージの送り手: user、assistant、developer、system。",
      "payload.content": "メッセージのコンテンツ部分。",
      "payload.content[].type": "部分の種類: input_text、output_text など",
      "payload.content[].text": "部分のテキスト。",
      "payload.message": "event_msg メッセージのテキスト。",
      "payload.call_id": "ツール呼び出しとその出力を結び付ける ID。",
      "payload.name": "呼び出されたツール。",
      "payload.arguments": "ツールの引数(JSON 文字列)。",
      "payload.input": "カスタムツール呼び出しの入力。",
      "payload.output": "ツールが返した内容。",
      "payload.status": "呼び出しのステータス。",
      "payload.turn_id": "行が属するターン。",
      "payload.info": "トークン使用量: 累積の合計と直前のリクエストの値。",
    },
    copilot: {
      type: "イベントの種類。すでに category.subCategory の形です。",
      data: "イベントのデータ。",
      id: "イベントの ID。",
      timestamp: "発生した日時(ISO 8601)。",
      parentId: "このイベントの元になったイベント。",
      "data.version": "events.jsonl フォーマットのバージョン。",
      "data.copilotVersion": "Copilot CLI のバージョン。",
      "data.producer": "ファイルを書き込んだもの。",
      "data.toolCallId": "呼び出しとその結果を結び付ける ID。",
      "data.toolName": "呼び出されたツール。",
      "data.arguments": "ツールの引数。",
      "data.result": "ツールが返した内容: content と、ツールが付け加えた場合は detailedContent。",
      "data.error": "失敗した呼び出しの失敗理由。",
    },
  },

  events: {
    "session.start": {
      summary: "セッションの初期化。セッション開始時の実行環境と選択されたモデルを記録します。",
      sources: {
        ...claudeSources([
          {
            record: "レコードなし: Claude Code は開始レコードを書き込みません",
            note: "アプリがトランスクリプトのレコードの cwd、gitBranch、version、entrypoint から作成し、どのエージェントでもタイムラインが同じヘッダーで始まるようにします。",
          },
        ]),
        codex: [{ record: "最初の session_meta 行", note: "以降の session_meta 行はサブエージェントのスレッドで、subagent.session_start になります。" }],
        copilot: [{ record: "session.start(書かれたまま読み込み)" }],
      },
    },
    "session.resume": { summary: "以前の状態からセッションを再開しました。コンテキストの再読み込みと継続を示します。" },
    "session.shutdown": {
      summary: "セッション終了時の概要。通常は使用量、トークン合計、プレミアムリクエスト、API の時間を含みます。",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "アプリはここから sessionTotals と usageSummary を導きます。合計は累積値なので、最後の shutdown だけに料金を計算し、再開したセッションを二重に数えません。",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "自動モードでのモデル選択の結果。予測したタスクの傾向と選ばれたモデル設定を示します。" },
    "session.binary_asset": { summary: "セッションで取り込まれたバイナリデータ。たいていはスクリーンショットです。コンテキストと容量を大きく消費することがあります。" },
    "session.usage_checkpoint": {
      summary: "セッション実行中の途中経過の使用量集計。",
      sources: {
        ...claudeSources([{ record: "cost-state レコード", note: "totalCostUSD と totalAPIDuration は報告どおりにコピーします。" }]),
        codex: [
          {
            record: "種類が token_count の event_msg 行",
            note: "Codex は累積の合計を報告するため、アプリは前回のチェックポイントからの差分だけを課金し、キャッシュ済みトークンを input_tokens から外してそれぞれ 1 回だけ料金を計算します。",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "プレミアム/AIU の集計のみで、トークン合計はありません。premiumRequests は totalPremiumRequests からコピーします。" }],
      },
    },
    "session.model_change": {
      summary: "セッション中にモデル設定(モデル、推論レベル、コンテキストの段階)が切り替わりました。",
      sources: { codex: [{ record: "種類が thread_settings_applied の event_msg 行" }] },
    },
    "session.compaction_start": {
      summary: "コンテキストの圧縮を開始しました。リクエストごとに送るトークンを減らすため、会話を要約します。",
      sources: claudeSources([{ record: "subtype が compact_boundary の system レコード", note: "trigger と preTokens は compactMetadata から取得します。" }]),
    },
    "session.compaction_complete": { summary: "圧縮が完了しました。成功・失敗のメタデータとリクエスト ID を含みます。" },
    "session.error": {
      summary: "API または通信のエラー。再試行のたびにリクエストのコンテキスト全体を再送します。",
      sources: {
        ...claudeSources([{ record: "subtype が api_error の system レコード" }]),
        gemini: [{ record: "種類が error のメッセージ" }],
      },
    },
    "session.turn_aborted": {
      summary: "ターンが完了前に中断されました。",
      changes: ["中断の記録方法はエージェントごとに異なりますが、すべてこの 1 つの種類にまとめます。"],
      sources: {
        ...claudeSources([
          {
            record: "テキストが「[Request interrupted by user」で始まる user レコード",
            note: "Claude Code は中断をユーザーが入力したかのように記録します。アプリはこれをプロンプトとして表示しません。",
          },
        ]),
        codex: [{ record: "種類が turn_aborted の event_msg 行" }],
        copilot: [{ record: "abort イベント", note: "名前を変更し、データは書かれたまま残します。" }],
      },
    },
    "session.mode_change": {
      summary: "セッション中に対話モードまたは権限モードが切り替わりました。",
      sources: claudeSources([{ record: "mode または permission-mode レコード" }]),
    },
    "session.turn_context": {
      summary: "ターンごとの実行設定: モデル、推論レベル、サンドボックス、承認ポリシー。",
      sources: { codex: [{ record: "turn_context 行" }] },
    },
    "session.world_state": {
      summary: "実行環境がモデルに渡したワークスペースのスナップショット。",
      sources: { codex: [{ record: "world_state 行" }] },
    },
    "session.rollback": {
      summary: "会話が何ターンか巻き戻されました。",
      sources: { codex: [{ record: "種類が thread_rolled_back の event_msg 行" }] },
    },
    "session.plan_changed": { summary: "エージェントが作業計画を作成または更新しました。" },
    "session.info": {
      summary: "エージェントが表示した通知: 情報または警告。",
      sources: { gemini: [{ record: "種類が info または warning のメッセージ" }] },
    },

    "user.message": {
      summary: "ユーザーが入力した内容。アシスタントの次のターンのきっかけになります。",
      sources: {
        ...claudeSources([
          {
            record: "user レコード: 文字列としての message.content、またはその中の各 text ブロック",
            note: "同じ種類のレコードがツールの結果も運び、それらは tool.execution_complete になります。",
          },
        ]),
        codex: [
          { record: "種類が user_message の event_msg 行" },
          {
            record: "role が user の response_item メッセージ(古いロールアウトのみ)",
            note: "新しいロールアウトは会話を 2 回、event_msg(ユーザーが見たもの)と response_item(モデルが見たもの)として持ちます。ターンが重複しないようアプリは event_msg を使い、response_item のコピーは system.message になります。",
          },
        ],
        copilot: [{ record: "user.message(書かれたまま読み込み)" }],
        gemini: [{ record: "種類が user のメッセージ" }],
      },
    },
    "assistant.message": {
      summary: "モデルが返したテキスト。モデル名とトークン使用量を含みます。",
      fields: {
        phase: "Codex: メッセージがターンのどの部分に属するか。",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content に text ブロックを含む assistant レコード",
            note: `${CLAUDE_ASSISTANT_NOTE} テキスト、推論、ツール呼び出しのない応答も、使用量を数えるために空のメッセージになります。`,
          },
        ]),
        codex: [
          { record: "種類が agent_message の event_msg 行" },
          { record: "role が assistant の response_item メッセージ(event_msg のコピーがない場合のみ)" },
        ],
        copilot: [{ record: "assistant.message(書かれたまま読み込み)" }],
        gemini: [{ record: "種類が gemini のメッセージの内容" }],
      },
    },
    "assistant.thinking": {
      summary: "モデルが回答前に生成した推論。出力トークンとして課金されます。",
      sources: {
        ...claudeSources([{ record: "thinking ブロックを含む assistant レコード", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "種類が agent_reasoning の event_msg 行" },
          { record: "種類が reasoning の response_item(summary を使用)", note: "暗号化された推論しかない場合は読める部分がないため読み飛ばします。" },
        ],
        gemini: [{ record: "種類が gemini のメッセージにある thoughts の各項目" }],
      },
    },
    "assistant.turn_start": {
      summary: "アシスタントの 1 ターンの開始。",
      sources: { codex: [{ record: "種類が task_started の event_msg 行" }] },
    },
    "assistant.turn_end": {
      summary: "推論、ツール呼び出し、出力を終えたアシスタントのターンの終了。",
      sources: {
        ...claudeSources([{ record: "subtype が turn_duration の system レコード" }]),
        codex: [{ record: "種類が task_complete の event_msg 行" }],
      },
    },

    "tool.execution_start": {
      summary: "モデルが組み込みツールを、名前と引数を指定して呼び出しました。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `mcp__… という名前のツールは代わりに external_tool.requested になります。${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "種類が function_call、custom_tool_call、local_shell_call の response_item",
            note: "JSON 文字列として書かれた引数はオブジェクトに解析します。",
          },
        ],
        copilot: [{ record: "tool.execution_start(書かれたまま読み込み)" }],
        gemini: [{ record: "種類が gemini のメッセージにある toolCalls の各項目" }],
      },
    },
    "tool.execution_complete": {
      summary: "組み込みツールの呼び出しが完了しました。ステータスと結果を含みます。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "ツール名は対応する呼び出しから取得します。ブロックに内容がない場合はレコードの toolUseResult を使います。is_error が設定されていると success は false になります。",
          },
        ]),
        codex: [
          {
            record: "種類が function_call_output、custom_tool_call_output、local_shell_call_output の response_item",
            note: "Codex は成功フラグを記録しないため、出力が 0 以外の終了コードを報告したときにアプリが失敗として扱います。",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content が結果のテキストになり、失敗した呼び出しでは error.message がその代わりになります。detailedContent(たいていは diff)は result.detail になります。",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "モデルが外部ブリッジ(たいていは MCP サーバー)が提供するツールを呼び出しました。",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}(mcp__… という名前のツールの場合)` }]),
        copilot: [{ record: "external_tool.requested(書かれたまま読み込み)" }],
      },
    },
    "external_tool.completed": {
      summary: "外部ツールの呼び出しが完了しました。ステータスと結果を含みます。",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}(mcp__… という名前のツールの場合)` }]),
        codex: [{ record: "種類が mcp_tool_call_end の event_msg 行" }],
        copilot: [{ record: "external_tool.completed", note: "tool.execution_complete と同じ形です。" }],
      },
    },

    "permission.requested": { summary: "実行環境が操作(ファイル、システム、ネットワーク)の許可をユーザーに求めました。" },
    "permission.completed": { summary: "許可リクエストが承認または拒否されました。" },
    "hook.start": { summary: "ライフサイクルフックが開始されました。たとえばプロンプト送信時など。" },
    "hook.end": {
      summary: "ライフサイクルフックが成功または失敗で終了しました。",
      sources: claudeSources([{ record: "subtype が stop_hook_summary の system レコード", note: "レコードにフックのエラーが列挙されていると success は false になります。" }]),
    },

    "system.message": {
      summary: "実行環境がモデルの前に置いた指示: システムプロンプト、指示ファイル、挿入されたコンテキスト。",
      detail: "これらはリクエストのたびに送られるため、セッションを通してサイズが積み重なります。ツールバーの切り替えで、ほかの挿入コンテキストと一緒に非表示にできます。",
      sources: {
        ...claudeSources([
          { record: "種類が prompt_snapshot の attachment レコード", note: "Claude Code はシステムプロンプトのどこかが変わるたびに再記録しますが、アプリはプロンプトのテキスト自体が変わったときだけ表示します。" },
          { record: "種類が instructions の attachment レコード(CLAUDE.md と AGENTS.md ファイル)" },
          { record: "その他の subtype の system レコード" },
        ]),
        codex: [
          { record: "session_meta 行の base_instructions" },
          { record: "role が developer または system の response_item メッセージ" },
          { record: "実行環境が挿入した role が user の response_item メッセージ(role user_context として表示)" },
        ],
      },
    },
    "context.attachment": {
      summary: "実行環境が自ら追加したコンテキスト: ファイルのスナップショット、リマインダー、ツールやスキルの一覧、画像。",
      changes: ["どの種類の添付も {label, subject, items, content} に平坦化し、生の JSON ではなく内容として読めるようにします。"],
      sources: {
        ...claudeSources([
          { record: "attachment レコード(date、file、skill_listing、deferred_tools_delta など)" },
          { record: "prompt_snapshot 添付のツール一覧。変化したときにツール定義として表示" },
          { record: "user レコード内の image ブロック", note: "画像が送られたという事実だけを残し、ピクセルはディスク上に残ります。" },
        ]),
        codex: [{ record: "session_meta 行の dynamic_tools。ツール定義として表示" }],
      },
    },
    "system.notification": { summary: "会話に追加された実行環境からの通知。バックグラウンドのシェルの終了など。" },

    "file.patch_applied": {
      summary: "エージェントがワークスペースに適用したパッチ。変更したファイルを含みます。",
      sources: { codex: [{ record: "種類が patch_apply_end の event_msg 行" }] },
    },
    "web.search": {
      summary: "モデルが実行した Web 検索。結果はコンテキストに追加されます。",
      sources: { codex: [{ record: "種類が web_search_end の event_msg 行" }] },
    },

    "subagent.deselected": { summary: "サブエージェントへのフォーカスが解除され、制御がメインエージェントに戻りました。" },
    "subagent.activity": {
      summary: "メインエージェントの下で動くサブエージェントが報告したアクティビティ。",
      sources: { codex: [{ record: "種類が sub_agent_activity の event_msg 行" }] },
    },
    "subagent.message": {
      summary: "エージェント間でやり取りされたメッセージ。",
      sources: { codex: [{ record: "inter_agent_communication_metadata 行" }] },
    },
    "subagent.session_start": {
      summary: "このセッション内でサブエージェントのスレッドが開始されました。",
      sources: { codex: [{ record: "最初より後の session_meta 行" }] },
    },
  },

  unknownSummary: "「{category}」カテゴリ(「{name}」)のイベントで、まだ説明がありません。",
  unknownCategory: "不明",
  unknownName: "一般",
  unknownDetail:
    "エージェントが、アプリに対応付けのないレコードを書き込みました。データは書かれたまま保持されるため何も失われず、汎用カードで表示されます。",

  callAndResult: "呼び出しとその結果を 1 行で表示しています。",
  recordsInOrder: "この行の読み込み元のレコード(トランスクリプト順)。",
  recordTitle: "{agent} のレコード",
  eventFormat: "イベントフォーマット",
};
