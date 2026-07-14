require('./config');
const { getUnprocessedVideos, appendQuotes, updateVideoStatus, updateQuoteImageFilename } = require('./sheets');
const { extractQuotes } = require('./gemini');
const { generateBackgroundImage } = require('./image-gen');

const STATUS_DA_TRICH_QUOTE = 'Đã trích quote';

// Đọc tuỳ chọn dòng lệnh:
//   --topic=<tên chủ đề>   chọn prompt trong src/prompts/ (mặc định "quote")
//   --gen-images           bật sinh ảnh nền cho từng quote (mặc định TẮT — API tính phí riêng)
function parseArgs(argv) {
  const args = { topic: 'quote', genImages: false };
  for (const arg of argv) {
    if (arg === '--gen-images') {
      args.genImages = true;
    } else if (arg.startsWith('--topic=')) {
      args.topic = arg.slice('--topic='.length);
    }
  }
  return args;
}

console.log('Config OK');

async function main() {
  const { topic, genImages } = parseArgs(process.argv.slice(2));

  if (genImages) {
    console.log('Đã bật sinh ảnh nền (--gen-images) — mỗi quote sẽ tốn thêm 1 lần gọi Gemini 3.1 Flash Image.');
  }

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
      const quotes = await extractQuotes(video.link, video.tieuDe, topic);
      console.log(`  Trích được ${quotes.length} quote.`);

      const createdQuotes = await appendQuotes(video.stt, quotes);
      console.log('  Đã ghi quote vào tab Quotes.');

      if (genImages) {
        for (const q of createdQuotes) {
          try {
            const filename = await generateBackgroundImage(q.stt, q.quote);
            await updateQuoteImageFilename(q.stt, filename);
            console.log(`  Đã sinh ảnh nền: ${filename}`);
          } catch (err) {
            console.error(`  Lỗi khi sinh ảnh nền cho quote STT ${q.stt}: ${err.message}`);
          }
        }
      }

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
