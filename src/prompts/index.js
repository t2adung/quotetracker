// Thư viện prompt theo chủ đề. Mỗi chủ đề là 1 file riêng trong thư mục này, export
// { build(vars), parse(text) }. Khi cần thêm chủ đề mới (ví dụ ngoài "quote"), tạo file
// mới rồi đăng ký vào TOPICS bên dưới — không cần sửa code gọi Gemini ở gemini.js.
const TOPICS = {
  quote: require('./quote'),
};

function getTopic(topic) {
  const topicModule = TOPICS[topic];
  if (!topicModule) {
    throw new Error(
      `Không tìm thấy prompt cho chủ đề "${topic}". Các chủ đề hiện có: ${Object.keys(TOPICS).join(', ')}`
    );
  }
  return topicModule;
}

function getPrompt(topic, vars) {
  return getTopic(topic).build(vars);
}

function parseResponse(topic, text) {
  return getTopic(topic).parse(text);
}

module.exports = { getPrompt, parseResponse };
