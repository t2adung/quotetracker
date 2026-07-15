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

// 1 "slide" hiển thị 1 quote (dùng bên trong <Series.Sequence> của VideoSequence). Quote đầu
// tiên của mỗi video (isTitle) được hiển thị to/đậm hơn hẳn các quote còn lại.
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

      {/* Overlay đen mờ toàn khung để chữ luôn đọc được trên mọi ảnh nền */}
      <AbsoluteFill style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }} />

      {/* Quote nằm ở phía trên khung hình (không phải giữa trang), căn giữa theo chiều ngang */}
      <AbsoluteFill
        style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: isTitle ? 140 : 165 }}
      >
        <div
          style={{
            opacity,
            maxWidth: 920,
            padding: isTitle ? '38px 46px' : '28px 38px',
            borderRadius: 32,
            // Background mờ (blur) riêng sau chữ, tách biệt với overlay tối toàn khung ở trên
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
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
              // Border đen quanh chữ + đổ bóng nhẹ để nổi trên mọi ảnh nền
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
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
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
              @{logo}
            </p>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

module.exports = { QuoteSlide };
