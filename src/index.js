require('./config');
const {
  getUnprocessedVideos,
  getSttVideosWithQuotes,
  appendQuotes,
  updateVideoStatus,
  updateQuoteImageFilename,
  getQuotesMissingImages,
  appendScript,
} = require('./sheets');
const { extractQuotes } = require('./gemini');
const { generateBackgroundImage, pickSceneAnchor } = require('./image-gen');
const { buildScriptFromQuotes, validateScriptConsistency } = require('./script-builder');

const STATUS_DA_TRICH_QUOTE = 'Đã trích quote';

// Đọc tuỳ chọn dòng lệnh:
//   --topic=<tên chủ đề>     chọn prompt trong src/prompts/ (mặc định "quote")
//   --gen-images             bật sinh ảnh nền cho từng quote (mặc định TẮT — API tính phí riêng)
//   --resume-images          chỉ sinh ảnh còn thiếu cho các quote đã có sẵn trong Sheet, KHÔNG
//                            gọi lại Gemini trích quote — dùng khi lần chạy trước bị lỗi/hết
//                            quota giữa chừng lúc sinh ảnh, để không tốn token trích quote lại
//   --image-scope=quote|video  sinh 1 ảnh/quote (mặc định) hay chỉ 1 ảnh dùng chung cho cả video
//   --image-topic=<tên chủ đề> chọn style ảnh trong src/image-prompts/ (mặc định "quote")
//   --build-script           bật ghép quote thành kịch bản sau khi trích quote (mặc định TẮT —
//                            gọi thêm 2 lượt Gemini/video: ghép script + tự kiểm tra nhất quán)
//   --script-topic=<tên chủ đề> chọn style ghép kịch bản trong src/script-prompts/ (mặc định
//                            "quote"), chỉ có tác dụng khi bật --build-script
function parseArgs(argv) {
  const args = {
    topic: 'quote',
    genImages: false,
    resumeImages: false,
    imageScope: 'quote',
    imageTopic: 'quote',
    buildScript: false,
    scriptTopic: 'quote',
  };
  for (const arg of argv) {
    if (arg === '--gen-images') {
      args.genImages = true;
    } else if (arg === '--resume-images') {
      args.resumeImages = true;
    } else if (arg === '--build-script') {
      args.buildScript = true;
    } else if (arg.startsWith('--topic=')) {
      args.topic = arg.slice('--topic='.length);
    } else if (arg.startsWith('--image-scope=')) {
      args.imageScope = arg.slice('--image-scope='.length);
    } else if (arg.startsWith('--image-topic=')) {
      args.imageTopic = arg.slice('--image-topic='.length);
    } else if (arg.startsWith('--script-topic=')) {
      args.scriptTopic = arg.slice('--script-topic='.length);
    }
  }
  return args;
}

// Sinh ảnh nền cho 1 danh sách quote (thường là quote của cùng 1 video).
//   imageScope === 'video': chỉ sinh đúng 1 ảnh đại diện, dùng chung cho mọi quote trong video.
//   imageScope === 'quote' (mặc định): sinh 1 ảnh/quote, tuần tự — chọn 1 bối cảnh dùng chung,
//     truyền ảnh liền trước làm ảnh tham chiếu cho ảnh kế tiếp, để cả chuỗi ảnh cùng chủ đề/bối
//     cảnh nhưng tiến triển tuần tự, tạo cảm giác như đang xem 1 video chuyển động.
// Lỗi ở 1 quote/1 ảnh chỉ log lại, không chặn các quote còn lại.
async function generateImagesForQuotes(quotes, imageScope, imageTopic) {
  if (quotes.length === 0) return;

  const sceneAnchor = pickSceneAnchor(imageTopic);

  if (imageScope === 'video') {
    try {
      const firstQuote = quotes[0];
      const { filename } = await generateBackgroundImage({
        stt: firstQuote.stt,
        quoteText: firstQuote.quote,
        sceneAnchor,
        sequenceIndex: 1,
        totalInSequence: 1,
        previousImageBytes: null,
        topic: imageTopic,
      });
      for (const q of quotes) {
        await updateQuoteImageFilename(q.stt, filename);
      }
      console.log(`  Đã sinh 1 ảnh dùng chung cho cả video: ${filename}`);
    } catch (err) {
      console.error(`  Lỗi khi sinh ảnh chung cho video: ${err.message}`);
    }
    return;
  }

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
        topic: imageTopic,
      });
      await updateQuoteImageFilename(q.stt, filename);
      previousImageBytes = imageBytes;
      console.log(`  Đã sinh ảnh nền: ${filename}`);
    } catch (err) {
      console.error(`  Lỗi khi sinh ảnh nền cho quote STT ${q.stt}: ${err.message}`);
    }
  }
}

