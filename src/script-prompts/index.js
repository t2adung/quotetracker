// Thư viện style kịch bản theo chủ đề — song song với src/prompts/ (prompt trích quote) và
// src/image-prompts/ (style ảnh). Mỗi chủ đề 1 file, export { audienceDescription }. Thêm chủ đề
// mới: tạo file rồi đăng ký vào TOPICS bên dưới, không cần sửa code trong script-builder.js.
const TOPICS = {
  quote: require('./quote'),
};

function getScriptPrompt(topic) {
  const style = TOPICS[topic];
  if (!style) {
    throw new Error(
      `Không tìm thấy style kịch bản cho chủ đề "${topic}". Các chủ đề hiện có: ${Object.keys(TOPICS).join(', ')}`
    );
  }
  return style;
}

module.exports = { getScriptPrompt };
