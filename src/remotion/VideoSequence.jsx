const React = require('react');
const { AbsoluteFill, Series } = require('remotion');
const { QuoteSlide } = require('./QuoteVideo');
const { FPS, durationInFramesForText } = require('../timing');

// Total video duration (in frames) — sums up each slide's duration, already computed dynamically
// from the actual quote length (see durationInFramesForText in src/timing.js).
function totalDurationInFrames(segments) {
  if (!segments || segments.length === 0) return FPS;
  return segments.reduce(
    (total, segment, index) => total + durationInFramesForText(segment.quote, { isTitle: index === 0 }),
    0
  );
}

// Combines multiple quotes belonging to the same "STT Video nguồn" (source video) into 1 single
// video, played back to back. The first quote (segments[0]) is the title, shown bigger/bolder
// (see isTitle in QuoteSlide).
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
