const React = require('react');
const { Composition } = require('remotion');
const { QuoteVideo } = require('./QuoteVideo');

const COMPOSITION_ID = 'QuoteVideo';
const FPS = 30;
const DURATION_IN_FRAMES = 7 * FPS; // ~7 giây, đủ đọc hết quote
const WIDTH = 1080;
const HEIGHT = 1920;

function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={QuoteVideo}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{
        quote: 'Quote mẫu để xem trước trong Remotion Studio',
        context: 'Bối cảnh mẫu',
        imagePath: '',
      }}
    />
  );
}

module.exports = { RemotionRoot, COMPOSITION_ID, FPS, DURATION_IN_FRAMES, WIDTH, HEIGHT };
