require('./config');
const { getUnprocessedVideos, appendQuotes, updateVideoStatus } = require('./sheets');
const { extractQuotes } = require('./gemini');

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
      const quotes = await extractQuotes(video.link, video.tieuDe);
      console.log(`  Trích được ${quotes.length} quote.`);

      await appendQuotes(video.stt, quotes);
      console.log('  Đã ghi quote vào tab Quotes.');

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
