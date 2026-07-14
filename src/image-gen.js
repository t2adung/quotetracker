const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

// Model sinh ảnh — Gemini 3.1 Flash Image (nickname "Nano Banana 2")
const IMAGE_MODEL = 'gemini-3.1-flash-image';

const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'images');

const STYLE_PROMPT_SUFFIX = `
Photo, bright soft pastel color tones, wholesome and uplifting mood.
Only a small, partial glimpse of a person is visible — for example just a
shoulder, hand, or the edge of a silhouette entering the frame from one side
(no full body, no visible face), set in a beautiful natural outdoor setting
(mountain, forest, or open field). The person should occupy a small portion
of the frame, off to one side.
Composition: leave a large, clean, visually simple open space (sky, field,
blurred background, or negative space) in the upper or central area of the
frame, free of clutter or the subject, reserved for adding a text quote
overlay later without covering important visual details.
Style: cinematic photography, soft pastel colors, bright and airy, peaceful,
minimal and clean composition.
`;

function buildImagePrompt(quoteText) {
  return `Scene should visually reflect the feeling of: "${quoteText}"\n${STYLE_PROMPT_SUFFIX}`;
}

function filenameForStt(stt) {
  const padded = String(stt).padStart(3, '0');
  return `quote_${padded}.png`;
}

async function generateBackgroundImage(stt, quoteText) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: buildImagePrompt(quoteText),
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '9:16' },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart) {
      throw new Error('Gemini không trả về dữ liệu ảnh');
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const filename = filenameForStt(stt);
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(imagePart.inlineData.data, 'base64'));

    return filename;
  } catch (err) {
    throw new Error(`Lỗi khi sinh ảnh nền cho quote STT ${stt}: ${err.message}`);
  }
}

module.exports = { generateBackgroundImage, OUTPUT_DIR };
