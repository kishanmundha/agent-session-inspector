import { claudeSources, type EventDocs } from "./en";

/** Indonesian. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "Hasil disederhanakan menjadi teks biasa di result.content. Gambar hanya menyimpan jenis dan ukurannya; pikselnya tetap di disk.",
  "Di tampilan ringkas, panggilan dan hasilnya ditampilkan sebagai satu baris, jadi Raw dan Original menampilkan dua rekaman.",
];

const CLAUDE_TOOL_USE = "Rekaman assistant dengan blok tool_use di message.content";
const CLAUDE_TOOL_RESULT =
  "Rekaman user dengan blok tool_result, dicocokkan ke panggilannya melalui tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code menulis satu rekaman per blok konten dari respons yang di-stream, dan mengulang penggunaan respons di setiap rekaman. Penggunaan dihitung sekali, pada event pertama respons.";
const ARGUMENT_CHARS =
  "argumentChars ditambahkan: ukuran argumen seperti yang ditulis, yaitu biayanya di konteks.";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "Jenis rekaman: user, assistant, system, attachment, mode, …",
  subtype: "Jenis rekaman system: api_error, compact_boundary, turn_duration, …",
  uuid: "Id rekaman.",
  parentUuid: "Rekaman yang diikuti rekaman ini dalam percakapan.",
  isSidechain: "Ditulis oleh subagen, bukan percakapan utama.",
  timestamp: "Kapan ditulis, ISO 8601.",
  sessionId: "Sesi pemilik rekaman; fork mempertahankan id induknya pada rekaman yang disalin.",
  cwd: "Direktori kerja.",
  gitBranch: "Branch Git saat itu.",
  version: "Versi Claude Code yang menulis rekaman.",
  entrypoint: "Tempat Claude Code berjalan: cli, claude-desktop, …",
  userType: "Siapa yang mengendalikan sesi.",
  requestId: "Id permintaan API.",
  promptId: "Prompt pemilik rekaman.",
  effort: "Tingkat penalaran permintaan.",
  message: "Pesan API, seperti yang dikirim atau diterima.",
  "message.role": "user atau assistant.",
  "message.model": "Model yang menjawab; <synthetic> untuk pesan yang ditulis Claude Code sendiri.",
  "message.id": "Id pesan API; sama untuk semua rekaman dari satu respons yang di-stream.",
  "message.type": "Selalu message.",
  "message.content": "String, atau daftar blok konten.",
  "message.content[].type": "Jenis blok: text, thinking, tool_use, tool_result, image.",
  "message.content[].text": "Teks blok text.",
  "message.content[].thinking": "Penalaran blok thinking.",
  "message.content[].signature": "Tanda tangan agar penalaran bisa dikirim kembali ke API.",
  "message.content[].id": "Id blok tool_use.",
  "message.content[].name": "Alat yang dipanggil blok tool_use.",
  "message.content[].input": "Argumen blok tool_use.",
  "message.content[].tool_use_id": "Panggilan yang dijawab blok tool_result.",
  "message.content[].content": "Apa yang dikembalikan alat.",
  "message.content[].is_error": "Alat melaporkan kegagalan.",
  "message.stop_reason": "Alasan respons berakhir: end_turn, tool_use, max_tokens, …",
  "message.usage": "Penggunaan token seluruh respons, diulang di setiap rekamannya.",
  "message.usage.input_tokens": "Token input yang tidak dibaca dari maupun ditulis ke cache.",
  "message.usage.output_tokens": "Token output.",
  "message.usage.cache_read_input_tokens": "Token input yang dibaca dari cache.",
  "message.usage.cache_creation_input_tokens": "Token input yang ditulis ke cache.",
  "message.usage.cache_creation": "Penulisan cache dirinci per masa berlaku.",
  "message.usage.speed": "fast jika permintaan berjalan dalam mode cepat.",
  toolUseResult: "Salinan terstruktur milik Claude Code dari hasil alat.",
  attachment: "Konteks yang disisipkan Claude Code; type-nya menunjukkan jenisnya.",
  "attachment.type": "Jenis lampiran: prompt_snapshot, instructions, file, date, …",
  content: "Teks rekaman system.",
  level: "Tingkat keparahan rekaman system.",
  error: "Detail galat rekaman api_error.",
};

export const id: EventDocs = {
  providerFormats: {
    claude:
      "JSONL di ~/.claude/projects/<project>/<session>.jsonl: satu rekaman JSON per baris, berjenis user, assistant, system, attachment, dan seterusnya. Setiap rekaman membawa versi Claude Code yang menulisnya.",
    cowork:
      "CLI Claude Code berjalan di dalam setiap sesi Cowork dan menulis transkrip JSONL yang sama, jadi dibaca persis seperti Claude Code.",
    codex:
      "JSONL di ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: baris {timestamp, type, payload} berjenis session_meta, event_msg, response_item, turn_context. Hanya session_meta yang menyebut versi CLI.",
    copilot:
      "JSONL di ~/.copilot/session-state/<id>/events.jsonl, sudah ditulis sebagai {type, data, id, timestamp, parentId} dengan kosakata category.subCategory yang sama dengan aplikasi ini. session.start menyebut versi format dan versi CLI.",
    vscode:
      "File sesi chat (JSON, atau JSONL berisi perubahan yang ditambahkan) di penyimpanan workspace VS Code, satu pasangan permintaan/respons per entri.",
    gemini:
      "File sesi di ~/.gemini/tmp/<project>/chats. Setiap pesan berjenis user, gemini, info, warning atau error; pesan yang ditulis ulang menggantikan versi sebelumnya.",
    opencode:
      "SQLite (opencode.db): baris session, message dan part, masing-masing menyimpan kontennya di kolom JSON.",
    cursor:
      "Penyimpanan SQLite di ~/.cursor/projects, menyimpan percakapan sebagai baris bubble: 1 untuk pengguna, 2 untuk agen.",
    hermes: "SQLite (state.db) di ~/.hermes: sesi dan pesannya sebagai baris.",
  },

  sharedChanges: [
    "Jenisnya diganti ke kosakata bersama category.subCategory, agar event dari semua agen terbaca sama.",
    "Teks panjang dipotong pada 20.000 karakter. charLength menyimpan panjang penuh dan truncated menandakan pemotongan; rekaman aslinya tidak dipotong.",
    "Satu rekaman bisa menjadi beberapa event (respons dengan teks, penalaran, dan panggilan alat), dan beberapa rekaman dilewati karena hanya pencatatan internal.",
  ],

  fieldDocs: {
    content: "Teks pesan, dibatasi 20.000 karakter.",
    charLength: "Panjang penuh teks sebelum dibatasi.",
    truncated: "True jika teks yang ditampilkan terpotong.",
    model: "Model yang menghasilkan ini, sesuai nama dari agen.",
    effort: "Tingkat penalaran yang dipakai permintaan.",
    requestId: "Id permintaan API, untuk dicocokkan dengan log penyedia.",
    role: "Asal teks: system_prompt, instructions, developer, user_context, …",
    toolName: "Alat yang dipanggil model; mcp__server__tool untuk alat MCP.",
    toolCallId: "Id yang menghubungkan panggilan dengan hasilnya.",
    arguments: "Argumen yang diberikan model ke alat, diurai menjadi JSON.",
    argumentChars: "Ukuran argumen seperti yang ditulis model, yaitu biayanya di konteks.",
    result: "Apa yang dikembalikan alat, disederhanakan menjadi {content, format, images?, detail?}.",
    resultChars: "Panjang penuh hasil sebelum dibatasi.",
    success: "False jika panggilan melaporkan kegagalan.",
    inputTokens: "Token input permintaan, termasuk token yang ditulis ke cache.",
    outputTokens: "Token output respons, termasuk penalaran.",
    cacheReadTokens: "Token input yang dilayani dari cache prompt.",
    billedUsage: "Penggunaan dirinci sesuai cara penetapan harganya, dipakai untuk estimasi biaya.",
    costUSD: "Estimasi biaya permintaan ini dengan harga daftar API.",
    inherited: "Disalin dari sesi asal fork ini; biayanya milik sesi tersebut.",
    durationMs: "Berapa lama, dalam milidetik.",
    sessionId: "Id sesi.",
    context: "Direktori kerja, branch, dan repositori tempat sesi berjalan.",
    attachmentType: "Nama yang dipakai agen untuk jenis konteks ini.",
    label: "Nama yang mudah dibaca untuk jenis lampiran.",
    subject: "Topik lampiran: sebuah file, tanggal, hook…",
    items: "Nama yang dicantumkan lampiran (alat, skill, agen), paling banyak 200.",
    itemCount: "Berapa banyak nama yang dicantumkan lampiran secara lengkap.",
    itemsLabel: "Apa nama-nama yang dicantumkan itu.",
    message: "Teks galat atau pemberitahuan.",
    reason: "Mengapa hal itu terjadi.",
    mode: "Mode yang dituju.",
    trigger: "Pemicunya: manual atau auto.",
    preTokens: "Ukuran konteks sebelum pemadatan.",
    turnId: "Id giliran.",
    totalCostUSD: "Biaya sesi sejauh ini menurut laporan agen sendiri.",
    apiDurationMs: "Total waktu menunggu API sejauh ini.",
    premiumRequests: "Permintaan premium yang terhitung sejauh ini.",
    sessionTotals: "Total sesi yang dilaporkan agen, dipakai untuk ringkasan sesi.",
    usage: "Total penggunaan seperti yang dilaporkan agen.",
    selectedModel: "Model yang dipilih saat sesi dimulai.",
    copilotVersion: "Versi CLI agen yang menulis sesi.",
    cliVersion: "Versi CLI agen yang menulis sesi.",
    entrypoint: "Tempat sesi berjalan: cli, claude-desktop, …",
    forkedFrom: "Sesi asal fork ini.",
  },

  pathDocs: {
    type: "Jenis event, category.subCategory.",
    data: "Apa yang dicatat agen, dinormalkan bila perlu.",
    id: "Id unik event dalam sesi.",
    timestamp: "Kapan terjadi, ISO 8601.",
    parentId: "Event asal event ini, jika agen mencatatnya.",
    source: "Lokasi rekaman asli: barisnya di transkrip, atau id milik agen.",
    category: "Bagian pertama jenis, dipakai oleh filter.",
    subCategory: "Sisa jenis, dipakai oleh filter.",
    subKey: "Jenis lengkap, dipakai oleh filter.",
    "data.result.content": "Teks biasa hasil, dibatasi. Hasil JSON diberi indentasi.",
    "data.result.format": "text atau json.",
    "data.result.images": "Gambar yang dikembalikan alat: hanya jenis dan ukuran.",
    "data.result.detail": "Tampilan kedua yang ditambahkan beberapa alat, biasanya diff.",
    "data.context.cwd": "Direktori kerja.",
    "data.context.branch": "Branch Git.",
    "data.context.repository": "Repositori Git.",
    "data.billedUsage.model": "Model yang menjadi dasar harga penggunaan.",
    "data.billedUsage.inputTokens": "Token input yang tidak dibaca dari maupun ditulis ke cache.",
    "data.billedUsage.outputTokens": "Token output.",
    "data.billedUsage.cacheReadTokens": "Token input yang dibaca dari cache.",
    "data.billedUsage.cacheWriteTokens": "Token input yang ditulis ke cache 5 menit.",
    "data.billedUsage.cacheWrite1hTokens": "Token input yang ditulis ke cache 1 jam.",
    "data.billedUsage.fast": "Berjalan dalam mode cepat, ditagih dengan tarif lebih tinggi.",
    "data.billedUsage.local": "Berjalan di model lokal, tanpa biaya.",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "Kapan baris ditulis, ISO 8601.",
      ordinal: "Posisi baris di rollout.",
      type: "Jenis baris: session_meta, event_msg, response_item, turn_context, …",
      payload: "Isi baris; type miliknya menunjukkan apa isinya.",
      "payload.type": "Jenis payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "Id sesi (session_meta) atau item.",
      "payload.cli_version": "Versi CLI Codex, hanya di session_meta.",
      "payload.originator": "Aplikasi yang menjalankan Codex.",
      "payload.cwd": "Direktori kerja.",
      "payload.role": "Pengirim pesan: user, assistant, developer, system.",
      "payload.content": "Bagian-bagian konten pesan.",
      "payload.content[].type": "Jenis bagian: input_text, output_text, …",
      "payload.content[].text": "Teks bagian.",
      "payload.message": "Teks pesan event_msg.",
      "payload.call_id": "Id yang menghubungkan panggilan alat dengan output-nya.",
      "payload.name": "Alat yang dipanggil.",
      "payload.arguments": "Argumen alat, sebagai string JSON.",
      "payload.input": "Input panggilan alat kustom.",
      "payload.output": "Apa yang dikembalikan alat.",
      "payload.status": "Status panggilan.",
      "payload.turn_id": "Giliran pemilik baris.",
      "payload.info": "Penggunaan token: total kumulatif dan milik permintaan terakhir.",
    },
    copilot: {
      type: "Jenis event, sudah dalam bentuk category.subCategory.",
      data: "Data event.",
      id: "Id event.",
      timestamp: "Kapan terjadi, ISO 8601.",
      parentId: "Event asal event ini.",
      "data.version": "Versi format events.jsonl.",
      "data.copilotVersion": "Versi CLI Copilot.",
      "data.producer": "Yang menulis file.",
      "data.toolCallId": "Id yang menghubungkan panggilan dengan hasilnya.",
      "data.toolName": "Alat yang dipanggil.",
      "data.arguments": "Argumen alat.",
      "data.result": "Apa yang dikembalikan alat: content, dan detailedContent jika alat menambahkannya.",
      "data.error": "Mengapa panggilan yang gagal itu gagal.",
    },
  },

  events: {
    "session.start": {
      summary: "Inisialisasi sesi. Mencatat konteks runtime dan model yang dipilih saat sesi dimulai.",
      sources: {
        ...claudeSources([
          {
            record: "Tidak ada rekaman: Claude Code tidak menulis rekaman awal",
            note: "Aplikasi membuatnya dari cwd, gitBranch, version dan entrypoint rekaman transkrip, agar linimasa dibuka dengan header yang sama untuk setiap agen.",
          },
        ]),
        codex: [{ record: "Baris session_meta pertama", note: "Baris session_meta berikutnya adalah thread subagen dan menjadi subagent.session_start." }],
        copilot: [{ record: "session.start, dibaca apa adanya" }],
      },
    },
    "session.resume": { summary: "Sesi dilanjutkan dari keadaan sebelumnya. Menandakan pemuatan ulang konteks dan kelanjutan." },
    "session.shutdown": {
      summary: "Ringkasan akhir sesi. Biasanya berisi penggunaan, total token, permintaan premium, dan waktu API.",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "Aplikasi menurunkan sessionTotals dan usageSummary darinya. Totalnya kumulatif, jadi hanya shutdown terakhir yang dihitung harganya dan sesi yang dilanjutkan tidak dihitung dua kali.",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "Hasil pemilihan model mode otomatis. Menampilkan profil tugas yang diprediksi dan pengaturan model yang dipilih." },
    "session.binary_asset": { summary: "Data biner yang terekam dalam sesi, biasanya tangkapan layar. Bisa memakan banyak konteks dan penyimpanan." },
    "session.usage_checkpoint": {
      summary: "Pencatatan penggunaan sementara selama sesi aktif.",
      sources: {
        ...claudeSources([{ record: "Rekaman cost-state", note: "totalCostUSD dan totalAPIDuration disalin sesuai laporan." }]),
        codex: [
          {
            record: "Baris event_msg berjenis token_count",
            note: "Codex melaporkan total kumulatif, jadi aplikasi hanya menagih selisih sejak checkpoint sebelumnya, dan memindahkan token cache dari input_tokens agar masing-masing dihargai sekali.",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "Hanya pencatatan premium/AIU, tanpa total token; premiumRequests disalin dari totalPremiumRequests." }],
      },
    },
    "session.model_change": {
      summary: "Konfigurasi model berubah selama sesi (model, tingkat penalaran atau tingkat konteks).",
      sources: { codex: [{ record: "Baris event_msg berjenis thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "Pemadatan konteks dimulai. Percakapan diringkas untuk mengurangi token yang dikirim di setiap permintaan.",
      sources: claudeSources([{ record: "Rekaman system dengan subtype compact_boundary", note: "trigger dan preTokens berasal dari compactMetadata." }]),
    },
    "session.compaction_complete": { summary: "Pemadatan selesai, dengan metadata berhasil atau gagal dan id permintaan." },
    "session.error": {
      summary: "Galat API atau transport. Setiap percobaan ulang mengirim seluruh konteks permintaan lagi.",
      sources: {
        ...claudeSources([{ record: "Rekaman system dengan subtype api_error" }]),
        gemini: [{ record: "Pesan berjenis error" }],
      },
    },
    "session.turn_aborted": {
      summary: "Giliran dihentikan sebelum selesai.",
      changes: ["Setiap agen menandai penghentian dengan cara berbeda; semuanya menjadi satu jenis ini."],
      sources: {
        ...claudeSources([
          {
            record: "Rekaman user yang teksnya diawali “[Request interrupted by user”",
            note: "Claude Code mencatat penghentian seolah-olah pengguna mengetiknya; aplikasi tidak menampilkannya sebagai prompt.",
          },
        ]),
        codex: [{ record: "Baris event_msg berjenis turn_aborted" }],
        copilot: [{ record: "Event abort", note: "Diganti nama; datanya disimpan apa adanya." }],
      },
    },
    "session.mode_change": {
      summary: "Mode interaksi atau izin berubah selama sesi.",
      sources: claudeSources([{ record: "Rekaman mode atau permission-mode" }]),
    },
    "session.turn_context": {
      summary: "Konfigurasi runtime per giliran: model, tingkat penalaran, sandbox, dan kebijakan persetujuan.",
      sources: { codex: [{ record: "Baris turn_context" }] },
    },
    "session.world_state": {
      summary: "Cuplikan workspace yang diberikan runtime kepada model.",
      sources: { codex: [{ record: "Baris world_state" }] },
    },
    "session.rollback": {
      summary: "Percakapan dimundurkan beberapa giliran.",
      sources: { codex: [{ record: "Baris event_msg berjenis thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "Agen membuat atau memperbarui rencana kerjanya." },
    "session.info": {
      summary: "Pemberitahuan yang dicetak agen: informasi atau peringatan.",
      sources: { gemini: [{ record: "Pesan berjenis info atau warning" }] },
    },

    "user.message": {
      summary: "Apa yang diketik pengguna. Ini memicu giliran asisten berikutnya.",
      sources: {
        ...claudeSources([
          {
            record: "Rekaman user: message.content sebagai string, atau setiap blok text di dalamnya",
            note: "Jenis rekaman yang sama juga membawa hasil alat, yang menjadi tool.execution_complete.",
          },
        ]),
        codex: [
          { record: "Baris event_msg berjenis user_message" },
          {
            record: "Pesan response_item dengan role user, hanya di rollout lama",
            note: "Rollout baru memuat percakapan dua kali, sebagai event_msg (yang dilihat pengguna) dan response_item (yang dilihat model). Aplikasi memakai event_msg agar giliran tidak ganda; salinan response_item menjadi system.message.",
          },
        ],
        copilot: [{ record: "user.message, dibaca apa adanya" }],
        gemini: [{ record: "Pesan berjenis user" }],
      },
    },
    "assistant.message": {
      summary: "Teks balasan model, dengan nama model dan penggunaan token.",
      fields: {
        phase: "Codex: bagian giliran tempat pesan ini berada.",
      },
      sources: {
        ...claudeSources([
          {
            record: "Rekaman assistant dengan blok text di message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} Respons tanpa teks, penalaran, atau panggilan alat tetap menjadi pesan kosong, agar penggunaannya terhitung.`,
          },
        ]),
        codex: [
          { record: "Baris event_msg berjenis agent_message" },
          { record: "Pesan response_item dengan role assistant, hanya jika tidak ada salinan event_msg" },
        ],
        copilot: [{ record: "assistant.message, dibaca apa adanya" }],
        gemini: [{ record: "Konten pesan berjenis gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "Penalaran yang dihasilkan model sebelum menjawab. Ditagih sebagai token output.",
      sources: {
        ...claudeSources([{ record: "Rekaman assistant dengan blok thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "Baris event_msg berjenis agent_reasoning" },
          { record: "response_item berjenis reasoning, memakai summary-nya", note: "Penalaran yang hanya terenkripsi tidak punya bagian terbaca dan dilewati." },
        ],
        gemini: [{ record: "Setiap entri thoughts pada pesan berjenis gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "Awal satu giliran asisten.",
      sources: { codex: [{ record: "Baris event_msg berjenis task_started" }] },
    },
    "assistant.turn_end": {
      summary: "Akhir giliran asisten setelah penalaran, panggilan alat, dan output-nya.",
      sources: {
        ...claudeSources([{ record: "Rekaman system dengan subtype turn_duration" }]),
        codex: [{ record: "Baris event_msg berjenis task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "Model memanggil alat bawaan, dengan nama dan argumennya.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `Alat bernama mcp__… menjadi external_tool.requested. ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "response_item berjenis function_call, custom_tool_call atau local_shell_call",
            note: "Argumen yang ditulis sebagai string JSON diurai menjadi objek.",
          },
        ],
        copilot: [{ record: "tool.execution_start, dibaca apa adanya" }],
        gemini: [{ record: "Setiap entri toolCalls pada pesan berjenis gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "Panggilan alat bawaan selesai, dengan status dan hasilnya.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "Nama alat diambil dari panggilan yang cocok. Jika blok tidak berisi konten, toolUseResult rekaman yang dipakai. success bernilai false jika is_error diset.",
          },
        ]),
        codex: [
          {
            record: "response_item berjenis function_call_output, custom_tool_call_output atau local_shell_call_output",
            note: "Codex tidak mencatat penanda berhasil; aplikasi menandai panggilan gagal jika output-nya melaporkan kode keluar bukan nol.",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content menjadi teks hasil, error.message dari panggilan yang gagal menggantikannya, dan detailedContent (biasanya diff) menjadi result.detail.",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "Model memanggil alat yang dilayani jembatan eksternal, biasanya server MCP.",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE}, untuk alat bernama mcp__…` }]),
        copilot: [{ record: "external_tool.requested, dibaca apa adanya" }],
      },
    },
    "external_tool.completed": {
      summary: "Panggilan alat eksternal selesai, dengan status dan hasilnya.",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT}, untuk alat bernama mcp__…` }]),
        codex: [{ record: "Baris event_msg berjenis mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "Bentuknya sama dengan tool.execution_complete." }],
      },
    },

    "permission.requested": { summary: "Runtime meminta izin pengguna untuk suatu tindakan (file, sistem, atau jaringan)." },
    "permission.completed": { summary: "Permintaan izin telah diputuskan: disetujui atau ditolak." },
    "hook.start": { summary: "Hook siklus hidup dimulai, misalnya saat prompt dikirim." },
    "hook.end": {
      summary: "Hook siklus hidup selesai, berhasil atau gagal.",
      sources: claudeSources([{ record: "Rekaman system dengan subtype stop_hook_summary", note: "success bernilai false jika rekaman mencantumkan galat hook." }]),
    },

    "system.message": {
      summary: "Instruksi yang diletakkan runtime di depan model: prompt sistem, file instruksi, atau konteks yang disisipkan.",
      detail: "Instruksi ini dikirim di setiap permintaan, jadi ukurannya terakumulasi sepanjang sesi. Tombol di toolbar menyembunyikannya bersama konteks sisipan lainnya.",
      sources: {
        ...claudeSources([
          { record: "Rekaman attachment berjenis prompt_snapshot", note: "Claude Code mencatat ulang prompt sistem setiap kali ada bagian yang berubah; aplikasi hanya menampilkannya jika teks prompt itu sendiri berubah." },
          { record: "Rekaman attachment berjenis instructions (file CLAUDE.md dan AGENTS.md)" },
          { record: "Rekaman system dengan subtype lainnya" },
        ]),
        codex: [
          { record: "base_instructions pada baris session_meta" },
          { record: "Pesan response_item dengan role developer atau system" },
          { record: "Pesan response_item dengan role user yang disisipkan runtime, ditampilkan sebagai role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "Konteks yang ditambahkan runtime sendiri: cuplikan file, pengingat, daftar alat atau skill, gambar.",
      changes: ["Setiap jenis lampiran diratakan menjadi {label, subject, items, content}, agar terbaca sebagai konten, bukan JSON mentah."],
      sources: {
        ...claudeSources([
          { record: "Rekaman attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "Daftar alat dari lampiran prompt_snapshot, ditampilkan sebagai definisi alat saat berubah" },
          { record: "Blok image di rekaman user", note: "Hanya fakta bahwa gambar dikirim yang disimpan; pikselnya tetap di disk." },
        ]),
        codex: [{ record: "dynamic_tools pada baris session_meta, ditampilkan sebagai definisi alat" }],
      },
    },
    "system.notification": { summary: "Notifikasi runtime yang ditambahkan ke percakapan, misalnya shell latar belakang yang selesai." },

    "file.patch_applied": {
      summary: "Patch yang diterapkan agen ke workspace, dengan file yang disentuhnya.",
      sources: { codex: [{ record: "Baris event_msg berjenis patch_apply_end" }] },
    },
    "web.search": {
      summary: "Pencarian web yang dijalankan model; hasilnya ditambahkan ke konteks.",
      sources: { codex: [{ record: "Baris event_msg berjenis web_search_end" }] },
    },

    "subagent.deselected": { summary: "Fokus subagen dihapus dan kendali kembali ke agen utama." },
    "subagent.activity": {
      summary: "Aktivitas yang dilaporkan subagen yang bekerja di bawah agen utama.",
      sources: { codex: [{ record: "Baris event_msg berjenis sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "Pesan yang diteruskan antar agen.",
      sources: { codex: [{ record: "Baris inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "Thread subagen dimulai di dalam sesi ini.",
      sources: { codex: [{ record: "Baris session_meta setelah yang pertama" }] },
    },
  },

  unknownSummary: "Event dalam kategori “{category}” (“{name}”) yang belum punya deskripsi.",
  unknownCategory: "tidak dikenal",
  unknownName: "umum",
  unknownDetail:
    "Agen menulis rekaman yang belum punya pemetaan di aplikasi. Rekaman disimpan beserta datanya apa adanya, jadi tidak ada yang hilang, dan ditampilkan lewat kartu umum.",

  callAndResult: "Panggilan dan hasilnya, ditampilkan sebagai satu baris.",
  recordsInOrder: "Rekaman sumber baris ini, sesuai urutan transkrip.",
  recordTitle: "Rekaman {agent}",
  eventFormat: "Format event",
};
