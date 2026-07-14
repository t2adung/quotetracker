require('./config');
const { getUnprocessedVideos, appendQuotes, updateVideoStatus, updateQuoteImageFilename } = require('./sheets');
const { extractQuotes } = require('./gemini');
const { generateBackgroundImage } = require('./image-gen');

const STATUS_DA_TRICH_QUOTE = 'Đã trích quote';

console.log('Config OK');

async function main() {
  let videos;
  try {
    videos = await getUnprocessedVideos();
  } catch (err) {
    console.error(err.message);
    return;
  }

  console.log(`Tìm thấy ${videos.length} video chưa xử lý.`);

  const videoLoi = [];

  for (const video of videos) {
    console.log(`\n▶ Đang xử lý video STT ${video.stt}: "${video.tieuDe}"`);
    try {
      const quotes = await extractQuotes(video.link, video.tieuDe, 'quote');
      console.log(`  Trích được ${quotes.length} quote.`);

      const createdQuotes = await appendQuotes(video.stt, quotes);
      console.log('  Đã ghi quote vào tab Quotes.');

      // --- Sinh ảnh nền cho từng quote bằng Gemini 3.1 Flash Image ---
      // ĐANG TẮT: sinh ảnh là lệnh gọi API tính phí riêng, khác với gọi Gemini trích quote
      // (text). Mỗi video có 10-15 quote => 10-15 ảnh mỗi lần chạy, cần tính lại chi phí
      // trước khi bật. Bỏ comment khối dưới để bật, đồng thời nhớ thêm cột "image_filename"
      // (header ở hàng 3, cột J) vào tab Quotes trên Google Sheet thật trước khi chạy.
      //
      // for (const q of createdQuotes) {
      //   try {
      //     const filename = await generateBackgroundImage(q.stt, q.quote);
      //     await updateQuoteImageFilename(q.stt, filename);
      //     console.log(`  Đã sinh ảnh nền: ${filename}`);
      //   } catch (err) {
      //     console.error(`  Lỗi khi sinh ảnh nền cho quote STT ${q.stt}: ${err.message}`);
      //   }
      // }

      await updateVideoStatus(video.stt, STATUS_DA_TRICH_QUOTE);
      console.log(`  Đã cập nhật trạng thái "${STATUS_DA_TRICH_QUOTE}".`);
    } catch (err) {
      console.error(`  Lỗi khi xử lý video STT ${video.stt}: ${err.message}`);
      videoLoi.push(video.stt);
    }
  }

  console.log(`\nHoàn tất. ${videos.length - videoLoi.length}/${videos.length} video xử lý thành công.`);
  if (videoLoi.length > 0) {
    console.log(`Video bị lỗi (STT): ${videoLoi.join(', ')}`);
  }
}

main();
