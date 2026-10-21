import { claudeSources, type EventDocs } from "./en";

/** Thai. Follows en.ts key for key; record and field names stay as written. */

const TOOL_RESULT_CHANGES = [
  "ผลลัพธ์ถูกย่อเหลือข้อความธรรมดาใน result.content รูปภาพเก็บไว้เพียงชนิดและขนาด ส่วนพิกเซลยังอยู่บนดิสก์",
  "ในมุมมองแบบกะทัดรัด การเรียกและผลลัพธ์จะแสดงเป็นแถวเดียว Raw และ Original จึงแสดงสองเรคคอร์ด",
];

const CLAUDE_TOOL_USE = "เรคคอร์ด assistant ที่มีบล็อก tool_use ใน message.content";
const CLAUDE_TOOL_RESULT =
  "เรคคอร์ด user ที่มีบล็อก tool_result จับคู่กับการเรียกด้วย tool_use_id";
const CLAUDE_ASSISTANT_NOTE =
  "Claude Code เขียนหนึ่งเรคคอร์ดต่อหนึ่งบล็อกเนื้อหาของคำตอบแบบสตรีม และบันทึกการใช้งานของคำตอบซ้ำในทุกเรคคอร์ด การใช้งานจึงนับเพียงครั้งเดียวที่อีเวนต์แรกของคำตอบ";
const ARGUMENT_CHARS =
  "เพิ่ม argumentChars: ขนาดของอาร์กิวเมนต์ตามที่เขียน ซึ่งก็คือต้นทุนในบริบท";

const CLAUDE_RECORD_DOCS: EventDocs["recordDocs"]["claude"] = {
  type: "ชนิดเรคคอร์ด: user, assistant, system, attachment, mode, …",
  subtype: "ชนิดของเรคคอร์ด system: api_error, compact_boundary, turn_duration, …",
  uuid: "id ของเรคคอร์ด",
  parentUuid: "เรคคอร์ดที่อยู่ก่อนหน้าเรคคอร์ดนี้ในบทสนทนา",
  isSidechain: "เขียนโดยซับเอเจนต์ ไม่ใช่บทสนทนาหลัก",
  timestamp: "เวลาที่เขียน ISO 8601",
  sessionId: "เซสชันที่เรคคอร์ดนี้สังกัด การ fork จะคง id ของเซสชันแม่ไว้ในเรคคอร์ดที่คัดลอก",
  cwd: "ไดเรกทอรีทำงาน",
  gitBranch: "Git branch ในขณะนั้น",
  version: "เวอร์ชัน Claude Code ที่เขียนเรคคอร์ด",
  entrypoint: "ที่ที่ Claude Code ทำงาน: cli, claude-desktop, …",
  userType: "ผู้ที่ควบคุมเซสชัน",
  requestId: "id ของคำขอ API",
  promptId: "พรอมต์ที่เรคคอร์ดนี้สังกัด",
  effort: "ระดับการให้เหตุผลของคำขอ",
  message: "ข้อความ API ตามที่ส่งหรือได้รับ",
  "message.role": "user หรือ assistant",
  "message.model": "โมเดลที่ตอบ ส่วนข้อความที่ Claude Code เขียนเองจะเป็น <synthetic>",
  "message.id": "id ข้อความ API ใช้ร่วมกันในทุกเรคคอร์ดของคำตอบแบบสตรีมหนึ่งรายการ",
  "message.type": "เป็น message เสมอ",
  "message.content": "สตริง หรือรายการบล็อกเนื้อหา",
  "message.content[].type": "ชนิดบล็อก: text, thinking, tool_use, tool_result, image",
  "message.content[].text": "ข้อความของบล็อก text",
  "message.content[].thinking": "การให้เหตุผลของบล็อก thinking",
  "message.content[].signature": "ลายเซ็นที่ทำให้ส่งการให้เหตุผลกลับไปยัง API ได้",
  "message.content[].id": "id ของบล็อก tool_use",
  "message.content[].name": "เครื่องมือที่บล็อก tool_use เรียก",
  "message.content[].input": "อาร์กิวเมนต์ของบล็อก tool_use",
  "message.content[].tool_use_id": "การเรียกที่บล็อก tool_result ตอบกลับ",
  "message.content[].content": "สิ่งที่เครื่องมือส่งคืน",
  "message.content[].is_error": "เครื่องมือรายงานว่าล้มเหลว",
  "message.stop_reason": "เหตุที่คำตอบจบ: end_turn, tool_use, max_tokens, …",
  "message.usage": "การใช้โทเคนของคำตอบทั้งหมด บันทึกซ้ำในทุกเรคคอร์ดของคำตอบนั้น",
  "message.usage.input_tokens": "โทเคนอินพุตที่ไม่ได้อ่านจากแคชและไม่ได้เขียนลงแคช",
  "message.usage.output_tokens": "โทเคนเอาต์พุต",
  "message.usage.cache_read_input_tokens": "โทเคนอินพุตที่อ่านจากแคช",
  "message.usage.cache_creation_input_tokens": "โทเคนอินพุตที่เขียนลงแคช",
  "message.usage.cache_creation": "การเขียนแคชแยกตามอายุแคช",
  "message.usage.speed": "fast เมื่อคำขอทำงานในโหมดเร็ว",
  toolUseResult: "สำเนาผลลัพธ์เครื่องมือแบบมีโครงสร้างของ Claude Code เอง",
  attachment: "บริบทที่ Claude Code แทรกเข้ามา type บอกว่าเป็นชนิดใด",
  "attachment.type": "ชนิดไฟล์แนบ: prompt_snapshot, instructions, file, date, …",
  content: "ข้อความของเรคคอร์ด system",
  level: "ระดับความรุนแรงของเรคคอร์ด system",
  error: "รายละเอียดข้อผิดพลาดของเรคคอร์ด api_error",
};

