const path = require('path');
require('./config');
const {
  getUnprocessedVideos,
  getVideoByStt,
  getQuotesByVideoStt,
  getSttVideosWithQuotes,
  appendQuotes,
  updateVideoStatus,
  updateQuoteImageFilename,
  getQuotesMissingImages,
  appendScript,
} = require('./sheets');
const { extractQuotes } = require('./gemini');
const { generateBackgroundImage, pickSceneAnchor, OUTPUT_DIR: IMAGES_OUTPUT_DIR } = require('./image-gen');
const { uploadImageToDrive } = require('./drive');
const { buildScriptFromQuotes, validateScriptConsistency } = require('./script-builder');

const STATUS_DA_TRICH_QUOTE = 'Đã trích quote';

// Parse command-line options:
//   --topic=<topic name>     select the prompt in src/prompts/ (default "quote")
//   --gen-images             enable generating background images per quote (default OFF — a
//                            separately billed API)
//   --resume-images          only generate images still missing for quotes already in the
//                            Sheet, WITHOUT calling Gemini to re-extract quotes — used when the
//                            previous run failed/ran out of quota partway through image
//                            generation, to avoid re-spending tokens on quote extraction
//   --image-scope=quote|video  generate 1 image/quote (default) or just 1 shared image for the
//                            whole video
//   --image-topic=<topic name> select the image style in src/image-prompts/ (default "quote")
//   --upload-drive           with --gen-images: also upload each generated background image to
//                            Google Drive (folder GOOGLE_DRIVE_FOLDER_ID), so render-quotes.js
//                            can fetch it back even when run on a different machine/job (default
//                            OFF)
//   --build-script           enable merging quotes into a script after extraction (default OFF —
//                            calls Gemini 2 extra times per video: building the script + self
//                            consistency check)
//   --script-topic=<topic name> select the script-building style in src/script-prompts/ (default
//                            "quote"), only takes effect when --build-script is on
//   --stt-video=<STT>        only process EXACTLY 1 video by this "STT Video nguồn" (source video
//                            number), regardless of processing status (even an already-processed
//                            video) — used to test/re-run 1 specific video. If the video already
//                            has quotes in the Quotes tab, REUSE them (don't call Gemini to
//                            re-extract) — handy for testing just the script-building step
//                            (--build-script) with a video that already has quotes
function parseArgs(argv) {
  const args = {
    topic: 'quote',
    genImages: false,
    resumeImages: false,
    imageScope: 'quote',
    imageTopic: 'quote',
    buildScript: false,
    scriptTopic: 'quote',
    sttVideo: '',
    uploadDrive: false,
  };
  for (const arg of argv) {
    if (arg === '--gen-images') {
      args.genImages = true;
    } else if (arg === '--resume-images') {
      args.resumeImages = true;
    } else if (arg === '--build-script') {
      args.buildScript = true;
    } else if (arg === '--upload-drive') {
      args.uploadDrive = true;
    } else if (arg.startsWith('--topic=')) {
      args.topic = arg.slice('--topic='.length);
    } else if (arg.startsWith('--image-scope=')) {
      args.imageScope = arg.slice('--image-scope='.length);
    } else if (arg.startsWith('--image-topic=')) {
      args.imageTopic = arg.slice('--image-topic='.length);
    } else if (arg.startsWith('--script-topic=')) {
      args.scriptTopic = arg.slice('--script-topic='.length);
    } else if (arg.startsWith('--stt-video=')) {
      args.sttVideo = arg.slice('--stt-video='.length);
    }
  }
  return args;
}

// Generate background images for a list of quotes (usually all quotes from 1 video).
//   imageScope === 'video': generate only 1 representative image, shared by every quote in the
//     video.
//   imageScope === 'quote' (default): generate 1 image/quote, sequentially — pick 1 shared
//     scene, pass the previous image as a reference for the next one, so the whole sequence
//     shares the same theme/setting but progresses gradually, giving the feel of watching a
//     moving video.
// Upload 1 newly generated background image to Google Drive — errors are only logged (not
// thrown), since a missing Drive link shouldn't block the image-generation step (the image is
// still usable locally by render-quotes.js running on the same machine).
// TẠM PENDING: tính năng upload Drive đang tạm ngưng, bỏ comment đoạn code bên dưới khi cần dùng
// lại (đã setup xong OAuth, xem README mục "Upload video output lên Google Drive").
async function uploadImageIfRequested(uploadDrive, filename) {
  if (!uploadDrive) return;
  console.log(`  (Upload Drive đang tạm ngưng — bỏ qua upload ảnh nền "${filename}".)`);
  // try {
  //   await uploadImageToDrive(path.join(IMAGES_OUTPUT_DIR, filename), filename);
  //   console.log(`  Đã upload ảnh nền "${filename}" lên Google Drive.`);
  // } catch (err) {
  //   console.error(`  Lỗi khi upload ảnh nền "${filename}" lên Google Drive: ${err.message}`);
  // }
}

