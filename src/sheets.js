const { google } = require('googleapis');
const config = require('./config');

const STATUS_CHUA_XU_LY = 'Chưa xử lý';

// Dữ liệu thật bắt đầu từ hàng 4 (hàng 1: banner hướng dẫn, hàng 3: header)
const VIDEOS_RANGE = `${config.SHEET_TAB_VIDEOS}!A4:I`;

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.GOOGLE_SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function getUnprocessedVideos() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: VIDEOS_RANGE,
    });

    const rows = res.data.values || [];

    return rows
      .filter((row) => row[0] && row[5] === STATUS_CHUA_XU_LY)
      .map((row) => ({
        stt: row[0],
        link: row[1],
        tieuDe: row[2],
        chuDe: row[4],
      }));
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc dữ liệu từ tab "${config.SHEET_TAB_VIDEOS}" trong Google Sheet: ${err.message}`
    );
  }
}

module.exports = { getUnprocessedVideos };
