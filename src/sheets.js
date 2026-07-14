const { google } = require('googleapis');
const config = require('./config');

const STATUS_CHUA_XU_LY = 'Chưa xử lý';
const STATUS_QUOTE_CHUA_DUNG = 'Chưa dùng';

// Dữ liệu thật bắt đầu từ hàng 4 (hàng 1: banner hướng dẫn, hàng 3: header)
const VIDEOS_RANGE = `${config.SHEET_TAB_VIDEOS}!A4:I`;
const VIDEOS_STT_RANGE = `${config.SHEET_TAB_VIDEOS}!A4:A`;
const QUOTES_STT_RANGE = `${config.SHEET_TAB_QUOTES}!A4:A`;
const QUOTES_APPEND_RANGE = `${config.SHEET_TAB_QUOTES}!A4:I`;
const VIDEOS_FIRST_DATA_ROW = 4;
const QUOTES_FIRST_DATA_ROW = 4;
// Cột J = "image_filename" (tên file ảnh nền, ví dụ quote_001.png) — cột mới, thêm thủ công
// vào header hàng 3 của tab Quotes trên Google Sheet thật trước khi dùng updateQuoteImageFilename.
const QUOTES_IMAGE_FILENAME_COLUMN = 'J';

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

async function appendQuotes(sttVideo, quotes) {
  try {
    const sheets = await getSheetsClient();

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_STT_RANGE,
    });
    const existingRows = existingRes.data.values || [];
    const lastStt = existingRows.reduce((max, row) => {
      const n = Number(row[0]);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);

    const rows = quotes.map((q, i) => [
      lastStt + i + 1,
      sttVideo,
      q.quote,
      q.context,
      q.timestamp,
      q.hookScore,
      STATUS_QUOTE_CHUA_DUNG,
      '',
      '',
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_APPEND_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    return rows.map((row) => ({ stt: row[0], quote: row[2] }));
  } catch (err) {
    throw new Error(
      `Lỗi khi ghi quote vào tab "${config.SHEET_TAB_QUOTES}" cho video STT ${sttVideo}: ${err.message}`
    );
  }
}

async function updateQuoteImageFilename(stt, filename) {
  try {
    const sheets = await getSheetsClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_STT_RANGE,
    });
    const rows = res.data.values || [];
    const rowOffset = rows.findIndex((row) => String(row[0]) === String(stt));

    if (rowOffset === -1) {
      throw new Error(`Không tìm thấy quote có STT = ${stt} trong tab "${config.SHEET_TAB_QUOTES}"`);
    }

    const sheetRowNumber = rowOffset + QUOTES_FIRST_DATA_ROW;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.SHEET_ID,
      range: `${config.SHEET_TAB_QUOTES}!${QUOTES_IMAGE_FILENAME_COLUMN}${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[filename]] },
    });
  } catch (err) {
    throw new Error(`Lỗi khi ghi tên file ảnh cho quote STT ${stt}: ${err.message}`);
  }
}

async function updateVideoStatus(stt, newStatus) {
  try {
    const sheets = await getSheetsClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: VIDEOS_STT_RANGE,
    });
    const rows = res.data.values || [];
    const rowOffset = rows.findIndex((row) => String(row[0]) === String(stt));

    if (rowOffset === -1) {
      throw new Error(`Không tìm thấy video có STT = ${stt} trong tab "${config.SHEET_TAB_VIDEOS}"`);
    }

    const sheetRowNumber = rowOffset + VIDEOS_FIRST_DATA_ROW;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.SHEET_ID,
      range: `${config.SHEET_TAB_VIDEOS}!F${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newStatus]] },
    });
  } catch (err) {
    throw new Error(`Lỗi khi cập nhật trạng thái cho video STT ${stt}: ${err.message}`);
  }
}

module.exports = { getUnprocessedVideos, appendQuotes, updateVideoStatus, updateQuoteImageFilename };