// An error on 1 quote/1 image is only logged, not blocking the remaining quotes.
async function generateImagesForQuotes(quotes, imageScope, imageTopic, uploadDrive) {
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
      await uploadImageIfRequested(uploadDrive, filename);
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
      await uploadImageIfRequested(uploadDrive, filename);
    } catch (err) {
      console.error(`  Lỗi khi sinh ảnh nền cho quote STT ${q.stt}: ${err.message}`);
    }
  }
}

// Merges the quotes just extracted from 1 video into a script, self-checks its consistency, then
// writes it to the Scripts tab if it passes. Doesn't throw outward — errors in this step are only
// logged, not blocking the video status update (successfully writing quotes to the Sheet is
// already enough to consider the video done).
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

async function runResumeImages(imageScope, imageTopic, uploadDrive) {
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
    await generateImagesForQuotes(quotesOfVideo, imageScope, imageTopic, uploadDrive);
  }

  console.log('\nHoàn tất sinh ảnh còn thiếu.');
}

async function runExtractQuotes(topic, genImages, imageScope, imageTopic, buildScript, scriptTopic, uploadDrive) {
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

    // In case the processing status in the Nguồn Video tab wasn't updated correctly (the
    // previous run failed partway through, after quotes were already written) — also check the
    // Quotes tab to avoid writing duplicate quotes.
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
        await generateImagesForQuotes(createdQuotes, imageScope, imageTopic, uploadDrive);
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

// --stt-video mode: only process exactly 1 video by STT, regardless of processing status. If the
// video already has quotes in the Quotes tab, reuse them instead of calling Gemini again — handy
// for testing just the script-building step with a video that already has quotes (matches the
// Milestone 4b acceptance scenario).
async function runForSingleVideo(sttVideo, topic, genImages, imageScope, imageTopic, buildScript, scriptTopic, uploadDrive) {
  let video;
  try {
    video = await getVideoByStt(sttVideo);
  } catch (err) {
    console.error(err.message);
    return;
  }

  if (!video) {
    console.error(`Không tìm thấy video có STT = ${sttVideo} trong tab "Nguồn Video".`);
    return;
  }

  console.log(`▶ Đang xử lý video STT ${video.stt}: "${video.tieuDe}" (chế độ --stt-video)`);

  try {
    let createdQuotes;
    let daTrichQuoteMoi = false;

    const existingQuotes = await getQuotesByVideoStt(video.stt);

    if (existingQuotes.length > 0) {
      console.log(`  Video đã có sẵn ${existingQuotes.length} quote trong tab Quotes — tái dùng, không trích lại.`);
      createdQuotes = existingQuotes;
    } else {
      const quotes = await extractQuotes(video.link, video.tieuDe, topic);
      console.log(`  Trích được ${quotes.length} quote.`);

      createdQuotes = await appendQuotes(video.stt, quotes);
      console.log('  Đã ghi quote vào tab Quotes.');
      daTrichQuoteMoi = true;
    }

    if (genImages) {
      await generateImagesForQuotes(createdQuotes, imageScope, imageTopic, uploadDrive);
    }

    if (buildScript) {
      await buildAndSaveScript(video, createdQuotes, scriptTopic);
    }

    if (daTrichQuoteMoi) {
      await updateVideoStatus(video.stt, STATUS_DA_TRICH_QUOTE);
      console.log(`  Đã cập nhật trạng thái "${STATUS_DA_TRICH_QUOTE}".`);
    }

    console.log(`\nHoàn tất xử lý video STT ${video.stt}.`);
  } catch (err) {
    console.error(`  Lỗi khi xử lý video STT ${video.stt}: ${err.message}`);
  }
}

async function main() {
  const { topic, genImages, resumeImages, imageScope, imageTopic, buildScript, scriptTopic, sttVideo, uploadDrive } =
    parseArgs(process.argv.slice(2));

  if (resumeImages) {
    console.log('Chế độ --resume-images: chỉ sinh ảnh còn thiếu, không gọi lại Gemini trích quote.');
    await runResumeImages(imageScope, imageTopic, uploadDrive);
    return;
  }

  if (genImages) {
    console.log(
      `Đã bật sinh ảnh nền (--gen-images, image-scope=${imageScope}, image-topic=${imageTopic}) — sẽ gọi thêm Gemini Flash Image.`
    );
    if (uploadDrive) {
      console.log('Đã bật --upload-drive: mỗi ảnh nền sinh xong sẽ được upload lên Google Drive.');
    }
  }

  if (buildScript) {
    console.log(`Đã bật ghép kịch bản (--build-script, script-topic=${scriptTopic}) — sẽ gọi thêm Gemini để ghép + tự kiểm tra script.`);
  }

  if (sttVideo) {
    console.log(`Chế độ --stt-video=${sttVideo}: chỉ xử lý đúng video này.`);
    await runForSingleVideo(sttVideo, topic, genImages, imageScope, imageTopic, buildScript, scriptTopic, uploadDrive);
    return;
  }

  await runExtractQuotes(topic, genImages, imageScope, imageTopic, buildScript, scriptTopic, uploadDrive);
}

main();
