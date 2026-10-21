import { claudeSources, type EventDocs } from "./en";

/** German. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Das Ergebnis wird auf reinen Text in result.content reduziert. Bilder behalten nur Typ und Größe; die Pixel bleiben auf der Festplatte.",
  "In der kompakten Ansicht werden ein Aufruf und sein Ergebnis als eine Zeile gezeigt, daher zeigen Raw und Original zwei Einträge.",
];

const CLAUDE_TOOL_USE = "Ein assistant-Eintrag mit einem tool_use-Block in message.content";
const CLAUDE_TOOL_RESULT =
  "Ein user-Eintrag mit einem tool_result-Block, über tool_use_id seinem Aufruf zugeordnet";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code schreibt pro Inhaltsblock einer gestreamten Antwort einen Eintrag und wiederholt die Nutzung der Antwort in jedem. Die Nutzung wird einmal gezählt, beim ersten Ereignis der Antwort.";
const ARGUMENT_CHARS =
  "argumentChars wird ergänzt: die Größe der Argumente wie geschrieben, also das, was sie im Kontext kosten.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Art des Eintrags: user, assistant, system, attachment, mode, …",
  subtype: "Art des system-Eintrags: api_error, compact_boundary, turn_duration, …",
  uuid: "Id des Eintrags.",
  parentUuid: "Eintrag, auf den dieser im Gespräch folgt.",
  isSidechain: "Von einem Subagenten geschrieben, nicht vom Hauptgespräch.",
  timestamp: "Wann er geschrieben wurde, ISO 8601.",
  sessionId: "Sitzung, zu der der Eintrag gehört; ein Fork behält auf kopierten Einträgen die Id der Elternsitzung.",
  cwd: "Arbeitsverzeichnis.",
  gitBranch: "Git-Branch zu diesem Zeitpunkt.",
  version: "Claude-Code-Version, die den Eintrag geschrieben hat.",
  entrypoint: "Wo Claude Code lief: cli, claude-desktop, …",
  userType: "Wer die Sitzung steuert.",
  requestId: "Id der API-Anfrage.",
  promptId: "Prompt, zu dem der Eintrag gehört.",
  effort: "Reasoning-Aufwand der Anfrage.",
  message: "Die API-Nachricht, wie gesendet oder empfangen.",
  "message.role": "user oder assistant.",
  "message.model": "Modell, das geantwortet hat; <synthetic> für Nachrichten, die Claude Code selbst geschrieben hat.",
  "message.id": "Id der API-Nachricht; gemeinsam für alle Einträge einer gestreamten Antwort.",
  "message.type": "Immer message.",
  "message.content": "Ein String oder eine Liste von Inhaltsblöcken.",
  "message.content[].type": "Art des Blocks: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Text eines text-Blocks.",
  "message.content[].thinking": "Reasoning eines thinking-Blocks.",
  "message.content[].signature": "Signatur, mit der das Reasoning an die API zurückgeschickt werden kann.",
  "message.content[].id": "Id eines tool_use-Blocks.",
  "message.content[].name": "Tool, das ein tool_use-Block aufruft.",
  "message.content[].input": "Argumente eines tool_use-Blocks.",
  "message.content[].tool_use_id": "Aufruf, den ein tool_result-Block beantwortet.",
  "message.content[].content": "Was das Tool zurückgegeben hat.",
  "message.content[].is_error": "Das Tool hat einen Fehler gemeldet.",
  "message.stop_reason": "Warum die Antwort endete: end_turn, tool_use, max_tokens, …",
  "message.usage": "Token-Nutzung der ganzen Antwort, in jedem ihrer Einträge wiederholt.",
  "message.usage.input_tokens": "Eingabe-Tokens, die weder aus dem Cache gelesen noch in ihn geschrieben wurden.",
  "message.usage.output_tokens": "Ausgabe-Tokens.",
  "message.usage.cache_read_input_tokens": "Aus dem Cache gelesene Eingabe-Tokens.",
  "message.usage.cache_creation_input_tokens": "In den Cache geschriebene Eingabe-Tokens.",
  "message.usage.cache_creation": "Cache-Schreibvorgänge nach Lebensdauer aufgeteilt.",
  "message.usage.speed": "fast, wenn die Anfrage im schnellen Modus lief.",
  toolUseResult: "Claude Codes eigene strukturierte Kopie eines Tool-Ergebnisses.",
  attachment: "Von Claude Code eingefügter Kontext; sein type sagt, welche Art.",
  "attachment.type": "Art des Anhangs: prompt_snapshot, instructions, file, date, …",
  content: "Text eines system-Eintrags.",
  level: "Schweregrad eines system-Eintrags.",
  error: "Fehlerdetails eines api_error-Eintrags.",
};

export const de: EventDocs = {
  providerFormats: {
    claude:
      "JSONL unter ~/.claude/projects/<project>/<session>.jsonl: ein JSON-Eintrag pro Zeile, vom Typ user, assistant, system, attachment usw. Jeder Eintrag trägt die Claude-Code-Version, die ihn geschrieben hat.",
    cowork:
      "Die Claude-Code-CLI läuft in jeder Cowork-Sitzung und schreibt dasselbe JSONL-Transkript, daher wird es genau wie Claude Code gelesen.",
    codex:
      "JSONL unter ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: {timestamp, type, payload}-Zeilen vom Typ session_meta, event_msg, response_item, turn_context. Nur session_meta nennt die CLI-Version.",
    copilot:
      "JSONL unter ~/.copilot/session-state/<id>/events.jsonl, bereits als {type, data, id, timestamp, parentId} im selben category.subCategory-Vokabular geschrieben, das diese App nutzt. session.start nennt Format- und CLI-Version.",
    vscode:
      "Chat-Sitzungsdateien (JSON oder JSONL mit angehängten Änderungen) im Workspace-Speicher von VS Code, ein Anfrage-/Antwortpaar pro Eintrag.",
    gemini:
      "Sitzungsdateien unter ~/.gemini/tmp/<project>/chats. Jede Nachricht hat den Typ user, gemini, info, warning oder error; eine erneut geschriebene Nachricht ersetzt ihre frühere Fassung.",
    opencode:
      "SQLite (opencode.db): Zeilen für session, message und part, jeweils mit dem Inhalt in einer JSON-Spalte.",
    cursor:
      "SQLite-Speicher unter ~/.cursor/projects, die das Gespräch als bubble-Zeilen halten: 1 für den Nutzer, 2 für den Agenten.",
    hermes: "SQLite (state.db) unter ~/.hermes: Sitzungen und ihre Nachrichten als Zeilen.",
  },

  sharedChanges: [
    "Der Typ wird ins gemeinsame category.subCategory-Vokabular umbenannt, sodass sich die Ereignisse aller Agenten gleich lesen.",
    "Langer Text wird bei 20.000 Zeichen abgeschnitten. charLength behält die volle Länge, truncated zeigt das Kürzen an; der Originaleintrag bleibt ungekürzt.",
    "Ein Eintrag kann mehrere Ereignisse ergeben (eine Antwort mit Text, Reasoning und Tool-Aufrufen), und manche Einträge werden als reine Verwaltung übersprungen.",
  ],

  fieldDocs: {
    content: "Text der Nachricht, auf 20.000 Zeichen begrenzt.",
    charLength: "Volle Länge des Texts vor der Begrenzung.",
    truncated: "True, wenn der gezeigte Text gekürzt wurde.",
    model: "Modell, das dies erzeugt hat, so wie der Agent es nennt.",
    effort: "Reasoning-Aufwand, mit dem die Anfrage lief.",
    requestId: "Id der API-Anfrage, zum Abgleich mit den Logs des Anbieters.",
    role: "Woher der Text stammt: system_prompt, instructions, developer, user_context, …",
    toolName: "Vom Modell aufgerufenes Tool; mcp__server__tool bei MCP-Tools.",
    toolCallId: "Id, die einen Aufruf mit seinem Ergebnis verbindet.",
    arguments: "Argumente, die das Modell dem Tool übergab, als JSON geparst.",
    argumentChars: "Größe der Argumente, wie das Modell sie schrieb, also das, was sie im Kontext kosten.",
    result: "Was das Tool zurückgab, reduziert auf {content, format, images?, detail?}.",
    resultChars: "Volle Länge des Ergebnisses vor der Begrenzung.",
    success: "False, wenn der Aufruf einen Fehler meldete.",
    inputTokens: "Eingabe-Tokens der Anfrage, einschließlich der in den Cache geschriebenen.",
    outputTokens: "Ausgabe-Tokens der Antwort, Reasoning eingeschlossen.",
    cacheReadTokens: "Aus dem Prompt-Cache bediente Eingabe-Tokens.",
    billedUsage: "Nutzung so aufgeteilt, wie sie bepreist wird; Grundlage der Kostenschätzung.",
    costUSD: "Geschätzte Kosten dieser Anfrage nach API-Listenpreisen.",
    inherited: "Aus der Sitzung kopiert, von der diese geforkt wurde; die Kosten gehören dorthin.",
    durationMs: "Wie lange es dauerte, in Millisekunden.",
    sessionId: "Id der Sitzung.",
    context: "Arbeitsverzeichnis, Branch und Repository, in denen die Sitzung lief.",
    attachmentType: "Der eigene Name des Agenten für diese Art von Kontext.",
    label: "Lesbarer Name für die Art des Anhangs.",
    subject: "Worum es im Anhang geht: eine Datei, ein Datum, ein Hook…",
    items: "Vom Anhang aufgeführte Namen (Tools, Skills, Agenten), höchstens 200.",
    itemCount: "Wie viele Namen der Anhang vollständig aufführte.",
    itemsLabel: "Was die aufgeführten Namen sind.",
    message: "Fehler- oder Hinweistext.",
    reason: "Warum es passierte.",
    mode: "Der Modus, zu dem gewechselt wurde.",
    trigger: "Was es auslöste: manual oder auto.",
    preTokens: "Kontextgröße vor der Komprimierung.",
    turnId: "Id der Runde.",
    totalCostUSD: "Bisherige Sitzungskosten, wie der Agent sie selbst meldet.",
    apiDurationMs: "Bisherige Gesamtwartezeit auf die API.",
    premiumRequests: "Bisher gezählte Premium-Anfragen.",
    sessionTotals: "Vom Agenten gemeldete Sitzungssummen, für die Sitzungsübersicht genutzt.",
    usage: "Nutzungssummen, wie der Agent sie meldete.",
    selectedModel: "Beim Sitzungsstart gewähltes Modell.",
    copilotVersion: "Version der Agenten-CLI, die die Sitzung schrieb.",
    cliVersion: "Version der Agenten-CLI, die die Sitzung schrieb.",
    entrypoint: "Wo die Sitzung lief: cli, claude-desktop, …",
    forkedFrom: "Die Sitzung, von der diese geforkt wurde.",
  },

  pathDocs: {
    type: "Ereignistyp, category.subCategory.",
    data: "Was der Agent aufgezeichnet hat, normalisiert, wo es sich lohnt.",
    id: "Eindeutige Id des Ereignisses innerhalb der Sitzung.",
    timestamp: "Wann es geschah, ISO 8601.",
    parentId: "Ereignis, auf das dieses folgt, sofern der Agent es aufzeichnet.",
    source: "Wo der Originaleintrag liegt: seine Zeile im Transkript oder die eigene Id des Agenten.",
    category: "Erster Teil des Typs, von den Filtern genutzt.",
    subCategory: "Rest des Typs, von den Filtern genutzt.",
    subKey: "Vollständiger Typ, von den Filtern genutzt.",
    "data.result.content": "Reiner Text des Ergebnisses, begrenzt. JSON-Ergebnisse werden eingerückt.",
    "data.result.format": "text oder json.",
    "data.result.images": "Vom Tool zurückgegebene Bilder: nur Typ und Größe.",
    "data.result.detail": "Eine zweite Darstellung, die manche Tools ergänzen, meist ein Diff.",
    "data.context.cwd": "Arbeitsverzeichnis.",
    "data.context.branch": "Git-Branch.",
    "data.context.repository": "Git-Repository.",
    "data.billedUsage.model": "Modell, nach dem die Nutzung bepreist wird.",
    "data.billedUsage.inputTokens": "Eingabe-Tokens, die weder aus dem Cache gelesen noch in ihn geschrieben wurden.",
    "data.billedUsage.outputTokens": "Ausgabe-Tokens.",
    "data.billedUsage.cacheReadTokens": "Aus dem Cache gelesene Eingabe-Tokens.",
    "data.billedUsage.cacheWriteTokens": "In den 5-Minuten-Cache geschriebene Eingabe-Tokens.",
    "data.billedUsage.cacheWrite1hTokens": "In den 1-Stunden-Cache geschriebene Eingabe-Tokens.",
    "data.billedUsage.fast": "Lief im schnellen Modus, zu einem höheren Tarif abgerechnet.",
    "data.billedUsage.local": "Lief auf einem lokalen Modell, das nichts kostet.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Wann die Zeile geschrieben wurde, ISO 8601.",
      ordinal: "Position der Zeile im Rollout.",
      type: "Art der Zeile: session_meta, event_msg, response_item, turn_context, …",
      payload: "Inhalt der Zeile; ihr eigener type sagt, was es ist.",
      "payload.type": "Art des Payloads: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id der Sitzung (session_meta) oder des Elements.",
      "payload.cli_version": "Codex-CLI-Version, nur in session_meta.",
      "payload.originator": "App, die Codex ausgeführt hat.",
      "payload.cwd": "Arbeitsverzeichnis.",
      "payload.role": "Von wem eine Nachricht stammt: user, assistant, developer, system.",
      "payload.content": "Inhaltsteile einer Nachricht.",
      "payload.content[].type": "Art des Teils: input_text, output_text, …",
      "payload.content[].text": "Text des Teils.",
      "payload.message": "Text einer event_msg-Nachricht.",
      "payload.call_id": "Id, die einen Tool-Aufruf mit seiner Ausgabe verbindet.",
      "payload.name": "Aufgerufenes Tool.",
      "payload.arguments": "Tool-Argumente als JSON-String.",
      "payload.input": "Eingabe eines benutzerdefinierten Tool-Aufrufs.",
      "payload.output": "Was das Tool zurückgegeben hat.",
      "payload.status": "Status des Aufrufs.",
      "payload.turn_id": "Runde, zu der die Zeile gehört.",
      "payload.info": "Token-Nutzung: kumulierte Summen und die der letzten Anfrage.",
    },
    copilot: {
      type: "Ereignistyp, bereits in der Form category.subCategory.",
      data: "Ereignisdaten.",
      id: "Id des Ereignisses.",
      timestamp: "Wann es geschah, ISO 8601.",
      parentId: "Ereignis, auf das dieses folgt.",
      "data.version": "Version des events.jsonl-Formats.",
      "data.copilotVersion": "Copilot-CLI-Version.",
      "data.producer": "Was die Datei geschrieben hat.",
      "data.toolCallId": "Id, die einen Aufruf mit seinem Ergebnis verbindet.",
      "data.toolName": "Aufgerufenes Tool.",
      "data.arguments": "Tool-Argumente.",
      "data.result": "Was das Tool zurückgab: content und detailedContent, falls das Tool eines ergänzt.",
      "data.error": "Warum ein fehlgeschlagener Aufruf fehlschlug.",
    },
  },

  events: {
    "session.start": {
      summary: "Sitzungsstart. Erfasst die Laufzeitumgebung und das gewählte Modell zu Beginn einer Sitzung.",
      sources: {
        ...claudeSources([
          {
            record: "Kein Eintrag: Claude Code schreibt keinen Starteintrag",
            note: "Die App baut einen aus cwd, gitBranch, version und entrypoint der Transkripteinträge, damit die Zeitleiste bei jedem Agenten mit demselben Kopf beginnt.",
          },
        ]),
        codex: [{ record: "Die erste session_meta-Zeile", note: "Spätere session_meta-Zeilen sind Subagenten-Threads und werden zu subagent.session_start." }],
        copilot: [{ record: "session.start, so gelesen wie geschrieben" }],
      },
    },
    "session.resume": { summary: "Sitzung aus einem früheren Zustand fortgesetzt. Zeigt das Neuladen des Kontexts und die Fortsetzung an." },
    "session.shutdown": {
      summary: "Abschlussübersicht der Sitzung. Enthält meist Nutzung, Token-Summen, Premium-Anfragen und API-Zeiten.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Die App leitet daraus sessionTotals und usageSummary ab. Die Summen sind kumuliert, daher wird nur das letzte shutdown bepreist und eine fortgesetzte Sitzung nicht doppelt gezählt.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Ergebnis der Modellauswahl im Auto-Modus. Zeigt das erwartete Aufgabenprofil und die gewählten Modelleinstellungen." },
    "session.binary_asset": { summary: "In der Sitzung erfasste Binärdaten, meist Screenshots. Können viel Kontext und Speicher belegen." },
    "session.usage_checkpoint": {
      summary: "Zwischenstand der Nutzungsabrechnung, während die Sitzung läuft.",
      sources: {
        ...claudeSources([{ record: "Ein cost-state-Eintrag", note: "totalCostUSD und totalAPIDuration werden wie gemeldet übernommen." }]),
        codex: [
          {
            record: "Eine event_msg-Zeile vom Typ token_count",
            note: "Codex meldet kumulierte Summen, daher berechnet die App nur den Schritt seit dem vorigen Checkpoint und nimmt gecachte Tokens aus input_tokens heraus, damit jedes nur einmal bepreist wird.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Nur Premium-/AIU-Abrechnung, keine Token-Summen; premiumRequests wird aus totalPremiumRequests übernommen." }],
      },
    },
    "session.model_change": {
      summary: "Modellkonfiguration während der Sitzung gewechselt (Modell, Aufwand oder Kontextstufe).",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Kontextkomprimierung gestartet. Das Gespräch wird zusammengefasst, um die bei jeder Anfrage gesendeten Tokens zu verringern.",
      sources: claudeSources([{ record: "Ein system-Eintrag mit subtype compact_boundary", note: "trigger und preTokens stammen aus compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Komprimierung beendet, mit Erfolgs- oder Fehlermetadaten und Anfrage-Ids." },
    "session.error": {
      summary: "API- oder Übertragungsfehler. Jeder neue Versuch sendet den gesamten Anfragekontext erneut.",
      sources: {
        ...claudeSources([{ record: "Ein system-Eintrag mit subtype api_error" }]),
        gemini: [{ record: "Eine Nachricht vom Typ error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Die Runde wurde unterbrochen, bevor sie fertig war.",
      changes: ["Jeder Agent markiert eine Unterbrechung anders; alle werden zu diesem einen Typ."],
      sources: {
        ...claudeSources([
          {
            record: "Ein user-Eintrag, dessen Text mit „[Request interrupted by user“ beginnt",
            note: "Claude Code protokolliert die Unterbrechung, als hätte der Nutzer sie eingetippt; die App zeigt sie nicht als Prompt.",
          },
        ]),
        codex: [{ record: "Eine event_msg-Zeile vom Typ turn_aborted" }],
        copilot: [{ record: "Ein abort-Ereignis", note: "Umbenannt; die Daten bleiben wie geschrieben." }],
      },
    },
    "session.mode_change": {
      summary: "Interaktions- oder Berechtigungsmodus während der Sitzung gewechselt.",
      sources: claudeSources([{ record: "Ein mode- oder permission-mode-Eintrag" }]),
    },
    "session.turn_context": {
      summary: "Laufzeitkonfiguration pro Runde: Modell, Aufwand, Sandbox und Freigaberichtlinie.",
      sources: { codex: [{ record: "Eine turn_context-Zeile" }] },
    },
    "session.world_state": {
      summary: "Momentaufnahme des Arbeitsbereichs, die die Laufzeit dem Modell übergab.",
      sources: { codex: [{ record: "Eine world_state-Zeile" }] },
    },
    "session.rollback": {
      summary: "Das Gespräch wurde um einige Runden zurückgesetzt.",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Der Agent hat seinen Arbeitsplan erstellt oder aktualisiert." },
    "session.info": {
      summary: "Ein Hinweis, den der Agent ausgegeben hat: eine Information oder eine Warnung.",
      sources: { gemini: [{ record: "Eine Nachricht vom Typ info oder warning" }] },
    },

    "user.message": {
      summary: "Was der Nutzer eingegeben hat. Es treibt die nächste Runde des Assistenten an.",
      sources: {
        ...claudeSources([
          {
            record: "Ein user-Eintrag: message.content als String oder jeder text-Block darin",
            note: "Derselbe Eintragstyp trägt auch Tool-Ergebnisse, die zu tool.execution_complete werden.",
          },
        ]),
        codex: [
          { record: "Eine event_msg-Zeile vom Typ user_message" },
          {
            record: "Eine response_item-Nachricht mit role user, nur in älteren Rollouts",
            note: "Neuere Rollouts enthalten das Gespräch doppelt, als event_msg (was der Nutzer sah) und als response_item (was das Modell sah). Die App nutzt event_msg, damit Runden nicht doppelt erscheinen; die response_item-Kopie wird zu system.message.",
          },
        ],
        copilot: [{ record: "user.message, so gelesen wie geschrieben" }],
        gemini: [{ record: "Eine Nachricht vom Typ user" }],
      },
    },
    "assistant.message": {
      summary: "Text, den das Modell zurückgeschrieben hat, mit Modellname und Token-Nutzung.",
      fields: {
        phase: "Codex: zu welchem Teil der Runde die Nachricht gehört.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Ein assistant-Eintrag mit einem text-Block in message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Eine Antwort ohne Text, Reasoning oder Tool-Aufruf wird trotzdem zu einer leeren Nachricht, damit ihre Nutzung gezählt wird.`,
          },
        ]),
        codex: [
          { record: "Eine event_msg-Zeile vom Typ agent_message" },
          { record: "Eine response_item-Nachricht mit role assistant, nur wenn keine event_msg-Kopie existiert" },
        ],
        copilot: [{ record: "assistant.message, so gelesen wie geschrieben" }],
        gemini: [{ record: "Der Inhalt einer Nachricht vom Typ gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Reasoning, das das Modell vor der Antwort erzeugte. Wird als Ausgabe-Tokens abgerechnet.",
      sources: {
        ...claudeSources([{ record: "Ein assistant-Eintrag mit einem thinking-Block", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Eine event_msg-Zeile vom Typ agent_reasoning" },
          { record: "Ein response_item vom Typ reasoning, anhand seiner summary", note: "Nur verschlüsseltes Reasoning enthält nichts Lesbares und wird übersprungen." },
        ],
        gemini: [{ record: "Jeder Eintrag von thoughts in einer Nachricht vom Typ gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Beginn einer Runde des Assistenten.",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Ende der Runde des Assistenten nach Reasoning, Tool-Aufrufen und Ausgabe.",
      sources: {
        ...claudeSources([{ record: "Ein system-Eintrag mit subtype turn_duration" }]),
        codex: [{ record: "Eine event_msg-Zeile vom Typ task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Das Modell hat ein eingebautes Tool aufgerufen, mit Name und Argumenten.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Tools namens mcp__… werden stattdessen zu external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "Ein response_item vom Typ function_call, custom_tool_call oder local_shell_call",
            note: "Als JSON-String geschriebene Argumente werden zu einem Objekt geparst.",
          },
        ],
        copilot: [{ record: "tool.execution_start, so gelesen wie geschrieben" }],
        gemini: [{ record: "Jeder Eintrag von toolCalls in einer Nachricht vom Typ gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Ein Aufruf eines eingebauten Tools ist beendet, mit Status und Ergebnis.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Der Tool-Name stammt vom zugehörigen Aufruf. Hat der Block keinen Inhalt, wird toolUseResult des Eintrags genutzt. success ist false, wenn is_error gesetzt ist.",
          },
        ]),
        codex: [
          {
            record: "Ein response_item vom Typ function_call_output, custom_tool_call_output oder local_shell_call_output",
            note: "Codex speichert kein Erfolgsflag; die App markiert einen Aufruf als fehlgeschlagen, wenn seine Ausgabe einen Exit-Code ungleich null meldet.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content wird zum Ergebnistext, bei einem fehlgeschlagenen Aufruf tritt error.message an seine Stelle, und detailedContent (meist ein Diff) wird zu result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Das Modell hat ein Tool über eine externe Brücke aufgerufen, meist einen MCP-Server.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, für ein Tool namens mcp__…` }]),
        copilot: [{ record: "external_tool.requested, so gelesen wie geschrieben" }],
      },
    },
    "external_tool.completed": {
      summary: "Ein externer Tool-Aufruf ist beendet, mit Status und Ergebnis.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, für ein Tool namens mcp__…` }]),
        codex: [{ record: "Eine event_msg-Zeile vom Typ mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Aufgebaut wie tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Die Laufzeit hat den Nutzer um Erlaubnis für eine Aktion gebeten (Datei, System oder Netzwerk)." },
    "permission.completed": { summary: "Die Berechtigungsanfrage wurde entschieden: genehmigt oder abgelehnt." },
    "hook.start": { summary: "Ein Lifecycle-Hook wurde gestartet, zum Beispiel beim Absenden eines Prompts." },
    "hook.end": {
      summary: "Ein Lifecycle-Hook ist beendet, mit Erfolg oder Fehler.",
      sources: claudeSources([{ record: "Ein system-Eintrag mit subtype stop_hook_summary", note: "success ist false, wenn der Eintrag Hook-Fehler auflistet." }]),
    },

    "system.message": {
      summary: "Anweisungen, die die Laufzeit dem Modell vorangestellt hat: der System-Prompt, Anweisungsdateien oder eingefügter Kontext.",
      detail: "Sie werden mit jeder Anfrage gesendet, daher summiert sich ihre Größe über eine Sitzung. Der Schalter in der Werkzeugleiste blendet sie mit dem übrigen eingefügten Kontext aus.",
      sources: {
        ...claudeSources([
          { record: "Ein attachment-Eintrag vom Typ prompt_snapshot", note: "Claude Code speichert den System-Prompt erneut, sobald sich irgendein Teil ändert; die App zeigt ihn nur, wenn sich der Prompttext selbst geändert hat." },
          { record: "Ein attachment-Eintrag vom Typ instructions (CLAUDE.md- und AGENTS.md-Dateien)" },
          { record: "Ein system-Eintrag mit beliebigem anderem subtype" },
        ]),
        codex: [
          { record: "base_instructions in der session_meta-Zeile" },
          { record: "Eine response_item-Nachricht mit role developer oder system" },
          { record: "Eine response_item-Nachricht mit role user, die die Laufzeit eingefügt hat, gezeigt als role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Kontext, den die Laufzeit selbst ergänzt hat: Datei-Snapshots, Erinnerungen, Tool- oder Skill-Listen, Bilder.",
      changes: ["Jede Art von Anhang wird auf {label, subject, items, content} abgeflacht, sodass sie sich als Inhalt statt als rohes JSON liest."],
      sources: {
        ...claudeSources([
          { record: "Ein attachment-Eintrag (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Die Tool-Liste eines prompt_snapshot-Anhangs, bei Änderungen als Tool-Definitionen gezeigt" },
          { record: "Ein image-Block in einem user-Eintrag", note: "Nur dass ein Bild gesendet wurde, bleibt erhalten; die Pixel bleiben auf der Festplatte." },
        ]),
        codex: [{ record: "dynamic_tools in der session_meta-Zeile, als Tool-Definitionen gezeigt" }],
      },
    },
    "system.notification": { summary: "Eine Laufzeitbenachrichtigung im Gespräch, etwa wenn eine Hintergrund-Shell fertig ist." },

    "file.patch_applied": {
      summary: "Ein Patch, den der Agent auf den Arbeitsbereich angewendet hat, mit den betroffenen Dateien.",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ patch_apply_end" }] },
    },
    "web.search": {
      summary: "Eine Websuche des Modells; ihre Ergebnisse werden dem Kontext hinzugefügt.",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ web_search_end" }] },
    },

    "subagent.deselected": { summary: "Der Fokus auf den Subagenten wurde aufgehoben, die Steuerung ging an den Hauptagenten zurück." },
    "subagent.activity": {
      summary: "Aktivität, die ein Subagent unter dem Hauptagenten gemeldet hat.",
      sources: { codex: [{ record: "Eine event_msg-Zeile vom Typ sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Eine Nachricht zwischen Agenten.",
      sources: { codex: [{ record: "Eine inter_agent_communication_metadata-Zeile" }] },
    },
    "subagent.session_start": {
      summary: "In dieser Sitzung wurde ein Subagenten-Thread gestartet.",
      sources: { codex: [{ record: "Eine session_meta-Zeile nach der ersten" }] },
    },
  },

  unknownSummary: "Ein Ereignis der Kategorie „{category}“ („{name}“), für das es noch keine Beschreibung gibt.",
  unknownCategory: "unbekannt",
  unknownName: "allgemein",
  unknownDetail:
    "Der Agent hat einen Eintrag geschrieben, für den die App keine Zuordnung kennt. Er bleibt mit seinen Daten wie geschrieben erhalten, sodass nichts verloren geht, und wird über die allgemeine Karte gezeigt.",

  callAndResult: "Ein Aufruf und sein Ergebnis, als eine Zeile gezeigt.",
  recordsInOrder: "Die Einträge, aus denen die Zeile gelesen wurde, in Transkriptreihenfolge.",
  recordTitle: "{agent}-Eintrag",
  eventFormat: "Ereignisformat",
};
