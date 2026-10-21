import { claudeSources, type EventDocs } from "./en";

/** Turkish. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Sonuç, result.content içinde düz metne indirgenir. Görsellerin yalnızca türü ve boyutu tutulur; pikseller diskte kalır.",
  "Kompakt görünümde bir çağrı ve sonucu tek satır olarak gösterilir, bu yüzden Raw ve Original iki kayıt gösterir.",
];

const CLAUDE_TOOL_USE = "message.content içinde tool_use bloğu olan bir assistant kaydı";
const CLAUDE_TOOL_RESULT =
  "tool_result bloğu olan bir user kaydı; tool_use_id ile çağrısıyla eşleştirilir";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code, akışla gelen bir yanıtın her içerik bloğu için bir kayıt yazar ve yanıtın kullanımını her birinde tekrarlar. Kullanım bir kez, yanıtın ilk olayında sayılır.";
const ARGUMENT_CHARS =
  "argumentChars eklenir: argümanların yazıldığı haliyle boyutu, yani bağlamdaki maliyetleri.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Kayıt türü: user, assistant, system, attachment, mode, …",
  subtype: "system kaydının türü: api_error, compact_boundary, turn_duration, …",
  uuid: "Kaydın kimliği.",
  parentUuid: "Konuşmada bu kaydın ardından geldiği kayıt.",
  isSidechain: "Ana konuşma değil, bir alt ajan tarafından yazıldı.",
  timestamp: "Yazıldığı zaman, ISO 8601.",
  sessionId: "Kaydın ait olduğu oturum; bir fork, kopyalanan kayıtlarda üst oturumun kimliğini korur.",
  cwd: "Çalışma dizini.",
  gitBranch: "O andaki Git dalı.",
  version: "Kaydı yazan Claude Code sürümü.",
  entrypoint: "Claude Code'un çalıştığı yer: cli, claude-desktop, …",
  userType: "Oturumu kimin yönettiği.",
  requestId: "API isteğinin kimliği.",
  promptId: "Kaydın ait olduğu istem.",
  effort: "İsteğin akıl yürütme düzeyi.",
  message: "Gönderildiği ya da alındığı haliyle API mesajı.",
  "message.role": "user veya assistant.",
  "message.model": "Yanıt veren model; Claude Code'un kendi yazdığı mesajlar için <synthetic>.",
  "message.id": "API mesajının kimliği; akışla gelen bir yanıtın tüm kayıtlarında ortaktır.",
  "message.type": "Her zaman message.",
  "message.content": "Bir dize ya da içerik blokları listesi.",
  "message.content[].type": "Blok türü: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "text bloğunun metni.",
  "message.content[].thinking": "thinking bloğunun akıl yürütmesi.",
  "message.content[].signature": "Akıl yürütmenin API'ye geri gönderilmesini sağlayan imza.",
  "message.content[].id": "tool_use bloğunun kimliği.",
  "message.content[].name": "tool_use bloğunun çağırdığı araç.",
  "message.content[].input": "tool_use bloğunun argümanları.",
  "message.content[].tool_use_id": "tool_result bloğunun yanıtladığı çağrı.",
  "message.content[].content": "Aracın döndürdüğü.",
  "message.content[].is_error": "Araç başarısızlık bildirdi.",
  "message.stop_reason": "Yanıtın neden bittiği: end_turn, tool_use, max_tokens, …",
  "message.usage": "Tüm yanıtın token kullanımı, her kaydında tekrarlanır.",
  "message.usage.input_tokens": "Önbellekten okunmayan ve önbelleğe yazılmayan girdi tokenları.",
  "message.usage.output_tokens": "Çıktı tokenları.",
  "message.usage.cache_read_input_tokens": "Önbellekten okunan girdi tokenları.",
  "message.usage.cache_creation_input_tokens": "Önbelleğe yazılan girdi tokenları.",
  "message.usage.cache_creation": "Yaşam süresine göre ayrılmış önbellek yazmaları.",
  "message.usage.speed": "İstek hızlı modda çalıştıysa fast.",
  toolUseResult: "Bir araç sonucunun Claude Code'a ait yapılandırılmış kopyası.",
  attachment: "Claude Code'un eklediği bağlam; türünü type söyler.",
  "attachment.type": "Ek türü: prompt_snapshot, instructions, file, date, …",
  content: "system kaydının metni.",
  level: "system kaydının önem düzeyi.",
  error: "api_error kaydının hata ayrıntıları.",
};

export const tr: EventDocs = {
  providerFormats: {
    claude:
      "~/.claude/projects/<project>/<session>.jsonl altında JSONL: satır başına bir JSON kaydı; türleri user, assistant, system, attachment vb. Her kayıt, onu yazan Claude Code sürümünü taşır.",
    cowork:
      "Claude Code CLI her Cowork oturumunun içinde çalışır ve aynı JSONL dökümünü yazar; bu yüzden tam olarak Claude Code gibi okunur.",
    codex:
      "~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl altında JSONL: session_meta, event_msg, response_item, turn_context türünde {timestamp, type, payload} satırları. CLI sürümünü yalnızca session_meta belirtir.",
    copilot:
      "~/.copilot/session-state/<id>/events.jsonl altında JSONL; bu uygulamanın kullandığı category.subCategory sözlüğüyle zaten {type, data, id, timestamp, parentId} olarak yazılmıştır. session.start biçim sürümünü ve CLI sürümünü belirtir.",
    vscode:
      "VS Code çalışma alanı deposundaki sohbet oturumu dosyaları (JSON ya da eklenen değişikliklerin JSONL'i); her girişte bir istek/yanıt çifti.",
    gemini:
      "~/.gemini/tmp/<project>/chats altındaki oturum dosyaları. Her mesajın türü user, gemini, info, warning veya error'dur; yeniden yazılan bir mesaj önceki sürümünün yerini alır.",
    opencode:
      "SQLite (opencode.db): session, message ve part satırları; her biri içeriğini bir JSON sütununda tutar.",
    cursor:
      "~/.cursor/projects altındaki SQLite depoları; konuşmayı bubble satırları olarak tutar: 1 kullanıcı, 2 ajan.",
    hermes: "~/.hermes altında SQLite (state.db): oturumlar ve mesajları satırlar halinde.",
  },

  sharedChanges: [
    "Tür, ortak category.subCategory sözlüğüne göre yeniden adlandırılır; böylece tüm ajanların olayları aynı şekilde okunur.",
    "Uzun metin 20.000 karakterde kesilir. charLength tam uzunluğu tutar, truncated kesildiğini belirtir; özgün kayıt kesilmez.",
    "Bir kayıt birkaç olaya dönüşebilir (metin, akıl yürütme ve araç çağrıları içeren bir yanıt) ve bazı kayıtlar iç işleyişe ait olduğu için atlanır.",
  ],

  fieldDocs: {
    content: "Mesajın metni, 20.000 karakterle sınırlı.",
    charLength: "Sınırlanmadan önce metnin tam uzunluğu.",
    truncated: "Gösterilen metin kısaltıldıysa true.",
    model: "Bunu üreten model, ajanın verdiği adla.",
    effort: "İsteğin çalıştığı akıl yürütme düzeyi.",
    requestId: "Sağlayıcı günlükleriyle eşleştirmek için API isteğinin kimliği.",
    role: "Metnin kaynağı: system_prompt, instructions, developer, user_context, …",
    toolName: "Modelin çağırdığı araç; MCP araçları için mcp__server__tool.",
    toolCallId: "Bir çağrıyı sonucuna bağlayan kimlik.",
    arguments: "Modelin araca verdiği argümanlar, JSON olarak ayrıştırılmış.",
    argumentChars: "Argümanların modelin yazdığı haliyle boyutu, yani bağlamdaki maliyetleri.",
    result: "Aracın döndürdüğü, {content, format, images?, detail?} biçimine indirgenmiş.",
    resultChars: "Sınırlanmadan önce sonucun tam uzunluğu.",
    success: "Çağrı başarısızlık bildirdiyse false.",
    inputTokens: "İsteğin girdi tokenları, önbelleğe yazılanlar dahil.",
    outputTokens: "Yanıtın çıktı tokenları, akıl yürütme dahil.",
    cacheReadTokens: "İstem önbelleğinden sunulan girdi tokenları.",
    billedUsage: "Fiyatlandırıldığı şekilde ayrılmış kullanım; maliyet tahmininde kullanılır.",
    costUSD: "Bu isteğin API liste fiyatlarıyla tahmini maliyeti.",
    inherited: "Bu oturumun çatallandığı oturumdan kopyalandı; maliyeti oraya aittir.",
    durationMs: "Ne kadar sürdüğü, milisaniye.",
    sessionId: "Oturumun kimliği.",
    context: "Oturumun çalıştığı çalışma dizini, dal ve depo.",
    attachmentType: "Ajanın bu bağlam türü için kendi adı.",
    label: "Ek türünün okunabilir adı.",
    subject: "Ekin konusu: bir dosya, bir tarih, bir hook…",
    items: "Ekin listelediği adlar (araçlar, skill'ler, ajanlar), en fazla 200.",
    itemCount: "Ekin tam olarak listelediği ad sayısı.",
    itemsLabel: "Listelenen adların ne olduğu.",
    message: "Hata ya da bildirim metni.",
    reason: "Neden olduğu.",
    mode: "Geçilen mod.",
    trigger: "Neyin başlattığı: manual veya auto.",
    preTokens: "Sıkıştırmadan önceki bağlam boyutu.",
    turnId: "Turun kimliği.",
    totalCostUSD: "Ajanın kendi bildirdiği şimdiye kadarki oturum maliyeti.",
    apiDurationMs: "Şimdiye kadar API'yi beklemekle geçen toplam süre.",
    premiumRequests: "Şimdiye kadar sayılan premium istekler.",
    sessionTotals: "Ajanın bildirdiği oturum toplamları; oturum özetinde kullanılır.",
    usage: "Ajanın bildirdiği haliyle kullanım toplamları.",
    selectedModel: "Oturum başladığında seçilen model.",
    copilotVersion: "Oturumu yazan ajan CLI sürümü.",
    cliVersion: "Oturumu yazan ajan CLI sürümü.",
    entrypoint: "Oturumun çalıştığı yer: cli, claude-desktop, …",
    forkedFrom: "Bu oturumun çatallandığı oturum.",
  },

  pathDocs: {
    type: "Olay türü, category.subCategory.",
    data: "Ajanın kaydettiği; değdiği yerde normalleştirilmiş.",
    id: "Olayın oturum içindeki benzersiz kimliği.",
    timestamp: "Ne zaman olduğu, ISO 8601.",
    parentId: "Ajan kaydediyorsa, bu olayın türediği olay.",
    source: "Özgün kaydın yeri: dökümdeki satırı ya da ajanın kendi kimliği.",
    category: "Türün ilk kısmı, filtrelerde kullanılır.",
    subCategory: "Türün geri kalanı, filtrelerde kullanılır.",
    subKey: "Tam tür, filtrelerde kullanılır.",
    "data.result.content": "Sonucun düz metni, sınırlı. JSON sonuçları girintilenir.",
    "data.result.format": "text veya json.",
    "data.result.images": "Aracın döndürdüğü görseller: yalnızca tür ve boyut.",
    "data.result.detail": "Bazı araçların eklediği ikinci bir gösterim, genellikle diff.",
    "data.context.cwd": "Çalışma dizini.",
    "data.context.branch": "Git dalı.",
    "data.context.repository": "Git deposu.",
    "data.billedUsage.model": "Kullanımın fiyatlandırıldığı model.",
    "data.billedUsage.inputTokens": "Önbellekten okunmayan ve önbelleğe yazılmayan girdi tokenları.",
    "data.billedUsage.outputTokens": "Çıktı tokenları.",
    "data.billedUsage.cacheReadTokens": "Önbellekten okunan girdi tokenları.",
    "data.billedUsage.cacheWriteTokens": "5 dakikalık önbelleğe yazılan girdi tokenları.",
    "data.billedUsage.cacheWrite1hTokens": "1 saatlik önbelleğe yazılan girdi tokenları.",
    "data.billedUsage.fast": "Hızlı modda çalıştı, daha yüksek ücretle faturalandı.",
    "data.billedUsage.local": "Hiçbir ücret çıkarmayan yerel bir modelde çalıştı.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Satırın yazıldığı zaman, ISO 8601.",
      ordinal: "Satırın rollout içindeki konumu.",
      type: "Satır türü: session_meta, event_msg, response_item, turn_context, …",
      payload: "Satırın içeriği; ne olduğunu kendi type'ı söyler.",
      "payload.type": "Payload türü: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Oturumun (session_meta) ya da öğenin kimliği.",
      "payload.cli_version": "Codex CLI sürümü, yalnızca session_meta'da.",
      "payload.originator": "Codex'i çalıştıran uygulama.",
      "payload.cwd": "Çalışma dizini.",
      "payload.role": "Mesajın kimden olduğu: user, assistant, developer, system.",
      "payload.content": "Bir mesajın içerik parçaları.",
      "payload.content[].type": "Parça türü: input_text, output_text, …",
      "payload.content[].text": "Parçanın metni.",
      "payload.message": "Bir event_msg mesajının metni.",
      "payload.call_id": "Bir araç çağrısını çıktısına bağlayan kimlik.",
      "payload.name": "Çağrılan araç.",
      "payload.arguments": "Araç argümanları, JSON dizesi olarak.",
      "payload.input": "Özel bir araç çağrısının girdisi.",
      "payload.output": "Aracın döndürdüğü.",
      "payload.status": "Çağrının durumu.",
      "payload.turn_id": "Satırın ait olduğu tur.",
      "payload.info": "Token kullanımı: birikimli toplamlar ve son isteğinki.",
    },
    copilot: {
      type: "Olay türü, zaten category.subCategory biçiminde.",
      data: "Olay verisi.",
      id: "Olayın kimliği.",
      timestamp: "Ne zaman olduğu, ISO 8601.",
      parentId: "Bu olayın türediği olay.",
      "data.version": "events.jsonl biçiminin sürümü.",
      "data.copilotVersion": "Copilot CLI sürümü.",
      "data.producer": "Dosyayı neyin yazdığı.",
      "data.toolCallId": "Bir çağrıyı sonucuna bağlayan kimlik.",
      "data.toolName": "Çağrılan araç.",
      "data.arguments": "Araç argümanları.",
      "data.result": "Aracın döndürdüğü: content ve araç eklediyse detailedContent.",
      "data.error": "Başarısız çağrının neden başarısız olduğu.",
    },
  },

  events: {
    "session.start": {
      summary: "Oturum başlatma. Oturum başladığında çalışma ortamını ve seçilen modeli kaydeder.",
      sources: {
        ...claudeSources([
          {
            record: "Kayıt yok: Claude Code başlangıç kaydı yazmaz",
            note: "Uygulama, dökümdeki kayıtların cwd, gitBranch, version ve entrypoint alanlarından bir tane oluşturur; böylece zaman çizelgesi her ajan için aynı başlıkla açılır.",
          },
        ]),
        codex: [{ record: "İlk session_meta satırı", note: "Sonraki session_meta satırları alt ajan iş parçacıklarıdır ve subagent.session_start olur." }],
        copilot: [{ record: "session.start, yazıldığı gibi okunur" }],
      },
    },
    "session.resume": { summary: "Oturum önceki bir durumdan sürdürüldü. Bağlamın yeniden yüklendiğini ve devam edildiğini gösterir." },
    "session.shutdown": {
      summary: "Oturum sonu özeti. Genellikle kullanım, token toplamları, premium istekler ve API sürelerini içerir.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Uygulama sessionTotals ve usageSummary'yi buradan türetir. Toplamlar birikimlidir; bu yüzden yalnızca son shutdown fiyatlandırılır ve sürdürülen bir oturum iki kez sayılmaz.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Otomatik modda model seçiminin sonucu. Öngörülen görev profilini ve seçilen model ayarlarını gösterir." },
    "session.binary_asset": { summary: "Oturumda yakalanan ikili veri, genellikle ekran görüntüleri. Ciddi miktarda bağlam ve depolama kaplayabilir." },
    "session.usage_checkpoint": {
      summary: "Oturum etkinken ara kullanım hesabı.",
      sources: {
        ...claudeSources([{ record: "Bir cost-state kaydı", note: "totalCostUSD ve totalAPIDuration bildirildiği gibi kopyalanır." }]),
        codex: [
          {
            record: "token_count türünde bir event_msg satırı",
            note: "Codex birikimli toplamlar bildirir; bu yüzden uygulama yalnızca önceki kontrol noktasından bu yana olan adımı faturalar ve önbellekteki tokenları input_tokens'tan çıkarır ki her biri bir kez fiyatlansın.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Yalnızca premium/AIU hesabı, token toplamı yok; premiumRequests, totalPremiumRequests'ten kopyalanır." }],
      },
    },
    "session.model_change": {
      summary: "Oturum sırasında model yapılandırması değişti (model, akıl yürütme düzeyi ya da bağlam katmanı).",
      sources: { codex: [{ record: "thread_settings_applied türünde bir event_msg satırı" }] },
    },
    "session.compaction_start": {
      summary: "Bağlam sıkıştırma başladı. Her istekte gönderilen tokenları azaltmak için konuşma özetlenir.",
      sources: claudeSources([{ record: "subtype compact_boundary olan bir system kaydı", note: "trigger ve preTokens, compactMetadata'dan gelir." }]),
    },
    "session.compaction_complete": { summary: "Sıkıştırma bitti; başarı ya da hata meta verisi ve istek kimlikleriyle." },
    "session.error": {
      summary: "API veya aktarım hatası. Her yeniden deneme tüm istek bağlamını yeniden gönderir.",
      sources: {
        ...claudeSources([{ record: "subtype api_error olan bir system kaydı" }]),
        gemini: [{ record: "error türünde bir mesaj" }],
      },
    },
    "session.turn_aborted": {
      summary: "Tur tamamlanmadan kesildi.",
      changes: ["Her ajan bir kesintiyi farklı işaretler; hepsi bu tek türe dönüşür."],
      sources: {
        ...claudeSources([
          {
            record: "Metni “[Request interrupted by user” ile başlayan bir user kaydı",
            note: "Claude Code kesintiyi kullanıcı yazmış gibi kaydeder; uygulama bunu istem olarak göstermez.",
          },
        ]),
        codex: [{ record: "turn_aborted türünde bir event_msg satırı" }],
        copilot: [{ record: "Bir abort olayı", note: "Yeniden adlandırılır; veri yazıldığı gibi tutulur." }],
      },
    },
    "session.mode_change": {
      summary: "Oturum sırasında etkileşim ya da izin modu değişti.",
      sources: claudeSources([{ record: "Bir mode veya permission-mode kaydı" }]),
    },
    "session.turn_context": {
      summary: "Tur başına çalışma yapılandırması: model, akıl yürütme düzeyi, sandbox ve onay politikası.",
      sources: { codex: [{ record: "Bir turn_context satırı" }] },
    },
    "session.world_state": {
      summary: "Ortamın modele verdiği çalışma alanı anlık görüntüsü.",
      sources: { codex: [{ record: "Bir world_state satırı" }] },
    },
    "session.rollback": {
      summary: "Konuşma birkaç tur geri alındı.",
      sources: { codex: [{ record: "thread_rolled_back türünde bir event_msg satırı" }] },
    },
    "session.plan_changed": { summary: "Ajan çalışma planını oluşturdu ya da güncelledi." },
    "session.info": {
      summary: "Ajanın yazdırdığı bir bildirim: bilgi ya da uyarı.",
      sources: { gemini: [{ record: "info veya warning türünde bir mesaj" }] },
    },

    "user.message": {
      summary: "Kullanıcının yazdığı. Asistanın sonraki turunu başlatır.",
      sources: {
        ...claudeSources([
          {
            record: "Bir user kaydı: dize olarak message.content ya da içindeki her text bloğu",
            note: "Aynı kayıt türü araç sonuçlarını da taşır; bunlar tool.execution_complete olur.",
          },
        ]),
        codex: [
          { record: "user_message türünde bir event_msg satırı" },
          {
            record: "role user olan bir response_item mesajı, yalnızca eski rollout'larda",
            note: "Yeni rollout'lar konuşmayı iki kez taşır: event_msg (kullanıcının gördüğü) ve response_item (modelin gördüğü). Uygulama turlar ikilenmesin diye event_msg kullanır; response_item kopyası system.message olur.",
          },
        ],
        copilot: [{ record: "user.message, yazıldığı gibi okunur" }],
        gemini: [{ record: "user türünde bir mesaj" }],
      },
    },
    "assistant.message": {
      summary: "Modelin yanıt olarak yazdığı metin; model adı ve token kullanımıyla.",
      fields: {
        phase: "Codex: mesajın turun hangi kısmına ait olduğu.",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content içinde text bloğu olan bir assistant kaydı",
            note: `${CLAUDE_ASSISTANT_NOTE} Metni, akıl yürütmesi veya araç çağrısı olmayan bir yanıt da kullanımı sayılsın diye boş bir mesaja dönüşür.`,
          },
        ]),
        codex: [
          { record: "agent_message türünde bir event_msg satırı" },
          { record: "role assistant olan bir response_item mesajı, yalnızca event_msg kopyası yoksa" },
        ],
        copilot: [{ record: "assistant.message, yazıldığı gibi okunur" }],
        gemini: [{ record: "gemini türündeki bir mesajın içeriği" }],
      },
    },
    "assistant.thinking": {
      summary: "Modelin yanıtlamadan önce ürettiği akıl yürütme. Çıktı tokenı olarak faturalanır.",
      sources: {
        ...claudeSources([{ record: "thinking bloğu olan bir assistant kaydı", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "agent_reasoning türünde bir event_msg satırı" },
          { record: "reasoning türünde bir response_item, summary'si kullanılarak", note: "Yalnızca şifreli akıl yürütmede okunabilir bir şey yoktur ve atlanır." },
        ],
        gemini: [{ record: "gemini türündeki bir mesajın thoughts listesindeki her giriş" }],
      },
    },
    "assistant.turn_start": {
      summary: "Bir asistan turunun başlangıcı.",
      sources: { codex: [{ record: "task_started türünde bir event_msg satırı" }] },
    },
    "assistant.turn_end": {
      summary: "Akıl yürütme, araç çağrıları ve çıktıdan sonra asistan turunun sonu.",
      sources: {
        ...claudeSources([{ record: "subtype turn_duration olan bir system kaydı" }]),
        codex: [{ record: "task_complete türünde bir event_msg satırı" }],
      },
    },

    "tool.execution_start": {
      summary: "Model, adı ve argümanlarıyla yerleşik bir araç çağırdı.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `mcp__… adlı araçlar bunun yerine external_tool.requested olur. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "function_call, custom_tool_call veya local_shell_call türünde bir response_item",
            note: "JSON dizesi olarak yazılan argümanlar bir nesneye ayrıştırılır.",
          },
        ],
        copilot: [{ record: "tool.execution_start, yazıldığı gibi okunur" }],
        gemini: [{ record: "gemini türündeki bir mesajın toolCalls listesindeki her giriş" }],
      },
    },
    "tool.execution_complete": {
      summary: "Yerleşik bir araç çağrısı durumu ve sonucuyla tamamlandı.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Araç adı eşleşen çağrıdan gelir. Blokta içerik yoksa kaydın toolUseResult'ı kullanılır. is_error ayarlıysa success false olur.",
          },
        ]),
        codex: [
          {
            record: "function_call_output, custom_tool_call_output veya local_shell_call_output türünde bir response_item",
            note: "Codex başarı bayrağı kaydetmez; çıktı sıfır olmayan bir çıkış kodu bildirdiğinde uygulama çağrıyı başarısız olarak işaretler.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content sonuç metni olur, başarısız bir çağrıda error.message onun yerini alır ve detailedContent (genellikle bir diff) result.detail olur.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Model, harici bir köprünün (genellikle bir MCP sunucusu) sunduğu bir aracı çağırdı.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, mcp__… adlı bir araç için` }]),
        copilot: [{ record: "external_tool.requested, yazıldığı gibi okunur" }],
      },
    },
    "external_tool.completed": {
      summary: "Harici bir araç çağrısı durumu ve sonucuyla tamamlandı.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, mcp__… adlı bir araç için` }]),
        codex: [{ record: "mcp_tool_call_end türünde bir event_msg satırı" }],
        copilot: [{ record: "external_tool.completed", note: "tool.execution_complete ile aynı biçimde." }],
      },
    },

    "permission.requested": { summary: "Ortam, kullanıcıdan bir eylem için izin istedi (dosya, sistem veya ağ)." },
    "permission.completed": { summary: "İzin isteği sonuçlandı: onaylandı ya da reddedildi." },
    "hook.start": { summary: "Bir yaşam döngüsü hook'u başladı, örneğin istem gönderildiğinde." },
    "hook.end": {
      summary: "Bir yaşam döngüsü hook'u başarıyla ya da hatayla bitti.",
      sources: claudeSources([{ record: "subtype stop_hook_summary olan bir system kaydı", note: "Kayıt hook hatalarını listeliyorsa success false olur." }]),
    },

    "system.message": {
      summary: "Ortamın modelin önüne koyduğu talimatlar: sistem istemi, talimat dosyaları ya da eklenen bağlam.",
      detail: "Bunlar her istekle gönderilir, bu yüzden boyutları oturum boyunca birikir. Araç çubuğundaki anahtar bunları diğer eklenen bağlamla birlikte gizler.",
      sources: {
        ...claudeSources([
          { record: "prompt_snapshot türünde bir attachment kaydı", note: "Claude Code, sistem isteminin herhangi bir kısmı değiştiğinde onu yeniden kaydeder; uygulama onu yalnızca istem metninin kendisi değiştiğinde gösterir." },
          { record: "instructions türünde bir attachment kaydı (CLAUDE.md ve AGENTS.md dosyaları)" },
          { record: "Başka herhangi bir subtype'a sahip bir system kaydı" },
        ]),
        codex: [
          { record: "session_meta satırındaki base_instructions" },
          { record: "role developer veya system olan bir response_item mesajı" },
          { record: "Ortamın eklediği, role user olan bir response_item mesajı; role user_context olarak gösterilir" },
        ],
      },
    },
    "context.attachment": {
      summary: "Ortamın kendiliğinden eklediği bağlam: dosya anlık görüntüleri, hatırlatmalar, araç ya da skill listeleri, görseller.",
      changes: ["Her ek türü {label, subject, items, content} biçimine düzleştirilir; böylece ham JSON yerine içerik gibi okunur."],
      sources: {
        ...claudeSources([
          { record: "Bir attachment kaydı (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Bir prompt_snapshot ekinin araç listesi; değiştiğinde araç tanımları olarak gösterilir" },
          { record: "Bir user kaydındaki image bloğu", note: "Yalnızca bir görsel gönderildiği bilgisi tutulur; pikseller diskte kalır." },
        ]),
        codex: [{ record: "session_meta satırındaki dynamic_tools; araç tanımları olarak gösterilir" }],
      },
    },
    "system.notification": { summary: "Konuşmaya eklenen bir ortam bildirimi; örneğin arka plandaki bir kabuğun bitmesi." },

    "file.patch_applied": {
      summary: "Ajanın çalışma alanına uyguladığı bir yama ve dokunduğu dosyalar.",
      sources: { codex: [{ record: "patch_apply_end türünde bir event_msg satırı" }] },
    },
    "web.search": {
      summary: "Modelin yaptığı bir web araması; sonuçları bağlama eklenir.",
      sources: { codex: [{ record: "web_search_end türünde bir event_msg satırı" }] },
    },

    "subagent.deselected": { summary: "Alt ajan odağı kaldırıldı ve kontrol ana ajana döndü." },
    "subagent.activity": {
      summary: "Ana ajanın altında çalışan bir alt ajanın bildirdiği etkinlik.",
      sources: { codex: [{ record: "sub_agent_activity türünde bir event_msg satırı" }] },
    },
    "subagent.message": {
      summary: "Ajanlar arasında iletilen bir mesaj.",
      sources: { codex: [{ record: "Bir inter_agent_communication_metadata satırı" }] },
    },
    "subagent.session_start": {
      summary: "Bu oturumun içinde bir alt ajan iş parçacığı başladı.",
      sources: { codex: [{ record: "İlkinden sonraki bir session_meta satırı" }] },
    },
  },

  unknownSummary: "“{category}” kategorisinde (“{name}”) henüz açıklaması olmayan bir olay.",
  unknownCategory: "bilinmeyen",
  unknownName: "genel",
  unknownDetail:
    "Ajan, uygulamanın eşlemesi olmayan bir kayıt yazdı. Kayıt verileriyle yazıldığı gibi tutulur, böylece hiçbir şey kaybolmaz, ve genel kartla gösterilir.",

  callAndResult: "Bir çağrı ve sonucu, tek satır olarak gösterilir.",
  recordsInOrder: "Satırın okunduğu kayıtlar, döküm sırasıyla.",
  recordTitle: "{agent} kaydı",
  eventFormat: "Olay biçimi",
};
