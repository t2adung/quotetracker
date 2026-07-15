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

// Số quote (segments) thay đổi theo từng video nguồn, nên thời lượng composition phải tính lại
// động dựa trên props thay vì cố định — xem totalDurationInFrames() ở VideoSequence.jsx.
function calculateMetadata({ props }) {
  const segments = props.segments || [];
  return { durationInFrames: totalDurationInFrames(segments.length) };
}

function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={VideoSequence}
      durationInFrames={totalDurationInFrames(DEFAULT_SEGMENTS.length)}
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
