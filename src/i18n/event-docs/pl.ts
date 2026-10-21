import { claudeSources, type EventDocs } from "./en";

/** Polish. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Wynik jest sprowadzany do zwykłego tekstu w result.content. Obrazy zachowują tylko typ i rozmiar; piksele zostają na dysku.",
  "W widoku zwartym wywołanie i jego wynik są pokazane jako jeden wiersz, więc Raw i Original pokazują dwa rekordy.",
];

const CLAUDE_TOOL_USE = "Rekord assistant z blokiem tool_use w message.content";
const CLAUDE_TOOL_RESULT =
  "Rekord user z blokiem tool_result, dopasowany do wywołania przez tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code zapisuje jeden rekord na każdy blok treści strumieniowanej odpowiedzi i powtarza w każdym użycie odpowiedzi. Użycie jest liczone raz, przy pierwszym zdarzeniu odpowiedzi.";
const ARGUMENT_CHARS =
  "Dodawane jest argumentChars: rozmiar argumentów w zapisanej postaci, czyli to, ile kosztują w kontekście.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Rodzaj rekordu: user, assistant, system, attachment, mode, …",
  subtype: "Rodzaj rekordu system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id rekordu.",
  parentUuid: "Rekord, po którym ten następuje w rozmowie.",
  isSidechain: "Zapisany przez subagenta, a nie główną rozmowę.",
  timestamp: "Kiedy został zapisany, ISO 8601.",
  sessionId: "Sesja, do której należy rekord; fork zachowuje id sesji nadrzędnej w skopiowanych rekordach.",
  cwd: "Katalog roboczy.",
  gitBranch: "Gałąź Git w tamtym momencie.",
  version: "Wersja Claude Code, która zapisała rekord.",
  entrypoint: "Gdzie działał Claude Code: cli, claude-desktop, …",
  userType: "Kto prowadzi sesję.",
  requestId: "Id żądania API.",
  promptId: "Prompt, do którego należy rekord.",
  effort: "Poziom rozumowania żądania.",
  message: "Wiadomość API w postaci wysłanej lub odebranej.",
  "message.role": "user lub assistant.",
  "message.model": "Model, który odpowiedział; <synthetic> dla wiadomości napisanych przez sam Claude Code.",
  "message.id": "Id wiadomości API; wspólne dla wszystkich rekordów jednej strumieniowanej odpowiedzi.",
  "message.type": "Zawsze message.",
  "message.content": "Ciąg znaków lub lista bloków treści.",
  "message.content[].type": "Rodzaj bloku: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Tekst bloku text.",
  "message.content[].thinking": "Rozumowanie bloku thinking.",
  "message.content[].signature": "Podpis, dzięki któremu rozumowanie można odesłać do API.",
  "message.content[].id": "Id bloku tool_use.",
  "message.content[].name": "Narzędzie wywoływane przez blok tool_use.",
  "message.content[].input": "Argumenty bloku tool_use.",
  "message.content[].tool_use_id": "Wywołanie, na które odpowiada blok tool_result.",
  "message.content[].content": "Co zwróciło narzędzie.",
  "message.content[].is_error": "Narzędzie zgłosiło błąd.",
  "message.stop_reason": "Dlaczego odpowiedź się zakończyła: end_turn, tool_use, max_tokens, …",
  "message.usage": "Użycie tokenów całej odpowiedzi, powtarzane w każdym jej rekordzie.",
  "message.usage.input_tokens": "Tokeny wejściowe ani nieodczytane z cache, ani do niego niezapisane.",
  "message.usage.output_tokens": "Tokeny wyjściowe.",
  "message.usage.cache_read_input_tokens": "Tokeny wejściowe odczytane z cache.",
  "message.usage.cache_creation_input_tokens": "Tokeny wejściowe zapisane do cache.",
  "message.usage.cache_creation": "Zapisy do cache podzielone według czasu życia.",
  "message.usage.speed": "fast, gdy żądanie działało w trybie szybkim.",
  toolUseResult: "Własna, uporządkowana kopia wyniku narzędzia zapisana przez Claude Code.",
  attachment: "Kontekst wstrzyknięty przez Claude Code; jego type mówi, jakiego rodzaju.",
  "attachment.type": "Rodzaj załącznika: prompt_snapshot, instructions, file, date, …",
  content: "Tekst rekordu system.",
  level: "Waga rekordu system.",
  error: "Szczegóły błędu rekordu api_error.",
};

export const pl: EventDocs = {
  providerFormats: {
    claude:
      "JSONL w ~/.claude/projects/<project>/<session>.jsonl: jeden rekord JSON na wiersz, typu user, assistant, system, attachment itd. Każdy rekord zawiera wersję Claude Code, która go zapisała.",
    cowork:
      "CLI Claude Code działa w każdej sesji Cowork i zapisuje tę samą transkrypcję JSONL, więc jest czytana dokładnie tak jak Claude Code.",
    codex:
      "JSONL w ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: wiersze {timestamp, type, payload} typu session_meta, event_msg, response_item, turn_context. Tylko session_meta podaje wersję CLI.",
    copilot:
      "JSONL w ~/.copilot/session-state/<id>/events.jsonl, zapisany już jako {type, data, id, timestamp, parentId} w tym samym słowniku category.subCategory, którego używa ta aplikacja. session.start podaje wersję formatu i wersję CLI.",
    vscode:
      "Pliki sesji czatu (JSON lub JSONL z dopisywanymi zmianami) w magazynie obszaru roboczego VS Code, jedna para żądanie/odpowiedź na wpis.",
    gemini:
      "Pliki sesji w ~/.gemini/tmp/<project>/chats. Każda wiadomość ma typ user, gemini, info, warning lub error; wiadomość zapisana ponownie zastępuje swoją wcześniejszą wersję.",
    opencode:
      "SQLite (opencode.db): wiersze session, message i part, każdy z treścią w kolumnie JSON.",
    cursor:
      "Magazyny SQLite w ~/.cursor/projects, przechowujące rozmowę jako wiersze bubble: 1 dla użytkownika, 2 dla agenta.",
    hermes: "SQLite (state.db) w ~/.hermes: sesje i ich wiadomości jako wiersze.",
  },

  sharedChanges: [
    "Typ jest przemianowany na wspólny słownik category.subCategory, aby zdarzenia wszystkich agentów czytało się tak samo.",
    "Długi tekst jest przycinany do 20 000 znaków. charLength zachowuje pełną długość, a truncated mówi, że tekst przycięto; oryginalny rekord nie jest przycinany.",
    "Jeden rekord może dać kilka zdarzeń (odpowiedź z tekstem, rozumowaniem i wywołaniami narzędzi), a niektóre rekordy są pomijane jako techniczne.",
  ],

  fieldDocs: {
    content: "Tekst wiadomości, ograniczony do 20 000 znaków.",
    charLength: "Pełna długość tekstu przed ograniczeniem.",
    truncated: "True, gdy pokazany tekst został przycięty.",
    model: "Model, który to wygenerował, w nazwie nadanej przez agenta.",
    effort: "Poziom rozumowania, z jakim działało żądanie.",
    requestId: "Id żądania API, do porównania z logami dostawcy.",
    role: "Skąd pochodzi tekst: system_prompt, instructions, developer, user_context, …",
    toolName: "Narzędzie wywołane przez model; mcp__server__tool dla narzędzi MCP.",
    toolCallId: "Id łączące wywołanie z jego wynikiem.",
    arguments: "Argumenty przekazane narzędziu przez model, sparsowane do JSON.",
    argumentChars: "Rozmiar argumentów w postaci zapisanej przez model, czyli to, ile kosztują w kontekście.",
    result: "Co zwróciło narzędzie, sprowadzone do {content, format, images?, detail?}.",
    resultChars: "Pełna długość wyniku przed ograniczeniem.",
    success: "False, gdy wywołanie zgłosiło błąd.",
    inputTokens: "Tokeny wejściowe żądania, łącznie z zapisanymi do cache.",
    outputTokens: "Tokeny wyjściowe odpowiedzi, łącznie z rozumowaniem.",
    cacheReadTokens: "Tokeny wejściowe podane z cache promptów.",
    billedUsage: "Użycie podzielone tak, jak jest wyceniane; podstawa szacunku kosztu.",
    costUSD: "Szacowany koszt tego żądania według cennika API.",
    inherited: "Skopiowane z sesji, z której rozgałęziono tę; koszt należy tam.",
    durationMs: "Ile to trwało, w milisekundach.",
    sessionId: "Id sesji.",
    context: "Katalog roboczy, gałąź i repozytorium, w których działała sesja.",
    attachmentType: "Własna nazwa agenta dla tego rodzaju kontekstu.",
    label: "Czytelna nazwa rodzaju załącznika.",
    subject: "Czego dotyczy załącznik: pliku, daty, hooka…",
    items: "Nazwy wymienione w załączniku (narzędzia, umiejętności, agenci), najwyżej 200.",
    itemCount: "Ile nazw załącznik wymienił w całości.",
    itemsLabel: "Czym są wymienione nazwy.",
    message: "Tekst błędu lub komunikatu.",
    reason: "Dlaczego to się stało.",
    mode: "Tryb, na który przełączono.",
    trigger: "Co to uruchomiło: manual lub auto.",
    preTokens: "Rozmiar kontekstu przed kompaktowaniem.",
    turnId: "Id tury.",
    totalCostUSD: "Dotychczasowy koszt sesji według samego agenta.",
    apiDurationMs: "Łączny dotychczasowy czas oczekiwania na API.",
    premiumRequests: "Dotychczas policzone żądania premium.",
    sessionTotals: "Sumy sesji zgłoszone przez agenta, używane w podsumowaniu sesji.",
    usage: "Sumy użycia w postaci zgłoszonej przez agenta.",
    selectedModel: "Model wybrany na początku sesji.",
    copilotVersion: "Wersja CLI agenta, która zapisała sesję.",
    cliVersion: "Wersja CLI agenta, która zapisała sesję.",
    entrypoint: "Gdzie działała sesja: cli, claude-desktop, …",
    forkedFrom: "Sesja, z której rozgałęziono tę.",
  },

  pathDocs: {
    type: "Typ zdarzenia, category.subCategory.",
    data: "Co zapisał agent, znormalizowane tam, gdzie warto.",
    id: "Unikalne id zdarzenia w sesji.",
    timestamp: "Kiedy to się stało, ISO 8601.",
    parentId: "Zdarzenie, z którego wynika to, jeśli agent je zapisuje.",
    source: "Gdzie jest oryginalny rekord: jego wiersz w transkrypcji lub własne id agenta.",
    category: "Pierwsza część typu, używana przez filtry.",
    subCategory: "Reszta typu, używana przez filtry.",
    subKey: "Pełny typ, używany przez filtry.",
    "data.result.content": "Zwykły tekst wyniku, ograniczony. Wyniki JSON są wcięte.",
    "data.result.format": "text lub json.",
    "data.result.images": "Obrazy zwrócone przez narzędzie: tylko typ i rozmiar.",
    "data.result.detail": "Druga postać, którą dodają niektóre narzędzia, zwykle diff.",
    "data.context.cwd": "Katalog roboczy.",
    "data.context.branch": "Gałąź Git.",
    "data.context.repository": "Repozytorium Git.",
    "data.billedUsage.model": "Model, według którego wyceniane jest użycie.",
    "data.billedUsage.inputTokens": "Tokeny wejściowe ani nieodczytane z cache, ani do niego niezapisane.",
    "data.billedUsage.outputTokens": "Tokeny wyjściowe.",
    "data.billedUsage.cacheReadTokens": "Tokeny wejściowe odczytane z cache.",
    "data.billedUsage.cacheWriteTokens": "Tokeny wejściowe zapisane do cache 5-minutowego.",
    "data.billedUsage.cacheWrite1hTokens": "Tokeny wejściowe zapisane do cache 1-godzinnego.",
    "data.billedUsage.fast": "Działało w trybie szybkim, rozliczane według wyższej stawki.",
    "data.billedUsage.local": "Działało na modelu lokalnym, który nic nie kosztuje.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Kiedy wiersz został zapisany, ISO 8601.",
      ordinal: "Pozycja wiersza w rolloucie.",
      type: "Rodzaj wiersza: session_meta, event_msg, response_item, turn_context, …",
      payload: "Treść wiersza; jej własny type mówi, czym jest.",
      "payload.type": "Rodzaj payloadu: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id sesji (session_meta) lub elementu.",
      "payload.cli_version": "Wersja Codex CLI, tylko w session_meta.",
      "payload.originator": "Aplikacja, która uruchomiła Codex.",
      "payload.cwd": "Katalog roboczy.",
      "payload.role": "Od kogo jest wiadomość: user, assistant, developer, system.",
      "payload.content": "Części treści wiadomości.",
      "payload.content[].type": "Rodzaj części: input_text, output_text, …",
      "payload.content[].text": "Tekst części.",
      "payload.message": "Tekst wiadomości event_msg.",
      "payload.call_id": "Id łączące wywołanie narzędzia z jego wyjściem.",
      "payload.name": "Wywołane narzędzie.",
      "payload.arguments": "Argumenty narzędzia jako ciąg JSON.",
      "payload.input": "Wejście wywołania własnego narzędzia.",
      "payload.output": "Co zwróciło narzędzie.",
      "payload.status": "Status wywołania.",
      "payload.turn_id": "Tura, do której należy wiersz.",
      "payload.info": "Użycie tokenów: sumy narastające i wartości ostatniego żądania.",
    },
    copilot: {
      type: "Typ zdarzenia, już w postaci category.subCategory.",
      data: "Dane zdarzenia.",
      id: "Id zdarzenia.",
      timestamp: "Kiedy to się stało, ISO 8601.",
      parentId: "Zdarzenie, z którego wynika to.",
      "data.version": "Wersja formatu events.jsonl.",
      "data.copilotVersion": "Wersja Copilot CLI.",
      "data.producer": "Co zapisało plik.",
      "data.toolCallId": "Id łączące wywołanie z jego wynikiem.",
      "data.toolName": "Wywołane narzędzie.",
      "data.arguments": "Argumenty narzędzia.",
      "data.result": "Co zwróciło narzędzie: content oraz detailedContent, jeśli narzędzie je dodaje.",
      "data.error": "Dlaczego nieudane wywołanie się nie powiodło.",
    },
  },

  events: {
    "session.start": {
      summary: "Inicjalizacja sesji. Zapisuje środowisko uruchomieniowe i wybrany model na początku sesji.",
      sources: {
        ...claudeSources([
          {
            record: "Brak rekordu: Claude Code nie zapisuje rekordu początkowego",
            note: "Aplikacja buduje go z pól cwd, gitBranch, version i entrypoint rekordów transkrypcji, aby oś czasu u każdego agenta zaczynała się tym samym nagłówkiem.",
          },
        ]),
        codex: [{ record: "Pierwszy wiersz session_meta", note: "Kolejne wiersze session_meta to wątki subagentów i stają się subagent.session_start." }],
        copilot: [{ record: "session.start, czytane bez zmian" }],
      },
    },
    "session.resume": { summary: "Sesja wznowiona z wcześniejszego stanu. Oznacza ponowne wczytanie kontekstu i kontynuację." },
    "session.shutdown": {
      summary: "Podsumowanie końca sesji. Zwykle zawiera użycie, sumy tokenów, żądania premium i czasy API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Aplikacja wyprowadza z niego sessionTotals i usageSummary. Sumy są narastające, więc wyceniany jest tylko ostatni shutdown, a wznowiona sesja nie jest liczona dwa razy.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Wynik wyboru modelu w trybie automatycznym. Pokazuje przewidywany profil zadania i wybrane ustawienia modelu." },
    "session.binary_asset": { summary: "Dane binarne przechwycone w sesji, zwykle zrzuty ekranu. Mogą zajmować sporo kontekstu i miejsca." },
    "session.usage_checkpoint": {
      summary: "Pośrednie rozliczenie użycia w trakcie trwania sesji.",
      sources: {
        ...claudeSources([{ record: "Rekord cost-state", note: "totalCostUSD i totalAPIDuration są kopiowane tak, jak zgłoszono." }]),
        codex: [
          {
            record: "Wiersz event_msg typu token_count",
            note: "Codex zgłasza sumy narastające, więc aplikacja rozlicza tylko przyrost od poprzedniego punktu kontrolnego i wyjmuje tokeny z cache z input_tokens, aby każdy był wyceniony raz.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Tylko rozliczenie premium/AIU, bez sum tokenów; premiumRequests jest kopiowane z totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Konfiguracja modelu zmieniła się w trakcie sesji (model, poziom rozumowania lub poziom kontekstu).",
      sources: { codex: [{ record: "Wiersz event_msg typu thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Rozpoczęto kompaktowanie kontekstu. Rozmowa jest streszczana, by zmniejszyć liczbę tokenów wysyłanych w każdym żądaniu.",
      sources: claudeSources([{ record: "Rekord system z subtype compact_boundary", note: "trigger i preTokens pochodzą z compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Kompaktowanie zakończone, z metadanymi sukcesu lub błędu i id żądań." },
    "session.error": {
      summary: "Błąd API lub transportu. Każde ponowienie wysyła cały kontekst żądania od nowa.",
      sources: {
        ...claudeSources([{ record: "Rekord system z subtype api_error" }]),
        gemini: [{ record: "Wiadomość typu error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Tura została przerwana przed ukończeniem.",
      changes: ["Każdy agent oznacza przerwanie inaczej; wszystkie stają się tym jednym typem."],
      sources: {
        ...claudeSources([
          {
            record: "Rekord user, którego tekst zaczyna się od „[Request interrupted by user”",
            note: "Claude Code zapisuje przerwanie tak, jakby wpisał je użytkownik; aplikacja nie pokazuje go jako promptu.",
          },
        ]),
        codex: [{ record: "Wiersz event_msg typu turn_aborted" }],
        copilot: [{ record: "Zdarzenie abort", note: "Przemianowane; dane zachowane bez zmian." }],
      },
    },
    "session.mode_change": {
      summary: "Tryb interakcji lub uprawnień zmienił się w trakcie sesji.",
      sources: claudeSources([{ record: "Rekord mode lub permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Konfiguracja uruchomieniowa tury: model, poziom rozumowania, piaskownica i zasady zatwierdzania.",
      sources: { codex: [{ record: "Wiersz turn_context" }] },
    },
    "session.world_state": {
      summary: "Migawka obszaru roboczego przekazana modelowi przez środowisko.",
      sources: { codex: [{ record: "Wiersz world_state" }] },
    },
    "session.rollback": {
      summary: "Rozmowę cofnięto o pewną liczbę tur.",
      sources: { codex: [{ record: "Wiersz event_msg typu thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Agent utworzył lub zaktualizował swój plan pracy." },
    "session.info": {
      summary: "Komunikat wypisany przez agenta: informacja lub ostrzeżenie.",
      sources: { gemini: [{ record: "Wiadomość typu info lub warning" }] },
    },

    "user.message": {
      summary: "To, co wpisał użytkownik. Uruchamia kolejną turę asystenta.",
      sources: {
        ...claudeSources([
          {
            record: "Rekord user: message.content jako ciąg znaków lub każdy zawarty w nim blok text",
            note: "Ten sam rodzaj rekordu przenosi też wyniki narzędzi, które stają się tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Wiersz event_msg typu user_message" },
          {
            record: "Wiadomość response_item z role user, tylko w starszych rolloutach",
            note: "Nowsze rollouty zawierają rozmowę dwukrotnie: jako event_msg (to, co widział użytkownik) i response_item (to, co widział model). Aplikacja używa event_msg, by tury się nie dublowały; kopia response_item staje się system.message.",
          },
        ],
        copilot: [{ record: "user.message, czytane bez zmian" }],
        gemini: [{ record: "Wiadomość typu user" }],
      },
    },
    "assistant.message": {
      summary: "Tekst odpowiedzi modelu, z nazwą modelu i użyciem tokenów.",
      fields: {
        phase: "Codex: do której części tury należy wiadomość.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Rekord assistant z blokiem text w message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Odpowiedź bez tekstu, rozumowania i wywołania narzędzia też staje się pustą wiadomością, aby jej użycie zostało policzone.`,
          },
        ]),
        codex: [
          { record: "Wiersz event_msg typu agent_message" },
          { record: "Wiadomość response_item z role assistant, tylko gdy nie ma kopii event_msg" },
        ],
        copilot: [{ record: "assistant.message, czytane bez zmian" }],
        gemini: [{ record: "Treść wiadomości typu gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Rozumowanie wygenerowane przez model przed odpowiedzią. Rozliczane jako tokeny wyjściowe.",
      sources: {
        ...claudeSources([{ record: "Rekord assistant z blokiem thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Wiersz event_msg typu agent_reasoning" },
          { record: "response_item typu reasoning, na podstawie jego summary", note: "Rozumowanie wyłącznie zaszyfrowane nie zawiera nic czytelnego i jest pomijane." },
        ],
        gemini: [{ record: "Każdy wpis thoughts w wiadomości typu gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Początek jednej tury asystenta.",
      sources: { codex: [{ record: "Wiersz event_msg typu task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Koniec tury asystenta po rozumowaniu, wywołaniach narzędzi i wyjściu.",
      sources: {
        ...claudeSources([{ record: "Rekord system z subtype turn_duration" }]),
        codex: [{ record: "Wiersz event_msg typu task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Model wywołał wbudowane narzędzie, z nazwą i argumentami.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Narzędzia o nazwie mcp__… stają się zamiast tego external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "response_item typu function_call, custom_tool_call lub local_shell_call",
            note: "Argumenty zapisane jako ciąg JSON są parsowane do obiektu.",
          },
        ],
        copilot: [{ record: "tool.execution_start, czytane bez zmian" }],
        gemini: [{ record: "Każdy wpis toolCalls w wiadomości typu gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Wywołanie wbudowanego narzędzia zakończyło się, ze statusem i wynikiem.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Nazwa narzędzia pochodzi z dopasowanego wywołania. Gdy blok nie ma treści, używane jest toolUseResult rekordu. success ma wartość false, gdy ustawiono is_error.",
          },
        ]),
        codex: [
          {
            record: "response_item typu function_call_output, custom_tool_call_output lub local_shell_call_output",
            note: "Codex nie zapisuje flagi sukcesu; aplikacja oznacza wywołanie jako nieudane, gdy wyjście zgłasza niezerowy kod wyjścia.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content staje się tekstem wyniku, przy nieudanym wywołaniu zastępuje go error.message, a detailedContent (zwykle diff) staje się result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Model wywołał narzędzie udostępniane przez zewnętrzny most, zwykle serwer MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, dla narzędzia o nazwie mcp__…` }]),
        copilot: [{ record: "external_tool.requested, czytane bez zmian" }],
      },
    },
    "external_tool.completed": {
      summary: "Wywołanie zewnętrznego narzędzia zakończyło się, ze statusem i wynikiem.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, dla narzędzia o nazwie mcp__…` }]),
        codex: [{ record: "Wiersz event_msg typu mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Ma postać jak tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Środowisko poprosiło użytkownika o zgodę na działanie (plik, system lub sieć)." },
    "permission.completed": { summary: "Prośba o zgodę została rozpatrzona: zatwierdzona lub odrzucona." },
    "hook.start": { summary: "Uruchomiono hook cyklu życia, na przykład przy wysłaniu promptu." },
    "hook.end": {
      summary: "Hook cyklu życia zakończył się sukcesem lub błędem.",
      sources: claudeSources([{ record: "Rekord system z subtype stop_hook_summary", note: "success ma wartość false, gdy rekord wymienia błędy hooków." }]),
    },

    "system.message": {
      summary: "Instrukcje, które środowisko umieściło przed modelem: prompt systemowy, pliki instrukcji lub wstrzyknięty kontekst.",
      detail: "Są wysyłane z każdym żądaniem, więc ich rozmiar sumuje się w ciągu sesji. Przełącznik na pasku narzędzi ukrywa je razem z resztą wstrzykniętego kontekstu.",
      sources: {
        ...claudeSources([
          { record: "Rekord attachment typu prompt_snapshot", note: "Claude Code zapisuje prompt systemowy ponownie przy każdej zmianie dowolnej jego części; aplikacja pokazuje go tylko wtedy, gdy zmienił się sam tekst promptu." },
          { record: "Rekord attachment typu instructions (pliki CLAUDE.md i AGENTS.md)" },
          { record: "Rekord system o dowolnym innym subtype" },
        ]),
        codex: [
          { record: "base_instructions w wierszu session_meta" },
          { record: "Wiadomość response_item z role developer lub system" },
          { record: "Wiadomość response_item z role user wstrzyknięta przez środowisko, pokazywana jako role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Kontekst dodany przez samo środowisko: migawki plików, przypomnienia, listy narzędzi lub umiejętności, obrazy.",
      changes: ["Każdy rodzaj załącznika jest spłaszczany do {label, subject, items, content}, aby czytał się jak treść, a nie surowy JSON."],
      sources: {
        ...claudeSources([
          { record: "Rekord attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Lista narzędzi załącznika prompt_snapshot, pokazywana jako definicje narzędzi, gdy się zmienia" },
          { record: "Blok image w rekordzie user", note: "Zachowana jest tylko informacja, że wysłano obraz; piksele zostają na dysku." },
        ]),
        codex: [{ record: "dynamic_tools w wierszu session_meta, pokazywane jako definicje narzędzi" }],
      },
    },
    "system.notification": { summary: "Powiadomienie środowiska dodane do rozmowy, na przykład o zakończeniu powłoki w tle." },

    "file.patch_applied": {
      summary: "Łatka zastosowana przez agenta w obszarze roboczym, z plikami, których dotyczyła.",
      sources: { codex: [{ record: "Wiersz event_msg typu patch_apply_end" }] },
    },
    "web.search": {
      summary: "Wyszukiwanie w sieci wykonane przez model; wyniki trafiają do kontekstu.",
      sources: { codex: [{ record: "Wiersz event_msg typu web_search_end" }] },
    },

    "subagent.deselected": { summary: "Fokus subagenta został wyczyszczony, a sterowanie wróciło do głównego agenta." },
    "subagent.activity": {
      summary: "Aktywność zgłoszona przez subagenta pracującego pod głównym agentem.",
      sources: { codex: [{ record: "Wiersz event_msg typu sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Wiadomość przekazana między agentami.",
      sources: { codex: [{ record: "Wiersz inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "W tej sesji uruchomiono wątek subagenta.",
      sources: { codex: [{ record: "Wiersz session_meta po pierwszym" }] },
    },
  },

  unknownSummary: "Zdarzenie z kategorii „{category}” („{name}”), które nie ma jeszcze opisu.",
  unknownCategory: "nieznana",
  unknownName: "ogólne",
  unknownDetail:
    "Agent zapisał rekord, dla którego aplikacja nie ma odwzorowania. Jest zachowany z danymi w zapisanej postaci, więc nic nie ginie, i pokazany na ogólnej karcie.",

  callAndResult: "Wywołanie i jego wynik, pokazane jako jeden wiersz.",
  recordsInOrder: "Rekordy, z których odczytano wiersz, w kolejności transkrypcji.",
  recordTitle: "Rekord {agent}",
  eventFormat: "Format zdarzeń",
};
