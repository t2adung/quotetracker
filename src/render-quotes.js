const fs = require('fs');
const path = require('path');
require('./config');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const { getQuotesReadyToRender, updateQuoteStatus, STATUS_QUOTE_DA_DUNG } = require('./sheets');

const COMPOSITION_ID = 'VideoSequence';
const ENTRY_POINT = path.join(__dirname, 'remotion', 'index.jsx');
// publicDir = output/, để composition phục vụ ảnh nền qua staticFile('images/quote_XXX.png')
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

// --logo=<tên>: hiển thị "@<tên>" trong video (vd --logo=song.canbang). Bỏ trống thì không hiện.
function parseArgs(argv) {
  const args = { logo: '' };
  for (const arg of argv) {
    if (arg.startsWith('--logo=')) {
      args.logo = arg.slice('--logo='.length);
    }
  }
  return args;
}

function outputFilenameForVideo(sttVideo) {
  const padded = String(sttVideo).padStart(3, '0');
  return `video_${padded}.mp4`;
}

// Gom quote theo "STT Video nguồn" — mỗi nhóm ghép thành 1 video duy nhất, quote đầu tiên
// trong nhóm được hiểu là title.
function groupQuotesBySttVideo(quotes) {
  const map = new Map();
  for (const quote of quotes) {
    if (!map.has(quote.sttVideo)) {
      map.set(quote.sttVideo, []);
    }
    map.get(quote.sttVideo).push(quote);
  }
  return map;
}

// Bỏ qua (không chặn cả video) những quote thiếu ảnh nền trên đĩa; chỉ ghép các quote còn lại
// thành segments để render.
function buildSegments(quotesOfVideo) {
  const segments = [];
  const sttDaDung = [];

  for (const quote of quotesOfVideo) {
    const imageAbsolutePath = path.join(IMAGES_DIR, quote.imageFilename);
    if (!fs.existsSync(imageAbsolutePath)) {
      console.error(`    ✘ Bỏ qua quote STT ${quote.stt}: không tìm thấy ảnh nền "${quote.imageFilename}"`);
      continue;
    }
    segments.push({ quote: quote.quote, imagePath: `images/${quote.imageFilename}` });
    sttDaDung.push(quote.stt);
  }

  return { segments, sttDaDung };
}

async function renderVideo(bundleLocation, sttVideo, segments, logo) {
  const inputProps = { segments, logo };

  // Phải chọn lại composition với đúng inputProps của từng video — Remotion render theo
  // composition.props đã "resolve" lúc selectComposition(), không phải theo inputProps truyền
  // riêng cho renderMedia().
  const composition = await selectComposition({ serveUrl: bundleLocation, id: COMPOSITION_ID, inputProps });

  const outputLocation = path.join(OUTPUT_DIR, outputFilenameForVideo(sttVideo));

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
  });

  return outputLocation;
}

async function main() {
  const { logo } = parseArgs(process.argv.slice(2));

  let quotes;
  try {
    quotes = await getQuotesReadyToRender();
  } catch (err) {
    console.error(err.message);
    return;
  }

  if (quotes.length === 0) {
    console.log(
      'Không có quote nào sẵn sàng render (cần Trạng thái sử dụng = "Chưa dùng" và đã có ảnh nền).'
    );
    return;
  }

  const bySttVideo = groupQuotesBySttVideo(quotes);
  console.log(`Tìm thấy ${quotes.length} quote sẵn sàng render, thuộc ${bySttVideo.size} video nguồn.`);
  if (logo) {
    console.log(`Sẽ hiển thị logo "@${logo}" trong video.`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Đang bundle Remotion composition...');
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT, publicDir: OUTPUT_DIR });

  const sttThanhCong = [];
  const videoLoi = [];

  for (const [sttVideo, quotesOfVideo] of bySttVideo) {
    console.log(`\n▶ Đang render video cho STT Video nguồn ${sttVideo} (${quotesOfVideo.length} quote)`);
    const { segments, sttDaDung } = buildSegments(quotesOfVideo);

    if (segments.length === 0) {
      console.error(`  ✘ Bỏ qua video STT ${sttVideo}: không có quote nào đủ ảnh nền để render.`);
      videoLoi.push(sttVideo);
      continue;
    }

    try {
      const outputLocation = await renderVideo(bundleLocation, sttVideo, segments, logo);
      console.log(
        `  ✔ Đã render -> ${path.basename(outputLocation)} (${segments.length} quote, quote đầu là title)`
      );
      sttThanhCong.push(...sttDaDung);
    } catch (err) {
      console.error(`  ✘ Lỗi khi render video STT ${sttVideo}: ${err.message}`);
      videoLoi.push(sttVideo);
    }
  }

  console.log(`\nHoàn tất render. ${bySttVideo.size - videoLoi.length}/${bySttVideo.size} video thành công.`);
  if (videoLoi.length > 0) {
    console.log(`Video bị lỗi, chưa render được (STT Video nguồn): ${videoLoi.join(', ')}`);
  }

  for (const stt of sttThanhCong) {
    try {
      await updateQuoteStatus(stt, STATUS_QUOTE_DA_DUNG);
    } catch (err) {
      console.error(`  Lỗi khi cập nhật trạng thái sử dụng cho quote STT ${stt}: ${err.message}`);
    }
  }

  if (sttThanhCong.length > 0) {
    console.log(`Đã cập nhật Trạng thái sử dụng thành "${STATUS_QUOTE_DA_DUNG}" cho ${sttThanhCong.length} quote.`);
  }
}

main();
