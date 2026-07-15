const React = require('react');
const { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } = require('remotion');

const FADE_IN_DURATION_FRAMES = 20;

// imagePath là đường dẫn tương đối bên trong thư mục public (do bundle() trỏ publicDir vào
// output/ lúc render, xem src/render-quotes.js) — vd "images/quote_001.png". staticFile() phục
// vụ file qua local HTTP server của Remotion lúc render, tránh lỗi headless Chrome chặn file://.
function toImageSrc(imagePath) {
  if (!imagePath) return undefined;
  if (/^(https?:|data:)/i.test(imagePath)) return imagePath;
  return staticFile(imagePath);
}

function QuoteVideo({ quote, context, imagePath }) {
  const frame = useCurrentFrame();

  const quoteOpacity = interpolate(frame, [0, FADE_IN_DURATION_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Img src={toImageSrc(imagePath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Overlay đen mờ để chữ luôn đọc được trên mọi ảnh nền */}
      <AbsoluteFill style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '100px 90px' }}>
        <p
          style={{
            opacity: quoteOpacity,
            color: '#fff',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.4,
            textAlign: 'center',
            fontFamily: 'sans-serif',
            textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
            margin: 0,
          }}
        >
          {quote}
        </p>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 32,
            textAlign: 'center',
            fontFamily: 'sans-serif',
            padding: '0 110px',
            margin: 0,
          }}
        >
          {context}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

module.exports = { QuoteVideo };
