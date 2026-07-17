// Image style library by topic — parallel to src/prompts/ (text prompts). Each topic is 1
// file, exporting { styleSuffix, sceneAnchors }. To add a new topic: create a file and
// register it in TOPICS below, no need to change code in image-gen.js.
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
