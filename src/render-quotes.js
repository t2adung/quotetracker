const fs = require('fs');
const path = require('path');
require('./config');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const { getQuotesReadyToRender, updateQuoteStatus, STATUS_QUOTE_DA_DUNG } = require('./sheets');

const COMPOSITION_ID = 'QuoteVideo';
const ENTRY_POINT = path.join(__dirname, 'remotion', 'index.jsx');
// publicDir = output/, để composition phục vụ ảnh nền qua staticFile('images/quote_XXX.png')
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

function outputFilenameForStt(stt) {
  const padded = String(stt).padStart(3, '0');
  return `quote_${padded}.mp4`;
}

async function renderQuote(bundleLocation, quote) {
  const imagePath = path.join(IMAGES_DIR, quote.imageFilename);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Không tìm thấy ảnh nền "${quote.imageFilename}" tại ${imagePath}`);
  }

  const inputProps = {
    quote: quote.quote,
    context: quote.context,
    imagePath: `images/${quote.imageFilename}`,
  };

  // Phải chọn lại composition với đúng inputProps của từng quote — Remotion render theo
  // composition.props đã "resolve" lúc selectComposition(), không phải theo inputProps truyền
  // riêng cho renderMedia().
  const composition = await selectComposition({ serveUrl: bundleLocation, id: COMPOSITION_ID, inputProps });

  const outputLocation = path.join(OUTPUT_DIR, outputFilenameForStt(quote.stt));

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

  console.log(`Tìm thấy ${quotes.length} quote sẵn sàng render.`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Đang bundle Remotion composition...');
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT, publicDir: OUTPUT_DIR });

  const sttThanhCong = [];
  const sttLoi = [];

  for (const quote of quotes) {
    try {
      const outputLocation = await renderQuote(bundleLocation, quote);
      console.log(`  ✔ Đã render quote STT ${quote.stt} -> ${path.basename(outputLocation)}`);
      sttThanhCong.push(quote.stt);
    } catch (err) {
      console.error(`  ✘ Lỗi khi render quote STT ${quote.stt}: ${err.message}`);
      sttLoi.push(quote.stt);
    }
  }

  console.log(`\nHoàn tất render. ${sttThanhCong.length}/${quotes.length} quote thành công.`);
  if (sttLoi.length > 0) {
    console.log(`Quote bị lỗi, chưa render được (STT): ${sttLoi.join(', ')}`);
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
