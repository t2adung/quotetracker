const fs = require('fs');
const path = require('path');
const config = require('./config');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const {
  getQuotesReadyToRender,
  updateQuoteStatus,
  updateQuoteOutputLink,
  STATUS_QUOTE_DA_DUNG,
} = require('./sheets');
const { uploadVideoToDrive, downloadImageIfExists } = require('./drive');

const COMPOSITION_ID = 'VideoSequence';
const ENTRY_POINT = path.join(__dirname, 'remotion', 'index.jsx');
// publicDir = output/, so the composition can serve background images via staticFile('images/quote_XXX.png')
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

// --logo=<name>: show "@<name> sưu tầm" in the video (e.g. --logo=song.canbang). Leave empty to hide it.
// --upload-drive: after rendering 1 video, upload it to Google Drive and write the link into the
// "Link video output" column in the Quotes tab for every quote merged into that video. Default OFF.
function parseArgs(argv) {
  const args = { logo: '', uploadDrive: false };
  for (const arg of argv) {
    if (arg.startsWith('--logo=')) {
      args.logo = arg.slice('--logo='.length);
    } else if (arg === '--upload-drive') {
      args.uploadDrive = true;
    }
  }
  return args;
}

function outputFilenameForVideo(sttVideo) {
  const padded = String(sttVideo).padStart(3, '0');
  return `video_${padded}.mp4`;
}

// Groups quotes by "STT Video nguồn" (source video) — each group is merged into 1 single video,
// with the first quote in the group treated as the title.
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

// Background image not available locally (e.g. running on a different job/machine than the one
// that generated it via --gen-images --upload-drive) → try downloading it from Google Drive
// before giving up on that quote entirely. Only attempted when GOOGLE_DRIVE_FOLDER_ID is
// configured, to avoid a confusing "missing environment variable" error for people who only use
// local images and don't use Drive.
async function ensureImageAvailable(imageFilename) {
  const imageAbsolutePath = path.join(IMAGES_DIR, imageFilename);
  if (fs.existsSync(imageAbsolutePath)) return true;
  if (!config.GOOGLE_DRIVE_FOLDER_ID) return false;

  console.log(`    Không thấy ảnh nền cục bộ "${imageFilename}", thử tải từ Google Drive...`);
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const found = await downloadImageIfExists(imageFilename, imageAbsolutePath);
  if (found) {
    console.log(`    ✔ Đã tải ảnh nền từ Drive: ${imageFilename}`);
  }
  return found;
}

// Skips (without blocking the whole video) quotes missing a background image (both locally and
// on Drive); only merges the remaining quotes into segments to render.
async function buildSegments(quotesOfVideo) {
  const segments = [];
  const sttDaDung = [];

  for (const quote of quotesOfVideo) {
    let available;
    try {
      available = await ensureImageAvailable(quote.imageFilename);
    } catch (err) {
      console.error(`    ✘ Bỏ qua quote STT ${quote.stt}: lỗi khi tải ảnh nền từ Drive — ${err.message}`);
      continue;
    }

    if (!available) {
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

  // Must re-select the composition with each video's own inputProps — Remotion renders using
  // composition.props already "resolved" at selectComposition() time, not the inputProps passed
  // separately to renderMedia().
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
  const { logo, uploadDrive } = parseArgs(process.argv.slice(2));

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
    console.log(`Sẽ hiển thị logo "@${logo} sưu tầm" trong video.`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Đang bundle Remotion composition...');
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT, publicDir: OUTPUT_DIR });

  const sttThanhCong = [];
  const videoLoi = [];

  for (const [sttVideo, quotesOfVideo] of bySttVideo) {
    console.log(`\n▶ Đang render video cho STT Video nguồn ${sttVideo} (${quotesOfVideo.length} quote)`);
    const { segments, sttDaDung } = await buildSegments(quotesOfVideo);

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

      // TẠM PENDING: tính năng upload Drive đang tạm ngưng, bỏ comment đoạn code bên dưới khi cần
      // dùng lại (đã setup xong OAuth, xem README mục "Upload video output lên Google Drive").
      if (uploadDrive) {
        console.log(`  (Upload Drive đang tạm ngưng — bỏ qua upload video STT ${sttVideo}.)`);
        // try {
        //   const fileName = path.basename(outputLocation);
        //   console.log(`  ⇪ Đang upload ${fileName} lên Google Drive...`);
        //   const link = await uploadVideoToDrive(outputLocation, fileName);
        //   console.log(`  ✔ Đã upload, link: ${link}`);
        //
        //   for (const stt of sttDaDung) {
        //     await updateQuoteOutputLink(stt, link);
        //   }
        // } catch (err) {
        //   console.error(`  ✘ Lỗi khi upload video STT ${sttVideo} lên Drive: ${err.message}`);
        // }
      }
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
