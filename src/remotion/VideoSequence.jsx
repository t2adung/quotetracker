const React = require('react');
const { AbsoluteFill, Series } = require('remotion');
const { QuoteSlide } = require('./QuoteVideo');
const { FPS, TITLE_DURATION_IN_FRAMES, QUOTE_DURATION_IN_FRAMES } = require('../timing');

function durationForIndex(index) {
  return index === 0 ? TITLE_DURATION_IN_FRAMES : QUOTE_DURATION_IN_FRAMES;
}

function totalDurationInFrames(segmentCount) {
  if (segmentCount <= 0) return FPS;
  return TITLE_DURATION_IN_FRAMES + Math.max(0, segmentCount - 1) * QUOTE_DURATION_IN_FRAMES;
}

// Ghép nhiều quote thuộc cùng 1 "STT Video nguồn" thành 1 video duy nhất, phát nối tiếp nhau.
// Quote đầu tiên (segments[0]) là title, hiển thị to/đậm hơn (xem isTitle trong QuoteSlide).
function VideoSequence({ segments, logo }) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {segments.map((segment, index) => (
          <Series.Sequence key={index} durationInFrames={durationForIndex(index)}>
            <QuoteSlide quote={segment.quote} imagePath={segment.imagePath} isTitle={index === 0} logo={logo} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

module.exports = { VideoSequence, FPS, TITLE_DURATION_IN_FRAMES, QUOTE_DURATION_IN_FRAMES, totalDurationInFrames };
