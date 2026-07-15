const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

// Dùng chung alias model với gemini.js — xem lý do ở đó
const MODEL = 'gemini-flash-latest';

function buildPrompt(videoTitle, quotesArray) {
  const quoteList = quotesArray.map((q) => `- id ${q.stt}: "${q.quote}"`).join('\n');

  return `Bạn là biên tập viên kịch bản video ngắn (TikTok/Shorts), nhắm tới khán giả U40.

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

// Nhận tiêu đề video + danh sách quote của CÙNG 1 video nguồn (dạng { stt, quote }), gọi Gemini
// để chọn ra 3-4 quote phù hợp và ghép thành 1 kịch bản liền mạch. Trả về null nếu Gemini xác
// định không đủ quote phù hợp để ghép (không ép ghép gượng gạo).
async function buildScriptFromQuotes(videoTitle, quotesArray) {
  if (!Array.isArray(quotesArray) || quotesArray.length === 0) {
    return null;
  }

  const prompt = buildPrompt(videoTitle, quotesArray);

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

module.exports = { buildScriptFromQuotes };
