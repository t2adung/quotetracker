require('./config');
const { getUnprocessedVideos } = require('./sheets');

console.log('Config OK');

async function main() {
  try {
    const videos = await getUnprocessedVideos();
    console.log(`Tìm thấy ${videos.length} video chưa xử lý:`);
    console.log(videos);
  } catch (err) {
    console.error(err.message);
  }
}

main();
