// Prompt library by topic. Each topic is its own file in this folder, exporting
// { build(vars), parse(text) }. To add a new topic (e.g. besides "quote"), create a new
// file and register it in TOPICS below — no need to change the Gemini-calling code in gemini.js.
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
