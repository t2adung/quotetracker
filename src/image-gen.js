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

// Vài "bối cảnh gốc" để chọn ngẫu nhiên 1 cái dùng chung cho toàn bộ ảnh của 1 video —
// đảm bảo các ảnh trong cùng video có cùng chủ đề/bối cảnh thay vì mỗi ảnh 1 nơi khác nhau.
const SCENE_ANCHORS = [
  'a quiet lake shoreline at soft pastel dawn',
  'a minimalist pastel-toned room with a large window and soft sheer curtains',
  'a golden wheat field under a pale pastel sky',
  'a quiet mountain trail with soft mist and a pastel-colored sky',
  'a peaceful garden path lined with pastel flowers',
  'a calm beach at soft pastel sunrise',
];

function pickSceneAnchor() {
  return SCENE_ANCHORS[Math.floor(Math.random() * SCENE_ANCHORS.length)];
}

function buildImagePrompt({ quoteText, sceneAnchor, sequenceIndex, totalInSequence }) {
  return `Scene setting (must stay identical across the whole sequence): ${sceneAnchor}.

This is frame ${sequenceIndex} of ${totalInSequence} in a single continuous sequence of images
made for the same short video. Keep the exact same subject, outfit, setting, lighting and color
tone as the previous frame(s) — only let the pose or camera position progress slightly from one
frame to the next (as if the camera is slowly moving, or the subject is slowly walking/turning),
so that viewing the frames in order feels like watching a slow, continuous video rather than
unrelated photos.

This frame should visually reflect the feeling of: "${quoteText}"
${STYLE_PROMPT_SUFFIX}`;
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
}) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const prompt = buildImagePrompt({ quoteText, sceneAnchor, sequenceIndex, totalInSequence });

  const parts = [];
  if (previousImageBytes) {
    // Đưa ảnh của quote ngay trước làm ảnh tham chiếu, để model giữ đúng nhân vật/bối cảnh/
    // ánh sáng xuyên suốt, chỉ tiến triển nhẹ giữa các khung hình (cảm giác video chuyển động).
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
