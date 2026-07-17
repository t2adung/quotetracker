// Script style library by topic — parallel to src/prompts/ (quote extraction prompts) and
// src/image-prompts/ (image style). Each topic is 1 file, exporting { audienceDescription }. To
// add a new topic: create a file and register it in TOPICS below, no need to change code in
// script-builder.js.
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
