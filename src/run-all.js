// Runs 2 steps back to back: extract quotes (src/index.js) then render the Remotion video
// (src/render-quotes.js) — handy for doing everything in 1 go instead of typing 2 separate
// commands. Runs each as a child process (not merged code) to keep each step's logic/logging
// intact, with no changes needed to index.js or render-quotes.js.
//   npm run run:all
//   npm run run:all -- --gen-images --build-script --logo=song.canbang
// Every command-line flag (--gen-images, --build-script, --logo=...) is forwarded as-is to both
// steps — each step ignores whichever flags don't apply to it.
const { spawnSync } = require('child_process');
const path = require('path');

const INDEX_SCRIPT = path.join(__dirname, 'index.js');
const RENDER_SCRIPT = path.join(__dirname, 'render-quotes.js');

function runStep(scriptPath, label) {
  console.log(`\n========== ${label} ==========`);
  const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  return result.status === 0;
}

function main() {
  const trichOk = runStep(INDEX_SCRIPT, 'Bước 1/2: Trích quote');

  if (!trichOk) {
    console.error('\nBước trích quote bị lỗi (thoát với mã lỗi khác 0) — bỏ qua bước dựng video.');
    process.exitCode = 1;
    return;
  }

  const renderOk = runStep(RENDER_SCRIPT, 'Bước 2/2: Dựng video bằng Remotion');
  if (!renderOk) {
    process.exitCode = 1;
  }
}

main();
