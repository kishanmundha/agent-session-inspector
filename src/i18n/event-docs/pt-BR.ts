import { claudeSources, type EventDocs } from "./en";

/** Brazilian Portuguese. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "O resultado é reduzido a texto simples em result.content. Imagens mantêm apenas tipo e tamanho; os pixels ficam no disco.",
  "Na visualização compacta, uma chamada e seu resultado aparecem como uma única linha, então Raw e Original mostram dois registros.",
];

const CLAUDE_TOOL_USE = "Um registro assistant com um bloco tool_use em message.content";
const CLAUDE_TOOL_RESULT =
  "Um registro user com um bloco tool_result, associado à sua chamada por tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "O Claude Code grava um registro por bloco de conteúdo de uma resposta em streaming e repete o uso da resposta em cada um. O uso é contado uma vez, no primeiro evento da resposta.";
const ARGUMENT_CHARS =
  "argumentChars é adicionado: o tamanho dos argumentos como foram escritos, que é o quanto custam no contexto.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Tipo de registro: user, assistant, system, attachment, mode, …",
  subtype: "Tipo de registro system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id do registro.",
  parentUuid: "Registro que este segue na conversa.",
  isSidechain: "Gravado por um subagente, e não pela conversa principal.",
  timestamp: "Quando foi gravado, ISO 8601.",
  sessionId: "Sessão à qual o registro pertence; um fork mantém o id do pai nos registros copiados.",
  cwd: "Diretório de trabalho.",
  gitBranch: "Branch do Git naquele momento.",
  version: "Versão do Claude Code que gravou o registro.",
  entrypoint: "Onde o Claude Code rodou: cli, claude-desktop, …",
  userType: "Quem está conduzindo a sessão.",
  requestId: "Id da requisição à API.",
  promptId: "Prompt ao qual o registro pertence.",
  effort: "Nível de raciocínio da requisição.",
  message: "A mensagem da API, como foi enviada ou recebida.",
  "message.role": "user ou assistant.",
  "message.model": "Modelo que respondeu; <synthetic> para mensagens que o próprio Claude Code escreveu.",
  "message.id": "Id da mensagem da API; compartilhado por todos os registros de uma resposta em streaming.",
  "message.type": "Sempre message.",
  "message.content": "Uma string ou uma lista de blocos de conteúdo.",
  "message.content[].type": "Tipo de bloco: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Texto de um bloco text.",
  "message.content[].thinking": "Raciocínio de um bloco thinking.",
  "message.content[].signature": "Assinatura que permite reenviar o raciocínio à API.",
  "message.content[].id": "Id de um bloco tool_use.",
  "message.content[].name": "Ferramenta chamada por um bloco tool_use.",
  "message.content[].input": "Argumentos de um bloco tool_use.",
  "message.content[].tool_use_id": "Chamada à qual um bloco tool_result responde.",
  "message.content[].content": "O que a ferramenta retornou.",
  "message.content[].is_error": "A ferramenta relatou falha.",
  "message.stop_reason": "Por que a resposta terminou: end_turn, tool_use, max_tokens, …",
  "message.usage": "Uso de tokens da resposta inteira, repetido em cada um de seus registros.",
  "message.usage.input_tokens": "Tokens de entrada que não foram lidos do cache nem gravados nele.",
  "message.usage.output_tokens": "Tokens de saída.",
  "message.usage.cache_read_input_tokens": "Tokens de entrada lidos do cache.",
  "message.usage.cache_creation_input_tokens": "Tokens de entrada gravados no cache.",
  "message.usage.cache_creation": "Gravações no cache divididas por tempo de vida.",
  "message.usage.speed": "fast quando a requisição rodou no modo rápido.",
  toolUseResult: "A cópia estruturada do próprio Claude Code de um resultado de ferramenta.",
  attachment: "Contexto que o Claude Code injetou; o type diz de que tipo.",
  "attachment.type": "Tipo de anexo: prompt_snapshot, instructions, file, date, …",
  content: "Texto de um registro system.",
  level: "Gravidade de um registro system.",
  error: "Detalhes do erro de um registro api_error.",
};

export const ptBR: EventDocs = {
  providerFormats: {
    claude:
      "JSONL em ~/.claude/projects/<project>/<session>.jsonl: um registro JSON por linha, do tipo user, assistant, system, attachment etc. Cada registro traz a versão do Claude Code que o gravou.",
    cowork:
      "A CLI do Claude Code roda dentro de cada sessão do Cowork e grava a mesma transcrição JSONL, então ela é lida exatamente como o Claude Code.",
    codex:
      "JSONL em ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: linhas {timestamp, type, payload} do tipo session_meta, event_msg, response_item, turn_context. Só session_meta informa a versão da CLI.",
    copilot:
      "JSONL em ~/.copilot/session-state/<id>/events.jsonl, já gravado como {type, data, id, timestamp, parentId} no mesmo vocabulário category.subCategory que este app usa. session.start informa a versão do formato e a da CLI.",
    vscode:
      "Arquivos de sessão de chat (JSON, ou JSONL de alterações acrescentadas) no armazenamento do workspace do VS Code, um par requisição/resposta por entrada.",
    gemini:
      "Arquivos de sessão em ~/.gemini/tmp/<project>/chats. Cada mensagem é do tipo user, gemini, info, warning ou error; uma mensagem gravada de novo substitui a versão anterior.",
    opencode:
      "SQLite (opencode.db): linhas de session, message e part, cada uma com o conteúdo numa coluna JSON.",
    cursor:
      "Bancos SQLite em ~/.cursor/projects, que guardam a conversa como linhas bubble: 1 para o usuário, 2 para o agente.",
    hermes: "SQLite (state.db) em ~/.hermes: as sessões e suas mensagens como linhas.",
  },

  sharedChanges: [
    "O tipo é renomeado para o vocabulário comum category.subCategory, para que os eventos de todos os agentes sejam lidos da mesma forma.",
    "Texto longo é cortado em 20.000 caracteres. charLength guarda o tamanho completo e truncated indica o corte; o registro original não é cortado.",
    "Um registro pode virar vários eventos (uma resposta com texto, raciocínio e chamadas de ferramenta), e alguns registros de controle interno são ignorados.",
  ],

  fieldDocs: {
    content: "Texto da mensagem, limitado a 20.000 caracteres.",
    charLength: "Tamanho completo do texto antes do limite.",
    truncated: "True quando o texto exibido foi cortado.",
    model: "Modelo que produziu isto, com o nome dado pelo agente.",
    effort: "Nível de raciocínio com que a requisição rodou.",
    requestId: "Id da requisição à API, para cruzar com os logs do provedor.",
    role: "De onde veio o texto: system_prompt, instructions, developer, user_context, …",
    toolName: "Ferramenta que o modelo chamou; mcp__server__tool para ferramentas MCP.",
    toolCallId: "Id que liga uma chamada ao seu resultado.",
    arguments: "Argumentos que o modelo passou à ferramenta, convertidos para JSON.",
    argumentChars: "Tamanho dos argumentos como o modelo os escreveu, que é o quanto custam no contexto.",
    result: "O que a ferramenta retornou, reduzido a {content, format, images?, detail?}.",
    resultChars: "Tamanho completo do resultado antes do limite.",
    success: "False quando a chamada relatou falha.",
    inputTokens: "Tokens de entrada da requisição, incluindo os gravados no cache.",
    outputTokens: "Tokens de saída da resposta, incluindo o raciocínio.",
    cacheReadTokens: "Tokens de entrada servidos pelo cache de prompts.",
    billedUsage: "Uso dividido conforme é cobrado, usado na estimativa de custo.",
    costUSD: "Custo estimado desta requisição pelos preços de tabela da API.",
    inherited: "Copiado da sessão de onde esta foi bifurcada; o custo pertence a ela.",
    durationMs: "Quanto tempo levou, em milissegundos.",
    sessionId: "Id da sessão.",
    context: "Diretório de trabalho, branch e repositório em que a sessão rodou.",
    attachmentType: "O nome que o próprio agente dá a esse tipo de contexto.",
    label: "Nome legível do tipo de anexo.",
    subject: "Do que trata o anexo: um arquivo, uma data, um hook…",
    items: "Nomes listados pelo anexo (ferramentas, skills, agentes), no máximo 200.",
    itemCount: "Quantos nomes o anexo listou ao todo.",
    itemsLabel: "O que são os nomes listados.",
    message: "Texto do erro ou aviso.",
    reason: "Por que aconteceu.",
    mode: "O modo para o qual se mudou.",
    trigger: "O que iniciou: manual ou auto.",
    preTokens: "Tamanho do contexto antes da compactação.",
    turnId: "Id do turno.",
    totalCostUSD: "Custo da sessão até agora, segundo o próprio agente.",
    apiDurationMs: "Tempo total de espera pela API até agora.",
    premiumRequests: "Requisições premium contadas até agora.",
    sessionTotals: "Totais da sessão informados pelo agente, usados no resumo da sessão.",
    usage: "Totais de uso como o agente os informou.",
    selectedModel: "Modelo escolhido quando a sessão começou.",
    copilotVersion: "Versão da CLI do agente que gravou a sessão.",
    cliVersion: "Versão da CLI do agente que gravou a sessão.",
    entrypoint: "Onde a sessão rodou: cli, claude-desktop, …",
    forkedFrom: "A sessão de onde esta foi bifurcada.",
  },

  pathDocs: {
    type: "Tipo de evento, category.subCategory.",
    data: "O que o agente registrou, normalizado onde vale a pena.",
    id: "Id único do evento dentro da sessão.",
    timestamp: "Quando aconteceu, ISO 8601.",
    parentId: "Evento de onde este decorre, quando o agente registra.",
    source: "Onde está o registro original: sua linha na transcrição, ou o id do próprio agente.",
    category: "Primeira parte do tipo, usada pelos filtros.",
    subCategory: "Resto do tipo, usado pelos filtros.",
    subKey: "Tipo completo, usado pelos filtros.",
    "data.result.content": "Texto simples do resultado, limitado. Resultados JSON são indentados.",
    "data.result.format": "text ou json.",
    "data.result.images": "Imagens que a ferramenta retornou: só tipo e tamanho.",
    "data.result.detail": "Uma segunda representação que algumas ferramentas adicionam, geralmente um diff.",
    "data.context.cwd": "Diretório de trabalho.",
    "data.context.branch": "Branch do Git.",
    "data.context.repository": "Repositório Git.",
    "data.billedUsage.model": "Modelo pelo qual o uso é cobrado.",
    "data.billedUsage.inputTokens": "Tokens de entrada que não foram lidos do cache nem gravados nele.",
    "data.billedUsage.outputTokens": "Tokens de saída.",
    "data.billedUsage.cacheReadTokens": "Tokens de entrada lidos do cache.",
    "data.billedUsage.cacheWriteTokens": "Tokens de entrada gravados no cache de 5 minutos.",
    "data.billedUsage.cacheWrite1hTokens": "Tokens de entrada gravados no cache de 1 hora.",
    "data.billedUsage.fast": "Rodou no modo rápido, cobrado a uma tarifa maior.",
    "data.billedUsage.local": "Rodou num modelo local, que não cobra nada.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Quando a linha foi gravada, ISO 8601.",
      ordinal: "Posição da linha no rollout.",
      type: "Tipo de linha: session_meta, event_msg, response_item, turn_context, …",
      payload: "O conteúdo da linha; o próprio type diz o que é.",
      "payload.type": "Tipo de payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id da sessão (session_meta) ou do item.",
      "payload.cli_version": "Versão da CLI do Codex, só em session_meta.",
      "payload.originator": "App que executou o Codex.",
      "payload.cwd": "Diretório de trabalho.",
      "payload.role": "De quem é a mensagem: user, assistant, developer, system.",
      "payload.content": "Partes do conteúdo de uma mensagem.",
      "payload.content[].type": "Tipo de parte: input_text, output_text, …",
      "payload.content[].text": "Texto da parte.",
      "payload.message": "Texto de uma mensagem event_msg.",
      "payload.call_id": "Id que liga uma chamada de ferramenta à sua saída.",
      "payload.name": "Ferramenta chamada.",
      "payload.arguments": "Argumentos da ferramenta, como string JSON.",
      "payload.input": "Entrada de uma chamada de ferramenta personalizada.",
      "payload.output": "O que a ferramenta retornou.",
      "payload.status": "Status da chamada.",
      "payload.turn_id": "Turno ao qual a linha pertence.",
      "payload.info": "Uso de tokens: totais acumulados e os da última requisição.",
    },
    copilot: {
      type: "Tipo de evento, já na forma category.subCategory.",
      data: "Dados do evento.",
      id: "Id do evento.",
      timestamp: "Quando aconteceu, ISO 8601.",
      parentId: "Evento de onde este decorre.",
      "data.version": "Versão do formato events.jsonl.",
      "data.copilotVersion": "Versão da CLI do Copilot.",
      "data.producer": "O que gravou o arquivo.",
      "data.toolCallId": "Id que liga uma chamada ao seu resultado.",
      "data.toolName": "Ferramenta chamada.",
      "data.arguments": "Argumentos da ferramenta.",
      "data.result": "O que a ferramenta retornou: content, e detailedContent quando a ferramenta adiciona um.",
      "data.error": "Por que uma chamada com falha falhou.",
    },
  },

  events: {
    "session.start": {
      summary: "Inicialização da sessão. Registra o contexto de execução e o modelo escolhido quando a sessão começa.",
      sources: {
        ...claudeSources([
          {
            record: "Nenhum registro: o Claude Code não grava registro de início",
            note: "O app monta um a partir de cwd, gitBranch, version e entrypoint dos registros da transcrição, para que a linha do tempo comece com o mesmo cabeçalho para todos os agentes.",
          },
        ]),
        codex: [{ record: "A primeira linha session_meta", note: "Linhas session_meta posteriores são threads de subagentes e viram subagent.session_start." }],
        copilot: [{ record: "session.start, lido como foi gravado" }],
      },
    },
    "session.resume": { summary: "Sessão retomada de um estado anterior. Indica recarga do contexto e continuação." },
    "session.shutdown": {
      summary: "Resumo do fim da sessão. Normalmente inclui uso, totais de tokens, requisições premium e tempos da API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "O app deriva dele sessionTotals e usageSummary. Os totais são acumulados, então só o último shutdown é precificado e uma sessão retomada não é contada duas vezes.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Resultado da escolha de modelo no modo automático. Mostra o perfil de tarefa previsto e as configurações de modelo escolhidas." },
    "session.binary_asset": { summary: "Dados binários capturados na sessão, geralmente capturas de tela. Podem ocupar bastante contexto e armazenamento." },
    "session.usage_checkpoint": {
      summary: "Contabilização parcial do uso enquanto a sessão está ativa.",
      sources: {
        ...claudeSources([{ record: "Um registro cost-state", note: "totalCostUSD e totalAPIDuration são copiados como informados." }]),
        codex: [
          {
            record: "Uma linha event_msg do tipo token_count",
            note: "O Codex informa totais acumulados, então o app cobra só o trecho desde o checkpoint anterior e tira os tokens em cache de input_tokens para que cada um seja precificado uma vez.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Apenas contabilização premium/AIU, sem totais de tokens; premiumRequests é copiado de totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "A configuração do modelo mudou durante a sessão (modelo, nível de raciocínio ou faixa de contexto).",
      sources: { codex: [{ record: "Uma linha event_msg do tipo thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Compactação do contexto iniciada. A conversa é resumida para reduzir os tokens enviados em cada requisição.",
      sources: claudeSources([{ record: "Um registro system com subtype compact_boundary", note: "trigger e preTokens vêm de compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Compactação concluída, com metadados de sucesso ou falha e ids de requisição." },
    "session.error": {
      summary: "Erro de API ou de transporte. Cada nova tentativa reenvia todo o contexto da requisição.",
      sources: {
        ...claudeSources([{ record: "Um registro system com subtype api_error" }]),
        gemini: [{ record: "Uma mensagem do tipo error" }],
      },
    },
    "session.turn_aborted": {
      summary: "O turno foi interrompido antes de terminar.",
      changes: ["Cada agente marca uma interrupção de um jeito; todas viram este único tipo."],
      sources: {
        ...claudeSources([
          {
            record: "Um registro user cujo texto começa com “[Request interrupted by user”",
            note: "O Claude Code registra a interrupção como se o usuário a tivesse digitado; o app não a mostra como prompt.",
          },
        ]),
        codex: [{ record: "Uma linha event_msg do tipo turn_aborted" }],
        copilot: [{ record: "Um evento abort", note: "Renomeado; os dados são mantidos como foram gravados." }],
      },
    },
    "session.mode_change": {
      summary: "O modo de interação ou de permissão mudou durante a sessão.",
      sources: claudeSources([{ record: "Um registro mode ou permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Configuração de execução por turno: modelo, nível de raciocínio, sandbox e política de aprovação.",
      sources: { codex: [{ record: "Uma linha turn_context" }] },
    },
    "session.world_state": {
      summary: "Snapshot do workspace que o ambiente entregou ao modelo.",
      sources: { codex: [{ record: "Uma linha world_state" }] },
    },
    "session.rollback": {
      summary: "A conversa voltou alguns turnos.",
      sources: { codex: [{ record: "Uma linha event_msg do tipo thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "O agente criou ou atualizou seu plano de trabalho." },
    "session.info": {
      summary: "Um aviso que o agente exibiu: uma informação ou um alerta.",
      sources: { gemini: [{ record: "Uma mensagem do tipo info ou warning" }] },
    },

    "user.message": {
      summary: "O que o usuário digitou. Isso dispara o próximo turno do assistente.",
      sources: {
        ...claudeSources([
          {
            record: "Um registro user: message.content como string, ou cada bloco text dentro dele",
            note: "O mesmo tipo de registro também traz resultados de ferramentas, que viram tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Uma linha event_msg do tipo user_message" },
          {
            record: "Uma mensagem response_item com role user, só em rollouts antigos",
            note: "Rollouts mais novos trazem a conversa duas vezes, como event_msg (o que o usuário viu) e response_item (o que o modelo viu). O app usa event_msg para não duplicar turnos; a cópia response_item vira system.message.",
          },
        ],
        copilot: [{ record: "user.message, lido como foi gravado" }],
        gemini: [{ record: "Uma mensagem do tipo user" }],
      },
    },
    "assistant.message": {
      summary: "Texto que o modelo respondeu, com o nome do modelo e o uso de tokens.",
      fields: {
        phase: "Codex: a que parte do turno a mensagem pertence.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Um registro assistant com um bloco text em message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Uma resposta sem texto, raciocínio ou chamada de ferramenta ainda vira uma mensagem vazia, para que seu uso seja contado.`,
          },
        ]),
        codex: [
          { record: "Uma linha event_msg do tipo agent_message" },
          { record: "Uma mensagem response_item com role assistant, só quando não há cópia event_msg" },
        ],
        copilot: [{ record: "assistant.message, lido como foi gravado" }],
        gemini: [{ record: "O conteúdo de uma mensagem do tipo gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Raciocínio que o modelo produziu antes de responder. Cobrado como tokens de saída.",
      sources: {
        ...claudeSources([{ record: "Um registro assistant com um bloco thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Uma linha event_msg do tipo agent_reasoning" },
          { record: "Um response_item do tipo reasoning, usando seu summary", note: "Raciocínio só criptografado não tem nada legível e é ignorado." },
        ],
        gemini: [{ record: "Cada entrada de thoughts numa mensagem do tipo gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Início de um turno do assistente.",
      sources: { codex: [{ record: "Uma linha event_msg do tipo task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Fim do turno do assistente após raciocínio, chamadas de ferramenta e saída.",
      sources: {
        ...claudeSources([{ record: "Um registro system com subtype turn_duration" }]),
        codex: [{ record: "Uma linha event_msg do tipo task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "O modelo chamou uma ferramenta embutida, com nome e argumentos.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Ferramentas chamadas mcp__… viram external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "Um response_item do tipo function_call, custom_tool_call ou local_shell_call",
            note: "Argumentos escritos como string JSON são convertidos em objeto.",
          },
        ],
        copilot: [{ record: "tool.execution_start, lido como foi gravado" }],
        gemini: [{ record: "Cada entrada de toolCalls numa mensagem do tipo gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Uma chamada de ferramenta embutida terminou, com status e resultado.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "O nome da ferramenta vem da chamada correspondente. Quando o bloco não tem conteúdo, usa-se o toolUseResult do registro. success é false quando is_error está definido.",
          },
        ]),
        codex: [
          {
            record: "Um response_item do tipo function_call_output, custom_tool_call_output ou local_shell_call_output",
            note: "O Codex não grava indicador de sucesso; o app marca a chamada como falha quando a saída informa um código de saída diferente de zero.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content vira o texto do resultado, o error.message de uma chamada com falha o substitui, e detailedContent (geralmente um diff) vira result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "O modelo chamou uma ferramenta servida por uma ponte externa, geralmente um servidor MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, para uma ferramenta chamada mcp__…` }]),
        copilot: [{ record: "external_tool.requested, lido como foi gravado" }],
      },
    },
    "external_tool.completed": {
      summary: "Uma chamada de ferramenta externa terminou, com status e resultado.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, para uma ferramenta chamada mcp__…` }]),
        codex: [{ record: "Uma linha event_msg do tipo mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Com o mesmo formato de tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "O ambiente pediu permissão ao usuário para uma ação (arquivo, sistema ou rede)." },
    "permission.completed": { summary: "O pedido de permissão foi resolvido: aprovado ou negado." },
    "hook.start": { summary: "Um hook de ciclo de vida começou, por exemplo ao enviar um prompt." },
    "hook.end": {
      summary: "Um hook de ciclo de vida terminou, com sucesso ou falha.",
      sources: claudeSources([{ record: "Um registro system com subtype stop_hook_summary", note: "success é false quando o registro lista erros de hook." }]),
    },

    "system.message": {
      summary: "Instruções que o ambiente colocou diante do modelo: o prompt de sistema, arquivos de instruções ou contexto injetado.",
      detail: "Elas são enviadas em toda requisição, então o tamanho se acumula ao longo da sessão. O botão da barra de ferramentas as oculta junto com o restante do contexto injetado.",
      sources: {
        ...claudeSources([
          { record: "Um registro attachment do tipo prompt_snapshot", note: "O Claude Code grava o prompt de sistema de novo sempre que qualquer parte muda; o app só o mostra quando o texto do prompt em si mudou." },
          { record: "Um registro attachment do tipo instructions (arquivos CLAUDE.md e AGENTS.md)" },
          { record: "Um registro system de qualquer outro subtype" },
        ]),
        codex: [
          { record: "base_instructions na linha session_meta" },
          { record: "Uma mensagem response_item com role developer ou system" },
          { record: "Uma mensagem response_item com role user injetada pelo ambiente, exibida como role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Contexto que o ambiente adicionou por conta própria: snapshots de arquivos, lembretes, listas de ferramentas ou skills, imagens.",
      changes: ["Todo tipo de anexo é achatado em {label, subject, items, content}, para ser lido como conteúdo e não como JSON bruto."],
      sources: {
        ...claudeSources([
          { record: "Um registro attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "A lista de ferramentas de um anexo prompt_snapshot, exibida como definições de ferramentas quando muda" },
          { record: "Um bloco image num registro user", note: "Só fica registrado que uma imagem foi enviada; os pixels ficam no disco." },
        ]),
        codex: [{ record: "dynamic_tools na linha session_meta, exibido como definições de ferramentas" }],
      },
    },
    "system.notification": { summary: "Uma notificação do ambiente adicionada à conversa, como o fim de um shell em segundo plano." },

    "file.patch_applied": {
      summary: "Um patch que o agente aplicou ao workspace, com os arquivos alterados.",
      sources: { codex: [{ record: "Uma linha event_msg do tipo patch_apply_end" }] },
    },
    "web.search": {
      summary: "Uma busca na web feita pelo modelo; os resultados são adicionados ao contexto.",
      sources: { codex: [{ record: "Uma linha event_msg do tipo web_search_end" }] },
    },

    "subagent.deselected": { summary: "O foco no subagente foi removido e o controle voltou ao agente principal." },
    "subagent.activity": {
      summary: "Atividade relatada por um subagente que trabalha sob o agente principal.",
      sources: { codex: [{ record: "Uma linha event_msg do tipo sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Uma mensagem trocada entre agentes.",
      sources: { codex: [{ record: "Uma linha inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "Uma thread de subagente começou dentro desta sessão.",
      sources: { codex: [{ record: "Uma linha session_meta depois da primeira" }] },
    },
  },

  unknownSummary: "Um evento da categoria “{category}” (“{name}”) que ainda não tem descrição.",
  unknownCategory: "desconhecida",
  unknownName: "geral",
  unknownDetail:
    "O agente gravou um registro para o qual o app não tem mapeamento. Ele é mantido com os dados como foram gravados, então nada se perde, e exibido pelo cartão genérico.",

  callAndResult: "Uma chamada e seu resultado, exibidos como uma única linha.",
  recordsInOrder: "Os registros de onde a linha foi lida, na ordem da transcrição.",
  recordTitle: "Registro do {agent}",
  eventFormat: "Formato de eventos",
};
