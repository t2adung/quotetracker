require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await ai.models.list();
  for await (const model of pager) {
    if (model.supportedActions?.includes('generateContent')) {
      console.log(model.name);
    }
  }
}

main().catch((err) => console.error('Lỗi khi lấy danh sách model:', err.message));
