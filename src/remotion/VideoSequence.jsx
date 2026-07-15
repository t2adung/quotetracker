const React = require('react');
const { AbsoluteFill, Series } = require('remotion');
const { QuoteSlide } = require('./QuoteVideo');
const { FPS, durationInFramesForText } = require('../timing');

// Tổng thời lượng (số frame) của cả video — cộng dồn thời lượng từng slide, mỗi slide đã tính
// động theo độ dài quote thật (xem durationInFramesForText ở src/timing.js).
function totalDurationInFrames(segments) {
  if (!segments || segments.length === 0) return FPS;
  return segments.reduce(
    (total, segment, index) => total + durationInFramesForText(segment.quote, { isTitle: index === 0 }),
    0
  );
}

// Ghép nhiều quote thuộc cùng 1 "STT Video nguồn" thành 1 video duy nhất, phát nối tiếp nhau.
// Quote đầu tiên (segments[0]) là title, hiển thị to/đậm hơn (xem isTitle trong QuoteSlide).
function VideoSequence({ segments, logo }) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {segments.map((segment, index) => (
          <Series.Sequence
            key={index}
            durationInFrames={durationInFramesForText(segment.quote, { isTitle: index === 0 })}
          >
            <QuoteSlide quote={segment.quote} imagePath={segment.imagePath} isTitle={index === 0} logo={logo} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

module.exports = { VideoSequence, FPS, totalDurationInFrames };
