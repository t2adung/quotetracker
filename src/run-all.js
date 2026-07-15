// Chạy nối tiếp 2 bước: trích quote (src/index.js) rồi dựng video Remotion (src/render-quotes.js)
// — tiện khi muốn làm hết 1 lần thay vì gõ 2 lệnh riêng. Chạy bằng process con (không gộp code)
// để giữ nguyên logic/log của từng bước, không cần sửa gì ở index.js hay render-quotes.js.
//   npm run run:all
//   npm run run:all -- --gen-images --build-script --logo=song.canbang
// Mọi cờ dòng lệnh (--gen-images, --build-script, --logo=...) được chuyển tiếp nguyên vẹn cho cả
// 2 bước — mỗi bước tự bỏ qua cờ nào không liên quan tới mình.
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
