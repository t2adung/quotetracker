// Cấu hình thời lượng slide dùng CHUNG giữa Remotion (dựng video, xem src/remotion/VideoSequence.jsx)
// và Gemini (ghép kịch bản, xem src/script-builder.js) — đặt 1 chỗ duy nhất để 2 bên không bị
// lệch nếu sau này đổi tốc độ đọc.
const FPS = 30;

// Tốc độ đọc lướt trung bình (từ/giây) — dùng để tính thời lượng slide THEO ĐÚNG độ dài quote
// thật sự (xem durationInFramesForText bên dưới): quote dài hiện lâu hơn, quote ngắn hiện nhanh
// hơn, luôn vừa đủ để đọc lướt kịp, không quá chậm cũng không quá nhanh.
const READING_WORDS_PER_SECOND = 3;

// Chặn trên/dưới để tránh slide quá ngắn (chưa kịp đọc, dù quote rất ngắn) hoặc quá dài (video bị
// lê thê, dù quote rất dài).
const MIN_QUOTE_DURATION_SECONDS = 3;
const MAX_QUOTE_DURATION_SECONDS = 8;
// Quote/đoạn đầu tiên (title/hook) hiện lâu hơn 1 chút so với mức tính theo chữ, vì chữ to hơn +
// người xem cần thêm thời gian "bắt nhịp" video ngay từ đầu.
const TITLE_EXTRA_SECONDS = 1;

// Thời lượng THAM CHIẾU (không dùng để render trực tiếp) — chỉ để script-builder.js ước lượng số
// từ tối đa cho câu nối tự viết khi ghép kịch bản (Milestone 4b), tách biệt với thời lượng thật
// của từng slide 1-quote-1-slide (đã tính động theo text ở durationInFramesForText).
const REFERENCE_TITLE_DURATION_SECONDS = 5;
const REFERENCE_QUOTE_DURATION_SECONDS = 4;

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Tính thời lượng (số frame) hiển thị 1 slide dựa theo độ dài quote thật (đếm theo số từ, chia
// cho tốc độ đọc lướt trung bình), có chặn trên/dưới để không quá ngắn/quá dài.
function durationInFramesForText(text, { isTitle = false } = {}) {
  const seconds = wordCount(text) / READING_WORDS_PER_SECOND + (isTitle ? TITLE_EXTRA_SECONDS : 0);
  const clamped = Math.min(Math.max(seconds, MIN_QUOTE_DURATION_SECONDS), MAX_QUOTE_DURATION_SECONDS);
  return Math.round(clamped * FPS);
}

module.exports = {
  FPS,
  READING_WORDS_PER_SECOND,
  MIN_QUOTE_DURATION_SECONDS,
  MAX_QUOTE_DURATION_SECONDS,
  REFERENCE_TITLE_DURATION_SECONDS,
  REFERENCE_QUOTE_DURATION_SECONDS,
  durationInFramesForText,
};
