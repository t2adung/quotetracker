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

      {/* Quote nằm ở phía trên khung hình (không phải giữa trang), căn giữa theo chiều ngang.
          KHÔNG phủ overlay đen toàn khung ở đây — ảnh nền phải giữ nguyên độ sáng/rõ nét, chữ
          đã đủ đọc rõ nhờ nền đen mờ + viền đen riêng của khối chữ bên dưới. */}
      <AbsoluteFill
        style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: isTitle ? 170 : 195 }}
      >
        <div
          style={{
            opacity,
            maxWidth: 920,
            padding: isTitle ? '38px 46px' : '28px 38px',
            borderRadius: 32,
            // Nền đen mờ (không dùng backdrop-blur) riêng sau chữ, để đọc rõ mà không làm mờ ảnh nền
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
