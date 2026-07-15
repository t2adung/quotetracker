const React = require('react');
const { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } = require('remotion');

const FADE_IN_DURATION_FRAMES = 20;

// imagePath is a path relative to the public folder (bundle() points publicDir to output/ at
// render time, see src/render-quotes.js) — e.g. "images/quote_001.png". staticFile() serves the
// file through Remotion's local HTTP server at render time, avoiding headless Chrome blocking
// file:// URLs.
function toImageSrc(imagePath) {
  if (!imagePath) return undefined;
  if (/^(https?:|data:)/i.test(imagePath)) return imagePath;
  return staticFile(imagePath);
}

// 1 "slide" displaying 1 quote (used inside <Series.Sequence> in VideoSequence). The first quote
// of each video (isTitle) is shown noticeably bigger/bolder than the rest.
function QuoteSlide({ quote, imagePath, isTitle, logo }) {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, FADE_IN_DURATION_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fontSize = isTitle ? 80 : 58;

  return (
    <AbsoluteFill>
      <Img src={toImageSrc(imagePath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Quote sits near the top of the frame (not centered), horizontally centered. Do NOT
          apply a full-frame dark overlay here — the background image must keep its full
          brightness/sharpness; the text is already readable thanks to its own translucent
          background + text stroke below. */}
      <AbsoluteFill
        style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: isTitle ? 170 : 195 }}
      >
        <div
          style={{
            opacity,
            maxWidth: 920,
            padding: isTitle ? '38px 46px' : '28px 38px',
            borderRadius: 32,
            // Translucent dark background (not backdrop-blur) behind the text only, for
            // readability without blurring the background image
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
          }}
        >
          <p
            style={{
              margin: 0,
              color: '#fff',
              fontSize,
              fontWeight: 800,
              lineHeight: 1.35,
              textAlign: 'center',
              fontFamily: 'sans-serif',
              // Black outline around the text + a subtle drop shadow so it stands out on any background
              WebkitTextStroke: '2px rgba(0, 0, 0, 0.9)',
              textShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
            }}
          >
            {quote}
          </p>
        </div>
      </AbsoluteFill>

      {logo ? (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
          <div
            style={{
              padding: '14px 32px',
              borderRadius: 999,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
            }}
          >
            <p
              style={{
                margin: 0,
                color: 'rgba(255, 255, 255, 0.92)',
                fontSize: 34,
                fontWeight: 600,
                fontFamily: 'sans-serif',
              }}
            >
              @{logo} sưu tầm
            </p>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

module.exports = { QuoteSlide };
