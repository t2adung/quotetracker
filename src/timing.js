// Cấu hình thời lượng slide dùng CHUNG giữa Remotion (dựng video, xem src/remotion/VideoSequence.jsx)
// và Gemini (ghép kịch bản, xem src/script-builder.js) — đặt 1 chỗ duy nhất để 2 bên không bị
// lệch nếu sau này đổi thời lượng slide.
const FPS = 30;
// Quote/đoạn đầu tiên (title/hook) được giữ trên khung lâu hơn 1 chút vì chữ to hơn, đọc lâu hơn.
const TITLE_DURATION_IN_FRAMES = 5 * FPS;
const QUOTE_DURATION_IN_FRAMES = 4 * FPS;

module.exports = {
  FPS,
  TITLE_DURATION_IN_FRAMES,
  QUOTE_DURATION_IN_FRAMES,
  TITLE_DURATION_SECONDS: TITLE_DURATION_IN_FRAMES / FPS,
  QUOTE_DURATION_SECONDS: QUOTE_DURATION_IN_FRAMES / FPS,
};
