import { claudeSources, type EventDocs } from "./en";

/** French. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Le résultat est réduit à du texte brut dans result.content. Les images ne gardent que leur type et leur taille ; les pixels restent sur le disque.",
  "En vue compacte, un appel et son résultat forment une seule ligne : Raw et Original affichent donc deux enregistrements.",
];

const CLAUDE_TOOL_USE = "Un enregistrement assistant contenant un bloc tool_use dans message.content";
const CLAUDE_TOOL_RESULT =
  "Un enregistrement user contenant un bloc tool_result, rattaché à son appel par tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code écrit un enregistrement par bloc de contenu d'une réponse en streaming et répète l'usage de la réponse dans chacun. L'usage est compté une seule fois, sur le premier événement de la réponse.";
const ARGUMENT_CHARS =
  "argumentChars est ajouté : la taille des arguments tels qu'écrits, c'est-à-dire ce qu'ils coûtent en contexte.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Nature de l'enregistrement : user, assistant, system, attachment, mode, …",
  subtype: "Nature d'un enregistrement system : api_error, compact_boundary, turn_duration, …",
  uuid: "Id de l'enregistrement.",
  parentUuid: "Enregistrement que celui-ci suit dans la conversation.",
  isSidechain: "Écrit par un sous-agent plutôt que par la conversation principale.",
  timestamp: "Moment de l'écriture, ISO 8601.",
  sessionId: "Session à laquelle appartient l'enregistrement ; un fork garde l'id de son parent sur les enregistrements copiés.",
  cwd: "Répertoire de travail.",
  gitBranch: "Branche Git à ce moment-là.",
  version: "Version de Claude Code qui a écrit l'enregistrement.",
  entrypoint: "Où Claude Code s'exécutait : cli, claude-desktop, …",
  userType: "Qui pilote la session.",
  requestId: "Id de la requête API.",
  promptId: "Prompt auquel appartient l'enregistrement.",
  effort: "Effort de raisonnement de la requête.",
  message: "Le message API, tel qu'envoyé ou reçu.",
  "message.role": "user ou assistant.",
  "message.model": "Modèle qui a répondu ; <synthetic> pour les messages écrits par Claude Code lui-même.",
  "message.id": "Id du message API ; partagé par tous les enregistrements d'une même réponse en streaming.",
  "message.type": "Toujours message.",
  "message.content": "Une chaîne, ou une liste de blocs de contenu.",
  "message.content[].type": "Nature du bloc : text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Texte d'un bloc text.",
  "message.content[].thinking": "Raisonnement d'un bloc thinking.",
  "message.content[].signature": "Signature permettant de renvoyer le raisonnement à l'API.",
  "message.content[].id": "Id d'un bloc tool_use.",
  "message.content[].name": "Outil appelé par un bloc tool_use.",
  "message.content[].input": "Arguments d'un bloc tool_use.",
  "message.content[].tool_use_id": "Appel auquel répond un bloc tool_result.",
  "message.content[].content": "Ce que l'outil a renvoyé.",
  "message.content[].is_error": "L'outil a signalé un échec.",
  "message.stop_reason": "Pourquoi la réponse s'est arrêtée : end_turn, tool_use, max_tokens, …",
  "message.usage": "Usage de tokens de toute la réponse, répété sur chacun de ses enregistrements.",
  "message.usage.input_tokens": "Tokens d'entrée ni lus depuis le cache ni écrits dans celui-ci.",
  "message.usage.output_tokens": "Tokens de sortie.",
  "message.usage.cache_read_input_tokens": "Tokens d'entrée lus depuis le cache.",
  "message.usage.cache_creation_input_tokens": "Tokens d'entrée écrits dans le cache.",
  "message.usage.cache_creation": "Écritures en cache réparties par durée de vie.",
  "message.usage.speed": "fast quand la requête s'est exécutée en mode rapide.",
  toolUseResult: "La copie structurée, propre à Claude Code, d'un résultat d'outil.",
  attachment: "Contexte injecté par Claude Code ; son type en indique la nature.",
  "attachment.type": "Nature de la pièce jointe : prompt_snapshot, instructions, file, date, …",
  content: "Texte d'un enregistrement system.",
  level: "Gravité d'un enregistrement system.",
  error: "Détails de l'erreur d'un enregistrement api_error.",
};

export const fr: EventDocs = {
  providerFormats: {
    claude:
      "JSONL dans ~/.claude/projects/<project>/<session>.jsonl : un enregistrement JSON par ligne, de type user, assistant, system, attachment, etc. Chaque enregistrement porte la version de Claude Code qui l'a écrit.",
    cowork:
      "La CLI Claude Code s'exécute dans chaque session Cowork et écrit la même transcription JSONL : elle est donc lue exactement comme Claude Code.",
    codex:
      "JSONL dans ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl : lignes {timestamp, type, payload} de type session_meta, event_msg, response_item, turn_context. Seul session_meta indique la version de la CLI.",
    copilot:
      "JSONL dans ~/.copilot/session-state/<id>/events.jsonl, déjà écrit sous la forme {type, data, id, timestamp, parentId} avec le même vocabulaire category.subCategory que cette application. session.start indique la version du format et celle de la CLI.",
    vscode:
      "Fichiers de session de chat (JSON, ou JSONL de modifications ajoutées) dans le stockage d'espace de travail de VS Code, une paire requête/réponse par entrée.",
    gemini:
      "Fichiers de session dans ~/.gemini/tmp/<project>/chats. Chaque message est de type user, gemini, info, warning ou error ; un message réécrit remplace sa version précédente.",
    opencode:
      "SQLite (opencode.db) : lignes session, message et part, chacune gardant son contenu dans une colonne JSON.",
    cursor:
      "Bases SQLite dans ~/.cursor/projects, qui stockent la conversation sous forme de lignes bubble : 1 pour l'utilisateur, 2 pour l'agent.",
    hermes: "SQLite (state.db) dans ~/.hermes : les sessions et leurs messages sous forme de lignes.",
  },

  sharedChanges: [
    "Le type est renommé dans le vocabulaire commun category.subCategory, pour que les événements de tous les agents se lisent de la même façon.",
    "Le texte long est coupé à 20 000 caractères. charLength conserve la longueur complète et truncated indique la coupure ; l'enregistrement d'origine n'est pas coupé.",
    "Un enregistrement peut donner plusieurs événements (une réponse avec texte, raisonnement et appels d'outils), et certains enregistrements de pure gestion sont ignorés.",
  ],

  fieldDocs: {
    content: "Texte du message, limité à 20 000 caractères.",
    charLength: "Longueur complète du texte avant la limite.",
    truncated: "True quand le texte affiché a été coupé.",
    model: "Modèle qui a produit ceci, tel que l'agent le nomme.",
    effort: "Effort de raisonnement de la requête.",
    requestId: "Id de la requête API, pour la retrouver dans les journaux du fournisseur.",
    role: "Provenance du texte : system_prompt, instructions, developer, user_context, …",
    toolName: "Outil appelé par le modèle ; mcp__server__tool pour les outils MCP.",
    toolCallId: "Id reliant un appel à son résultat.",
    arguments: "Arguments passés à l'outil par le modèle, convertis en JSON.",
    argumentChars: "Taille des arguments tels que le modèle les a écrits, c'est-à-dire ce qu'ils coûtent en contexte.",
    result: "Ce que l'outil a renvoyé, réduit à {content, format, images?, detail?}.",
    resultChars: "Longueur complète du résultat avant la limite.",
    success: "False quand l'appel a signalé un échec.",
    inputTokens: "Tokens d'entrée de la requête, y compris ceux écrits en cache.",
    outputTokens: "Tokens de sortie de la réponse, raisonnement compris.",
    cacheReadTokens: "Tokens d'entrée servis depuis le cache de prompts.",
    billedUsage: "Usage réparti selon sa tarification, utilisé pour l'estimation du coût.",
    costUSD: "Coût estimé de cette requête aux prix publics de l'API.",
    inherited: "Copié depuis la session d'origine du fork ; son coût appartient à celle-ci.",
    durationMs: "Durée, en millisecondes.",
    sessionId: "Id de la session.",
    context: "Répertoire de travail, branche et dépôt dans lesquels la session s'est exécutée.",
    attachmentType: "Le nom propre à l'agent pour ce type de contexte.",
    label: "Nom lisible du type de pièce jointe.",
    subject: "Objet de la pièce jointe : un fichier, une date, un hook…",
    items: "Noms listés par la pièce jointe (outils, skills, agents), 200 au plus.",
    itemCount: "Nombre de noms listés au total par la pièce jointe.",
    itemsLabel: "Ce que sont les noms listés.",
    message: "Texte de l'erreur ou de l'avis.",
    reason: "Pourquoi c'est arrivé.",
    mode: "Le mode activé.",
    trigger: "Ce qui l'a déclenché : manual ou auto.",
    preTokens: "Taille du contexte avant la compaction.",
    turnId: "Id du tour.",
    totalCostUSD: "Coût de la session jusqu'ici, selon l'agent lui-même.",
    apiDurationMs: "Temps total d'attente de l'API jusqu'ici.",
    premiumRequests: "Requêtes premium comptées jusqu'ici.",
    sessionTotals: "Totaux de session signalés par l'agent, utilisés pour le résumé de la session.",
    usage: "Totaux d'usage tels que l'agent les a signalés.",
    selectedModel: "Modèle choisi au début de la session.",
    copilotVersion: "Version de la CLI de l'agent qui a écrit la session.",
    cliVersion: "Version de la CLI de l'agent qui a écrit la session.",
    entrypoint: "Où la session s'est exécutée : cli, claude-desktop, …",
    forkedFrom: "La session dont celle-ci est un fork.",
  },

  pathDocs: {
    type: "Type d'événement, category.subCategory.",
    data: "Ce que l'agent a enregistré, normalisé là où cela en vaut la peine.",
    id: "Id unique de l'événement dans la session.",
    timestamp: "Moment où il s'est produit, ISO 8601.",
    parentId: "Événement dont celui-ci découle, quand l'agent l'enregistre.",
    source: "Emplacement de l'enregistrement d'origine : sa ligne dans la transcription, ou l'id propre à l'agent.",
    category: "Première partie du type, utilisée par les filtres.",
    subCategory: "Reste du type, utilisé par les filtres.",
    subKey: "Type complet, utilisé par les filtres.",
    "data.result.content": "Texte brut du résultat, limité. Les résultats JSON sont indentés.",
    "data.result.format": "text ou json.",
    "data.result.images": "Images renvoyées par l'outil : type et taille uniquement.",
    "data.result.detail": "Un second rendu ajouté par certains outils, généralement un diff.",
    "data.context.cwd": "Répertoire de travail.",
    "data.context.branch": "Branche Git.",
    "data.context.repository": "Dépôt Git.",
    "data.billedUsage.model": "Modèle au tarif duquel l'usage est calculé.",
    "data.billedUsage.inputTokens": "Tokens d'entrée ni lus depuis le cache ni écrits dans celui-ci.",
    "data.billedUsage.outputTokens": "Tokens de sortie.",
    "data.billedUsage.cacheReadTokens": "Tokens d'entrée lus depuis le cache.",
    "data.billedUsage.cacheWriteTokens": "Tokens d'entrée écrits dans le cache de 5 minutes.",
    "data.billedUsage.cacheWrite1hTokens": "Tokens d'entrée écrits dans le cache d'une heure.",
    "data.billedUsage.fast": "Exécuté en mode rapide, facturé à un tarif plus élevé.",
    "data.billedUsage.local": "Exécuté sur un modèle local, qui ne coûte rien.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Moment où la ligne a été écrite, ISO 8601.",
      ordinal: "Position de la ligne dans le rollout.",
      type: "Nature de la ligne : session_meta, event_msg, response_item, turn_context, …",
      payload: "Le contenu de la ligne ; son propre type indique ce que c'est.",
      "payload.type": "Nature du payload : user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id de la session (session_meta) ou de l'élément.",
      "payload.cli_version": "Version de la CLI Codex, sur session_meta uniquement.",
      "payload.originator": "Application qui a lancé Codex.",
      "payload.cwd": "Répertoire de travail.",
      "payload.role": "Auteur d'un message : user, assistant, developer, system.",
      "payload.content": "Parties du contenu d'un message.",
      "payload.content[].type": "Nature de la partie : input_text, output_text, …",
      "payload.content[].text": "Texte de la partie.",
      "payload.message": "Texte d'un message event_msg.",
      "payload.call_id": "Id reliant un appel d'outil à sa sortie.",
      "payload.name": "Outil appelé.",
      "payload.arguments": "Arguments de l'outil, sous forme de chaîne JSON.",
      "payload.input": "Entrée d'un appel d'outil personnalisé.",
      "payload.output": "Ce que l'outil a renvoyé.",
      "payload.status": "Statut de l'appel.",
      "payload.turn_id": "Tour auquel appartient la ligne.",
      "payload.info": "Usage de tokens : totaux cumulés et ceux de la dernière requête.",
    },
    copilot: {
      type: "Type d'événement, déjà sous la forme category.subCategory.",
      data: "Données de l'événement.",
      id: "Id de l'événement.",
      timestamp: "Moment où il s'est produit, ISO 8601.",
      parentId: "Événement dont celui-ci découle.",
      "data.version": "Version du format events.jsonl.",
      "data.copilotVersion": "Version de la CLI Copilot.",
      "data.producer": "Ce qui a écrit le fichier.",
      "data.toolCallId": "Id reliant un appel à son résultat.",
      "data.toolName": "Outil appelé.",
      "data.arguments": "Arguments de l'outil.",
      "data.result": "Ce que l'outil a renvoyé : content, et detailedContent quand l'outil en ajoute un.",
      "data.error": "Pourquoi un appel en échec a échoué.",
    },
  },

  events: {
    "session.start": {
      summary: "Initialisation de la session. Capture le contexte d'exécution et le modèle choisi au début d'une session.",
      sources: {
        ...claudeSources([
          {
            record: "Aucun enregistrement : Claude Code n'écrit pas d'enregistrement de début",
            note: "L'application en construit un à partir des champs cwd, gitBranch, version et entrypoint des enregistrements, pour que la chronologie s'ouvre sur le même en-tête pour tous les agents.",
          },
        ]),
        codex: [{ record: "La première ligne session_meta", note: "Les lignes session_meta suivantes sont des fils de sous-agents et deviennent subagent.session_start." }],
        copilot: [{ record: "session.start, lu tel quel" }],
      },
    },
    "session.resume": { summary: "Session reprise depuis un état précédent. Indique le rechargement du contexte et la reprise." },
    "session.shutdown": {
      summary: "Bilan de fin de session. Contient généralement l'usage, les totaux de tokens, les requêtes premium et les temps d'API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "L'application en tire sessionTotals et usageSummary. Les totaux sont cumulés : seul le dernier shutdown est tarifé et une session reprise n'est pas comptée deux fois.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Résultat du choix de modèle en mode automatique. Montre le profil de tâche prévu et les réglages de modèle retenus." },
    "session.binary_asset": { summary: "Données binaires capturées dans la session, le plus souvent des captures d'écran. Peuvent occuper beaucoup de contexte et de stockage." },
    "session.usage_checkpoint": {
      summary: "Décompte intermédiaire de l'usage pendant que la session est active.",
      sources: {
        ...claudeSources([{ record: "Un enregistrement cost-state", note: "totalCostUSD et totalAPIDuration sont recopiés tels que signalés." }]),
        codex: [
          {
            record: "Une ligne event_msg de type token_count",
            note: "Codex signale des totaux cumulés : l'application ne facture que l'écart depuis le point de contrôle précédent et sort les tokens en cache de input_tokens pour que chacun ne soit tarifé qu'une fois.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Décompte premium/AIU uniquement, sans totaux de tokens ; premiumRequests est recopié depuis totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Configuration du modèle changée pendant la session (modèle, effort ou palier de contexte).",
      sources: { codex: [{ record: "Une ligne event_msg de type thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Compaction du contexte commencée. La conversation est résumée pour réduire les tokens envoyés à chaque requête.",
      sources: claudeSources([{ record: "Un enregistrement system avec le subtype compact_boundary", note: "trigger et preTokens proviennent de compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Compaction terminée, avec les métadonnées de succès ou d'échec et les ids de requête." },
    "session.error": {
      summary: "Erreur d'API ou de transport. Chaque nouvelle tentative renvoie tout le contexte de la requête.",
      sources: {
        ...claudeSources([{ record: "Un enregistrement system avec le subtype api_error" }]),
        gemini: [{ record: "Un message de type error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Le tour a été interrompu avant d'aboutir.",
      changes: ["Chaque agent marque une interruption à sa façon ; toutes deviennent ce type unique."],
      sources: {
        ...claudeSources([
          {
            record: "Un enregistrement user dont le texte commence par « [Request interrupted by user »",
            note: "Claude Code consigne l'interruption comme si l'utilisateur l'avait tapée ; l'application ne l'affiche pas comme un prompt.",
          },
        ]),
        codex: [{ record: "Une ligne event_msg de type turn_aborted" }],
        copilot: [{ record: "Un événement abort", note: "Renommé ; les données sont conservées telles qu'écrites." }],
      },
    },
    "session.mode_change": {
      summary: "Mode d'interaction ou de permission changé pendant la session.",
      sources: claudeSources([{ record: "Un enregistrement mode ou permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Configuration d'exécution par tour : modèle, effort, sandbox et politique d'approbation.",
      sources: { codex: [{ record: "Une ligne turn_context" }] },
    },
    "session.world_state": {
      summary: "Instantané de l'espace de travail transmis au modèle par l'environnement.",
      sources: { codex: [{ record: "Une ligne world_state" }] },
    },
    "session.rollback": {
      summary: "La conversation a été ramenée en arrière de plusieurs tours.",
      sources: { codex: [{ record: "Une ligne event_msg de type thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "L'agent a créé ou mis à jour son plan de travail." },
    "session.info": {
      summary: "Un avis affiché par l'agent : une information ou un avertissement.",
      sources: { gemini: [{ record: "Un message de type info ou warning" }] },
    },

    "user.message": {
      summary: "Ce que l'utilisateur a tapé. Cela déclenche le tour suivant de l'assistant.",
      sources: {
        ...claudeSources([
          {
            record: "Un enregistrement user : message.content sous forme de chaîne, ou chacun de ses blocs text",
            note: "Le même type d'enregistrement transporte aussi les résultats d'outils, qui deviennent tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Une ligne event_msg de type user_message" },
          {
            record: "Un message response_item avec le role user, seulement dans les anciens rollouts",
            note: "Les rollouts récents contiennent la conversation en double, en event_msg (ce qu'a vu l'utilisateur) et en response_item (ce qu'a vu le modèle). L'application utilise event_msg pour ne pas dédoubler les tours ; la copie response_item devient system.message.",
          },
        ],
        copilot: [{ record: "user.message, lu tel quel" }],
        gemini: [{ record: "Un message de type user" }],
      },
    },
    "assistant.message": {
      summary: "Texte renvoyé par le modèle, avec le nom du modèle et l'usage de tokens.",
      fields: {
        phase: "Codex : partie du tour à laquelle appartient le message.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Un enregistrement assistant contenant un bloc text dans message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Une réponse sans texte, raisonnement ni appel d'outil devient tout de même un message vide, pour que son usage soit compté.`,
          },
        ]),
        codex: [
          { record: "Une ligne event_msg de type agent_message" },
          { record: "Un message response_item avec le role assistant, seulement en l'absence de copie event_msg" },
        ],
        copilot: [{ record: "assistant.message, lu tel quel" }],
        gemini: [{ record: "Le contenu d'un message de type gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Raisonnement produit par le modèle avant de répondre. Facturé comme tokens de sortie.",
      sources: {
        ...claudeSources([{ record: "Un enregistrement assistant contenant un bloc thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Une ligne event_msg de type agent_reasoning" },
          { record: "Un response_item de type reasoning, d'après son summary", note: "Un raisonnement uniquement chiffré n'a rien de lisible et est ignoré." },
        ],
        gemini: [{ record: "Chaque entrée de thoughts d'un message de type gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Début d'un tour de l'assistant.",
      sources: { codex: [{ record: "Une ligne event_msg de type task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Fin du tour de l'assistant, après son raisonnement, ses appels d'outils et sa sortie.",
      sources: {
        ...claudeSources([{ record: "Un enregistrement system avec le subtype turn_duration" }]),
        codex: [{ record: "Une ligne event_msg de type task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Le modèle a appelé un outil intégré, avec son nom et ses arguments.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Les outils nommés mcp__… deviennent plutôt external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "Un response_item de type function_call, custom_tool_call ou local_shell_call",
            note: "Les arguments écrits sous forme de chaîne JSON sont convertis en objet.",
          },
        ],
        copilot: [{ record: "tool.execution_start, lu tel quel" }],
        gemini: [{ record: "Chaque entrée de toolCalls d'un message de type gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Un appel d'outil intégré s'est terminé, avec son statut et son résultat.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Le nom de l'outil vient de l'appel correspondant. Quand le bloc n'a pas de contenu, le toolUseResult de l'enregistrement est utilisé. success vaut false quand is_error est défini.",
          },
        ]),
        codex: [
          {
            record: "Un response_item de type function_call_output, custom_tool_call_output ou local_shell_call_output",
            note: "Codex n'enregistre aucun indicateur de succès ; l'application marque un appel en échec quand sa sortie signale un code de sortie non nul.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content devient le texte du résultat, le error.message d'un appel en échec le remplace, et detailedContent (généralement un diff) devient result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Le modèle a appelé un outil servi par une passerelle externe, généralement un serveur MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, pour un outil nommé mcp__…` }]),
        copilot: [{ record: "external_tool.requested, lu tel quel" }],
      },
    },
    "external_tool.completed": {
      summary: "Un appel d'outil externe s'est terminé, avec son statut et son résultat.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, pour un outil nommé mcp__…` }]),
        codex: [{ record: "Une ligne event_msg de type mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Même forme que tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "L'environnement a demandé à l'utilisateur l'autorisation d'une action (fichier, système ou réseau)." },
    "permission.completed": { summary: "La demande d'autorisation a été tranchée : approuvée ou refusée." },
    "hook.start": { summary: "Un hook de cycle de vie a démarré, par exemple à l'envoi d'un prompt." },
    "hook.end": {
      summary: "Un hook de cycle de vie s'est terminé, avec succès ou en échec.",
      sources: claudeSources([{ record: "Un enregistrement system avec le subtype stop_hook_summary", note: "success vaut false quand l'enregistrement liste des erreurs de hook." }]),
    },

    "system.message": {
      summary: "Instructions placées par l'environnement devant le modèle : le prompt système, les fichiers d'instructions ou le contexte injecté.",
      detail: "Elles sont envoyées à chaque requête, leur taille s'additionne donc au fil de la session. L'interrupteur de la barre d'outils les masque avec le reste du contexte injecté.",
      sources: {
        ...claudeSources([
          { record: "Un enregistrement attachment de type prompt_snapshot", note: "Claude Code réenregistre le prompt système dès qu'une partie change ; l'application ne l'affiche que si le texte du prompt lui-même a changé." },
          { record: "Un enregistrement attachment de type instructions (fichiers CLAUDE.md et AGENTS.md)" },
          { record: "Un enregistrement system de tout autre subtype" },
        ]),
        codex: [
          { record: "base_instructions sur la ligne session_meta" },
          { record: "Un message response_item avec le role developer ou system" },
          { record: "Un message response_item avec le role user injecté par l'environnement, affiché avec le role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Contexte ajouté de lui-même par l'environnement : instantanés de fichiers, rappels, listes d'outils ou de skills, images.",
      changes: ["Chaque type de pièce jointe est aplati en {label, subject, items, content}, pour se lire comme du contenu plutôt que du JSON brut."],
      sources: {
        ...claudeSources([
          { record: "Un enregistrement attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "La liste d'outils d'une pièce jointe prompt_snapshot, affichée comme définitions d'outils quand elle change" },
          { record: "Un bloc image dans un enregistrement user", note: "Seul le fait qu'une image a été envoyée est conservé ; les pixels restent sur le disque." },
        ]),
        codex: [{ record: "dynamic_tools sur la ligne session_meta, affiché comme définitions d'outils" }],
      },
    },
    "system.notification": { summary: "Une notification de l'environnement ajoutée à la conversation, par exemple la fin d'un shell en arrière-plan." },

    "file.patch_applied": {
      summary: "Un patch appliqué par l'agent à l'espace de travail, avec les fichiers touchés.",
      sources: { codex: [{ record: "Une ligne event_msg de type patch_apply_end" }] },
    },
    "web.search": {
      summary: "Une recherche web lancée par le modèle ; ses résultats sont ajoutés au contexte.",
      sources: { codex: [{ record: "Une ligne event_msg de type web_search_end" }] },
    },

    "subagent.deselected": { summary: "Le focus sur le sous-agent a été levé et la main est revenue à l'agent principal." },
    "subagent.activity": {
      summary: "Activité signalée par un sous-agent travaillant sous l'agent principal.",
      sources: { codex: [{ record: "Une ligne event_msg de type sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Un message échangé entre agents.",
      sources: { codex: [{ record: "Une ligne inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "Un fil de sous-agent a démarré dans cette session.",
      sources: { codex: [{ record: "Une ligne session_meta après la première" }] },
    },
  },

  unknownSummary: "Un événement de la catégorie « {category} » (« {name} ») qui n'a pas encore de description.",
  unknownCategory: "inconnue",
  unknownName: "général",
  unknownDetail:
    "L'agent a écrit un enregistrement pour lequel l'application n'a pas de correspondance. Il est conservé avec ses données telles qu'écrites, donc rien n'est perdu, et affiché avec la carte générique.",

  callAndResult: "Un appel et son résultat, affichés sur une seule ligne.",
  recordsInOrder: "Les enregistrements dont la ligne est issue, dans l'ordre de la transcription.",
  recordTitle: "Enregistrement {agent}",
  eventFormat: "Format des événements",
};
