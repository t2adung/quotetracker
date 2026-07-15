const { GoogleGenAI } = require('@google/genai');
const config = require('./config');
const { getPrompt, parseResponse } = require('./prompts');

// Dùng alias "-latest" thay vì ghim 1 phiên bản cụ thể, để không phải sửa
// code mỗi khi Google ngừng hỗ trợ 1 model đời cũ
const MODEL = 'gemini-flash-latest';

const REQUEST_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 2; // gọi lần đầu + retry 1 lần nếu timeout

function isTimeoutError(err) {
  const message = (err?.message || '').toLowerCase();
  return err?.name === 'AbortError' || message.includes('timeout') || message.includes('timed out');
}

async function callGemini(youtubeUrl, tieuDe, topic) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const prompt = getPrompt(topic, { tieuDe });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { fileUri: youtubeUrl } }, { text: prompt }],
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

async function extractQuotes(youtubeUrl, tieuDe, topic = 'quote') {
  let rawText;
  try {
    rawText = await callGemini(youtubeUrl, tieuDe, topic);
  } catch (err) {
    throw new Error(`Lỗi khi gọi Gemini API cho video "${tieuDe}": ${err.message}`);
  }

  try {
    return parseResponse(topic, rawText || '');
  } catch (err) {
    throw new Error(
      `Gemini trả về dữ liệu không phải JSON hợp lệ cho video "${tieuDe}": ${err.message}`
    );
  }
}

module.exports = { extractQuotes };
