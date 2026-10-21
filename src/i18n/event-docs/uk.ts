import { claudeSources, type EventDocs } from "./en";

/** Ukrainian. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Результат зводиться до простого тексту в result.content. Зображення зберігають лише тип і розмір; пікселі лишаються на диску.",
  "У компактному вигляді виклик і його результат показано одним рядком, тож Raw і Original показують два записи.",
];

const CLAUDE_TOOL_USE = "Запис assistant із блоком tool_use в message.content";
const CLAUDE_TOOL_RESULT =
  "Запис user із блоком tool_result, зіставлений зі своїм викликом за tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code пише по одному запису на кожен блок вмісту потокової відповіді й повторяє в кожному використання відповіді. Використання враховується один раз, на першій події відповіді.";
const ARGUMENT_CHARS =
  "Додається argumentChars: розмір аргументів у записаному вигляді — те, скільки вони коштують у контексті.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Вид запису: user, assistant, system, attachment, mode, …",
  subtype: "Вид запису system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id запису.",
  parentUuid: "Запис, за яким цей іде в розмові.",
  isSidechain: "Написано субагентом, а не основною розмовою.",
  timestamp: "Коли записано, ISO 8601.",
  sessionId: "Сесія, до якої належить запис; форк зберігає id батьківської сесії в скопійованих записах.",
  cwd: "Робочий каталог.",
  gitBranch: "Гілка Git на той момент.",
  version: "Версія Claude Code, що зробила запис.",
  entrypoint: "Де працював Claude Code: cli, claude-desktop, …",
  userType: "Хто керує сесією.",
  requestId: "Id запиту до API.",
  promptId: "Промпт, до якого належить запис.",
  effort: "Рівень міркувань запиту.",
  message: "Повідомлення API в тому вигляді, в якому його надіслано чи отримано.",
  "message.role": "user або assistant.",
  "message.model": "Модель, що відповіла; <synthetic> для повідомлень, написаних самим Claude Code.",
  "message.id": "Id повідомлення API; спільний для всіх записів однієї потокової відповіді.",
  "message.type": "Завжди message.",
  "message.content": "Рядок або список блоків вмісту.",
  "message.content[].type": "Вид блоку: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Текст блоку text.",
  "message.content[].thinking": "Міркування блоку thinking.",
  "message.content[].signature": "Підпис, що дає змогу надіслати міркування назад до API.",
  "message.content[].id": "Id блоку tool_use.",
  "message.content[].name": "Інструмент, який викликає блок tool_use.",
  "message.content[].input": "Аргументи блоку tool_use.",
  "message.content[].tool_use_id": "Виклик, на який відповідає блок tool_result.",
  "message.content[].content": "Що повернув інструмент.",
  "message.content[].is_error": "Інструмент повідомив про помилку.",
  "message.stop_reason": "Чому відповідь завершилася: end_turn, tool_use, max_tokens, …",
  "message.usage": "Використання токенів усією відповіддю, повторюється в кожному її записі.",
  "message.usage.input_tokens": "Вхідні токени, не прочитані з кешу й не записані в нього.",
  "message.usage.output_tokens": "Вихідні токени.",
  "message.usage.cache_read_input_tokens": "Вхідні токени, прочитані з кешу.",
  "message.usage.cache_creation_input_tokens": "Вхідні токени, записані в кеш.",
  "message.usage.cache_creation": "Записи в кеш із розбивкою за часом життя.",
  "message.usage.speed": "fast, якщо запит виконувався у швидкому режимі.",
  toolUseResult: "Власна структурована копія результату інструмента від Claude Code.",
  attachment: "Контекст, доданий Claude Code; його type каже, який саме.",
  "attachment.type": "Вид вкладення: prompt_snapshot, instructions, file, date, …",
  content: "Текст запису system.",
  level: "Важливість запису system.",
  error: "Подробиці помилки запису api_error.",
};

export const uk: EventDocs = {
  providerFormats: {
    claude:
      "JSONL у ~/.claude/projects/<project>/<session>.jsonl: один JSON-запис на рядок, з типами user, assistant, system, attachment тощо. Кожен запис містить версію Claude Code, яка його зробила.",
    cowork:
      "CLI Claude Code працює всередині кожної сесії Cowork і пише таку саму JSONL-транскрипцію, тож вона читається точно як Claude Code.",
    codex:
      "JSONL у ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: рядки {timestamp, type, payload} з типами session_meta, event_msg, response_item, turn_context. Версію CLI вказує лише session_meta.",
    copilot:
      "JSONL у ~/.copilot/session-state/<id>/events.jsonl, уже записаний як {type, data, id, timestamp, parentId} у тому самому словнику category.subCategory, що й у цьому застосунку. session.start вказує версію формату та версію CLI.",
    vscode:
      "Файли сесій чату (JSON або JSONL із дописаними змінами) у сховищі робочої області VS Code, одна пара запит/відповідь на запис.",
    gemini:
      "Файли сесій у ~/.gemini/tmp/<project>/chats. Кожне повідомлення має тип user, gemini, info, warning або error; повідомлення, записане повторно, замінює свою попередню версію.",
    opencode:
      "SQLite (opencode.db): рядки session, message і part, кожен зберігає вміст у JSON-стовпці.",
    cursor:
      "Сховища SQLite у ~/.cursor/projects, де розмова зберігається рядками bubble: 1 — користувач, 2 — агент.",
    hermes: "SQLite (state.db) у ~/.hermes: сесії та їхні повідомлення у вигляді рядків.",
  },

  sharedChanges: [
    "Тип перейменовується в спільний словник category.subCategory, щоб події всіх агентів читалися однаково.",
    "Довгий текст обрізається до 20 000 символів. charLength зберігає повну довжину, а truncated повідомляє про обрізання; оригінальний запис не обрізається.",
    "Один запис може стати кількома подіями (відповідь із текстом, міркуванням і викликами інструментів), а деякі службові записи пропускаються.",
  ],

  fieldDocs: {
    content: "Текст повідомлення, не довший за 20 000 символів.",
    charLength: "Повна довжина тексту до обмеження.",
    truncated: "True, якщо показаний текст обрізано.",
    model: "Модель, що створила це, під назвою, яку дав агент.",
    effort: "Рівень міркувань, з яким виконувався запит.",
    requestId: "Id запиту до API, для звірки з журналами провайдера.",
    role: "Звідки текст: system_prompt, instructions, developer, user_context, …",
    toolName: "Інструмент, викликаний моделлю; mcp__server__tool для інструментів MCP.",
    toolCallId: "Id, що пов'язує виклик із його результатом.",
    arguments: "Аргументи, передані моделлю інструменту, розібрані в JSON.",
    argumentChars: "Розмір аргументів у тому вигляді, як їх написала модель, — те, скільки вони коштують у контексті.",
    result: "Що повернув інструмент, зведене до {content, format, images?, detail?}.",
    resultChars: "Повна довжина результату до обмеження.",
    success: "False, якщо виклик повідомив про помилку.",
    inputTokens: "Вхідні токени запиту, включно із записаними в кеш.",
    outputTokens: "Вихідні токени відповіді, включно з міркуваннями.",
    cacheReadTokens: "Вхідні токени, отримані з кешу промптів.",
    billedUsage: "Використання з розбивкою за тарифами; основа оцінки вартості.",
    costUSD: "Оцінка вартості цього запиту за прайсом API.",
    inherited: "Скопійовано із сесії, від якої відгалужено цю; вартість належить туди.",
    durationMs: "Скільки це тривало, у мілісекундах.",
    sessionId: "Id сесії.",
    context: "Робочий каталог, гілка й репозиторій, у яких працювала сесія.",
    attachmentType: "Власна назва агента для цього виду контексту.",
    label: "Зрозуміла назва виду вкладення.",
    subject: "Чого стосується вкладення: файлу, дати, хука…",
    items: "Назви, перелічені у вкладенні (інструменти, навички, агенти), не більше 200.",
    itemCount: "Скільки назв вкладення перелічило повністю.",
    itemsLabel: "Що це за перелічені назви.",
    message: "Текст помилки чи сповіщення.",
    reason: "Чому це сталося.",
    mode: "Режим, на який перемкнулися.",
    trigger: "Що це запустило: manual або auto.",
    preTokens: "Розмір контексту до стиснення.",
    turnId: "Id ходу.",
    totalCostUSD: "Вартість сесії на цей момент за даними самого агента.",
    apiDurationMs: "Загальний час очікування API на цей момент.",
    premiumRequests: "Преміум-запити, враховані на цей момент.",
    sessionTotals: "Підсумки сесії, повідомлені агентом; використовуються в зведенні сесії.",
    usage: "Підсумки використання в тому вигляді, як їх повідомив агент.",
    selectedModel: "Модель, обрана на початку сесії.",
    copilotVersion: "Версія CLI агента, що записала сесію.",
    cliVersion: "Версія CLI агента, що записала сесію.",
    entrypoint: "Де працювала сесія: cli, claude-desktop, …",
    forkedFrom: "Сесія, від якої відгалужено цю.",
  },

  pathDocs: {
    type: "Тип події, category.subCategory.",
    data: "Що записав агент, нормалізоване там, де це має сенс.",
    id: "Унікальний id події в сесії.",
    timestamp: "Коли це сталося, ISO 8601.",
    parentId: "Подія, з якої випливає ця, якщо агент її записує.",
    source: "Де лежить оригінальний запис: його рядок у транскрипції або власний id агента.",
    category: "Перша частина типу, використовується фільтрами.",
    subCategory: "Решта типу, використовується фільтрами.",
    subKey: "Повний тип, використовується фільтрами.",
    "data.result.content": "Простий текст результату, з обмеженням. JSON-результати виводяться з відступами.",
    "data.result.format": "text або json.",
    "data.result.images": "Зображення, повернуті інструментом: лише тип і розмір.",
    "data.result.detail": "Друге подання, яке додають деякі інструменти, зазвичай diff.",
    "data.context.cwd": "Робочий каталог.",
    "data.context.branch": "Гілка Git.",
    "data.context.repository": "Репозиторій Git.",
    "data.billedUsage.model": "Модель, за тарифом якої рахується використання.",
    "data.billedUsage.inputTokens": "Вхідні токени, не прочитані з кешу й не записані в нього.",
    "data.billedUsage.outputTokens": "Вихідні токени.",
    "data.billedUsage.cacheReadTokens": "Вхідні токени, прочитані з кешу.",
    "data.billedUsage.cacheWriteTokens": "Вхідні токени, записані в 5-хвилинний кеш.",
    "data.billedUsage.cacheWrite1hTokens": "Вхідні токени, записані в годинний кеш.",
    "data.billedUsage.fast": "Виконано у швидкому режимі, за підвищеним тарифом.",
    "data.billedUsage.local": "Виконано на локальній моделі, яка нічого не коштує.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Коли записано рядок, ISO 8601.",
      ordinal: "Позиція рядка в rollout.",
      type: "Вид рядка: session_meta, event_msg, response_item, turn_context, …",
      payload: "Вміст рядка; його власний type каже, що це.",
      "payload.type": "Вид payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id сесії (session_meta) або елемента.",
      "payload.cli_version": "Версія Codex CLI, лише в session_meta.",
      "payload.originator": "Застосунок, що запустив Codex.",
      "payload.cwd": "Робочий каталог.",
      "payload.role": "Від кого повідомлення: user, assistant, developer, system.",
      "payload.content": "Частини вмісту повідомлення.",
      "payload.content[].type": "Вид частини: input_text, output_text, …",
      "payload.content[].text": "Текст частини.",
      "payload.message": "Текст повідомлення event_msg.",
      "payload.call_id": "Id, що пов'язує виклик інструмента з його виводом.",
      "payload.name": "Викликаний інструмент.",
      "payload.arguments": "Аргументи інструмента у вигляді JSON-рядка.",
      "payload.input": "Вхідні дані виклику користувацького інструмента.",
      "payload.output": "Що повернув інструмент.",
      "payload.status": "Статус виклику.",
      "payload.turn_id": "Хід, до якого належить рядок.",
      "payload.info": "Використання токенів: накопичувальні підсумки й дані останнього запиту.",
    },
    copilot: {
      type: "Тип події, уже у вигляді category.subCategory.",
      data: "Дані події.",
      id: "Id події.",
      timestamp: "Коли це сталося, ISO 8601.",
      parentId: "Подія, з якої випливає ця.",
      "data.version": "Версія формату events.jsonl.",
      "data.copilotVersion": "Версія Copilot CLI.",
      "data.producer": "Що записало файл.",
      "data.toolCallId": "Id, що пов'язує виклик із його результатом.",
      "data.toolName": "Викликаний інструмент.",
      "data.arguments": "Аргументи інструмента.",
      "data.result": "Що повернув інструмент: content і detailedContent, якщо інструмент його додає.",
      "data.error": "Чому невдалий виклик завершився помилкою.",
    },
  },

  events: {
    "session.start": {
      summary: "Ініціалізація сесії. Фіксує середовище виконання й обрану модель на початку сесії.",
      sources: {
        ...claudeSources([
          {
            record: "Запису немає: Claude Code не пише стартовий запис",
            note: "Застосунок збирає його з полів cwd, gitBranch, version і entrypoint записів транскрипції, щоб стрічка в кожного агента починалася з однакового заголовка.",
          },
        ]),
        codex: [{ record: "Перший рядок session_meta", note: "Наступні рядки session_meta — це потоки субагентів, вони стають subagent.session_start." }],
        copilot: [{ record: "session.start, читається як записано" }],
      },
    },
    "session.resume": { summary: "Сесію відновлено з попереднього стану. Означає перезавантаження контексту й продовження." },
    "session.shutdown": {
      summary: "Підсумки завершення сесії. Зазвичай містять використання, суми токенів, преміум-запити й час API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Застосунок виводить із нього sessionTotals і usageSummary. Підсумки накопичувальні, тож оцінюється лише останній shutdown, а відновлена сесія не рахується двічі.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Результат вибору моделі в автоматичному режимі. Показує передбачений профіль задачі й обрані налаштування моделі." },
    "session.binary_asset": { summary: "Двійкові дані, захоплені в сесії, зазвичай знімки екрана. Можуть займати багато контексту й місця." },
    "session.usage_checkpoint": {
      summary: "Проміжний облік використання, поки сесія активна.",
      sources: {
        ...claudeSources([{ record: "Запис cost-state", note: "totalCostUSD і totalAPIDuration копіюються як повідомлено." }]),
        codex: [
          {
            record: "Рядок event_msg з типом token_count",
            note: "Codex повідомляє накопичувальні підсумки, тож застосунок враховує лише приріст від попередньої контрольної точки й виносить кешовані токени з input_tokens, щоб кожен оцінювався один раз.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Лише облік преміум/AIU, без сум токенів; premiumRequests копіюється з totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Під час сесії змінилася конфігурація моделі (модель, рівень міркувань або рівень контексту).",
      sources: { codex: [{ record: "Рядок event_msg з типом thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Почалося стиснення контексту. Розмову стисло переказують, щоб зменшити кількість токенів у кожному запиті.",
      sources: claudeSources([{ record: "Запис system із subtype compact_boundary", note: "trigger і preTokens беруться з compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Стиснення завершено, з метаданими про успіх чи помилку та id запитів." },
    "session.error": {
      summary: "Помилка API або транспорту. Кожна повторна спроба наново надсилає весь контекст запиту.",
      sources: {
        ...claudeSources([{ record: "Запис system із subtype api_error" }]),
        gemini: [{ record: "Повідомлення з типом error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Хід перервано, перш ніж він завершився.",
      changes: ["Кожен агент позначає переривання по-своєму; усі вони стають цим одним типом."],
      sources: {
        ...claudeSources([
          {
            record: "Запис user, текст якого починається з «[Request interrupted by user»",
            note: "Claude Code записує переривання так, ніби його ввів користувач; застосунок не показує його як промпт.",
          },
        ]),
        codex: [{ record: "Рядок event_msg з типом turn_aborted" }],
        copilot: [{ record: "Подія abort", note: "Перейменовано; дані збережено як записано." }],
      },
    },
    "session.mode_change": {
      summary: "Під час сесії змінився режим взаємодії або дозволів.",
      sources: claudeSources([{ record: "Запис mode або permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Конфігурація виконання на хід: модель, рівень міркувань, пісочниця й політика підтверджень.",
      sources: { codex: [{ record: "Рядок turn_context" }] },
    },
    "session.world_state": {
      summary: "Знімок робочої області, переданий моделі середовищем виконання.",
      sources: { codex: [{ record: "Рядок world_state" }] },
    },
    "session.rollback": {
      summary: "Розмову відкотили на кілька ходів.",
      sources: { codex: [{ record: "Рядок event_msg з типом thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Агент створив або оновив робочий план." },
    "session.info": {
      summary: "Сповіщення, виведене агентом: інформація або попередження.",
      sources: { gemini: [{ record: "Повідомлення з типом info або warning" }] },
    },

    "user.message": {
      summary: "Те, що ввів користувач. Запускає наступний хід асистента.",
      sources: {
        ...claudeSources([
          {
            record: "Запис user: message.content у вигляді рядка або кожен блок text у ньому",
            note: "Той самий вид запису переносить і результати інструментів, які стають tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Рядок event_msg з типом user_message" },
          {
            record: "Повідомлення response_item з role user, лише в старих rollout",
            note: "Нові rollout містять розмову двічі: як event_msg (що бачив користувач) і як response_item (що бачила модель). Застосунок використовує event_msg, щоб ходи не подвоювалися; копія response_item стає system.message.",
          },
        ],
        copilot: [{ record: "user.message, читається як записано" }],
        gemini: [{ record: "Повідомлення з типом user" }],
      },
    },
    "assistant.message": {
      summary: "Текст відповіді моделі, з назвою моделі й використанням токенів.",
      fields: {
        phase: "Codex: до якої частини ходу належить повідомлення.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Запис assistant із блоком text в message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Відповідь без тексту, міркування й виклику інструмента все одно стає порожнім повідомленням, щоб її використання було враховано.`,
          },
        ]),
        codex: [
          { record: "Рядок event_msg з типом agent_message" },
          { record: "Повідомлення response_item з role assistant, лише якщо немає копії event_msg" },
        ],
        copilot: [{ record: "assistant.message, читається як записано" }],
        gemini: [{ record: "Вміст повідомлення з типом gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Міркування, яке модель видала перед відповіддю. Оплачується як вихідні токени.",
      sources: {
        ...claudeSources([{ record: "Запис assistant із блоком thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Рядок event_msg з типом agent_reasoning" },
          { record: "response_item з типом reasoning, за його summary", note: "Лише зашифроване міркування не містить нічого читабельного й пропускається." },
        ],
        gemini: [{ record: "Кожен запис thoughts у повідомленні з типом gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Початок одного ходу асистента.",
      sources: { codex: [{ record: "Рядок event_msg з типом task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Кінець ходу асистента після міркування, викликів інструментів і виводу.",
      sources: {
        ...claudeSources([{ record: "Запис system із subtype turn_duration" }]),
        codex: [{ record: "Рядок event_msg з типом task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Модель викликала вбудований інструмент, з його назвою й аргументами.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Інструменти з назвою mcp__… натомість стають external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "response_item з типом function_call, custom_tool_call або local_shell_call",
            note: "Аргументи, записані JSON-рядком, розбираються в об'єкт.",
          },
        ],
        copilot: [{ record: "tool.execution_start, читається як записано" }],
        gemini: [{ record: "Кожен запис toolCalls у повідомленні з типом gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Виклик вбудованого інструмента завершено, з його статусом і результатом.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Назва інструмента береться з відповідного виклику. Якщо в блоці немає вмісту, використовується toolUseResult запису. success дорівнює false, якщо задано is_error.",
          },
        ]),
        codex: [
          {
            record: "response_item з типом function_call_output, custom_tool_call_output або local_shell_call_output",
            note: "Codex не записує ознаку успіху; застосунок позначає виклик як невдалий, якщо його вивід повідомляє ненульовий код виходу.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content стає текстом результату, у невдалого виклику його замінює error.message, а detailedContent (зазвичай diff) стає result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Модель викликала інструмент, який надає зовнішній міст, зазвичай сервер MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, для інструмента з назвою mcp__…` }]),
        copilot: [{ record: "external_tool.requested, читається як записано" }],
      },
    },
    "external_tool.completed": {
      summary: "Виклик зовнішнього інструмента завершено, з його статусом і результатом.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, для інструмента з назвою mcp__…` }]),
        codex: [{ record: "Рядок event_msg з типом mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Має таку саму будову, як tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Середовище виконання попросило в користувача дозвіл на дію (файл, система чи мережа)." },
    "permission.completed": { summary: "Запит дозволу вирішено: схвалено або відхилено." },
    "hook.start": { summary: "Запущено хук життєвого циклу, наприклад під час надсилання промпту." },
    "hook.end": {
      summary: "Хук життєвого циклу завершився успіхом або помилкою.",
      sources: claudeSources([{ record: "Запис system із subtype stop_hook_summary", note: "success дорівнює false, якщо запис перелічує помилки хуків." }]),
    },

    "system.message": {
      summary: "Інструкції, які середовище виконання поставило перед моделлю: системний промпт, файли інструкцій або впроваджений контекст.",
      detail: "Вони надсилаються з кожним запитом, тож їхній розмір накопичується за сесію. Перемикач на панелі інструментів приховує їх разом з іншим впровадженим контекстом.",
      sources: {
        ...claudeSources([
          { record: "Запис attachment з типом prompt_snapshot", note: "Claude Code наново записує системний промпт за зміни будь-якої його частини; застосунок показує його, лише коли змінився сам текст промпту." },
          { record: "Запис attachment з типом instructions (файли CLAUDE.md і AGENTS.md)" },
          { record: "Запис system з будь-яким іншим subtype" },
        ]),
        codex: [
          { record: "base_instructions у рядку session_meta" },
          { record: "Повідомлення response_item з role developer або system" },
          { record: "Повідомлення response_item з role user, впроваджене середовищем виконання, показується як role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Контекст, доданий самим середовищем виконання: знімки файлів, нагадування, списки інструментів чи навичок, зображення.",
      changes: ["Будь-яке вкладення зводиться до {label, subject, items, content}, щоб читатися як вміст, а не як сирий JSON."],
      sources: {
        ...claudeSources([
          { record: "Запис attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Список інструментів вкладення prompt_snapshot, показується як визначення інструментів у разі змін" },
          { record: "Блок image у записі user", note: "Зберігається лише факт надсилання зображення; пікселі лишаються на диску." },
        ]),
        codex: [{ record: "dynamic_tools у рядку session_meta, показується як визначення інструментів" }],
      },
    },
    "system.notification": { summary: "Сповіщення середовища виконання, додане до розмови, наприклад про завершення фонової оболонки." },

    "file.patch_applied": {
      summary: "Патч, застосований агентом до робочої області, із зачепленими файлами.",
      sources: { codex: [{ record: "Рядок event_msg з типом patch_apply_end" }] },
    },
    "web.search": {
      summary: "Вебпошук, виконаний моделлю; його результати додаються до контексту.",
      sources: { codex: [{ record: "Рядок event_msg з типом web_search_end" }] },
    },

    "subagent.deselected": { summary: "Фокус субагента знято, керування повернулося основному агенту." },
    "subagent.activity": {
      summary: "Активність, про яку повідомив субагент, що працює під основним агентом.",
      sources: { codex: [{ record: "Рядок event_msg з типом sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Повідомлення, передане між агентами.",
      sources: { codex: [{ record: "Рядок inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "У цій сесії запущено потік субагента.",
      sources: { codex: [{ record: "Рядок session_meta після першого" }] },
    },
  },

  unknownSummary: "Подія категорії «{category}» («{name}»), для якої ще немає опису.",
  unknownCategory: "невідома",
  unknownName: "загальне",
  unknownDetail:
    "Агент записав запис, для якого в застосунку немає зіставлення. Він зберігається з даними як записано, тож нічого не втрачається, і показується через загальну картку.",

  callAndResult: "Виклик і його результат, показані одним рядком.",
  recordsInOrder: "Записи, з яких прочитано рядок, у порядку транскрипції.",
  recordTitle: "Запис {agent}",
  eventFormat: "Формат подій",
};
