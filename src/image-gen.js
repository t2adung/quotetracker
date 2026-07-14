const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

// Model sinh ảnh — đang tạm dùng Gemini 2.5 Flash Image ("Nano Banana"), đổi sang
// "gemini-3.1-flash-image" (Nano Banana 2) khi hết hạn dùng thử/điều kiện billing phù hợp.
const IMAGE_MODEL = 'gemini-2.5-flash-image';

const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'images');

// Giữ ngắn gọn dạng cụm từ (không viết câu đầy đủ) để giảm token input mỗi lần gọi, vẫn đủ
// các ràng buộc bắt buộc: 1 tấm ảnh liền mạch (không phải ảnh ghép 2 nửa/mảng màu rời rạc),
// người châu Á (ưu tiên Việt Nam) chỉ chiếm khoảng 1/4 khung hình chứ không bị cắt cụt còn 1
// mẩu nhỏ, tông pastel sáng, không chèn chữ vào ảnh.
const STYLE_PROMPT_SUFFIX = `Style: cinematic photo, bright soft pastel tones, minimal, airy, peaceful — 1 single cohesive real photograph filling the whole frame (NOT a collage, NOT split panels, NOT a separate flat solid-color block glued onto part of the frame).
Person (if shown): Asian, ideally Vietnamese, appearance and styling. Whole figure visible, small in the frame — occupying roughly 1/4 of the frame — not cropped by the frame edge, not just a hand/shoulder sliver. Shown from behind, from the side, or at a distance so the face is not clearly recognizable.
Any empty space for a future text overlay must come naturally from the scene itself (open sky, distant blurred background) — never as an artificial separate rectangle.
No text: absolutely no letters, words, numbers, captions, watermark, or typography anywhere in the image.`;

// Vài "bối cảnh gốc" thiên về hành động thực tế đời thường (nấu ăn, vẽ tranh, đi dạo...) để
// chọn ngẫu nhiên 1 cái dùng chung cho toàn bộ ảnh của 1 video — đảm bảo các ảnh trong cùng
// video có cùng chủ đề/bối cảnh/hành động thay vì mỗi ảnh 1 nơi khác nhau.
const SCENE_ANCHORS = [
  'cooking a simple meal in a bright pastel-toned kitchen',
  'painting on a canvas outdoors in a pastel-lit garden',
  'walking along a scenic pastel-colored trail in nature',
  'arranging fresh flowers at a pastel-toned table',
  'brewing tea by a large window with soft pastel light',
  'tending potted plants on a sunny pastel balcony',
];

function pickSceneAnchor() {
  return SCENE_ANCHORS[Math.floor(Math.random() * SCENE_ANCHORS.length)];
}

function buildImagePrompt({ quoteText, sceneAnchor, sequenceIndex, totalInSequence }) {
  return `Frame ${sequenceIndex}/${totalInSequence} of 1 continuous sequence, same short video.
Scene (identical every frame): ${sceneAnchor}.
Same subject/outfit/lighting/color tone as previous frame; only pose/camera shifts slightly — continuous motion feel, not unrelated photos.
Mood to reflect: "${quoteText}"
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
