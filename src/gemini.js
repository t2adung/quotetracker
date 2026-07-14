const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

const MODEL = 'gemini-2.5-flash';

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

async function extractQuotes(youtubeUrl, tieuDe) {
  let rawText;
  try {
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ fileData: { fileUri: youtubeUrl } }, { text: buildPrompt(tieuDe) }],
        },
      ],
    });

    rawText = response.text;
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
