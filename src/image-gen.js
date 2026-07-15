const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const config = require('./config');
const { getImageStyle } = require('./image-prompts');

// Image generation model — currently using Gemini 2.5 Flash Image ("Nano Banana"), switch to
// "gemini-3.1-flash-image" (Nano Banana 2) once the trial period ends / billing terms fit.
const IMAGE_MODEL = 'gemini-2.5-flash-image';

const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'images');

const DEFAULT_IMAGE_TOPIC = 'quote';

function pickSceneAnchor(topic = DEFAULT_IMAGE_TOPIC) {
  const { sceneAnchors } = getImageStyle(topic);
  return sceneAnchors[Math.floor(Math.random() * sceneAnchors.length)];
}

function buildImagePrompt({ quoteText, sceneAnchor, sequenceIndex, totalInSequence, topic }) {
  const { styleSuffix } = getImageStyle(topic);
  return `Frame ${sequenceIndex}/${totalInSequence} of 1 continuous sequence, same short video.
Scene (identical every frame): ${sceneAnchor}.
Same subject/outfit/lighting/color tone as previous frame; only pose/camera shifts slightly — continuous motion feel, not unrelated photos.
Mood to reflect: "${quoteText}"
${styleSuffix}`;
}

function filenameForStt(stt) {
  const padded = String(stt).padStart(3, '0');
  return `quote_${padded}.png`;
}

async function generateBackgroundImage({
  stt,
  quoteText,
  sceneAnchor,
  sequenceIndex,
  totalInSequence,
  previousImageBytes,
  topic = DEFAULT_IMAGE_TOPIC,
}) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const prompt = buildImagePrompt({ quoteText, sceneAnchor, sequenceIndex, totalInSequence, topic });

  const parts = [];
  if (previousImageBytes) {
    // Pass the previous quote's image as a reference, so the model keeps the same
    // character/setting/lighting throughout, only progressing slightly between frames (giving a
    // moving-video feel).
    parts.push({ inlineData: { mimeType: 'image/png', data: previousImageBytes } });
  }
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '9:16' },
      },
    });

    const responseParts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find((p) => p.inlineData?.data);

    if (!imagePart) {
      throw new Error('Gemini không trả về dữ liệu ảnh');
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const filename = filenameForStt(stt);
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(imagePart.inlineData.data, 'base64'));

    return { filename, imageBytes: imagePart.inlineData.data };
  } catch (err) {
    throw new Error(`Lỗi khi sinh ảnh nền cho quote STT ${stt}: ${err.message}`);
  }
}

module.exports = { generateBackgroundImage, pickSceneAnchor, OUTPUT_DIR };
