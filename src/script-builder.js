const { GoogleGenAI } = require('@google/genai');
const config = require('./config');
const { getScriptPrompt } = require('./script-prompts');
const {
  REFERENCE_TITLE_DURATION_SECONDS,
  REFERENCE_QUOTE_DURATION_SECONDS,
  READING_WORDS_PER_SECOND,
} = require('./timing');

// Shares the same model alias as gemini.js — see there for why
const MODEL = 'gemini-flash-latest';

function buildPrompt(videoTitle, quotesArray, topic) {
  const { audienceDescription } = getScriptPrompt(topic);
  const quoteList = quotesArray.map((q) => `- id ${q.stt}: "${q.quote}"`).join('\n');
  // Estimate a max length for self-written connector sentences, based on the average
  // skim-reading speed (shared with src/timing.js) and a reference slide duration — so the
  // connector sentences don't end up too dense to read comfortably.
  const hookMaxWords = Math.round(REFERENCE_TITLE_DURATION_SECONDS * READING_WORDS_PER_SECOND);
  const otherMaxWords = Math.round(REFERENCE_QUOTE_DURATION_SECONDS * READING_WORDS_PER_SECOND);

  return `Bạn là biên tập viên kịch bản video ngắn (TikTok/Shorts), ${audienceDescription}.

Tiêu đề video nguồn: "${videoTitle}"

Danh sách quote đã trích từ video này (mỗi quote có 1 id riêng, PHẢI dùng đúng id khi tham
chiếu, KHÔNG tự bịa id mới):
${quoteList}

Nhiệm vụ: chọn ra 3-4 quote PHÙ HỢP NHẤT trong danh sách trên, ghép thành 1 kịch bản video ngắn
liền mạch theo đúng cấu trúc 4 phần, theo thứ tự:
1. hook — câu mở đầu gây chú ý, khiến người xem dừng lại
2. van_de — nêu vấn đề/băn khoăn liên quan
3. insight — góc nhìn/bài học rút ra
4. chot — câu chốt, đọng lại trong đầu người xem sau khi xem xong

Yêu cầu bắt buộc:
- Với đoạn nào lấy từ 1 quote đã chọn: PHẢI giữ NGUYÊN VĂN quote đó, không diễn giải lại, không
  đổi từ ngữ, không rút gọn
- Được viết thêm các câu nối NGẮN (do bạn tự viết) giữa các quote để mạch chuyển tự nhiên, không
  lan man, không thêm thông tin không có căn cứ
- Toàn bộ kịch bản (kể cả câu nối tự viết) phải giữ NHẤT QUÁN 1 giọng điệu (tone) duy nhất từ
  đầu đến cuối
- Nếu không tìm đủ quote phù hợp để ghép thành 1 mạch logic rõ ràng (hook - vấn đề - insight -
  chốt), được phép dùng ÍT HƠN quote, hoặc trả về kết quả rỗng như hướng dẫn bên dưới — TUYỆT ĐỐI
  không ghép gượng ép cho đủ 4 phần

QUAN TRỌNG về thời lượng: khi dựng thành video, mỗi đoạn (segment) sẽ được hiển thị đủ lâu để đọc
lướt kịp theo đúng độ dài chữ thật sự (đoạn dài hiện lâu hơn, đoạn ngắn hiện nhanh hơn) — đoạn
"hook" thường khoảng ${REFERENCE_TITLE_DURATION_SECONDS} giây, các đoạn "van_de"/"insight"/"chot"
thường khoảng ${REFERENCE_QUOTE_DURATION_SECONDS} giây mỗi đoạn. Với CÂU NỐI DO BẠN TỰ VIẾT (không
áp dụng cho phần quote nguyên văn, vì quote giữ nguyên độ dài gốc): phải đủ ngắn để đọc thoải mái
trong khoảng thời gian đó — tối đa khoảng ${hookMaxWords} từ cho đoạn hook, ${otherMaxWords} từ
cho các đoạn còn lại. Không viết câu nối dài dòng làm chậm nhịp so với cách dựng video bình thường.

CHỈ trả về một object JSON hợp lệ theo đúng định dạng sau, không thêm bất kỳ chữ giải thích,
markdown hay text nào khác:

{
  "tone": "mô tả ngắn gọn giọng điệu đã chọn cho toàn bộ kịch bản (ví dụ: gần gũi, sâu lắng...)",
  "segments": [
    { "type": "hook", "text": "...", "quote_id": "id quote nếu đoạn này lấy nguyên văn từ 1 quote, để null nếu là câu nối tự viết" },
    { "type": "van_de", "text": "...", "quote_id": null },
    { "type": "insight", "text": "...", "quote_id": "..." },
    { "type": "chot", "text": "...", "quote_id": "..." }
  ],
  "full_script": "toàn bộ kịch bản nối liền thành 1 đoạn văn mạch lạc, đúng thứ tự các segments ở trên"
}

Nếu không đủ quote phù hợp để ghép thành kịch bản mạch lạc, trả về đúng:
{ "tone": null, "segments": [], "full_script": "" }`;
}

