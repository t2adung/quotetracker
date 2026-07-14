require('./config');
const {
  getUnprocessedVideos,
  appendQuotes,
  updateVideoStatus,
  updateQuoteImageFilename,
  getQuotesMissingImages,
} = require('./sheets');
const { extractQuotes } = require('./gemini');
const { generateBackgroundImage, pickSceneAnchor } = require('./image-gen');

const STATUS_DA_TRICH_QUOTE = 'Đã trích quote';

// Đọc tuỳ chọn dòng lệnh:
//   --topic=<tên chủ đề>   chọn prompt trong src/prompts/ (mặc định "quote")
//   --gen-images           bật sinh ảnh nền cho từng quote (mặc định TẮT — API tính phí riêng)
//   --resume-images        chỉ sinh ảnh còn thiếu cho các quote đã có sẵn trong Sheet, KHÔNG
//                          gọi lại Gemini trích quote — dùng khi lần chạy trước bị lỗi/hết
//                          quota giữa chừng lúc sinh ảnh, để không tốn token trích quote lại
function parseArgs(argv) {
  const args = { topic: 'quote', genImages: false, resumeImages: false };
  for (const arg of argv) {
    if (arg === '--gen-images') {
      args.genImages = true;
    } else if (arg === '--resume-images') {
      args.resumeImages = true;
    } else if (arg.startsWith('--topic=')) {
      args.topic = arg.slice('--topic='.length);
    }
  }
  return args;
}

// Sinh ảnh nền tuần tự cho 1 danh sách quote (thường là quote của cùng 1 video): chọn 1 bối
// cảnh dùng chung, và truyền ảnh liền trước làm ảnh tham chiếu cho ảnh kế tiếp — để cả chuỗi
// ảnh cùng chủ đề/bối cảnh nhưng tiến triển tuần tự, tạo cảm giác như đang xem 1 video chuyển
// động. Lỗi ở 1 quote chỉ log lại, không chặn các quote còn lại.
async function generateImagesForQuotes(quotes) {
  const sceneAnchor = pickSceneAnchor();
  let previousImageBytes = null;

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    try {
      const { filename, imageBytes } = await generateBackgroundImage({
        stt: q.stt,
        quoteText: q.quote,
        sceneAnchor,
        sequenceIndex: i + 1,
        totalInSequence: quotes.length,
        previousImageBytes,
      });
      await updateQuoteImageFilename(q.stt, filename);
      previousImageBytes = imageBytes;
      console.log(`  Đã sinh ảnh nền: ${filename}`);
    } catch (err) {
      console.error(`  Lỗi khi sinh ảnh nền cho quote STT ${q.stt}: ${err.message}`);
    }
  }
}

console.log('Config OK');

async function runResumeImages() {
  let missing;
  try {
    missing = await getQuotesMissingImages();
  } catch (err) {
    console.error(err.message);
    return;
  }

  if (missing.length === 0) {
    console.log('Không có quote nào thiếu ảnh nền — không cần sinh thêm.');
    return;
  }

  const bySttVideo = missing.reduce((acc, q) => {
    (acc[q.sttVideo] = acc[q.sttVideo] || []).push(q);
    return acc;
  }, {});

  const sttVideos = Object.keys(bySttVideo);
  console.log(`Tìm thấy ${missing.length} quote thiếu ảnh, thuộc ${sttVideos.length} video.`);

  for (const sttVideo of sttVideos) {
    const quotesOfVideo = bySttVideo[sttVideo];
    console.log(`\n▶ Sinh ảnh còn thiếu cho video STT ${sttVideo} (${quotesOfVideo.length} quote)`);
    await generateImagesForQuotes(quotesOfVideo);
  }

  console.log('\nHoàn tất sinh ảnh còn thiếu.');
}

async function runExtractQuotes(topic, genImages) {
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
        await generateImagesForQuotes(createdQuotes);
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

async function main() {
  const { topic, genImages, resumeImages } = parseArgs(process.argv.slice(2));

  if (resumeImages) {
    console.log('Chế độ --resume-images: chỉ sinh ảnh còn thiếu, không gọi lại Gemini trích quote.');
    await runResumeImages();
    return;
  }

  if (genImages) {
    console.log('Đã bật sinh ảnh nền (--gen-images) — mỗi quote sẽ tốn thêm 1 lần gọi Gemini Flash Image.');
  }

  await runExtractQuotes(topic, genImages);
}

main();
