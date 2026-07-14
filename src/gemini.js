const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

// Dùng alias "-latest" thay vì ghim 1 phiên bản cụ thể, để không phải sửa
// code mỗi khi Google ngừng hỗ trợ 1 model đời cũ
const MODEL = 'gemini-flash-latest';

const REQUEST_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 2; // gọi lần đầu + retry 1 lần nếu timeout

function isTimeoutError(err) {
  const message = (err?.message || '').toLowerCase();
  return err?.name === 'AbortError' || message.includes('timeout') || message.includes('timed out');
}

function buildPrompt(tieuDe) {
  return `Bạn là trợ lý trích quote hay từ video YouTube để dựng video ngắn (TikTok/Shorts).

Tiêu đề video: "${tieuDe}"

Hãy xem video và trích ra 10-15 câu quote hay nhất, đáng chú ý nhất, phù hợp để làm hook mở đầu
cho video ngắn. Với mỗi quote, trả về:
- quote: nguyên văn câu nói (tiếng Việt, giữ đúng lời)
- context: bối cảnh/ý nghĩa ngắn gọn của câu nói
- timestamp: thời điểm xuất hiện trong video, định dạng "mm:ss"
- hookScore: điểm hook từ 1 đến 5 (5 = hấp dẫn nhất để mở đầu video ngắn)

CHỈ trả về một mảng JSON hợp lệ theo đúng định dạng sau, không thêm bất kỳ chữ giải thích,
markdown hay text nào khác:

[
  { "quote": "...", "context": "...", "timestamp": "mm:ss", "hookScore": 1 }
]`;
}

function parseQuotesResponse(text) {
  const match = text.match(/\[[\s\S]*\]/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) {
    throw new Error('Kết quả trả về không phải là một mảng JSON');
  }

  return parsed.map((item) => ({
    quote: item.quote || '',
    context: item.context || '',
    timestamp: item.timestamp || '',
    hookScore: item.hookScore ?? item.hook_score ?? null,
  }));
}

async function callGemini(youtubeUrl, tieuDe) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { fileUri: youtubeUrl } }, { text: buildPrompt(tieuDe) }],
          },
        ],
        config: { httpOptions: { timeout: REQUEST_TIMEOUT_MS } },
      });
      return response.text;
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (!isLastAttempt && isTimeoutError(err)) {
        console.warn(`  Gemini API timeout cho video "${tieuDe}", thử lại lần ${attempt + 1}...`);
        continue;
      }
      throw err;
    }
  }
}

async function extractQuotes(youtubeUrl, tieuDe) {
  let rawText;
  try {
    rawText = await callGemini(youtubeUrl, tieuDe);
  } catch (err) {
    throw new Error(`Lỗi khi gọi Gemini API cho video "${tieuDe}": ${err.message}`);
  }

  try {
    return parseQuotesResponse(rawText || '');
  } catch (err) {
    throw new Error(
      `Gemini trả về dữ liệu không phải JSON hợp lệ cho video "${tieuDe}": ${err.message}`
    );
  }
}

module.exports = { extractQuotes };
