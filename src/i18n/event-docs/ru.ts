import { claudeSources, type EventDocs } from "./en";

/** Russian. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Результат сводится к простому тексту в result.content. У изображений остаются только тип и размер; пиксели остаются на диске.",
  "В компактном виде вызов и его результат показаны одной строкой, поэтому Raw и Original показывают две записи.",
];

const CLAUDE_TOOL_USE = "Запись assistant с блоком tool_use в message.content";
const CLAUDE_TOOL_RESULT =
  "Запись user с блоком tool_result, сопоставленная со своим вызовом по tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code пишет по одной записи на каждый блок содержимого потокового ответа и повторяет в каждой использование ответа. Использование учитывается один раз, на первом событии ответа.";
const ARGUMENT_CHARS =
  "Добавляется argumentChars: размер аргументов в том виде, в каком они записаны, — то, во что они обходятся в контексте.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Вид записи: user, assistant, system, attachment, mode, …",
  subtype: "Вид записи system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id записи.",
  parentUuid: "Запись, за которой эта следует в разговоре.",
  isSidechain: "Написано субагентом, а не основным разговором.",
  timestamp: "Когда записано, ISO 8601.",
  sessionId: "Сессия, к которой относится запись; форк сохраняет id родителя в скопированных записях.",
  cwd: "Рабочий каталог.",
  gitBranch: "Ветка Git в тот момент.",
  version: "Версия Claude Code, записавшая запись.",
  entrypoint: "Где работал Claude Code: cli, claude-desktop, …",
  userType: "Кто управляет сессией.",
  requestId: "Id запроса к API.",
  promptId: "Промпт, к которому относится запись.",
  effort: "Уровень рассуждений запроса.",
  message: "Сообщение API в том виде, в каком оно отправлено или получено.",
  "message.role": "user или assistant.",
  "message.model": "Ответившая модель; <synthetic> для сообщений, написанных самим Claude Code.",
  "message.id": "Id сообщения API; общий для всех записей одного потокового ответа.",
  "message.type": "Всегда message.",
  "message.content": "Строка или список блоков содержимого.",
  "message.content[].type": "Вид блока: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Текст блока text.",
  "message.content[].thinking": "Рассуждение блока thinking.",
  "message.content[].signature": "Подпись, позволяющая отправить рассуждение обратно в API.",
  "message.content[].id": "Id блока tool_use.",
  "message.content[].name": "Инструмент, который вызывает блок tool_use.",
  "message.content[].input": "Аргументы блока tool_use.",
  "message.content[].tool_use_id": "Вызов, на который отвечает блок tool_result.",
  "message.content[].content": "Что вернул инструмент.",
  "message.content[].is_error": "Инструмент сообщил об ошибке.",
  "message.stop_reason": "Почему ответ закончился: end_turn, tool_use, max_tokens, …",
  "message.usage": "Использование токенов всем ответом, повторяется в каждой его записи.",
  "message.usage.input_tokens": "Входные токены, не прочитанные из кэша и не записанные в него.",
  "message.usage.output_tokens": "Выходные токены.",
  "message.usage.cache_read_input_tokens": "Входные токены, прочитанные из кэша.",
  "message.usage.cache_creation_input_tokens": "Входные токены, записанные в кэш.",
  "message.usage.cache_creation": "Записи в кэш с разбивкой по времени жизни.",
  "message.usage.speed": "fast, если запрос выполнялся в быстром режиме.",
  toolUseResult: "Собственная структурированная копия результата инструмента от Claude Code.",
  attachment: "Контекст, добавленный Claude Code; его type говорит, какой именно.",
  "attachment.type": "Вид вложения: prompt_snapshot, instructions, file, date, …",
  content: "Текст записи system.",
  level: "Важность записи system.",
  error: "Подробности ошибки записи api_error.",
};

export const ru: EventDocs = {
  providerFormats: {
    claude:
      "JSONL в ~/.claude/projects/<project>/<session>.jsonl: одна JSON-запись на строку, с типами user, assistant, system, attachment и т. д. Каждая запись содержит версию Claude Code, которая её записала.",
    cowork:
      "CLI Claude Code работает внутри каждой сессии Cowork и пишет такую же JSONL-транскрипцию, поэтому она читается в точности как Claude Code.",
    codex:
      "JSONL в ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: строки {timestamp, type, payload} с типами session_meta, event_msg, response_item, turn_context. Версию CLI указывает только session_meta.",
    copilot:
      "JSONL в ~/.copilot/session-state/<id>/events.jsonl, уже записанный как {type, data, id, timestamp, parentId} в том же словаре category.subCategory, что использует это приложение. session.start указывает версию формата и версию CLI.",
    vscode:
      "Файлы сессий чата (JSON или JSONL с дописываемыми изменениями) в хранилище рабочей области VS Code, одна пара запрос/ответ на запись.",
    gemini:
      "Файлы сессий в ~/.gemini/tmp/<project>/chats. Каждое сообщение имеет тип user, gemini, info, warning или error; сообщение, записанное повторно, заменяет свою прежнюю версию.",
    opencode:
      "SQLite (opencode.db): строки session, message и part, каждая хранит содержимое в JSON-столбце.",
    cursor:
      "Хранилища SQLite в ~/.cursor/projects, где разговор хранится строками bubble: 1 — пользователь, 2 — агент.",
    hermes: "SQLite (state.db) в ~/.hermes: сессии и их сообщения в виде строк.",
  },

  sharedChanges: [
    "Тип переименовывается в общий словарь category.subCategory, чтобы события всех агентов читались одинаково.",
    "Длинный текст обрезается до 20 000 символов. charLength хранит полную длину, а truncated сообщает об обрезке; исходная запись не обрезается.",
    "Одна запись может стать несколькими событиями (ответ с текстом, рассуждением и вызовами инструментов), а некоторые служебные записи пропускаются.",
  ],

  fieldDocs: {
    content: "Текст сообщения, не длиннее 20 000 символов.",
    charLength: "Полная длина текста до ограничения.",
    truncated: "True, если показанный текст обрезан.",
    model: "Модель, создавшая это, под именем, которое дал агент.",
    effort: "Уровень рассуждений, с которым выполнялся запрос.",
    requestId: "Id запроса к API, для сверки с журналами провайдера.",
    role: "Откуда текст: system_prompt, instructions, developer, user_context, …",
    toolName: "Инструмент, вызванный моделью; mcp__server__tool для инструментов MCP.",
    toolCallId: "Id, связывающий вызов с его результатом.",
    arguments: "Аргументы, переданные моделью инструменту, разобранные в JSON.",
    argumentChars: "Размер аргументов в том виде, в каком их написала модель, — то, во что они обходятся в контексте.",
    result: "Что вернул инструмент, сведённое к {content, format, images?, detail?}.",
    resultChars: "Полная длина результата до ограничения.",
    success: "False, если вызов сообщил об ошибке.",
    inputTokens: "Входные токены запроса, включая записанные в кэш.",
    outputTokens: "Выходные токены ответа, включая рассуждения.",
    cacheReadTokens: "Входные токены, полученные из кэша промптов.",
    billedUsage: "Использование с разбивкой по тарифам; основа оценки стоимости.",
    costUSD: "Оценка стоимости этого запроса по прайсу API.",
    inherited: "Скопировано из сессии, от которой ответвлена эта; стоимость относится туда.",
    durationMs: "Сколько это заняло, в миллисекундах.",
    sessionId: "Id сессии.",
    context: "Рабочий каталог, ветка и репозиторий, в которых шла сессия.",
    attachmentType: "Собственное название агента для этого вида контекста.",
    label: "Читаемое название вида вложения.",
    subject: "Чему посвящено вложение: файлу, дате, хуку…",
    items: "Имена, перечисленные во вложении (инструменты, навыки, агенты), не более 200.",
    itemCount: "Сколько имён вложение перечислило полностью.",
    itemsLabel: "Что это за перечисленные имена.",
    message: "Текст ошибки или уведомления.",
    reason: "Почему это произошло.",
    mode: "Режим, на который переключились.",
    trigger: "Что это запустило: manual или auto.",
    preTokens: "Размер контекста до сжатия.",
    turnId: "Id хода.",
    totalCostUSD: "Стоимость сессии на данный момент по данным самого агента.",
    apiDurationMs: "Общее время ожидания API на данный момент.",
    premiumRequests: "Премиум-запросы, учтённые на данный момент.",
    sessionTotals: "Итоги сессии, сообщённые агентом; используются в сводке сессии.",
    usage: "Итоги использования в том виде, в каком их сообщил агент.",
    selectedModel: "Модель, выбранная в начале сессии.",
    copilotVersion: "Версия CLI агента, записавшая сессию.",
    cliVersion: "Версия CLI агента, записавшая сессию.",
    entrypoint: "Где шла сессия: cli, claude-desktop, …",
    forkedFrom: "Сессия, от которой ответвлена эта.",
  },

  pathDocs: {
    type: "Тип события, category.subCategory.",
    data: "Что записал агент, нормализованное там, где это имеет смысл.",
    id: "Уникальный id события в сессии.",
    timestamp: "Когда это произошло, ISO 8601.",
    parentId: "Событие, из которого следует это, если агент его записывает.",
    source: "Где лежит исходная запись: её строка в транскрипции или собственный id агента.",
    category: "Первая часть типа, используется фильтрами.",
    subCategory: "Остальная часть типа, используется фильтрами.",
    subKey: "Полный тип, используется фильтрами.",
    "data.result.content": "Простой текст результата, с ограничением. JSON-результаты выводятся с отступами.",
    "data.result.format": "text или json.",
    "data.result.images": "Изображения, возвращённые инструментом: только тип и размер.",
    "data.result.detail": "Второе представление, которое добавляют некоторые инструменты, обычно diff.",
    "data.context.cwd": "Рабочий каталог.",
    "data.context.branch": "Ветка Git.",
    "data.context.repository": "Репозиторий Git.",
    "data.billedUsage.model": "Модель, по тарифу которой считается использование.",
    "data.billedUsage.inputTokens": "Входные токены, не прочитанные из кэша и не записанные в него.",
    "data.billedUsage.outputTokens": "Выходные токены.",
    "data.billedUsage.cacheReadTokens": "Входные токены, прочитанные из кэша.",
    "data.billedUsage.cacheWriteTokens": "Входные токены, записанные в 5-минутный кэш.",
    "data.billedUsage.cacheWrite1hTokens": "Входные токены, записанные в часовой кэш.",
    "data.billedUsage.fast": "Выполнено в быстром режиме, по повышенному тарифу.",
    "data.billedUsage.local": "Выполнено на локальной модели, которая ничего не стоит.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Когда записана строка, ISO 8601.",
      ordinal: "Позиция строки в rollout.",
      type: "Вид строки: session_meta, event_msg, response_item, turn_context, …",
      payload: "Содержимое строки; его собственный type говорит, что это.",
      "payload.type": "Вид payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id сессии (session_meta) или элемента.",
      "payload.cli_version": "Версия Codex CLI, только в session_meta.",
      "payload.originator": "Приложение, запустившее Codex.",
      "payload.cwd": "Рабочий каталог.",
      "payload.role": "От кого сообщение: user, assistant, developer, system.",
      "payload.content": "Части содержимого сообщения.",
      "payload.content[].type": "Вид части: input_text, output_text, …",
      "payload.content[].text": "Текст части.",
      "payload.message": "Текст сообщения event_msg.",
      "payload.call_id": "Id, связывающий вызов инструмента с его выводом.",
      "payload.name": "Вызванный инструмент.",
      "payload.arguments": "Аргументы инструмента в виде JSON-строки.",
      "payload.input": "Входные данные вызова пользовательского инструмента.",
      "payload.output": "Что вернул инструмент.",
      "payload.status": "Статус вызова.",
      "payload.turn_id": "Ход, к которому относится строка.",
      "payload.info": "Использование токенов: накопительные итоги и данные последнего запроса.",
    },
    copilot: {
      type: "Тип события, уже в виде category.subCategory.",
      data: "Данные события.",
      id: "Id события.",
      timestamp: "Когда это произошло, ISO 8601.",
      parentId: "Событие, из которого следует это.",
      "data.version": "Версия формата events.jsonl.",
      "data.copilotVersion": "Версия Copilot CLI.",
      "data.producer": "Что записало файл.",
      "data.toolCallId": "Id, связывающий вызов с его результатом.",
      "data.toolName": "Вызванный инструмент.",
      "data.arguments": "Аргументы инструмента.",
      "data.result": "Что вернул инструмент: content и detailedContent, если инструмент его добавляет.",
      "data.error": "Почему неудачный вызов завершился ошибкой.",
    },
  },

  events: {
    "session.start": {
      summary: "Инициализация сессии. Фиксирует среду выполнения и выбранную модель в начале сессии.",
      sources: {
        ...claudeSources([
          {
            record: "Записи нет: Claude Code не пишет стартовую запись",
            note: "Приложение собирает её из полей cwd, gitBranch, version и entrypoint записей транскрипции, чтобы лента у каждого агента начиналась с одинакового заголовка.",
          },
        ]),
        codex: [{ record: "Первая строка session_meta", note: "Последующие строки session_meta — это потоки субагентов, они становятся subagent.session_start." }],
        copilot: [{ record: "session.start, читается как записано" }],
      },
    },
    "session.resume": { summary: "Сессия возобновлена из прежнего состояния. Означает перезагрузку контекста и продолжение." },
    "session.shutdown": {
      summary: "Итоги завершения сессии. Обычно включают использование, суммы токенов, премиум-запросы и время API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Приложение выводит из неё sessionTotals и usageSummary. Итоги накопительные, поэтому оценивается только последний shutdown, а возобновлённая сессия не считается дважды.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Результат выбора модели в автоматическом режиме. Показывает предсказанный профиль задачи и выбранные настройки модели." },
    "session.binary_asset": { summary: "Двоичные данные, захваченные в сессии, обычно снимки экрана. Могут занимать много контекста и места." },
    "session.usage_checkpoint": {
      summary: "Промежуточный учёт использования, пока сессия активна.",
      sources: {
        ...claudeSources([{ record: "Запись cost-state", note: "totalCostUSD и totalAPIDuration копируются как сообщены." }]),
        codex: [
          {
            record: "Строка event_msg с типом token_count",
            note: "Codex сообщает накопительные итоги, поэтому приложение учитывает только прирост с предыдущей контрольной точки и выносит кэшированные токены из input_tokens, чтобы каждый оценивался один раз.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Только учёт премиум/AIU, без сумм токенов; premiumRequests копируется из totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Во время сессии изменилась конфигурация модели (модель, уровень рассуждений или уровень контекста).",
      sources: { codex: [{ record: "Строка event_msg с типом thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Началось сжатие контекста. Разговор кратко пересказывается, чтобы уменьшить число токенов в каждом запросе.",
      sources: claudeSources([{ record: "Запись system с subtype compact_boundary", note: "trigger и preTokens берутся из compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Сжатие завершено, с метаданными об успехе или ошибке и id запросов." },
    "session.error": {
      summary: "Ошибка API или транспорта. Каждая повторная попытка заново отправляет весь контекст запроса.",
      sources: {
        ...claudeSources([{ record: "Запись system с subtype api_error" }]),
        gemini: [{ record: "Сообщение с типом error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Ход был прерван, не завершившись.",
      changes: ["Каждый агент отмечает прерывание по-своему; все они становятся этим одним типом."],
      sources: {
        ...claudeSources([
          {
            record: "Запись user, текст которой начинается с «[Request interrupted by user»",
            note: "Claude Code записывает прерывание так, будто его ввёл пользователь; приложение не показывает его как промпт.",
          },
        ]),
        codex: [{ record: "Строка event_msg с типом turn_aborted" }],
        copilot: [{ record: "Событие abort", note: "Переименовано; данные сохраняются как записаны." }],
      },
    },
    "session.mode_change": {
      summary: "Во время сессии изменился режим взаимодействия или разрешений.",
      sources: claudeSources([{ record: "Запись mode или permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Конфигурация выполнения на ход: модель, уровень рассуждений, песочница и политика подтверждений.",
      sources: { codex: [{ record: "Строка turn_context" }] },
    },
    "session.world_state": {
      summary: "Снимок рабочей области, переданный модели средой выполнения.",
      sources: { codex: [{ record: "Строка world_state" }] },
    },
    "session.rollback": {
      summary: "Разговор откатили на несколько ходов.",
      sources: { codex: [{ record: "Строка event_msg с типом thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Агент создал или обновил рабочий план." },
    "session.info": {
      summary: "Уведомление, выведенное агентом: информация или предупреждение.",
      sources: { gemini: [{ record: "Сообщение с типом info или warning" }] },
    },

    "user.message": {
      summary: "То, что ввёл пользователь. Запускает следующий ход ассистента.",
      sources: {
        ...claudeSources([
          {
            record: "Запись user: message.content в виде строки или каждый блок text в нём",
            note: "Тот же вид записи переносит и результаты инструментов, которые становятся tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Строка event_msg с типом user_message" },
          {
            record: "Сообщение response_item с role user, только в старых rollout",
            note: "Новые rollout содержат разговор дважды: как event_msg (что видел пользователь) и как response_item (что видела модель). Приложение использует event_msg, чтобы ходы не удваивались; копия response_item становится system.message.",
          },
        ],
        copilot: [{ record: "user.message, читается как записано" }],
        gemini: [{ record: "Сообщение с типом user" }],
      },
    },
    "assistant.message": {
      summary: "Текст ответа модели, с названием модели и использованием токенов.",
      fields: {
        phase: "Codex: к какой части хода относится сообщение.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Запись assistant с блоком text в message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Ответ без текста, рассуждения и вызова инструмента всё равно становится пустым сообщением, чтобы его использование было учтено.`,
          },
        ]),
        codex: [
          { record: "Строка event_msg с типом agent_message" },
          { record: "Сообщение response_item с role assistant, только если нет копии event_msg" },
        ],
        copilot: [{ record: "assistant.message, читается как записано" }],
        gemini: [{ record: "Содержимое сообщения с типом gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Рассуждение, которое модель выдала перед ответом. Оплачивается как выходные токены.",
      sources: {
        ...claudeSources([{ record: "Запись assistant с блоком thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Строка event_msg с типом agent_reasoning" },
          { record: "response_item с типом reasoning, по его summary", note: "Только зашифрованное рассуждение не содержит ничего читаемого и пропускается." },
        ],
        gemini: [{ record: "Каждая запись thoughts в сообщении с типом gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Начало одного хода ассистента.",
      sources: { codex: [{ record: "Строка event_msg с типом task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Конец хода ассистента после рассуждения, вызовов инструментов и вывода.",
      sources: {
        ...claudeSources([{ record: "Запись system с subtype turn_duration" }]),
        codex: [{ record: "Строка event_msg с типом task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Модель вызвала встроенный инструмент, с его именем и аргументами.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Инструменты с именем mcp__… вместо этого становятся external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "response_item с типом function_call, custom_tool_call или local_shell_call",
            note: "Аргументы, записанные JSON-строкой, разбираются в объект.",
          },
        ],
        copilot: [{ record: "tool.execution_start, читается как записано" }],
        gemini: [{ record: "Каждая запись toolCalls в сообщении с типом gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Вызов встроенного инструмента завершён, с его статусом и результатом.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Имя инструмента берётся из соответствующего вызова. Если в блоке нет содержимого, используется toolUseResult записи. success равен false, если задан is_error.",
          },
        ]),
        codex: [
          {
            record: "response_item с типом function_call_output, custom_tool_call_output или local_shell_call_output",
            note: "Codex не записывает признак успеха; приложение помечает вызов как неудачный, если его вывод сообщает ненулевой код выхода.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content становится текстом результата, у неудачного вызова его заменяет error.message, а detailedContent (обычно diff) становится result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Модель вызвала инструмент, предоставляемый внешним мостом, обычно сервером MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, для инструмента с именем mcp__…` }]),
        copilot: [{ record: "external_tool.requested, читается как записано" }],
      },
    },
    "external_tool.completed": {
      summary: "Вызов внешнего инструмента завершён, с его статусом и результатом.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, для инструмента с именем mcp__…` }]),
        codex: [{ record: "Строка event_msg с типом mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Устроено так же, как tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Среда выполнения запросила у пользователя разрешение на действие (файл, система или сеть)." },
    "permission.completed": { summary: "Запрос разрешения решён: одобрен или отклонён." },
    "hook.start": { summary: "Запущен хук жизненного цикла, например при отправке промпта." },
    "hook.end": {
      summary: "Хук жизненного цикла завершился успехом или ошибкой.",
      sources: claudeSources([{ record: "Запись system с subtype stop_hook_summary", note: "success равен false, если запись перечисляет ошибки хуков." }]),
    },

    "system.message": {
      summary: "Инструкции, которые среда выполнения поставила перед моделью: системный промпт, файлы инструкций или внедрённый контекст.",
      detail: "Они отправляются с каждым запросом, поэтому их размер накапливается за сессию. Переключатель на панели инструментов скрывает их вместе с остальным внедрённым контекстом.",
      sources: {
        ...claudeSources([
          { record: "Запись attachment с типом prompt_snapshot", note: "Claude Code заново записывает системный промпт при изменении любой его части; приложение показывает его, только когда изменился сам текст промпта." },
          { record: "Запись attachment с типом instructions (файлы CLAUDE.md и AGENTS.md)" },
          { record: "Запись system с любым другим subtype" },
        ]),
        codex: [
          { record: "base_instructions в строке session_meta" },
          { record: "Сообщение response_item с role developer или system" },
          { record: "Сообщение response_item с role user, внедрённое средой выполнения, показывается как role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Контекст, добавленный самой средой выполнения: снимки файлов, напоминания, списки инструментов или навыков, изображения.",
      changes: ["Любое вложение сводится к {label, subject, items, content}, чтобы читаться как содержимое, а не как сырой JSON."],
      sources: {
        ...claudeSources([
          { record: "Запись attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Список инструментов вложения prompt_snapshot, показывается как определения инструментов при изменении" },
          { record: "Блок image в записи user", note: "Сохраняется только факт отправки изображения; пиксели остаются на диске." },
        ]),
        codex: [{ record: "dynamic_tools в строке session_meta, показывается как определения инструментов" }],
      },
    },
    "system.notification": { summary: "Уведомление среды выполнения, добавленное в разговор, например о завершении фоновой оболочки." },

    "file.patch_applied": {
      summary: "Патч, применённый агентом к рабочей области, с затронутыми файлами.",
      sources: { codex: [{ record: "Строка event_msg с типом patch_apply_end" }] },
    },
    "web.search": {
      summary: "Веб-поиск, выполненный моделью; его результаты добавляются в контекст.",
      sources: { codex: [{ record: "Строка event_msg с типом web_search_end" }] },
    },

    "subagent.deselected": { summary: "Фокус субагента снят, управление вернулось основному агенту." },
    "subagent.activity": {
      summary: "Активность, о которой сообщил субагент, работающий под основным агентом.",
      sources: { codex: [{ record: "Строка event_msg с типом sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Сообщение, переданное между агентами.",
      sources: { codex: [{ record: "Строка inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "В этой сессии запущен поток субагента.",
      sources: { codex: [{ record: "Строка session_meta после первой" }] },
    },
  },

  unknownSummary: "Событие категории «{category}» («{name}»), у которого ещё нет описания.",
  unknownCategory: "неизвестная",
  unknownName: "общее",
  unknownDetail:
    "Агент записал запись, для которой у приложения нет сопоставления. Она сохраняется с данными как записано, так что ничего не теряется, и показывается через общую карточку.",

  callAndResult: "Вызов и его результат, показанные одной строкой.",
  recordsInOrder: "Записи, из которых прочитана строка, в порядке транскрипции.",
  recordTitle: "Запись {agent}",
  eventFormat: "Формат событий",
};
