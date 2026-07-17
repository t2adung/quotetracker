const React = require('react');
const { Composition } = require('remotion');
const { VideoSequence, FPS, totalDurationInFrames } = require('./VideoSequence');

const COMPOSITION_ID = 'VideoSequence';
const WIDTH = 1080;
const HEIGHT = 1920;

const DEFAULT_SEGMENTS = [
  { quote: 'Quote tiêu đề mẫu (title) để xem trước trong Remotion Studio', imagePath: '' },
  { quote: 'Quote thứ 2 mẫu để xem trước.', imagePath: '' },
];

// The number of quotes (segments) and each quote's length varies per source video, so the
// composition's duration must be recalculated dynamically from props instead of being fixed —
// see totalDurationInFrames() in VideoSequence.jsx.
function calculateMetadata({ props }) {
  const segments = props.segments || [];
  return { durationInFrames: totalDurationInFrames(segments) };
}

function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={VideoSequence}
      durationInFrames={totalDurationInFrames(DEFAULT_SEGMENTS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      calculateMetadata={calculateMetadata}
      defaultProps={{
        segments: DEFAULT_SEGMENTS,
        logo: '',
      }}
    />
  );
}

module.exports = { RemotionRoot, COMPOSITION_ID, FPS, WIDTH, HEIGHT };
