require('dotenv').config();

const REQUIRED_VARS = ['GEMINI_API_KEY', 'SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_PATH'];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Thiếu biến môi trường: ${missing.join(', ')}. ` +
      'Kiểm tra lại file .env (xem .env.example để biết cần khai báo gì).'
  );
}

function extractSheetId(value) {
  // Accept either the full Google Sheet URL
  // (https://docs.google.com/spreadsheets/d/XXXXX/edit) or just the ID by itself
  const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : value;
}

module.exports = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SHEET_ID: extractSheetId(process.env.SHEET_ID),
  GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  SHEET_TAB_VIDEOS: process.env.SHEET_TAB_VIDEOS || 'Nguồn Video',
  SHEET_TAB_QUOTES: process.env.SHEET_TAB_QUOTES || 'Quotes',
  SHEET_TAB_SCRIPTS: process.env.SHEET_TAB_SCRIPTS || 'Scripts',
  // Not required upfront — only needed when using --upload-drive, validated lazily then
  // (see src/drive.js), so it doesn't block other commands unrelated to Drive.
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  // Service accounts have no storage quota of their own, so they can't create new files in a
  // personal Drive — Drive uploads must use OAuth with your own Google account instead of the
  // service account (see README, "Upload video output lên Google Drive"). These 3 values come
  // from running "node scripts/drive-oauth-login.js" once.
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  GOOGLE_DRIVE_REFRESH_TOKEN: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
};
