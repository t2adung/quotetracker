// Thư viện style ảnh theo chủ đề — song song với src/prompts/ (prompt text). Mỗi chủ đề 1
// file, export { styleSuffix, sceneAnchors }. Thêm chủ đề mới: tạo file rồi đăng ký vào
// TOPICS bên dưới, không cần sửa code trong image-gen.js.
const TOPICS = {
  quote: require('./quote'),
};

function getImageStyle(topic) {
  const style = TOPICS[topic];
  if (!style) {
    throw new Error(
      `Không tìm thấy style ảnh cho chủ đề "${topic}". Các chủ đề hiện có: ${Object.keys(TOPICS).join(', ')}`
    );
  }
  return style;
}

module.exports = { getImageStyle };