// Ghép các quote vừa trích của 1 video thành 1 kịch bản (script), tự kiểm tra tính nhất quán,
// rồi ghi vào tab Scripts nếu đạt. Không throw ra ngoài — lỗi ở bước này chỉ log lại, không
// chặn việc cập nhật trạng thái video (quote đã ghi vào Sheet thành công là đủ để coi là xong).
async function buildAndSaveScript(video, quotes, scriptTopic) {
  console.log('  Đang ghép kịch bản từ các quote vừa trích...');

  let script;
  try {
    script = await buildScriptFromQuotes(video.tieuDe, quotes, scriptTopic);
  } catch (err) {
    console.error(`  Lỗi khi ghép kịch bản: ${err.message}`);
    return;
  }

  if (!script) {
    console.log('  Không đủ quote phù hợp để ghép thành kịch bản mạch lạc — bỏ qua, không ghi script.');
    return;
  }

  console.log('  Đang tự kiểm tra tính nhất quán của kịch bản...');
  let consistency;
  try {
    consistency = await validateScriptConsistency(script);
  } catch (err) {
    console.error(`  Lỗi khi tự kiểm tra tính nhất quán kịch bản: ${err.message}`);
    return;
  }

  if (!consistency.isConsistent) {
    console.log(`  Kịch bản KHÔNG đạt kiểm tra tính nhất quán, bỏ qua không ghi vào Sheet. Lý do: ${consistency.reason}`);
    return;
  }

  const quoteIds = [...new Set(script.segments.filter((s) => s.quoteId != null).map((s) => s.quoteId))];

  try {
    await appendScript(video.stt, quoteIds, script.fullScript, script.segments);
    console.log('  Đã ghi kịch bản vào tab Scripts.');
  } catch (err) {
    console.error(`  Lỗi khi ghi kịch bản vào Sheet: ${err.message}`);
  }
}

console.log('Config OK');

async function runResumeImages(imageScope, imageTopic) {
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
    await generateImagesForQuotes(quotesOfVideo, imageScope, imageTopic);
  }

  console.log('\nHoàn tất sinh ảnh còn thiếu.');
}

async function runExtractQuotes(topic, genImages, imageScope, imageTopic, buildScript, scriptTopic) {
  let videos;
  let sttVideosWithQuotes;
  try {
    videos = await getUnprocessedVideos();
    sttVideosWithQuotes = await getSttVideosWithQuotes();
  } catch (err) {
    console.error(err.message);
    return;
  }

  console.log(`Tìm thấy ${videos.length} video chưa xử lý.`);

  const videoLoi = [];
  const videoBoQua = [];

  for (const video of videos) {
    console.log(`\n▶ Đang xử lý video STT ${video.stt}: "${video.tieuDe}"`);

    // Phòng trường hợp Trạng thái xử lý ở tab Nguồn Video chưa kịp cập nhật đúng (lần chạy trước
    // lỗi giữa chừng sau khi đã ghi quote) — kiểm tra thêm tab Quotes, tránh ghi trùng quote.
    if (sttVideosWithQuotes.has(String(video.stt))) {
      console.log(`  Video STT ${video.stt} đã có quote trong tab Quotes — bỏ qua, không trích lại.`);
      videoBoQua.push(video.stt);
      continue;
    }

    try {
      const quotes = await extractQuotes(video.link, video.tieuDe, topic);
      console.log(`  Trích được ${quotes.length} quote.`);

      const createdQuotes = await appendQuotes(video.stt, quotes);
      console.log('  Đã ghi quote vào tab Quotes.');

      if (genImages) {
        await generateImagesForQuotes(createdQuotes, imageScope, imageTopic);
      }

      if (buildScript) {
        await buildAndSaveScript(video, createdQuotes, scriptTopic);
      }

      await updateVideoStatus(video.stt, STATUS_DA_TRICH_QUOTE);
      console.log(`  Đã cập nhật trạng thái "${STATUS_DA_TRICH_QUOTE}".`);
    } catch (err) {
      console.error(`  Lỗi khi xử lý video STT ${video.stt}: ${err.message}`);
      videoLoi.push(video.stt);
    }
  }

  const daXuLy = videos.length - videoLoi.length - videoBoQua.length;
  console.log(`\nHoàn tất. ${daXuLy}/${videos.length} video xử lý thành công.`);
  if (videoBoQua.length > 0) {
    console.log(`Video bị bỏ qua vì đã có quote sẵn (STT): ${videoBoQua.join(', ')}`);
  }
  if (videoLoi.length > 0) {
    console.log(`Video bị lỗi (STT): ${videoLoi.join(', ')}`);
  }
}

async function main() {
  const { topic, genImages, resumeImages, imageScope, imageTopic, buildScript, scriptTopic } = parseArgs(
    process.argv.slice(2)
  );

  if (resumeImages) {
    console.log('Chế độ --resume-images: chỉ sinh ảnh còn thiếu, không gọi lại Gemini trích quote.');
    await runResumeImages(imageScope, imageTopic);
    return;
  }

  if (genImages) {
    console.log(
      `Đã bật sinh ảnh nền (--gen-images, image-scope=${imageScope}, image-topic=${imageTopic}) — sẽ gọi thêm Gemini Flash Image.`
    );
  }

  if (buildScript) {
    console.log(`Đã bật ghép kịch bản (--build-script, script-topic=${scriptTopic}) — sẽ gọi thêm Gemini để ghép + tự kiểm tra script.`);
  }

  await runExtractQuotes(topic, genImages, imageScope, imageTopic, buildScript, scriptTopic);
}

main();
