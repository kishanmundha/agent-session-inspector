import { claudeSources, type EventDocs } from "./en";

/** Spanish. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "El resultado se reduce a texto plano en result.content. Las imágenes conservan solo su tipo y tamaño; los píxeles se quedan en disco.",
  "En la vista compacta, una llamada y su resultado se muestran como una sola fila, así que Raw y Original muestran dos registros.",
];

const CLAUDE_TOOL_USE = "Un registro assistant con un bloque tool_use en message.content";
const CLAUDE_TOOL_RESULT =
  "Un registro user con un bloque tool_result, emparejado con su llamada mediante tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code escribe un registro por cada bloque de contenido de una respuesta en streaming y repite el uso de la respuesta en cada uno. El uso se cuenta una sola vez, en el primer evento de la respuesta.";
const ARGUMENT_CHARS =
  "Se añade argumentChars: el tamaño de los argumentos tal como se escribieron, que es lo que cuestan en el contexto.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Tipo de registro: user, assistant, system, attachment, mode, …",
  subtype: "Tipo de registro system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id del registro.",
  parentUuid: "Registro al que sigue este en la conversación.",
  isSidechain: "Escrito por un subagente y no por la conversación principal.",
  timestamp: "Cuándo se escribió, ISO 8601.",
  sessionId: "Sesión a la que pertenece el registro; un fork conserva el id de su padre en los registros copiados.",
  cwd: "Directorio de trabajo.",
  gitBranch: "Rama de Git en ese momento.",
  version: "Versión de Claude Code que escribió el registro.",
  entrypoint: "Dónde se ejecutó Claude Code: cli, claude-desktop, …",
  userType: "Quién dirige la sesión.",
  requestId: "Id de la solicitud a la API.",
  promptId: "Prompt al que pertenece el registro.",
  effort: "Esfuerzo de razonamiento de la solicitud.",
  message: "El mensaje de la API, tal como se envió o recibió.",
  "message.role": "user o assistant.",
  "message.model": "Modelo que respondió; <synthetic> para mensajes que escribió el propio Claude Code.",
  "message.id": "Id del mensaje de la API; compartido por todos los registros de una respuesta en streaming.",
  "message.type": "Siempre message.",
  "message.content": "Una cadena o una lista de bloques de contenido.",
  "message.content[].type": "Tipo de bloque: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Texto de un bloque text.",
  "message.content[].thinking": "Razonamiento de un bloque thinking.",
  "message.content[].signature": "Firma que permite devolver el razonamiento a la API.",
  "message.content[].id": "Id de un bloque tool_use.",
  "message.content[].name": "Herramienta que llama un bloque tool_use.",
  "message.content[].input": "Argumentos de un bloque tool_use.",
  "message.content[].tool_use_id": "Llamada a la que responde un bloque tool_result.",
  "message.content[].content": "Lo que devolvió la herramienta.",
  "message.content[].is_error": "La herramienta informó de un fallo.",
  "message.stop_reason": "Por qué terminó la respuesta: end_turn, tool_use, max_tokens, …",
  "message.usage": "Uso de tokens de toda la respuesta, repetido en cada uno de sus registros.",
  "message.usage.input_tokens": "Tokens de entrada que no se leyeron de la caché ni se escribieron en ella.",
  "message.usage.output_tokens": "Tokens de salida.",
  "message.usage.cache_read_input_tokens": "Tokens de entrada leídos de la caché.",
  "message.usage.cache_creation_input_tokens": "Tokens de entrada escritos en la caché.",
  "message.usage.cache_creation": "Escrituras en caché desglosadas por tiempo de vida.",
  "message.usage.speed": "fast cuando la solicitud se ejecutó en modo rápido.",
  toolUseResult: "La copia estructurada propia de Claude Code de un resultado de herramienta.",
  attachment: "Contexto que inyectó Claude Code; su type indica de qué tipo es.",
  "attachment.type": "Tipo de adjunto: prompt_snapshot, instructions, file, date, …",
  content: "Texto de un registro system.",
  level: "Gravedad de un registro system.",
  error: "Detalles del error de un registro api_error.",
};

export const es: EventDocs = {
  providerFormats: {
    claude:
      "JSONL en ~/.claude/projects/<project>/<session>.jsonl: un registro JSON por línea, de tipo user, assistant, system, attachment, etc. Cada registro incluye la versión de Claude Code que lo escribió.",
    cowork:
      "La CLI de Claude Code se ejecuta dentro de cada sesión de Cowork y escribe la misma transcripción JSONL, así que se lee exactamente igual que Claude Code.",
    codex:
      "JSONL en ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: líneas {timestamp, type, payload} de tipo session_meta, event_msg, response_item, turn_context. Solo session_meta indica la versión de la CLI.",
    copilot:
      "JSONL en ~/.copilot/session-state/<id>/events.jsonl, ya escrito como {type, data, id, timestamp, parentId} con el mismo vocabulario category.subCategory que usa esta app. session.start indica la versión del formato y de la CLI.",
    vscode:
      "Archivos de sesión de chat (JSON, o JSONL de cambios añadidos) en el almacenamiento del espacio de trabajo de VS Code, un par solicitud/respuesta por entrada.",
    gemini:
      "Archivos de sesión en ~/.gemini/tmp/<project>/chats. Cada mensaje es de tipo user, gemini, info, warning o error; un mensaje escrito de nuevo sustituye a su versión anterior.",
    opencode:
      "SQLite (opencode.db): filas de session, message y part, cada una con su contenido en una columna JSON.",
    cursor:
      "Almacenes SQLite en ~/.cursor/projects que guardan la conversación como filas bubble: 1 para el usuario, 2 para el agente.",
    hermes: "SQLite (state.db) en ~/.hermes: las sesiones y sus mensajes como filas.",
  },

  sharedChanges: [
    "El tipo se renombra al vocabulario común category.subCategory, para que los eventos de todos los agentes se lean igual.",
    "El texto largo se corta a 20 000 caracteres. charLength conserva la longitud completa y truncated indica que se cortó; el registro original no se recorta.",
    "Un registro puede convertirse en varios eventos (una respuesta con texto, razonamiento y llamadas a herramientas), y algunos registros se omiten por ser de control interno.",
  ],

  fieldDocs: {
    content: "Texto del mensaje, limitado a 20 000 caracteres.",
    charLength: "Longitud completa del texto antes de limitarlo.",
    truncated: "True cuando el texto mostrado se recortó.",
    model: "Modelo que generó esto, tal como lo nombra el agente.",
    effort: "Esfuerzo de razonamiento con el que se ejecutó la solicitud.",
    requestId: "Id de la solicitud a la API, para cotejar con los registros del proveedor.",
    role: "De dónde viene el texto: system_prompt, instructions, developer, user_context, …",
    toolName: "Herramienta que llamó el modelo; mcp__server__tool para herramientas MCP.",
    toolCallId: "Id que une una llamada con su resultado.",
    arguments: "Argumentos que el modelo pasó a la herramienta, convertidos a JSON.",
    argumentChars: "Tamaño de los argumentos tal como los escribió el modelo, que es lo que cuestan en el contexto.",
    result: "Lo que devolvió la herramienta, reducido a {content, format, images?, detail?}.",
    resultChars: "Longitud completa del resultado antes de limitarlo.",
    success: "False cuando la llamada informó de un fallo.",
    inputTokens: "Tokens de entrada de la solicitud, incluidos los escritos en caché.",
    outputTokens: "Tokens de salida de la respuesta, incluido el razonamiento.",
    cacheReadTokens: "Tokens de entrada servidos desde la caché de prompts.",
    billedUsage: "Uso desglosado según su precio, usado para estimar el coste.",
    costUSD: "Coste estimado de esta solicitud según los precios de lista de la API.",
    inherited: "Copiado de la sesión de la que se bifurcó esta; su coste pertenece allí.",
    durationMs: "Cuánto tardó, en milisegundos.",
    sessionId: "Id de la sesión.",
    context: "Directorio de trabajo, rama y repositorio en que se ejecutó la sesión.",
    attachmentType: "El nombre propio del agente para este tipo de contexto.",
    label: "Nombre legible del tipo de adjunto.",
    subject: "De qué trata el adjunto: un archivo, una fecha, un hook…",
    items: "Nombres que enumera el adjunto (herramientas, skills, agentes), como máximo 200.",
    itemCount: "Cuántos nombres enumeró el adjunto en total.",
    itemsLabel: "Qué son los nombres enumerados.",
    message: "Texto del error o aviso.",
    reason: "Por qué ocurrió.",
    mode: "El modo al que se cambió.",
    trigger: "Qué lo inició: manual o auto.",
    preTokens: "Tamaño del contexto antes de la compactación.",
    turnId: "Id del turno.",
    totalCostUSD: "Coste de la sesión hasta ahora, según el propio agente.",
    apiDurationMs: "Tiempo total de espera a la API hasta ahora.",
    premiumRequests: "Solicitudes premium contadas hasta ahora.",
    sessionTotals: "Totales de la sesión informados por el agente, usados para el resumen de la sesión.",
    usage: "Totales de uso tal como los informó el agente.",
    selectedModel: "Modelo elegido al empezar la sesión.",
    copilotVersion: "Versión de la CLI del agente que escribió la sesión.",
    cliVersion: "Versión de la CLI del agente que escribió la sesión.",
    entrypoint: "Dónde se ejecutó la sesión: cli, claude-desktop, …",
    forkedFrom: "La sesión de la que se bifurcó esta.",
  },

  pathDocs: {
    type: "Tipo de evento, category.subCategory.",
    data: "Lo que registró el agente, normalizado donde merece la pena.",
    id: "Id único del evento dentro de la sesión.",
    timestamp: "Cuándo ocurrió, ISO 8601.",
    parentId: "Evento del que procede este, cuando el agente lo registra.",
    source: "Dónde está el registro original: su línea en la transcripción o el id propio del agente.",
    category: "Primera parte del tipo, usada por los filtros.",
    subCategory: "Resto del tipo, usado por los filtros.",
    subKey: "Tipo completo, usado por los filtros.",
    "data.result.content": "Texto plano del resultado, limitado. Los resultados JSON se indentan.",
    "data.result.format": "text o json.",
    "data.result.images": "Imágenes que devolvió la herramienta: solo tipo y tamaño.",
    "data.result.detail": "Una segunda representación que añaden algunas herramientas, normalmente un diff.",
    "data.context.cwd": "Directorio de trabajo.",
    "data.context.branch": "Rama de Git.",
    "data.context.repository": "Repositorio de Git.",
    "data.billedUsage.model": "Modelo con cuyo precio se calcula el uso.",
    "data.billedUsage.inputTokens": "Tokens de entrada que no se leyeron de la caché ni se escribieron en ella.",
    "data.billedUsage.outputTokens": "Tokens de salida.",
    "data.billedUsage.cacheReadTokens": "Tokens de entrada leídos de la caché.",
    "data.billedUsage.cacheWriteTokens": "Tokens de entrada escritos en la caché de 5 minutos.",
    "data.billedUsage.cacheWrite1hTokens": "Tokens de entrada escritos en la caché de 1 hora.",
    "data.billedUsage.fast": "Se ejecutó en modo rápido, con una tarifa más alta.",
    "data.billedUsage.local": "Se ejecutó en un modelo local, que no cuesta nada.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Cuándo se escribió la línea, ISO 8601.",
      ordinal: "Posición de la línea en el rollout.",
      type: "Tipo de línea: session_meta, event_msg, response_item, turn_context, …",
      payload: "El contenido de la línea; su propio type indica qué es.",
      "payload.type": "Tipo de payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id de la sesión (session_meta) o del elemento.",
      "payload.cli_version": "Versión de la CLI de Codex, solo en session_meta.",
      "payload.originator": "App que ejecutó Codex.",
      "payload.cwd": "Directorio de trabajo.",
      "payload.role": "De quién es un mensaje: user, assistant, developer, system.",
      "payload.content": "Partes del contenido de un mensaje.",
      "payload.content[].type": "Tipo de parte: input_text, output_text, …",
      "payload.content[].text": "Texto de la parte.",
      "payload.message": "Texto de un mensaje event_msg.",
      "payload.call_id": "Id que une una llamada a herramienta con su salida.",
      "payload.name": "Herramienta llamada.",
      "payload.arguments": "Argumentos de la herramienta, como cadena JSON.",
      "payload.input": "Entrada de una llamada a herramienta personalizada.",
      "payload.output": "Lo que devolvió la herramienta.",
      "payload.status": "Estado de la llamada.",
      "payload.turn_id": "Turno al que pertenece la línea.",
      "payload.info": "Uso de tokens: totales acumulados y los de la última solicitud.",
    },
    copilot: {
      type: "Tipo de evento, ya en forma category.subCategory.",
      data: "Datos del evento.",
      id: "Id del evento.",
      timestamp: "Cuándo ocurrió, ISO 8601.",
      parentId: "Evento del que procede este.",
      "data.version": "Versión del formato events.jsonl.",
      "data.copilotVersion": "Versión de la CLI de Copilot.",
      "data.producer": "Qué escribió el archivo.",
      "data.toolCallId": "Id que une una llamada con su resultado.",
      "data.toolName": "Herramienta llamada.",
      "data.arguments": "Argumentos de la herramienta.",
      "data.result": "Lo que devolvió la herramienta: content, y detailedContent cuando la herramienta añade uno.",
      "data.error": "Por qué falló una llamada fallida.",
    },
  },

  events: {
    "session.start": {
      summary: "Inicio de la sesión. Recoge el contexto de ejecución y el modelo elegido al empezar una sesión.",
      sources: {
        ...claudeSources([
          {
            record: "Ningún registro: Claude Code no escribe un registro de inicio",
            note: "La app crea uno a partir de cwd, gitBranch, version y entrypoint de los registros de la transcripción, para que la línea de tiempo empiece con la misma cabecera en todos los agentes.",
          },
        ]),
        codex: [{ record: "La primera línea session_meta", note: "Las líneas session_meta posteriores son hilos de subagentes y se convierten en subagent.session_start." }],
        copilot: [{ record: "session.start, leído tal cual" }],
      },
    },
    "session.resume": { summary: "Sesión reanudada desde un estado anterior. Indica la recarga del contexto y la continuación." },
    "session.shutdown": {
      summary: "Resumen de fin de sesión. Suele incluir uso, totales de tokens, solicitudes premium y tiempos de la API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "La app obtiene de él sessionTotals y usageSummary. Los totales son acumulados, así que solo se calcula el precio del último shutdown y una sesión reanudada no se cuenta dos veces.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Resultado de la selección de modelo en modo automático. Muestra el perfil de tarea previsto y la configuración de modelo elegida." },
    "session.binary_asset": { summary: "Datos binarios capturados en la sesión, normalmente capturas de pantalla. Pueden ocupar mucho contexto y almacenamiento." },
    "session.usage_checkpoint": {
      summary: "Contabilidad provisional del uso mientras la sesión está activa.",
      sources: {
        ...claudeSources([{ record: "Un registro cost-state", note: "totalCostUSD y totalAPIDuration se copian tal como se informan." }]),
        codex: [
          {
            record: "Una línea event_msg de tipo token_count",
            note: "Codex informa totales acumulados, así que la app factura solo el tramo desde el punto de control anterior y saca los tokens en caché de input_tokens para que cada uno se cobre una vez.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Solo contabilidad premium/AIU, sin totales de tokens; premiumRequests se copia de totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Cambió la configuración del modelo durante la sesión (modelo, esfuerzo o nivel de contexto).",
      sources: { codex: [{ record: "Una línea event_msg de tipo thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Empezó la compactación del contexto. La conversación se resume para reducir los tokens que se envían en cada solicitud.",
      sources: claudeSources([{ record: "Un registro system con subtype compact_boundary", note: "trigger y preTokens vienen de compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Terminó la compactación, con metadatos de éxito o fallo e ids de solicitud." },
    "session.error": {
      summary: "Error de la API o de transporte. Cada reintento vuelve a enviar todo el contexto de la solicitud.",
      sources: {
        ...claudeSources([{ record: "Un registro system con subtype api_error" }]),
        gemini: [{ record: "Un mensaje de tipo error" }],
      },
    },
    "session.turn_aborted": {
      summary: "El turno se interrumpió antes de completarse.",
      changes: ["Cada agente marca una interrupción de forma distinta; todas se convierten en este único tipo."],
      sources: {
        ...claudeSources([
          {
            record: "Un registro user cuyo texto empieza por «[Request interrupted by user»",
            note: "Claude Code registra la interrupción como si la hubiera escrito el usuario; la app no la muestra como prompt.",
          },
        ]),
        codex: [{ record: "Una línea event_msg de tipo turn_aborted" }],
        copilot: [{ record: "Un evento abort", note: "Renombrado; los datos se conservan tal cual." }],
      },
    },
    "session.mode_change": {
      summary: "Cambió el modo de interacción o de permisos durante la sesión.",
      sources: claudeSources([{ record: "Un registro mode o permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Configuración de ejecución por turno: modelo, esfuerzo, sandbox y política de aprobación.",
      sources: { codex: [{ record: "Una línea turn_context" }] },
    },
    "session.world_state": {
      summary: "Instantánea del espacio de trabajo que el entorno entregó al modelo.",
      sources: { codex: [{ record: "Una línea world_state" }] },
    },
    "session.rollback": {
      summary: "La conversación se revirtió un número de turnos.",
      sources: { codex: [{ record: "Una línea event_msg de tipo thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "El agente creó o actualizó su plan de trabajo." },
    "session.info": {
      summary: "Un aviso que mostró el agente: información o una advertencia.",
      sources: { gemini: [{ record: "Un mensaje de tipo info o warning" }] },
    },

    "user.message": {
      summary: "Lo que escribió el usuario. Impulsa el siguiente turno del asistente.",
      sources: {
        ...claudeSources([
          {
            record: "Un registro user: message.content como cadena, o cada bloque text que contiene",
            note: "El mismo tipo de registro también lleva resultados de herramientas, que se convierten en tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Una línea event_msg de tipo user_message" },
          {
            record: "Un mensaje response_item con role user, solo en rollouts antiguos",
            note: "Los rollouts nuevos llevan la conversación dos veces, como event_msg (lo que vio el usuario) y response_item (lo que vio el modelo). La app usa event_msg para no duplicar turnos; la copia response_item se convierte en system.message.",
          },
        ],
        copilot: [{ record: "user.message, leído tal cual" }],
        gemini: [{ record: "Un mensaje de tipo user" }],
      },
    },
    "assistant.message": {
      summary: "Texto que respondió el modelo, con el nombre del modelo y el uso de tokens.",
      fields: {
        phase: "Codex: a qué parte del turno pertenece el mensaje.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Un registro assistant con un bloque text en message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Una respuesta sin texto, razonamiento ni llamada a herramienta se convierte igualmente en un mensaje vacío, para contar su uso.`,
          },
        ]),
        codex: [
          { record: "Una línea event_msg de tipo agent_message" },
          { record: "Un mensaje response_item con role assistant, solo cuando no hay copia event_msg" },
        ],
        copilot: [{ record: "assistant.message, leído tal cual" }],
        gemini: [{ record: "El contenido de un mensaje de tipo gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Razonamiento que produjo el modelo antes de responder. Se factura como tokens de salida.",
      sources: {
        ...claudeSources([{ record: "Un registro assistant con un bloque thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Una línea event_msg de tipo agent_reasoning" },
          { record: "Un response_item de tipo reasoning, usando su summary", note: "El razonamiento solo cifrado no tiene nada legible y se omite." },
        ],
        gemini: [{ record: "Cada entrada de thoughts en un mensaje de tipo gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Inicio de un turno del asistente.",
      sources: { codex: [{ record: "Una línea event_msg de tipo task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Fin del turno del asistente tras su razonamiento, llamadas a herramientas y salida.",
      sources: {
        ...claudeSources([{ record: "Un registro system con subtype turn_duration" }]),
        codex: [{ record: "Una línea event_msg de tipo task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "El modelo llamó a una herramienta integrada, con su nombre y argumentos.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Las herramientas llamadas mcp__… se convierten en external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "Un response_item de tipo function_call, custom_tool_call o local_shell_call",
            note: "Los argumentos escritos como cadena JSON se convierten en un objeto.",
          },
        ],
        copilot: [{ record: "tool.execution_start, leído tal cual" }],
        gemini: [{ record: "Cada entrada de toolCalls en un mensaje de tipo gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Terminó una llamada a una herramienta integrada, con su estado y resultado.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "El nombre de la herramienta viene de la llamada correspondiente. Si el bloque no tiene contenido, se usa toolUseResult del registro. success es false cuando is_error está activo.",
          },
        ]),
        codex: [
          {
            record: "Un response_item de tipo function_call_output, custom_tool_call_output o local_shell_call_output",
            note: "Codex no registra ningún indicador de éxito; la app marca una llamada como fallida cuando su salida indica un código de salida distinto de cero.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content pasa a ser el texto del resultado, el error.message de una llamada fallida ocupa su lugar y detailedContent (normalmente un diff) pasa a ser result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "El modelo llamó a una herramienta servida por un puente externo, normalmente un servidor MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, para una herramienta llamada mcp__…` }]),
        copilot: [{ record: "external_tool.requested, leído tal cual" }],
      },
    },
    "external_tool.completed": {
      summary: "Terminó una llamada a una herramienta externa, con su estado y resultado.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, para una herramienta llamada mcp__…` }]),
        codex: [{ record: "Una línea event_msg de tipo mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Con la misma forma que tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "El entorno pidió permiso al usuario para una acción (archivo, sistema o red)." },
    "permission.completed": { summary: "Se resolvió la solicitud de permiso: aprobada o denegada." },
    "hook.start": { summary: "Empezó un hook del ciclo de vida, por ejemplo al enviar un prompt." },
    "hook.end": {
      summary: "Terminó un hook del ciclo de vida, con éxito o con fallo.",
      sources: claudeSources([{ record: "Un registro system con subtype stop_hook_summary", note: "success es false cuando el registro enumera errores de hooks." }]),
    },

    "system.message": {
      summary: "Instrucciones que el entorno puso delante del modelo: el prompt del sistema, archivos de instrucciones o contexto inyectado.",
      detail: "Se envían con cada solicitud, así que su tamaño se acumula a lo largo de la sesión. El interruptor de la barra de herramientas las oculta junto con el resto del contexto inyectado.",
      sources: {
        ...claudeSources([
          { record: "Un registro attachment de tipo prompt_snapshot", note: "Claude Code vuelve a registrar el prompt del sistema cada vez que cambia cualquier parte; la app solo lo muestra cuando cambió el propio texto del prompt." },
          { record: "Un registro attachment de tipo instructions (archivos CLAUDE.md y AGENTS.md)" },
          { record: "Un registro system de cualquier otro subtype" },
        ]),
        codex: [
          { record: "base_instructions en la línea session_meta" },
          { record: "Un mensaje response_item con role developer o system" },
          { record: "Un mensaje response_item con role user que inyectó el entorno, mostrado como role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Contexto que el entorno añadió por su cuenta: instantáneas de archivos, recordatorios, listas de herramientas o skills, imágenes.",
      changes: ["Todo tipo de adjunto se aplana a {label, subject, items, content}, para que se lea como contenido y no como JSON en bruto."],
      sources: {
        ...claudeSources([
          { record: "Un registro attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "La lista de herramientas de un adjunto prompt_snapshot, mostrada como definiciones de herramientas cuando cambia" },
          { record: "Un bloque image en un registro user", note: "Solo se conserva que se envió una imagen; los píxeles se quedan en disco." },
        ]),
        codex: [{ record: "dynamic_tools en la línea session_meta, mostrado como definiciones de herramientas" }],
      },
    },
    "system.notification": { summary: "Una notificación del entorno añadida a la conversación, como el fin de un shell en segundo plano." },

    "file.patch_applied": {
      summary: "Un parche que el agente aplicó al espacio de trabajo, con los archivos que tocó.",
      sources: { codex: [{ record: "Una línea event_msg de tipo patch_apply_end" }] },
    },
    "web.search": {
      summary: "Una búsqueda web que hizo el modelo; sus resultados se añaden al contexto.",
      sources: { codex: [{ record: "Una línea event_msg de tipo web_search_end" }] },
    },

    "subagent.deselected": { summary: "Se quitó el foco del subagente y el control volvió al agente principal." },
    "subagent.activity": {
      summary: "Actividad informada por un subagente que trabaja bajo el agente principal.",
      sources: { codex: [{ record: "Una línea event_msg de tipo sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Un mensaje entre agentes.",
      sources: { codex: [{ record: "Una línea inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "Empezó un hilo de subagente dentro de esta sesión.",
      sources: { codex: [{ record: "Una línea session_meta posterior a la primera" }] },
    },
  },

  unknownSummary: "Un evento de la categoría «{category}» («{name}») que aún no tiene descripción.",
  unknownCategory: "desconocida",
  unknownName: "general",
  unknownDetail:
    "El agente escribió un registro para el que la app no tiene correspondencia. Se conserva con sus datos tal cual, así que no se pierde nada, y se muestra con la tarjeta genérica.",

  callAndResult: "Una llamada y su resultado, mostrados como una sola fila.",
  recordsInOrder: "Los registros de los que se leyó la fila, en el orden de la transcripción.",
  recordTitle: "Registro de {agent}",
  eventFormat: "Formato de eventos",
};
