const fs = require('fs');
const { google } = require('googleapis');
const config = require('./config');

// Scope hẹp: chỉ cho phép truy cập file do chính app này tạo ra, không xin quyền toàn bộ Drive
// của service account (đúng nguyên tắc bảo mật đã áp dụng cho Sheets ở sheets.js).
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.GOOGLE_SERVICE_ACCOUNT_PATH,
    scopes: [DRIVE_SCOPE],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

function ensureFolderConfigured() {
  if (!config.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error(
      'Thiếu biến môi trường GOOGLE_DRIVE_FOLDER_ID. Tạo 1 thư mục trên Google Drive, share cho ' +
        'email service account (quyền Editor), rồi điền Folder ID vào .env (xem .env.example).'
    );
  }
}

// Upload 1 file (video hoặc ảnh nền) lên thư mục Drive đã cấu hình (GOOGLE_DRIVE_FOLDER_ID), trả
// về link xem file (webViewLink). Không tự đổi quyền chia sẻ — thư mục đã được share sẵn cho
// service account bởi chính chủ sở hữu, nên link mở ra vẫn xem/tải được khi đăng nhập đúng tài
// khoản Google đó.
async function uploadFileToDrive(filePath, fileName, mimeType) {
  ensureFolderConfigured();

  try {
    const drive = await getDriveClient();

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [config.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
      fields: 'id, webViewLink',
    });

    return res.data.webViewLink;
  } catch (err) {
    throw new Error(`Lỗi khi upload file "${fileName}" lên Google Drive: ${err.message}`);
  }
}

async function uploadVideoToDrive(filePath, fileName) {
  return uploadFileToDrive(filePath, fileName, 'video/mp4');
}

async function uploadImageToDrive(filePath, fileName) {
  return uploadFileToDrive(filePath, fileName, 'image/png');
}

// Tìm file theo đúng tên trong thư mục Drive đã cấu hình — ảnh nền và video cùng chung 1 thư mục
// nên chỉ cần lọc theo tên là đủ, không cần thêm cột lưu ID trên Sheet.
async function findFileIdByName(fileName) {
  ensureFolderConfigured();

  try {
    const drive = await getDriveClient();
    const safeFileName = fileName.replace(/'/g, "\\'");

    const res = await drive.files.list({
      q: `name = '${safeFileName}' and '${config.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    const file = (res.data.files || [])[0];
    return file ? file.id : null;
  } catch (err) {
    throw new Error(`Lỗi khi tìm file "${fileName}" trên Google Drive: ${err.message}`);
  }
}

async function downloadFileToPath(fileId, destPath) {
  const drive = await getDriveClient();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    res.data.on('error', reject);
    dest.on('error', reject);
    dest.on('finish', resolve);
    res.data.pipe(dest);
  });
}

// Tìm + tải ảnh nền theo tên file, dùng khi ảnh không có sẵn cục bộ trong output/images/ (ví dụ
// render-quotes.js chạy trên 1 job/máy khác với lúc sinh ảnh bằng --gen-images --upload-drive).
// Trả về true nếu tải thành công, false nếu không tìm thấy trên Drive — không throw cho trường
// hợp không tìm thấy, để nơi gọi tự quyết định bỏ qua quote đó thay vì dừng cả video.
async function downloadImageIfExists(fileName, destPath) {
  const fileId = await findFileIdByName(fileName);
  if (!fileId) return false;

  try {
    await downloadFileToPath(fileId, destPath);
    return true;
  } catch (err) {
    throw new Error(`Lỗi khi tải file "${fileName}" từ Google Drive: ${err.message}`);
  }
}

module.exports = { uploadVideoToDrive, uploadImageToDrive, downloadImageIfExists };
