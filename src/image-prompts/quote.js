// Style ảnh cho chủ đề "quote" — dùng cho video trích quote hiện tại.
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

module.exports = { styleSuffix: STYLE_PROMPT_SUFFIX, sceneAnchors: SCENE_ANCHORS };
