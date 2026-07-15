const fs = require('fs');
const { google } = require('googleapis');
const config = require('./config');

// IMPORTANT: Drive uploads must use OAuth with your own Google account, NOT the service account
// used for Sheets — service accounts have zero storage quota of their own, so they cannot create
// new files in a personal (non-Workspace) Drive even when given Editor access to a folder. Run
// "node scripts/drive-oauth-login.js" once to obtain a refresh token (see README).
function getOAuthClient() {
  if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET || !config.GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error(
      'Thiếu GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN trong ' +
        '.env. Chạy "node scripts/drive-oauth-login.js" 1 lần để lấy các giá trị này (xem README ' +
        'mục "Upload video output lên Google Drive").'
    );
  }

  const oauth2Client = new google.auth.OAuth2(config.GOOGLE_OAUTH_CLIENT_ID, config.GOOGLE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: config.GOOGLE_DRIVE_REFRESH_TOKEN });
  return oauth2Client;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getOAuthClient() });
}

function ensureFolderConfigured() {
  if (!config.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error(
      'Thiếu biến môi trường GOOGLE_DRIVE_FOLDER_ID. Tạo 1 thư mục trên Google Drive của bạn, lấy ' +
        'Folder ID trong URL rồi điền vào .env (xem .env.example).'
    );
  }
}

// Upload 1 file (video or image) to the configured Drive folder (GOOGLE_DRIVE_FOLDER_ID),
// returning a link to view the file (webViewLink). The file is owned by whichever Google account
// completed the OAuth login, so the link opens fine as long as you're signed into that account.
async function uploadFileToDrive(filePath, fileName, mimeType) {
  ensureFolderConfigured();

  try {
    const drive = getDriveClient();

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

// Find a file by exact name in the configured Drive folder — images and videos share the same
// folder, so filtering by name alone is enough, no need for an extra ID column on the Sheet.
async function findFileIdByName(fileName) {
  ensureFolderConfigured();

  try {
    const drive = getDriveClient();
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
  const drive = getDriveClient();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    res.data.on('error', reject);
    dest.on('error', reject);
    dest.on('finish', resolve);
    res.data.pipe(dest);
  });
}

// Find + download a background image by file name, used when the image isn't available locally
// in output/images/ (e.g. render-quotes.js running on a different job/machine than the one that
// generated the image via --gen-images --upload-drive). Returns true on success, false if not
// found on Drive — doesn't throw for the not-found case, letting the caller decide to skip that
// quote instead of stopping the whole video.
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
