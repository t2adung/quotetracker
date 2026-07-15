// One-time interactive script to obtain a Google Drive OAuth refresh token for your OWN Google
// account (not the service account used for Sheets — see src/drive.js for why). Run this once
// locally (needs a browser), then paste the printed refresh token into .env.
//   node scripts/drive-oauth-login.js
require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Thiếu GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET trong .env.\n' +
      'Tạo OAuth Client ID (loại "Desktop app") trong Google Cloud Console → APIs & Services → ' +
      'Credentials, rồi điền Client ID/Secret vào .env trước khi chạy lại script này (xem README).'
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force Google to re-issue a refresh_token even if this account authorized before
  scope: SCOPES,
});

console.log('Mở đường link sau trong trình duyệt, đăng nhập ĐÚNG tài khoản Google muốn dùng để');
console.log('upload video/ảnh lên Drive, rồi bấm "Cho phép" (Allow):\n');
console.log(authUrl);
console.log('\nNếu Google cảnh báo "Ứng dụng chưa xác minh" (unverified app), bấm "Advanced" →');
console.log('"Go to ... (unsafe)" — bình thường vì đây là app cá nhân do chính bạn tạo.\n');
console.log('Đang chờ bạn hoàn tất đăng nhập...');

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, REDIRECT_URI);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Thiếu mã xác thực (code) trong URL redirect</h1>');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Đăng nhập thành công — quay lại terminal để lấy refresh token.</h1>', () => {
      server.close();

      if (!tokens.refresh_token) {
        console.error(
          '\nKhông nhận được refresh_token (Google chỉ cấp lần đầu app này xin quyền).\n' +
            'Vào https://myaccount.google.com/permissions, gỡ quyền của app này rồi chạy lại script.'
        );
        process.exit(1);
      }

      console.log('\nThành công! Dán dòng sau vào file .env:\n');
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      process.exit(0);
    });
  } catch (err) {
    console.error(`\nLỗi khi đổi mã xác thực lấy refresh token: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Lỗi, xem terminal.</h1>', () => {
      server.close();
      process.exit(1);
    });
  }
});

server.listen(PORT);
