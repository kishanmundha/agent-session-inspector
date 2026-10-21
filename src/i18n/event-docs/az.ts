import { claudeSources, type EventDocs } from "./en";

/** Azerbaijani. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Nəticə result.content daxilində sadə mətnə endirilir. Şəkillərdən yalnız növü və ölçüsü saxlanılır; piksellər diskdə qalır.",
  "Yığcam görünüşdə çağırış və onun nəticəsi bir sətir kimi göstərilir, ona görə Raw və Original iki qeyd göstərir.",
];

const CLAUDE_TOOL_USE = "message.content daxilində tool_use bloku olan assistant qeydi";
const CLAUDE_TOOL_RESULT =
  "tool_result bloku olan user qeydi, tool_use_id ilə öz çağırışına bağlanır";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code axınla gələn cavabın hər məzmun bloku üçün ayrıca qeyd yazır və cavabın istifadəsini hər birində təkrarlayır. İstifadə yalnız bir dəfə, cavabın ilk hadisəsində sayılır.";
const ARGUMENT_CHARS =
  "argumentChars əlavə olunur: arqumentlərin yazıldığı kimi ölçüsü, yəni kontekstdə onların dəyəri.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Qeydin növü: user, assistant, system, attachment, mode, …",
  subtype: "system qeydinin növü: api_error, compact_boundary, turn_duration, …",
  uuid: "Qeydin id-si.",
  parentUuid: "Söhbətdə bu qeydin ardınca gəldiyi qeyd.",
  isSidechain: "Əsas söhbət deyil, subagent tərəfindən yazılıb.",
  timestamp: "Nə vaxt yazıldığı, ISO 8601.",
  sessionId: "Qeydin aid olduğu sessiya; fork kopyalanmış qeydlərdə valideynin id-sini saxlayır.",
  cwd: "İş qovluğu.",
  gitBranch: "O andakı Git branch-ı.",
  version: "Qeydi yazan Claude Code versiyası.",
  entrypoint: "Claude Code harada işləyib: cli, claude-desktop, …",
  userType: "Sessiyanı kim idarə edir.",
  requestId: "API sorğusunun id-si.",
  promptId: "Qeydin aid olduğu prompt.",
  effort: "Sorğunun düşünmə səviyyəsi.",
  message: "Göndərildiyi və ya alındığı kimi API mesajı.",
  "message.role": "user və ya assistant.",
  "message.model": "Cavab verən model; Claude Code-un özünün yazdığı mesajlar üçün <synthetic>.",
  "message.id": "API mesajının id-si; axınla gələn bir cavabın bütün qeydləri üçün eynidir.",
  "message.type": "Həmişə message.",
  "message.content": "Sətir və ya məzmun bloklarının siyahısı.",
  "message.content[].type": "Blokun növü: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "text blokunun mətni.",
  "message.content[].thinking": "thinking blokunun düşüncəsi.",
  "message.content[].signature": "Düşüncəni API-yə geri göndərməyə imkan verən imza.",
  "message.content[].id": "tool_use blokunun id-si.",
  "message.content[].name": "tool_use blokunun çağırdığı alət.",
  "message.content[].input": "tool_use blokunun arqumentləri.",
  "message.content[].tool_use_id": "tool_result blokunun cavab verdiyi çağırış.",
  "message.content[].content": "Alətin qaytardığı.",
  "message.content[].is_error": "Alət uğursuzluq bildirib.",
  "message.stop_reason": "Cavabın niyə bitdiyi: end_turn, tool_use, max_tokens, …",
  "message.usage": "Bütün cavabın token istifadəsi, hər qeydində təkrarlanır.",
  "message.usage.input_tokens": "Keşdən oxunmayan və keşə yazılmayan giriş tokenləri.",
  "message.usage.output_tokens": "Çıxış tokenləri.",
  "message.usage.cache_read_input_tokens": "Keşdən oxunan giriş tokenləri.",
  "message.usage.cache_creation_input_tokens": "Keşə yazılan giriş tokenləri.",
  "message.usage.cache_creation": "Yaşama müddətinə görə bölünmüş keş yazıları.",
  "message.usage.speed": "Sorğu sürətli rejimdə işləyibsə fast.",
  toolUseResult: "Alət nəticəsinin Claude Code-un özünə məxsus strukturlaşdırılmış surəti.",
  attachment: "Claude Code-un əlavə etdiyi kontekst; növünü type göstərir.",
  "attachment.type": "Əlavənin növü: prompt_snapshot, instructions, file, date, …",
  content: "system qeydinin mətni.",
  level: "system qeydinin ciddilik səviyyəsi.",
  error: "api_error qeydinin xəta təfərrüatları.",
};

export const az: EventDocs = {
  providerFormats: {
    claude:
      "~/.claude/projects/<project>/<session>.jsonl altında JSONL: hər sətirdə bir JSON qeydi, növü user, assistant, system, attachment və s. Hər qeyd onu yazan Claude Code versiyasını daşıyır.",
    cowork:
      "Claude Code CLI hər Cowork sessiyasında işləyir və eyni JSONL transkripti yazır, ona görə də tam Claude Code kimi oxunur.",
    codex:
      "~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl altında JSONL: növü session_meta, event_msg, response_item, turn_context olan {timestamp, type, payload} sətirləri. CLI versiyasını yalnız session_meta göstərir.",
    copilot:
      "~/.copilot/session-state/<id>/events.jsonl altında JSONL, artıq bu tətbiqin istifadə etdiyi category.subCategory lüğətində {type, data, id, timestamp, parentId} kimi yazılıb. session.start format və CLI versiyasını göstərir.",
    vscode:
      "VS Code-un iş sahəsi yaddaşında söhbət sessiyası faylları (JSON və ya əlavə edilən dəyişikliklərin JSONL-i), hər girişdə bir sorğu/cavab cütü.",
    gemini:
      "~/.gemini/tmp/<project>/chats altında sessiya faylları. Hər mesajın növü user, gemini, info, warning və ya error-dur; yenidən yazılan mesaj əvvəlki versiyasını əvəz edir.",
    opencode:
      "SQLite (opencode.db): session, message və part sətirləri, hər biri məzmununu JSON sütununda saxlayır.",
    cursor:
      "~/.cursor/projects altında SQLite anbarları, söhbəti bubble sətirləri kimi saxlayır: 1 istifadəçi üçün, 2 agent üçün.",
    hermes: "~/.hermes altında SQLite (state.db): sessiyalar və onların mesajları sətir kimi.",
  },

  sharedChanges: [
    "Növ ortaq category.subCategory lüğətinə uyğun adlandırılır ki, bütün agentlərin hadisələri eyni oxunsun.",
    "Uzun mətn 20 000 simvolda kəsilir. charLength tam uzunluğu saxlayır, truncated isə kəsildiyini bildirir; orijinal qeyd kəsilmir.",
    "Bir qeyd bir neçə hadisəyə çevrilə bilər (mətn, düşüncə və alət çağırışları olan cavab), bəzi qeydlər isə xidməti olduğu üçün buraxılır.",
  ],

  fieldDocs: {
    content: "Mesajın mətni, 20 000 simvolla məhdudlaşdırılıb.",
    charLength: "Məhdudlaşdırılmadan əvvəl mətnin tam uzunluğu.",
    truncated: "Göstərilən mətn qısaldılıbsa true.",
    model: "Bunu yaradan model, agentin adlandırdığı kimi.",
    effort: "Sorğunun düşünmə səviyyəsi.",
    requestId: "Provayder jurnalları ilə tutuşdurmaq üçün API sorğusunun id-si.",
    role: "Mətnin mənbəyi: system_prompt, instructions, developer, user_context, …",
    toolName: "Modelin çağırdığı alət; MCP alətləri üçün mcp__server__tool.",
    toolCallId: "Çağırışı nəticəsi ilə bağlayan id.",
    arguments: "Modelin alətə ötürdüyü arqumentlər, JSON-a çevrilmiş.",
    argumentChars: "Modelin yazdığı kimi arqumentlərin ölçüsü, yəni kontekstdə onların dəyəri.",
    result: "Alətin qaytardığı, {content, format, images?, detail?} formasına salınıb.",
    resultChars: "Məhdudlaşdırılmadan əvvəl nəticənin tam uzunluğu.",
    success: "Çağırış uğursuzluq bildiribsə false.",
    inputTokens: "Sorğunun giriş tokenləri, keşə yazılanlar daxil.",
    outputTokens: "Cavabın çıxış tokenləri, düşüncə daxil.",
    cacheReadTokens: "Prompt keşindən verilən giriş tokenləri.",
    billedUsage: "Qiymətləndirmə qaydasına görə bölünmüş istifadə, xərc təxmini üçün.",
    costUSD: "Bu sorğunun API siyahı qiymətləri ilə təxmini xərci.",
    inherited: "Bu sessiyanın fork olunduğu sessiyadan kopyalanıb; xərci oraya aiddir.",
    durationMs: "Nə qədər çəkdiyi, millisaniyə ilə.",
    sessionId: "Sessiyanın id-si.",
    context: "Sessiyanın işlədiyi iş qovluğu, branch və repozitori.",
    attachmentType: "Agentin bu kontekst növü üçün öz adı.",
    label: "Əlavə növünün oxunaqlı adı.",
    subject: "Əlavənin mövzusu: fayl, tarix, hook…",
    items: "Əlavənin sadaladığı adlar (alətlər, skill-lər, agentlər), ən çoxu 200.",
    itemCount: "Əlavənin tam sadaladığı adların sayı.",
    itemsLabel: "Sadalanan adların nə olduğu.",
    message: "Xəta və ya bildiriş mətni.",
    reason: "Niyə baş verdiyi.",
    mode: "Keçid edilən rejim.",
    trigger: "Nəyin başlatdığı: manual və ya auto.",
    preTokens: "Sıxlaşdırmadan əvvəl kontekstin ölçüsü.",
    turnId: "Növbənin id-si.",
    totalCostUSD: "Agentin özünün indiyədək bildirdiyi sessiya xərci.",
    apiDurationMs: "İndiyədək API-ni gözləməyə sərf olunan ümumi vaxt.",
    premiumRequests: "İndiyədək sayılan premium sorğular.",
    sessionTotals: "Agentin bildirdiyi sessiya cəmləri, sessiya xülasəsi üçün istifadə olunur.",
    usage: "Agentin bildirdiyi kimi istifadə cəmləri.",
    selectedModel: "Sessiya başlayanda seçilən model.",
    copilotVersion: "Sessiyanı yazan agent CLI versiyası.",
    cliVersion: "Sessiyanı yazan agent CLI versiyası.",
    entrypoint: "Sessiyanın harada işlədiyi: cli, claude-desktop, …",
    forkedFrom: "Bu sessiyanın fork olunduğu sessiya.",
  },

  pathDocs: {
    type: "Hadisə növü, category.subCategory.",
    data: "Agentin qeyd etdiyi, dəyər olduğu yerdə normallaşdırılıb.",
    id: "Sessiya daxilində hadisənin unikal id-si.",
    timestamp: "Nə vaxt baş verdiyi, ISO 8601.",
    parentId: "Agent qeyd edibsə, bu hadisənin ardınca gəldiyi hadisə.",
    source: "Orijinal qeydin yeri: transkriptdəki sətri və ya agentin öz id-si.",
    category: "Növün ilk hissəsi, filtrlər üçün.",
    subCategory: "Növün qalan hissəsi, filtrlər üçün.",
    subKey: "Tam növ, filtrlər üçün.",
    "data.result.content": "Nəticənin sadə mətni, məhdudlaşdırılıb. JSON nəticələri girintilidir.",
    "data.result.format": "text və ya json.",
    "data.result.images": "Alətin qaytardığı şəkillər: yalnız növ və ölçü.",
    "data.result.detail": "Bəzi alətlərin əlavə etdiyi ikinci görünüş, adətən diff.",
    "data.context.cwd": "İş qovluğu.",
    "data.context.branch": "Git branch-ı.",
    "data.context.repository": "Git repozitorisi.",
    "data.billedUsage.model": "İstifadənin hansı modelin qiyməti ilə hesablandığı.",
    "data.billedUsage.inputTokens": "Keşdən oxunmayan və keşə yazılmayan giriş tokenləri.",
    "data.billedUsage.outputTokens": "Çıxış tokenləri.",
    "data.billedUsage.cacheReadTokens": "Keşdən oxunan giriş tokenləri.",
    "data.billedUsage.cacheWriteTokens": "5 dəqiqəlik keşə yazılan giriş tokenləri.",
    "data.billedUsage.cacheWrite1hTokens": "1 saatlıq keşə yazılan giriş tokenləri.",
    "data.billedUsage.fast": "Sürətli rejimdə işləyib, daha yüksək tariflə hesablanıb.",
    "data.billedUsage.local": "Heç nə ödənilməyən lokal modeldə işləyib.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Sətrin nə vaxt yazıldığı, ISO 8601.",
      ordinal: "Sətrin rollout-dakı mövqeyi.",
      type: "Sətrin növü: session_meta, event_msg, response_item, turn_context, …",
      payload: "Sətrin məzmunu; nə olduğunu öz type-ı göstərir.",
      "payload.type": "Payload növü: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Sessiyanın (session_meta) və ya elementin id-si.",
      "payload.cli_version": "Codex CLI versiyası, yalnız session_meta-da.",
      "payload.originator": "Codex-i işə salan tətbiq.",
      "payload.cwd": "İş qovluğu.",
      "payload.role": "Mesajın kimdən olduğu: user, assistant, developer, system.",
      "payload.content": "Mesajın məzmun hissələri.",
      "payload.content[].type": "Hissənin növü: input_text, output_text, …",
      "payload.content[].text": "Hissənin mətni.",
      "payload.message": "event_msg mesajının mətni.",
      "payload.call_id": "Alət çağırışını çıxışı ilə bağlayan id.",
      "payload.name": "Çağırılan alət.",
      "payload.arguments": "Alət arqumentləri, JSON sətri kimi.",
      "payload.input": "Xüsusi alət çağırışının girişi.",
      "payload.output": "Alətin qaytardığı.",
      "payload.status": "Çağırışın statusu.",
      "payload.turn_id": "Sətrin aid olduğu növbə.",
      "payload.info": "Token istifadəsi: məcmu cəmlər və son sorğununku.",
    },
    copilot: {
      type: "Hadisə növü, artıq category.subCategory formasında.",
      data: "Hadisə məlumatı.",
      id: "Hadisənin id-si.",
      timestamp: "Nə vaxt baş verdiyi, ISO 8601.",
      parentId: "Bu hadisənin ardınca gəldiyi hadisə.",
      "data.version": "events.jsonl formatının versiyası.",
      "data.copilotVersion": "Copilot CLI versiyası.",
      "data.producer": "Faylı nəyin yazdığı.",
      "data.toolCallId": "Çağırışı nəticəsi ilə bağlayan id.",
      "data.toolName": "Çağırılan alət.",
      "data.arguments": "Alət arqumentləri.",
      "data.result": "Alətin qaytardığı: content, alət əlavə edibsə detailedContent.",
      "data.error": "Uğursuz çağırışın niyə uğursuz olduğu.",
    },
  },

  events: {
    "session.start": {
      summary: "Sessiyanın başlanğıcı. Sessiya başlayanda iş mühitini və seçilən modeli qeyd edir.",
      sources: {
        ...claudeSources([
          {
            record: "Qeyd yoxdur: Claude Code başlanğıc qeydi yazmır",
            note: "Tətbiq onu transkript qeydlərinin cwd, gitBranch, version və entrypoint sahələrindən qurur ki, zaman xətti hər agent üçün eyni başlıqla açılsın.",
          },
        ]),
        codex: [{ record: "İlk session_meta sətri", note: "Sonrakı session_meta sətirləri subagent axınlarıdır və subagent.session_start olur." }],
        copilot: [{ record: "session.start, yazıldığı kimi oxunur" }],
      },
    },
    "session.resume": { summary: "Sessiya əvvəlki vəziyyətdən davam etdirildi. Kontekstin yenidən yüklənməsini və davamı göstərir." },
    "session.shutdown": {
      summary: "Sessiyanın yekun xülasəsi. Adətən istifadə, token cəmləri, premium sorğular və API vaxtını əhatə edir.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Tətbiq ondan sessionTotals və usageSummary çıxarır. Cəmlər məcmudur, ona görə yalnız sonuncu shutdown qiymətləndirilir və davam etdirilən sessiya iki dəfə sayılmır.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Avtomatik rejimdə model seçiminin nəticəsi. Gözlənilən tapşırıq profilini və seçilən model ayarlarını göstərir." },
    "session.binary_asset": { summary: "Sessiyada tutulan binar məlumat, adətən ekran görüntüləri. Çox kontekst və yaddaş tuta bilər." },
    "session.usage_checkpoint": {
      summary: "Sessiya aktiv olarkən aralıq istifadə hesabı.",
      sources: {
        ...claudeSources([{ record: "cost-state qeydi", note: "totalCostUSD və totalAPIDuration bildirildiyi kimi köçürülür." }]),
        codex: [
          {
            record: "token_count növlü event_msg sətri",
            note: "Codex məcmu cəmlər bildirir, ona görə tətbiq yalnız əvvəlki yoxlama nöqtəsindən bəri olan addımı hesablayır və keşlənmiş tokenləri input_tokens-dən çıxarır ki, hər biri bir dəfə qiymətləndirilsin.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Yalnız premium/AIU hesabı, token cəmləri yoxdur; premiumRequests totalPremiumRequests-dən köçürülür." }],
      },
    },
    "session.model_change": {
      summary: "Sessiya zamanı model konfiqurasiyası dəyişdi (model, səviyyə və ya kontekst pilləsi).",
      sources: { codex: [{ record: "thread_settings_applied növlü event_msg sətri" }] },
    },
    "session.compaction_start": {
      summary: "Kontekstin sıxlaşdırılması başladı. Hər sorğuda göndərilən tokenləri azaltmaq üçün söhbət xülasə edilir.",
      sources: claudeSources([{ record: "subtype compact_boundary olan system qeydi", note: "trigger və preTokens compactMetadata-dan götürülür." }]),
    },
    "session.compaction_complete": { summary: "Sıxlaşdırma bitdi, uğur və ya uğursuzluq metaməlumatı və sorğu id-ləri ilə." },
    "session.error": {
      summary: "API və ya ötürmə xətası. Hər təkrar cəhd bütün sorğu kontekstini yenidən göndərir.",
      sources: {
        ...claudeSources([{ record: "subtype api_error olan system qeydi" }]),
        gemini: [{ record: "error növlü mesaj" }],
      },
    },
    "session.turn_aborted": {
      summary: "Növbə tamamlanmadan dayandırıldı.",
      changes: ["Hər agent dayandırmanı fərqli qeyd edir; hamısı bu bir növə çevrilir."],
      sources: {
        ...claudeSources([
          {
            record: "Mətni “[Request interrupted by user” ilə başlayan user qeydi",
            note: "Claude Code dayandırmanı istifadəçi yazmış kimi qeyd edir; tətbiq onu prompt kimi göstərmir.",
          },
        ]),
        codex: [{ record: "turn_aborted növlü event_msg sətri" }],
        copilot: [{ record: "abort hadisəsi", note: "Adı dəyişdirilir; məlumat yazıldığı kimi saxlanılır." }],
      },
    },
    "session.mode_change": {
      summary: "Sessiya zamanı qarşılıqlı əlaqə və ya icazə rejimi dəyişdi.",
      sources: claudeSources([{ record: "mode və ya permission-mode qeydi" }]),
    },
    "session.turn_context": {
      summary: "Hər növbənin iş konfiqurasiyası: model, səviyyə, sandbox və təsdiq siyasəti.",
      sources: { codex: [{ record: "turn_context sətri" }] },
    },
    "session.world_state": {
      summary: "Mühitin modelə ötürdüyü iş sahəsinin anlıq görüntüsü.",
      sources: { codex: [{ record: "world_state sətri" }] },
    },
    "session.rollback": {
      summary: "Söhbət bir neçə növbə geri qaytarıldı.",
      sources: { codex: [{ record: "thread_rolled_back növlü event_msg sətri" }] },
    },
    "session.plan_changed": { summary: "Agent iş planını yaratdı və ya yenilədi." },
    "session.info": {
      summary: "Agentin göstərdiyi bildiriş: məlumat və ya xəbərdarlıq.",
      sources: { gemini: [{ record: "info və ya warning növlü mesaj" }] },
    },

    "user.message": {
      summary: "İstifadəçinin yazdığı. Assistentin növbəti növbəsini başladır.",
      sources: {
        ...claudeSources([
          {
            record: "user qeydi: sətir kimi message.content və ya onun içindəki hər text bloku",
            note: "Eyni qeyd növü alət nəticələrini də daşıyır, onlar tool.execution_complete olur.",
          },
        ]),
        codex: [
          { record: "user_message növlü event_msg sətri" },
          {
            record: "role user olan response_item mesajı, yalnız köhnə rollout-larda",
            note: "Yeni rollout-lar söhbəti iki dəfə saxlayır: event_msg (istifadəçinin gördüyü) və response_item (modelin gördüyü). Tətbiq növbələr ikiqat olmasın deyə event_msg-dən istifadə edir; response_item surəti system.message olur.",
          },
        ],
        copilot: [{ record: "user.message, yazıldığı kimi oxunur" }],
        gemini: [{ record: "user növlü mesaj" }],
      },
    },
    "assistant.message": {
      summary: "Modelin cavab olaraq yazdığı mətn, model adı və token istifadəsi ilə.",
      fields: {
        phase: "Codex: mesajın növbənin hansı hissəsinə aid olduğu.",
      },
      sources: {
        ...claudeSources([
          {
            record: "message.content daxilində text bloku olan assistant qeydi",
            note: `${CLAUDE_ASSISTANT_NOTE} Mətni, düşüncəsi və ya alət çağırışı olmayan cavab da boş mesaja çevrilir ki, istifadəsi sayılsın.`,
          },
        ]),
        codex: [
          { record: "agent_message növlü event_msg sətri" },
          { record: "role assistant olan response_item mesajı, yalnız event_msg surəti olmadıqda" },
        ],
        copilot: [{ record: "assistant.message, yazıldığı kimi oxunur" }],
        gemini: [{ record: "gemini növlü mesajın məzmunu" }],
      },
    },
    "assistant.thinking": {
      summary: "Modelin cavabdan əvvəl yaratdığı düşüncə. Çıxış tokenləri kimi hesablanır.",
      sources: {
        ...claudeSources([{ record: "thinking bloku olan assistant qeydi", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "agent_reasoning növlü event_msg sətri" },
          { record: "reasoning növlü response_item, onun summary-si ilə", note: "Yalnız şifrəli düşüncədə oxunaqlı heç nə yoxdur və o buraxılır." },
        ],
        gemini: [{ record: "gemini növlü mesajdakı thoughts-un hər girişi" }],
      },
    },
    "assistant.turn_start": {
      summary: "Assistentin bir növbəsinin başlanğıcı.",
      sources: { codex: [{ record: "task_started növlü event_msg sətri" }] },
    },
    "assistant.turn_end": {
      summary: "Düşüncə, alət çağırışları və çıxışdan sonra assistent növbəsinin sonu.",
      sources: {
        ...claudeSources([{ record: "subtype turn_duration olan system qeydi" }]),
        codex: [{ record: "task_complete növlü event_msg sətri" }],
      },
    },

    "tool.execution_start": {
      summary: "Model daxili aləti adı və arqumentləri ilə çağırdı.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `mcp__… adlı alətlər əvəzində external_tool.requested olur. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "function_call, custom_tool_call və ya local_shell_call növlü response_item",
            note: "JSON sətri kimi yazılmış arqumentlər obyektə çevrilir.",
          },
        ],
        copilot: [{ record: "tool.execution_start, yazıldığı kimi oxunur" }],
        gemini: [{ record: "gemini növlü mesajdakı toolCalls-un hər girişi" }],
      },
    },
    "tool.execution_complete": {
      summary: "Daxili alət çağırışı statusu və nəticəsi ilə bitdi.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Alətin adı uyğun çağırışdan götürülür. Blokda məzmun yoxdursa, qeydin toolUseResult-ı istifadə olunur. is_error qoyulubsa success false olur.",
          },
        ]),
        codex: [
          {
            record: "function_call_output, custom_tool_call_output və ya local_shell_call_output növlü response_item",
            note: "Codex uğur bayrağı yazmır; çıxış sıfırdan fərqli çıxış kodu bildirəndə tətbiq çağırışı uğursuz kimi işarələyir.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content nəticə mətni olur, uğursuz çağırışda onun yerini error.message tutur, detailedContent (adətən diff) isə result.detail olur.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Model xarici körpü, adətən MCP serveri tərəfindən təqdim olunan aləti çağırdı.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, mcp__… adlı alət üçün` }]),
        copilot: [{ record: "external_tool.requested, yazıldığı kimi oxunur" }],
      },
    },
    "external_tool.completed": {
      summary: "Xarici alət çağırışı statusu və nəticəsi ilə bitdi.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, mcp__… adlı alət üçün` }]),
        codex: [{ record: "mcp_tool_call_end növlü event_msg sətri" }],
        copilot: [{ record: "external_tool.completed", note: "tool.execution_complete kimi qurulub." }],
      },
    },

    "permission.requested": { summary: "Mühit istifadəçidən bir əməliyyat üçün icazə istədi (fayl, sistem və ya şəbəkə)." },
    "permission.completed": { summary: "İcazə sorğusu həll olundu: təsdiqləndi və ya rədd edildi." },
    "hook.start": { summary: "Həyat dövrü hook-u başladı, məsələn prompt göndəriləndə." },
    "hook.end": {
      summary: "Həyat dövrü hook-u uğurla və ya uğursuz bitdi.",
      sources: claudeSources([{ record: "subtype stop_hook_summary olan system qeydi", note: "Qeyd hook xətalarını sadalayırsa success false olur." }]),
    },

    "system.message": {
      summary: "Mühitin modelin qarşısına qoyduğu təlimatlar: sistem promptu, təlimat faylları və ya əlavə edilmiş kontekst.",
      detail: "Onlar hər sorğu ilə göndərilir, ona görə ölçüləri sessiya boyu toplanır. Alətlər panelindəki açar onları digər əlavə edilmiş kontekstlə birlikdə gizlədir.",
      sources: {
        ...claudeSources([
          { record: "prompt_snapshot növlü attachment qeydi", note: "Claude Code sistem promptunun hər hansı hissəsi dəyişəndə onu yenidən qeyd edir; tətbiq onu yalnız promptun mətni dəyişəndə göstərir." },
          { record: "instructions növlü attachment qeydi (CLAUDE.md və AGENTS.md faylları)" },
          { record: "Hər hansı başqa subtype-lı system qeydi" },
        ]),
        codex: [
          { record: "session_meta sətrindəki base_instructions" },
          { record: "role developer və ya system olan response_item mesajı" },
          { record: "Mühitin əlavə etdiyi role user olan response_item mesajı, role user_context kimi göstərilir" },
        ],
      },
    },
    "context.attachment": {
      summary: "Mühitin özünün əlavə etdiyi kontekst: fayl görüntüləri, xatırlatmalar, alət və ya skill siyahıları, şəkillər.",
      changes: ["Hər növ əlavə {label, subject, items, content} formasına salınır ki, xam JSON deyil, məzmun kimi oxunsun."],
      sources: {
        ...claudeSources([
          { record: "attachment qeydi (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "prompt_snapshot əlavəsinin alət siyahısı, dəyişəndə alət tərifləri kimi göstərilir" },
          { record: "user qeydindəki image bloku", note: "Yalnız şəkil göndərildiyi faktı saxlanılır; piksellər diskdə qalır." },
        ]),
        codex: [{ record: "session_meta sətrindəki dynamic_tools, alət tərifləri kimi göstərilir" }],
      },
    },
    "system.notification": { summary: "Söhbətə əlavə olunan mühit bildirişi, məsələn arxa fon shell-inin bitməsi." },

    "file.patch_applied": {
      summary: "Agentin iş sahəsinə tətbiq etdiyi patch, toxunduğu fayllarla.",
      sources: { codex: [{ record: "patch_apply_end növlü event_msg sətri" }] },
    },
    "web.search": {
      summary: "Modelin apardığı veb axtarış; nəticələri kontekstə əlavə olunur.",
      sources: { codex: [{ record: "web_search_end növlü event_msg sətri" }] },
    },

    "subagent.deselected": { summary: "Subagent fokusu təmizləndi və idarə əsas agentə qayıtdı." },
    "subagent.activity": {
      summary: "Əsas agentin altında işləyən subagentin bildirdiyi fəaliyyət.",
      sources: { codex: [{ record: "sub_agent_activity növlü event_msg sətri" }] },
    },
    "subagent.message": {
      summary: "Agentlər arasında ötürülən mesaj.",
      sources: { codex: [{ record: "inter_agent_communication_metadata sətri" }] },
    },
    "subagent.session_start": {
      summary: "Bu sessiyada subagent axını başladı.",
      sources: { codex: [{ record: "Birincidən sonrakı session_meta sətri" }] },
    },
  },

  unknownSummary: "“{category}” kateqoriyasında (“{name}”) hələ təsviri olmayan hadisə.",
  unknownCategory: "naməlum",
  unknownName: "ümumi",
  unknownDetail:
    "Agent tətbiqin uyğunluğu olmayan bir qeyd yazıb. O, məlumatları ilə yazıldığı kimi saxlanılır, heç nə itmir və ümumi kartla göstərilir.",

  callAndResult: "Çağırış və onun nəticəsi, bir sətir kimi göstərilir.",
  recordsInOrder: "Sətrin oxunduğu qeydlər, transkript ardıcıllığı ilə.",
  recordTitle: "{agent} qeydi",
  eventFormat: "Hadisə formatı",
};