async function callGemini(prompt) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  return response.text;
}

function parseScriptResponse(text) {
  const match = (text || '').match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed.segments)) {
    throw new Error('Trường "segments" trong kết quả trả về không phải là 1 mảng');
  }

  return {
    tone: parsed.tone || null,
    segments: parsed.segments.map((s) => ({
      type: s.type || '',
      text: s.text || '',
      quoteId: s.quote_id ?? s.quoteId ?? null,
    })),
    fullScript: parsed.full_script || parsed.fullScript || '',
  };
}

// Takes a video title + a list of quotes from THE SAME source video (shape { stt, quote }), calls
// Gemini to pick 3-4 suitable quotes and merge them into 1 coherent script. Returns null if
// Gemini decides there aren't enough suitable quotes to merge (no forced/awkward merging).
// topic: selects the style/audience in src/script-prompts/ (default "quote") — same mechanism as
// the existing --topic (quote extraction) and --image-topic (background image generation).
async function buildScriptFromQuotes(videoTitle, quotesArray, topic = 'quote') {
  if (!Array.isArray(quotesArray) || quotesArray.length === 0) {
    return null;
  }

  const prompt = buildPrompt(videoTitle, quotesArray, topic);

  let rawText;
  try {
    rawText = await callGemini(prompt);
  } catch (err) {
    throw new Error(
      `Lỗi khi gọi Gemini API để ghép kịch bản cho video "${videoTitle}": ${err.message}`
    );
  }

  let script;
  try {
    script = parseScriptResponse(rawText || '');
  } catch (err) {
    throw new Error(
      `Gemini trả về dữ liệu không phải JSON hợp lệ khi ghép kịch bản cho video "${videoTitle}": ${err.message}`
    );
  }

  if (!script.fullScript || script.segments.length === 0) {
    return null;
  }

  return script;
}

function buildConsistencyPrompt(scriptJson) {
  const segmentsText = scriptJson.segments
    .map((s, i) => `${i + 1}. [${s.type}] ${s.text}`)
    .join('\n');

  return `Bạn là biên tập viên kiểm duyệt kịch bản video ngắn. Dưới đây là 1 kịch bản đã được
ghép từ nhiều quote của cùng 1 video nguồn, giọng điệu (tone) dự kiến: "${scriptJson.tone || ''}"

Các đoạn theo đúng thứ tự:
${segmentsText}

Toàn văn kịch bản:
"${scriptJson.fullScript}"

Hãy kiểm tra kỹ 3 điều sau:
1. Có đoạn nào MÂU THUẪN Ý với đoạn khác trong cùng kịch bản không (ví dụ đoạn trước nói A, đoạn
   sau lại phủ định hoặc nói ngược lại A)
2. Có đoạn nào LẶP Ý (nói lại gần như nguyên ý của 1 đoạn trước đó) không
3. Giọng điệu (tone) có NHẤT QUÁN xuyên suốt từ đầu đến cuối không, hay bị lệch giữa các đoạn
   (ví dụ đoạn thì trang trọng, đoạn thì suồng sã)

CHỈ trả về 1 object JSON theo đúng định dạng sau, không thêm bất kỳ text/markdown nào khác:
{ "is_consistent": true hoặc false, "reason": "giải thích ngắn gọn lý do — bắt buộc nêu rõ nếu is_consistent là false; có thể để chuỗi rỗng nếu is_consistent là true" }`;
}

function parseConsistencyResponse(text) {
  const match = (text || '').match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText);

  return {
    isConsistent: parsed.is_consistent === true,
    reason: parsed.reason || '',
  };
}

// Makes 1 more Gemini call to self-critique the script just built by buildScriptFromQuotes, for
// contradictions, repeated ideas, or tone drift. Returns { isConsistent, reason }.
async function validateScriptConsistency(scriptJson) {
  const prompt = buildConsistencyPrompt(scriptJson);

  let rawText;
  try {
    rawText = await callGemini(prompt);
  } catch (err) {
    throw new Error(`Lỗi khi gọi Gemini API để kiểm tra tính nhất quán kịch bản: ${err.message}`);
  }

  try {
    return parseConsistencyResponse(rawText || '');
  } catch (err) {
    // If the check result can't be parsed, treat it as NOT consistent (safety first) — better to
    // skip a script that might actually be fine than to accidentally write an unvetted script to
    // the Sheet
    return {
      isConsistent: false,
      reason: `Không đọc được kết quả kiểm tra từ Gemini (lỗi parse JSON: ${err.message})`,
    };
  }
}

module.exports = { buildScriptFromQuotes, validateScriptConsistency };
