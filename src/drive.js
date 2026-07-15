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

// Upload 1 file MP4 lên thư mục Drive đã cấu hình (GOOGLE_DRIVE_FOLDER_ID), trả về link xem file
// (webViewLink). Không tự đổi quyền chia sẻ — thư mục đã được share sẵn cho service account bởi
// chính chủ sở hữu, nên link mở ra vẫn xem/tải được khi đăng nhập đúng tài khoản Google đó.
async function uploadVideoToDrive(filePath, fileName) {
  if (!config.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error(
      'Thiếu biến môi trường GOOGLE_DRIVE_FOLDER_ID. Tạo 1 thư mục trên Google Drive, share cho ' +
        'email service account (quyền Editor), rồi điền Folder ID vào .env (xem .env.example).'
    );
  }

  try {
    const drive = await getDriveClient();

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [config.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath),
      },
      fields: 'id, webViewLink',
    });

    return res.data.webViewLink;
  } catch (err) {
    throw new Error(`Lỗi khi upload file "${fileName}" lên Google Drive: ${err.message}`);
  }
}

module.exports = { uploadVideoToDrive };
