const { google } = require('googleapis');
const config = require('./config');

const STATUS_CHUA_XU_LY = 'Chưa xử lý';
const STATUS_QUOTE_CHUA_DUNG = 'Chưa dùng';
const STATUS_QUOTE_DA_DUNG = 'Đã dùng';
const STATUS_SCRIPT_CHUA_DUNG = 'Chưa dùng';
const STATUS_SCRIPT_DA_DUNG = 'Đã dùng';

// Dữ liệu thật bắt đầu từ hàng 4 (hàng 1: banner hướng dẫn, hàng 3: header)
const VIDEOS_RANGE = `${config.SHEET_TAB_VIDEOS}!A4:I`;
const VIDEOS_STT_RANGE = `${config.SHEET_TAB_VIDEOS}!A4:A`;
const QUOTES_STT_RANGE = `${config.SHEET_TAB_QUOTES}!A4:A`;
const QUOTES_VIDEO_STT_RANGE = `${config.SHEET_TAB_QUOTES}!A4:B`;
const QUOTES_APPEND_RANGE = `${config.SHEET_TAB_QUOTES}!A4:I`;
const QUOTES_FULL_RANGE = `${config.SHEET_TAB_QUOTES}!A4:J`;
const VIDEOS_FIRST_DATA_ROW = 4;
const QUOTES_FIRST_DATA_ROW = 4;
// Cột J = "image_filename" (tên file ảnh nền, ví dụ quote_001.png) — cột mới, thêm thủ công
// vào header hàng 3 của tab Quotes trên Google Sheet thật trước khi dùng updateQuoteImageFilename.
const QUOTES_IMAGE_FILENAME_COLUMN = 'J';
// Cột G = "Trạng thái sử dụng"
const QUOTES_STATUS_COLUMN = 'G';

// Tab Scripts (mới) — cột: A STT Script, B STT Video nguồn, C Quote IDs đã dùng,
// D Full Script, E Segments (JSON dạng text), F Trạng thái. Cần tự tạo tab này thủ công
// trên Google Sheet thật trước khi dùng các hàm bên dưới.
const SCRIPTS_STT_RANGE = `${config.SHEET_TAB_SCRIPTS}!A4:A`;
const SCRIPTS_FULL_RANGE = `${config.SHEET_TAB_SCRIPTS}!A4:F`;
const SCRIPTS_APPEND_RANGE = `${config.SHEET_TAB_SCRIPTS}!A4:F`;
const SCRIPTS_FIRST_DATA_ROW = 4;
// Cột F = "Trạng thái"
const SCRIPTS_STATUS_COLUMN = 'F';

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

// Đọc 1 video theo đúng STT, BẤT KỂ Trạng thái xử lý — dùng cho chế độ --stt-video để nhắm vào
// đúng 1 video cụ thể (kể cả video đã xử lý xong rồi), khác với getUnprocessedVideos() chỉ trả
// về video có Trạng thái xử lý = "Chưa xử lý". Trả về null nếu không tìm thấy STT.
async function getVideoByStt(stt) {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: VIDEOS_RANGE,
    });

    const rows = res.data.values || [];
    const row = rows.find((r) => r[0] && String(r[0]) === String(stt));

    if (!row) return null;

    return { stt: row[0], link: row[1], tieuDe: row[2], chuDe: row[4] };
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc video STT ${stt} từ tab "${config.SHEET_TAB_VIDEOS}": ${err.message}`
    );
  }
}

// Đọc toàn bộ quote ĐÃ CÓ SẴN của 1 video (theo STT Video nguồn) trong tab Quotes — dùng cho chế
// độ --stt-video khi video đã có quote sẵn, để tái dùng thay vì gọi lại Gemini trích quote.
async function getQuotesByVideoStt(sttVideo) {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_FULL_RANGE,
    });

    const rows = res.data.values || [];

    return rows
      .filter((row) => row[0] && String(row[1]) === String(sttVideo))
      .map((row) => ({ stt: row[0], quote: row[2] }));
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc quote của video STT ${sttVideo} từ tab "${config.SHEET_TAB_QUOTES}": ${err.message}`
    );
  }
}