export const th: EventDocs = {
  providerFormats: {
    claude:
      "JSONL ใน ~/.claude/projects/<project>/<session>.jsonl: หนึ่งเรคคอร์ด JSON ต่อบรรทัด ชนิด user, assistant, system, attachment เป็นต้น ทุกเรคคอร์ดระบุเวอร์ชัน Claude Code ที่เขียนไว้",
    cowork:
      "Claude Code CLI ทำงานภายในทุกเซสชัน Cowork และเขียนทรานสคริปต์ JSONL แบบเดียวกัน จึงอ่านเหมือน Claude Code ทุกประการ",
    codex:
      "JSONL ใน ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl: บรรทัด {timestamp, type, payload} ชนิด session_meta, event_msg, response_item, turn_context มีเพียง session_meta ที่ระบุเวอร์ชัน CLI",
    copilot:
      "JSONL ใน ~/.copilot/session-state/<id>/events.jsonl ซึ่งเขียนเป็น {type, data, id, timestamp, parentId} ด้วยคำศัพท์ category.subCategory แบบเดียวกับแอปนี้อยู่แล้ว session.start ระบุเวอร์ชันรูปแบบและเวอร์ชัน CLI",
    vscode:
      "ไฟล์เซสชันแชต (JSON หรือ JSONL ของการเปลี่ยนแปลงที่ต่อท้าย) ในพื้นที่จัดเก็บเวิร์กสเปซของ VS Code หนึ่งคู่คำขอ/คำตอบต่อรายการ",
    gemini:
      "ไฟล์เซสชันใน ~/.gemini/tmp/<project>/chats แต่ละข้อความเป็นชนิด user, gemini, info, warning หรือ error ข้อความที่เขียนซ้ำจะแทนที่เวอร์ชันก่อนหน้า",
    opencode:
      "SQLite (opencode.db): แถว session, message และ part แต่ละแถวเก็บเนื้อหาในคอลัมน์ JSON",
    cursor:
      "ที่เก็บ SQLite ใน ~/.cursor/projects เก็บบทสนทนาเป็นแถว bubble: 1 สำหรับผู้ใช้ 2 สำหรับเอเจนต์",
    hermes: "SQLite (state.db) ใน ~/.hermes: เซสชันและข้อความของเซสชันเป็นแถว",
  },

  sharedChanges: [
    "ชนิดจะถูกเปลี่ยนชื่อเป็นคำศัพท์กลาง category.subCategory เพื่อให้อีเวนต์ของทุกเอเจนต์อ่านแบบเดียวกัน",
    "ข้อความยาวจะถูกตัดที่ 20,000 อักขระ charLength เก็บความยาวเต็ม และ truncated บอกว่าถูกตัด ส่วนเรคคอร์ดต้นฉบับไม่ถูกตัด",
    "หนึ่งเรคคอร์ดอาจกลายเป็นหลายอีเวนต์ (คำตอบที่มีข้อความ การให้เหตุผล และการเรียกเครื่องมือ) และเรคคอร์ดที่เป็นงานภายในบางรายการจะถูกข้าม",
  ],

  fieldDocs: {
    content: "ข้อความของข้อความ จำกัดที่ 20,000 อักขระ",
    charLength: "ความยาวเต็มของข้อความก่อนถูกจำกัด",
    truncated: "true เมื่อข้อความที่แสดงถูกตัด",
    model: "โมเดลที่สร้างสิ่งนี้ ตามชื่อที่เอเจนต์ตั้ง",
    effort: "ระดับการให้เหตุผลที่คำขอใช้",
    requestId: "id ของคำขอ API ใช้เทียบกับล็อกของผู้ให้บริการ",
    role: "ที่มาของข้อความ: system_prompt, instructions, developer, user_context, …",
    toolName: "เครื่องมือที่โมเดลเรียก เครื่องมือ MCP จะเป็น mcp__server__tool",
    toolCallId: "id ที่เชื่อมการเรียกกับผลลัพธ์",
    arguments: "อาร์กิวเมนต์ที่โมเดลส่งให้เครื่องมือ แปลงเป็น JSON แล้ว",
    argumentChars: "ขนาดของอาร์กิวเมนต์ตามที่โมเดลเขียน ซึ่งก็คือต้นทุนในบริบท",
    result: "สิ่งที่เครื่องมือส่งคืน ย่อเป็น {content, format, images?, detail?}",
    resultChars: "ความยาวเต็มของผลลัพธ์ก่อนถูกจำกัด",
    success: "false เมื่อการเรียกรายงานว่าล้มเหลว",
    inputTokens: "โทเคนอินพุตของคำขอ รวมโทเคนที่เขียนลงแคช",
    outputTokens: "โทเคนเอาต์พุตของคำตอบ รวมการให้เหตุผล",
    cacheReadTokens: "โทเคนอินพุตที่ได้จากแคชพรอมต์",
    billedUsage: "การใช้งานที่แยกตามวิธีคิดราคา ใช้สำหรับประมาณค่าใช้จ่าย",
    costUSD: "ค่าใช้จ่ายโดยประมาณของคำขอนี้ตามราคา API",
    inherited: "คัดลอกมาจากเซสชันต้นทางของการ fork ค่าใช้จ่ายเป็นของเซสชันนั้น",
    durationMs: "ระยะเวลาที่ใช้ เป็นมิลลิวินาที",
    sessionId: "id ของเซสชัน",
    context: "ไดเรกทอรีทำงาน branch และรีโพซิทอรีที่เซสชันทำงาน",
    attachmentType: "ชื่อที่เอเจนต์ใช้เรียกบริบทชนิดนี้",
    label: "ชื่อที่อ่านง่ายของชนิดไฟล์แนบ",
    subject: "สิ่งที่ไฟล์แนบเกี่ยวข้อง: ไฟล์ วันที่ ฮุก…",
    items: "ชื่อที่ไฟล์แนบระบุ (เครื่องมือ สกิล เอเจนต์) สูงสุด 200 รายการ",
    itemCount: "จำนวนชื่อทั้งหมดที่ไฟล์แนบระบุ",
    itemsLabel: "ชื่อที่ระบุเป็นอะไร",
    message: "ข้อความข้อผิดพลาดหรือการแจ้งเตือน",
    reason: "เหตุที่เกิดขึ้น",
    mode: "โหมดที่เปลี่ยนไป",
    trigger: "สิ่งที่เริ่ม: manual หรือ auto",
    preTokens: "ขนาดบริบทก่อนการบีบอัด",
    turnId: "id ของเทิร์น",
    totalCostUSD: "ค่าใช้จ่ายของเซสชันจนถึงตอนนี้ตามที่เอเจนต์รายงานเอง",
    apiDurationMs: "เวลารวมที่รอ API จนถึงตอนนี้",
    premiumRequests: "คำขอพรีเมียมที่นับได้จนถึงตอนนี้",
    sessionTotals: "ยอดรวมของเซสชันที่เอเจนต์รายงาน ใช้ในสรุปเซสชัน",
    usage: "ยอดรวมการใช้งานตามที่เอเจนต์รายงาน",
    selectedModel: "โมเดลที่เลือกเมื่อเริ่มเซสชัน",
    copilotVersion: "เวอร์ชัน CLI ของเอเจนต์ที่เขียนเซสชัน",
    cliVersion: "เวอร์ชัน CLI ของเอเจนต์ที่เขียนเซสชัน",
    entrypoint: "ที่ที่เซสชันทำงาน: cli, claude-desktop, …",
    forkedFrom: "เซสชันต้นทางของการ fork นี้",
  },

  pathDocs: {
    type: "ชนิดอีเวนต์ category.subCategory",
    data: "สิ่งที่เอเจนต์บันทึก ปรับให้เป็นมาตรฐานในจุดที่คุ้มค่า",
    id: "id ที่ไม่ซ้ำของอีเวนต์ภายในเซสชัน",
    timestamp: "เวลาที่เกิดขึ้น ISO 8601",
    parentId: "อีเวนต์ต้นทางของอีเวนต์นี้ หากเอเจนต์บันทึกไว้",
    source: "ตำแหน่งของเรคคอร์ดต้นฉบับ: บรรทัดในทรานสคริปต์ หรือ id ของเอเจนต์เอง",
    category: "ส่วนแรกของชนิด ใช้โดยตัวกรอง",
    subCategory: "ส่วนที่เหลือของชนิด ใช้โดยตัวกรอง",
    subKey: "ชนิดแบบเต็ม ใช้โดยตัวกรอง",
    "data.result.content": "ข้อความธรรมดาของผลลัพธ์ มีการจำกัดความยาว ผลลัพธ์ JSON จะเยื้องบรรทัด",
    "data.result.format": "text หรือ json",
    "data.result.images": "รูปภาพที่เครื่องมือส่งคืน: เฉพาะชนิดและขนาด",
    "data.result.detail": "การแสดงผลแบบที่สองที่เครื่องมือบางตัวเพิ่ม มักเป็น diff",
    "data.context.cwd": "ไดเรกทอรีทำงาน",
    "data.context.branch": "Git branch",
    "data.context.repository": "Git repository",
    "data.billedUsage.model": "โมเดลที่ใช้คิดราคาการใช้งาน",
    "data.billedUsage.inputTokens": "โทเคนอินพุตที่ไม่ได้อ่านจากแคชและไม่ได้เขียนลงแคช",
    "data.billedUsage.outputTokens": "โทเคนเอาต์พุต",
    "data.billedUsage.cacheReadTokens": "โทเคนอินพุตที่อ่านจากแคช",
    "data.billedUsage.cacheWriteTokens": "โทเคนอินพุตที่เขียนลงแคช 5 นาที",
    "data.billedUsage.cacheWrite1hTokens": "โทเคนอินพุตที่เขียนลงแคช 1 ชั่วโมง",
    "data.billedUsage.fast": "ทำงานในโหมดเร็ว คิดค่าบริการในอัตราที่สูงกว่า",
    "data.billedUsage.local": "ทำงานบนโมเดลในเครื่อง ซึ่งไม่มีค่าใช้จ่าย",
  },

  recordDocs: {
    claude: CLAUDE_RECORD_DOCS,
    cowork: CLAUDE_RECORD_DOCS,
    codex: {
      timestamp: "เวลาที่เขียนบรรทัด ISO 8601",
      ordinal: "ตำแหน่งของบรรทัดใน rollout",
      type: "ชนิดบรรทัด: session_meta, event_msg, response_item, turn_context, …",
      payload: "เนื้อหาของบรรทัด type ของมันเองบอกว่าเป็นอะไร",
      "payload.type": "ชนิด payload: user_message, agent_message, function_call, token_count, …",
      "payload.id": "id ของเซสชัน (session_meta) หรือของรายการ",
      "payload.cli_version": "เวอร์ชัน Codex CLI มีเฉพาะใน session_meta",
      "payload.originator": "แอปที่รัน Codex",
      "payload.cwd": "ไดเรกทอรีทำงาน",
      "payload.role": "ผู้ส่งข้อความ: user, assistant, developer, system",
      "payload.content": "ส่วนเนื้อหาของข้อความ",
      "payload.content[].type": "ชนิดของส่วน: input_text, output_text, …",
      "payload.content[].text": "ข้อความของส่วน",
      "payload.message": "ข้อความของ event_msg",
      "payload.call_id": "id ที่เชื่อมการเรียกเครื่องมือกับเอาต์พุต",
      "payload.name": "เครื่องมือที่ถูกเรียก",
      "payload.arguments": "อาร์กิวเมนต์ของเครื่องมือ เป็นสตริง JSON",
      "payload.input": "อินพุตของการเรียกเครื่องมือแบบกำหนดเอง",
      "payload.output": "สิ่งที่เครื่องมือส่งคืน",
      "payload.status": "สถานะของการเรียก",
      "payload.turn_id": "เทิร์นที่บรรทัดนี้สังกัด",
      "payload.info": "การใช้โทเคน: ยอดสะสมและของคำขอล่าสุด",
    },
    copilot: {
      type: "ชนิดอีเวนต์ อยู่ในรูป category.subCategory แล้ว",
      data: "ข้อมูลอีเวนต์",
      id: "id ของอีเวนต์",
      timestamp: "เวลาที่เกิดขึ้น ISO 8601",
      parentId: "อีเวนต์ต้นทางของอีเวนต์นี้",
      "data.version": "เวอร์ชันของรูปแบบ events.jsonl",
      "data.copilotVersion": "เวอร์ชัน Copilot CLI",
      "data.producer": "สิ่งที่เขียนไฟล์",
      "data.toolCallId": "id ที่เชื่อมการเรียกกับผลลัพธ์",
      "data.toolName": "เครื่องมือที่ถูกเรียก",
      "data.arguments": "อาร์กิวเมนต์ของเครื่องมือ",
      "data.result": "สิ่งที่เครื่องมือส่งคืน: content และ detailedContent หากเครื่องมือเพิ่มมา",
      "data.error": "เหตุที่การเรียกที่ล้มเหลวล้มเหลว",
    },
  },

  events: {
    "session.start": {
      summary: "การเริ่มต้นเซสชัน บันทึกสภาพแวดล้อมการทำงานและโมเดลที่เลือกเมื่อเซสชันเริ่ม",
      sources: {
        ...claudeSources([
          {
            record: "ไม่มีเรคคอร์ด: Claude Code ไม่เขียนเรคคอร์ดเริ่มต้น",
            note: "แอปสร้างขึ้นจาก cwd, gitBranch, version และ entrypoint ของเรคคอร์ดในทรานสคริปต์ เพื่อให้ไทม์ไลน์ของทุกเอเจนต์เปิดด้วยส่วนหัวแบบเดียวกัน",
          },
        ]),
        codex: [{ record: "บรรทัด session_meta แรก", note: "บรรทัด session_meta ถัดมาเป็นเธรดของซับเอเจนต์และกลายเป็น subagent.session_start" }],
        copilot: [{ record: "session.start อ่านตามที่เขียน" }],
      },
    },
    "session.resume": { summary: "เซสชันกลับมาทำงานต่อจากสถานะก่อนหน้า บ่งบอกการโหลดบริบทใหม่และการทำงานต่อ" },
    "session.shutdown": {
      summary: "สรุปเมื่อจบเซสชัน มักรวมการใช้งาน ยอดรวมโทเคน คำขอพรีเมียม และเวลา API",
      sources: {
        copilot: [
          {
            record: "session.shutdown",
            note: "แอปได้ sessionTotals และ usageSummary จากเรคคอร์ดนี้ ยอดรวมเป็นแบบสะสม จึงคิดราคาเฉพาะ shutdown ล่าสุด และเซสชันที่ทำต่อจะไม่ถูกนับสองครั้ง",
          },
        ],
      },
    },
    "session.auto_mode_resolved": { summary: "ผลการเลือกโมเดลในโหมดอัตโนมัติ แสดงลักษณะงานที่คาดไว้และการตั้งค่าโมเดลที่เลือก" },
    "session.binary_asset": { summary: "ข้อมูลไบนารีที่บันทึกในเซสชัน มักเป็นภาพหน้าจอ อาจใช้บริบทและพื้นที่จัดเก็บมาก" },
    "session.usage_checkpoint": {
      summary: "การนับการใช้งานระหว่างทางขณะที่เซสชันยังทำงาน",
      sources: {
        ...claudeSources([{ record: "เรคคอร์ด cost-state", note: "totalCostUSD และ totalAPIDuration คัดลอกตามที่รายงาน" }]),
        codex: [
          {
            record: "บรรทัด event_msg ชนิด token_count",
            note: "Codex รายงานยอดสะสม แอปจึงคิดเฉพาะส่วนที่เพิ่มขึ้นจากจุดตรวจสอบก่อนหน้า และย้ายโทเคนจากแคชออกจาก input_tokens เพื่อให้แต่ละโทเคนคิดราคาครั้งเดียว",
          },
        ],
        copilot: [{ record: "session.usage_checkpoint", note: "นับเฉพาะพรีเมียม/AIU ไม่มียอดรวมโทเคน premiumRequests คัดลอกจาก totalPremiumRequests" }],
      },
    },
    "session.model_change": {
      summary: "การตั้งค่าโมเดลเปลี่ยนระหว่างเซสชัน (โมเดล ระดับการให้เหตุผล หรือระดับบริบท)",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด thread_settings_applied" }] },
    },
    "session.compaction_start": {
      summary: "เริ่มบีบอัดบริบท บทสนทนาจะถูกสรุปเพื่อลดโทเคนที่ส่งในทุกคำขอ",
      sources: claudeSources([{ record: "เรคคอร์ด system ที่มี subtype compact_boundary", note: "trigger และ preTokens มาจาก compactMetadata" }]),
    },
    "session.compaction_complete": { summary: "การบีบอัดเสร็จสิ้น พร้อมเมทาดาทาความสำเร็จหรือล้มเหลวและ id คำขอ" },
    "session.error": {
      summary: "ข้อผิดพลาดของ API หรือการรับส่งข้อมูล การลองใหม่แต่ละครั้งจะส่งบริบทของคำขอทั้งหมดอีกครั้ง",
      sources: {
        ...claudeSources([{ record: "เรคคอร์ด system ที่มี subtype api_error" }]),
        gemini: [{ record: "ข้อความชนิด error" }],
      },
    },
    "session.turn_aborted": {
      summary: "เทิร์นถูกขัดจังหวะก่อนเสร็จ",
      changes: ["แต่ละเอเจนต์ทำเครื่องหมายการขัดจังหวะต่างกัน แต่ทั้งหมดกลายเป็นชนิดเดียวนี้"],
      sources: {
        ...claudeSources([
          {
            record: "เรคคอร์ด user ที่ข้อความขึ้นต้นด้วย “[Request interrupted by user”",
            note: "Claude Code บันทึกการขัดจังหวะเหมือนผู้ใช้พิมพ์เอง แอปจึงไม่แสดงเป็นพรอมต์",
          },
        ]),
        codex: [{ record: "บรรทัด event_msg ชนิด turn_aborted" }],
        copilot: [{ record: "อีเวนต์ abort", note: "เปลี่ยนชื่อ ข้อมูลคงไว้ตามที่เขียน" }],
      },
    },
    "session.mode_change": {
      summary: "โหมดการโต้ตอบหรือโหมดสิทธิ์เปลี่ยนระหว่างเซสชัน",
      sources: claudeSources([{ record: "เรคคอร์ด mode หรือ permission-mode" }]),
    },
    "session.turn_context": {
      summary: "การตั้งค่าการทำงานต่อเทิร์น: โมเดล ระดับการให้เหตุผล แซนด์บ็อกซ์ และนโยบายการอนุมัติ",
      sources: { codex: [{ record: "บรรทัด turn_context" }] },
    },
    "session.world_state": {
      summary: "สแนปช็อตของเวิร์กสเปซที่สภาพแวดล้อมส่งให้โมเดล",
      sources: { codex: [{ record: "บรรทัด world_state" }] },
    },
    "session.rollback": {
      summary: "บทสนทนาถูกย้อนกลับไปจำนวนหนึ่งเทิร์น",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด thread_rolled_back" }] },
    },
    "session.plan_changed": { summary: "เอเจนต์สร้างหรืออัปเดตแผนการทำงาน" },
    "session.info": {
      summary: "การแจ้งเตือนที่เอเจนต์แสดง: ข้อมูลหรือคำเตือน",
      sources: { gemini: [{ record: "ข้อความชนิด info หรือ warning" }] },
    },

    "user.message": {
      summary: "สิ่งที่ผู้ใช้พิมพ์ ซึ่งขับเคลื่อนเทิร์นถัดไปของผู้ช่วย",
      sources: {
        ...claudeSources([
          {
            record: "เรคคอร์ด user: message.content ที่เป็นสตริง หรือแต่ละบล็อก text ในนั้น",
            note: "เรคคอร์ดชนิดเดียวกันนี้ยังส่งผลลัพธ์เครื่องมือด้วย ซึ่งจะกลายเป็น tool.execution_complete",
          },
        ]),
        codex: [
          { record: "บรรทัด event_msg ชนิด user_message" },
          {
            record: "ข้อความ response_item ที่มี role user เฉพาะใน rollout รุ่นเก่า",
            note: "rollout รุ่นใหม่เก็บบทสนทนาสองชุด คือ event_msg (สิ่งที่ผู้ใช้เห็น) และ response_item (สิ่งที่โมเดลเห็น) แอปใช้ event_msg เพื่อไม่ให้เทิร์นซ้ำ ส่วนสำเนา response_item กลายเป็น system.message",
          },
        ],
        copilot: [{ record: "user.message อ่านตามที่เขียน" }],
        gemini: [{ record: "ข้อความชนิด user" }],
      },
    },
    "assistant.message": {
      summary: "ข้อความที่โมเดลตอบกลับ พร้อมชื่อโมเดลและการใช้โทเคน",
      fields: {
        phase: "Codex: ส่วนของเทิร์นที่ข้อความนี้สังกัด",
      },
      sources: {
        ...claudeSources([
          {
            record: "เรคคอร์ด assistant ที่มีบล็อก text ใน message.content",
            note: `${CLAUDE_ASSISTANT_NOTE} คำตอบที่ไม่มีข้อความ การให้เหตุผล หรือการเรียกเครื่องมือ ก็ยังกลายเป็นข้อความว่างเพื่อให้นับการใช้งาน`,
          },
        ]),
        codex: [
          { record: "บรรทัด event_msg ชนิด agent_message" },
          { record: "ข้อความ response_item ที่มี role assistant เฉพาะเมื่อไม่มีสำเนา event_msg" },
        ],
        copilot: [{ record: "assistant.message อ่านตามที่เขียน" }],
        gemini: [{ record: "เนื้อหาของข้อความชนิด gemini" }],
      },
    },
    "assistant.thinking": {
      summary: "การให้เหตุผลที่โมเดลสร้างก่อนตอบ คิดค่าบริการเป็นโทเคนเอาต์พุต",
      sources: {
        ...claudeSources([{ record: "เรคคอร์ด assistant ที่มีบล็อก thinking", note: CLAUDE_ASSISTANT_NOTE }]),
        codex: [
          { record: "บรรทัด event_msg ชนิด agent_reasoning" },
          { record: "response_item ชนิด reasoning โดยใช้ summary", note: "การให้เหตุผลที่เข้ารหัสอย่างเดียวไม่มีส่วนที่อ่านได้และจะถูกข้าม" },
        ],
        gemini: [{ record: "แต่ละรายการของ thoughts ในข้อความชนิด gemini" }],
      },
    },
    "assistant.turn_start": {
      summary: "จุดเริ่มต้นของเทิร์นผู้ช่วยหนึ่งเทิร์น",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด task_started" }] },
    },
    "assistant.turn_end": {
      summary: "จุดสิ้นสุดของเทิร์นผู้ช่วยหลังการให้เหตุผล การเรียกเครื่องมือ และเอาต์พุต",
      sources: {
        ...claudeSources([{ record: "เรคคอร์ด system ที่มี subtype turn_duration" }]),
        codex: [{ record: "บรรทัด event_msg ชนิด task_complete" }],
      },
    },

    "tool.execution_start": {
      summary: "โมเดลเรียกเครื่องมือในตัว พร้อมชื่อและอาร์กิวเมนต์",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: CLAUDE_TOOL_USE, note: `เครื่องมือที่ชื่อ mcp__… จะกลายเป็น external_tool.requested แทน ${CLAUDE_ASSISTANT_NOTE}` }]),
        codex: [
          {
            record: "response_item ชนิด function_call, custom_tool_call หรือ local_shell_call",
            note: "อาร์กิวเมนต์ที่เขียนเป็นสตริง JSON จะถูกแปลงเป็นออบเจกต์",
          },
        ],
        copilot: [{ record: "tool.execution_start อ่านตามที่เขียน" }],
        gemini: [{ record: "แต่ละรายการของ toolCalls ในข้อความชนิด gemini" }],
      },
    },
    "tool.execution_complete": {
      summary: "การเรียกเครื่องมือในตัวเสร็จสิ้น พร้อมสถานะและผลลัพธ์",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([
          {
            record: CLAUDE_TOOL_RESULT,
            note: "ชื่อเครื่องมือมาจากการเรียกที่จับคู่กัน ถ้าบล็อกไม่มีเนื้อหาจะใช้ toolUseResult ของเรคคอร์ด success เป็น false เมื่อตั้งค่า is_error",
          },
        ]),
        codex: [
          {
            record: "response_item ชนิด function_call_output, custom_tool_call_output หรือ local_shell_call_output",
            note: "Codex ไม่บันทึกแฟล็กความสำเร็จ แอปจะทำเครื่องหมายว่าล้มเหลวเมื่อเอาต์พุตรายงานรหัสออกที่ไม่ใช่ศูนย์",
          },
        ],
        copilot: [
          {
            record: "tool.execution_complete",
            note: "result.content กลายเป็นข้อความผลลัพธ์ การเรียกที่ล้มเหลวจะใช้ error.message แทน และ detailedContent (มักเป็น diff) กลายเป็น result.detail",
          },
        ],
      },
    },
    "external_tool.requested": {
      summary: "โมเดลเรียกเครื่องมือที่ให้บริการผ่านบริดจ์ภายนอก มักเป็นเซิร์ฟเวอร์ MCP",
      changes: [ARGUMENT_CHARS],
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_USE} สำหรับเครื่องมือที่ชื่อ mcp__…` }]),
        copilot: [{ record: "external_tool.requested อ่านตามที่เขียน" }],
      },
    },
    "external_tool.completed": {
      summary: "การเรียกเครื่องมือภายนอกเสร็จสิ้น พร้อมสถานะและผลลัพธ์",
      changes: TOOL_RESULT_CHANGES,
      sources: {
        ...claudeSources([{ record: `${CLAUDE_TOOL_RESULT} สำหรับเครื่องมือที่ชื่อ mcp__…` }]),
        codex: [{ record: "บรรทัด event_msg ชนิด mcp_tool_call_end" }],
        copilot: [{ record: "external_tool.completed", note: "มีรูปแบบเดียวกับ tool.execution_complete" }],
      },
    },

    "permission.requested": { summary: "สภาพแวดล้อมขอสิทธิ์จากผู้ใช้สำหรับการกระทำ (ไฟล์ ระบบ หรือเครือข่าย)" },
    "permission.completed": { summary: "คำขอสิทธิ์ได้รับการตัดสินแล้ว: อนุมัติหรือปฏิเสธ" },
    "hook.start": { summary: "ฮุกวงจรชีวิตเริ่มทำงาน เช่น เมื่อส่งพรอมต์" },
    "hook.end": {
      summary: "ฮุกวงจรชีวิตจบลง สำเร็จหรือล้มเหลว",
      sources: claudeSources([{ record: "เรคคอร์ด system ที่มี subtype stop_hook_summary", note: "success เป็น false เมื่อเรคคอร์ดระบุข้อผิดพลาดของฮุก" }]),
    },

    "system.message": {
      summary: "คำสั่งที่สภาพแวดล้อมวางไว้หน้าโมเดล: พรอมต์ระบบ ไฟล์คำสั่ง หรือบริบทที่แทรกเข้ามา",
      detail: "สิ่งเหล่านี้ส่งไปกับทุกคำขอ ขนาดจึงสะสมตลอดเซสชัน สวิตช์บนแถบเครื่องมือจะซ่อนไว้พร้อมกับบริบทแทรกอื่น ๆ",
      sources: {
        ...claudeSources([
          { record: "เรคคอร์ด attachment ชนิด prompt_snapshot", note: "Claude Code บันทึกพรอมต์ระบบใหม่ทุกครั้งที่ส่วนใดเปลี่ยน แอปจะแสดงเฉพาะเมื่อข้อความพรอมต์เปลี่ยนจริง" },
          { record: "เรคคอร์ด attachment ชนิด instructions (ไฟล์ CLAUDE.md และ AGENTS.md)" },
          { record: "เรคคอร์ด system ที่มี subtype อื่น ๆ" },
        ]),
        codex: [
          { record: "base_instructions ในบรรทัด session_meta" },
          { record: "ข้อความ response_item ที่มี role developer หรือ system" },
          { record: "ข้อความ response_item ที่มี role user ซึ่งสภาพแวดล้อมแทรกเข้ามา แสดงเป็น role user_context" },
        ],
      },
    },
    "context.attachment": {
      summary: "บริบทที่สภาพแวดล้อมเพิ่มเอง: สแนปช็อตไฟล์ การเตือน รายการเครื่องมือหรือสกิล รูปภาพ",
      changes: ["ไฟล์แนบทุกชนิดจะถูกแปลงเป็น {label, subject, items, content} เพื่อให้อ่านเป็นเนื้อหาแทน JSON ดิบ"],
      sources: {
        ...claudeSources([
          { record: "เรคคอร์ด attachment (date, file, skill_listing, deferred_tools_delta, …)" },
          { record: "รายการเครื่องมือของไฟล์แนบ prompt_snapshot แสดงเป็นนิยามเครื่องมือเมื่อเปลี่ยน" },
          { record: "บล็อก image ในเรคคอร์ด user", note: "เก็บไว้เพียงว่ามีการส่งรูปภาพ ส่วนพิกเซลยังอยู่บนดิสก์" },
        ]),
        codex: [{ record: "dynamic_tools ในบรรทัด session_meta แสดงเป็นนิยามเครื่องมือ" }],
      },
    },
    "system.notification": { summary: "การแจ้งเตือนจากสภาพแวดล้อมที่เพิ่มในบทสนทนา เช่น เชลล์เบื้องหลังทำงานเสร็จ" },

    "file.patch_applied": {
      summary: "แพตช์ที่เอเจนต์ใช้กับเวิร์กสเปซ พร้อมไฟล์ที่ได้รับผล",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด patch_apply_end" }] },
    },
    "web.search": {
      summary: "การค้นหาเว็บที่โมเดลทำ ผลลัพธ์จะถูกเพิ่มในบริบท",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด web_search_end" }] },
    },

    "subagent.deselected": { summary: "ล้างโฟกัสซับเอเจนต์แล้ว และการควบคุมกลับไปที่เอเจนต์หลัก" },
    "subagent.activity": {
      summary: "กิจกรรมที่ซับเอเจนต์ซึ่งทำงานภายใต้เอเจนต์หลักรายงาน",
      sources: { codex: [{ record: "บรรทัด event_msg ชนิด sub_agent_activity" }] },
    },
    "subagent.message": {
      summary: "ข้อความที่ส่งระหว่างเอเจนต์",
      sources: { codex: [{ record: "บรรทัด inter_agent_communication_metadata" }] },
    },
    "subagent.session_start": {
      summary: "เธรดซับเอเจนต์เริ่มขึ้นภายในเซสชันนี้",
      sources: { codex: [{ record: "บรรทัด session_meta ที่อยู่หลังบรรทัดแรก" }] },
    },
  },

  unknownSummary: "อีเวนต์ในหมวด “{category}” (“{name}”) ที่ยังไม่มีคำอธิบาย",
  unknownCategory: "ไม่ทราบ",
  unknownName: "ทั่วไป",
  unknownDetail:
    "เอเจนต์เขียนเรคคอร์ดที่แอปยังไม่มีการจับคู่ เรคคอร์ดถูกเก็บไว้พร้อมข้อมูลตามที่เขียน จึงไม่มีอะไรสูญหาย และแสดงผ่านการ์ดทั่วไป",

  callAndResult: "การเรียกและผลลัพธ์ แสดงเป็นแถวเดียว",
  recordsInOrder: "เรคคอร์ดที่แถวนี้อ่านมา ตามลำดับทรานสคริปต์",
  recordTitle: "เรคคอร์ด {agent}",
  eventFormat: "รูปแบบอีเวนต์",
};
