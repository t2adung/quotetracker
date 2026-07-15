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
  // Cho phép dán nguyên link Google Sheet
  // (https://docs.google.com/spreadsheets/d/XXXXX/edit) hoặc chỉ dán riêng phần ID
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
};