// Trả về 1 Set các "STT Video nguồn" đã có ít nhất 1 quote trong tab Quotes — dùng để bỏ qua
// video đã có quote rồi (phòng trường hợp Trạng thái xử lý ở tab Nguồn Video chưa kịp cập nhật
// đúng do lần chạy trước bị lỗi giữa chừng), tránh ghi trùng quote cho cùng 1 video.
async function getSttVideosWithQuotes() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_VIDEO_STT_RANGE,
    });

    const rows = res.data.values || [];

    return new Set(rows.filter((row) => row[0]).map((row) => String(row[1])));
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc danh sách video đã có quote từ tab "${config.SHEET_TAB_QUOTES}": ${err.message}`
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

async function getQuotesMissingImages() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_FULL_RANGE,
    });

    const rows = res.data.values || [];

    return rows
      .filter((row) => row[0] && !row[9]) // cột J (image_filename) trống = chưa sinh ảnh
      .map((row) => ({ stt: row[0], sttVideo: row[1], quote: row[2] }));
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc quote còn thiếu ảnh từ tab "${config.SHEET_TAB_QUOTES}": ${err.message}`
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

async function getQuotesReadyToRender() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: QUOTES_FULL_RANGE,
    });

    const rows = res.data.values || [];

    return rows
      .filter((row) => row[0] && row[6] === STATUS_QUOTE_CHUA_DUNG && row[9])
      .map((row) => ({
        stt: row[0],
        sttVideo: row[1],
        quote: row[2],
        imageFilename: row[9],
      }));
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc quote sẵn sàng render từ tab "${config.SHEET_TAB_QUOTES}": ${err.message}`
    );
  }
}

async function updateQuoteStatus(stt, newStatus) {
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
      range: `${config.SHEET_TAB_QUOTES}!${QUOTES_STATUS_COLUMN}${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newStatus]] },
    });
  } catch (err) {
    throw new Error(`Lỗi khi cập nhật trạng thái sử dụng cho quote STT ${stt}: ${err.message}`);
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

async function getScriptsToProcess() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: SCRIPTS_FULL_RANGE,
    });

    const rows = res.data.values || [];

    return rows
      .filter((row) => row[0] && row[5] === STATUS_SCRIPT_CHUA_DUNG)
      .map((row) => {
        let segments = [];
        try {
          segments = JSON.parse(row[4] || '[]');
        } catch (err) {
          console.error(
            `Lỗi khi đọc segments (JSON) của script STT ${row[0]}, bỏ qua segments: ${err.message}`
          );
        }

        return {
          sttScript: row[0],
          sttVideo: row[1],
          quoteIds: row[2],
          fullScript: row[3],
          segments,
        };
      });
  } catch (err) {
    throw new Error(
      `Lỗi khi đọc dữ liệu từ tab "${config.SHEET_TAB_SCRIPTS}" trong Google Sheet: ${err.message}`
    );
  }
}

async function appendScript(sttVideo, quoteIds, fullScript, segments) {
  try {
    const sheets = await getSheetsClient();

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: SCRIPTS_STT_RANGE,
    });
    const existingRows = existingRes.data.values || [];
    const lastStt = existingRows.reduce((max, row) => {
      const n = Number(row[0]);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);

    const sttScript = lastStt + 1;
    const row = [
      sttScript,
      sttVideo,
      quoteIds.join(', '),
      fullScript,
      JSON.stringify(segments),
      STATUS_SCRIPT_CHUA_DUNG,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.SHEET_ID,
      range: SCRIPTS_APPEND_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return { sttScript, sttVideo, fullScript };
  } catch (err) {
    throw new Error(
      `Lỗi khi ghi script vào tab "${config.SHEET_TAB_SCRIPTS}" cho video STT ${sttVideo}: ${err.message}`
    );
  }
}

async function updateScriptStatus(sttScript, newStatus) {
  try {
    const sheets = await getSheetsClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID,
      range: SCRIPTS_STT_RANGE,
    });
    const rows = res.data.values || [];
    const rowOffset = rows.findIndex((row) => String(row[0]) === String(sttScript));

    if (rowOffset === -1) {
      throw new Error(
        `Không tìm thấy script có STT = ${sttScript} trong tab "${config.SHEET_TAB_SCRIPTS}"`
      );
    }

    const sheetRowNumber = rowOffset + SCRIPTS_FIRST_DATA_ROW;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.SHEET_ID,
      range: `${config.SHEET_TAB_SCRIPTS}!${SCRIPTS_STATUS_COLUMN}${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newStatus]] },
    });
  } catch (err) {
    throw new Error(`Lỗi khi cập nhật trạng thái cho script STT ${sttScript}: ${err.message}`);
  }
}

module.exports = {
  getUnprocessedVideos,
  getVideoByStt,
  getQuotesByVideoStt,
  getSttVideosWithQuotes,
  appendQuotes,
  updateVideoStatus,
  updateQuoteImageFilename,
  getQuotesMissingImages,
  getQuotesReadyToRender,
  updateQuoteStatus,
  getScriptsToProcess,
  appendScript,
  updateScriptStatus,
  STATUS_QUOTE_DA_DUNG,
  STATUS_SCRIPT_DA_DUNG,
};
