# quotetracker

Script trích quote hay từ video YouTube bằng Gemini API, ghi kết quả vào Google Sheet trung
tâm, làm nguồn dữ liệu để dựng video ngắn hàng loạt (ví dụ qua Canva Bulk Create).

Xem chi tiết bối cảnh và mục tiêu ở [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md), lộ trình triển
khai từng bước ở [`ROADMAP.md`](./ROADMAP.md), quy ước code cho Claude Code ở
[`CLAUDE.md`](./CLAUDE.md).

## Yêu cầu trước khi chạy

1. **Node.js** bản LTS hiện tại
2. **Google Cloud project** đã **bật Google Sheets API** (Cloud Console → APIs & Services →
   Library → tìm "Google Sheets API" → Enable). Nếu quên bước này, script sẽ báo lỗi dạng
   "Google Sheets API has not been used ... or it is disabled"
3. **Google Cloud Service Account** — tạo trong cùng project, tải file JSON key về. Sau đó mở
   Google Sheet bạn dùng làm kho dữ liệu → **Share** → thêm email service account (dạng
   `xxx@xxx.iam.gserviceaccount.com`) với quyền **Editor**. Nếu quên bước này, script sẽ báo lỗi
   "The caller does not have permission"
4. **Gemini API key** — lấy tại [Google AI Studio](https://aistudio.google.com)

## Setup

```bash
git clone <repo-url>
cd quotetracker
npm install

cp .env.example .env
# mở .env, điền GEMINI_API_KEY, dán nguyên link Google Sheet (hoặc chỉ ID) vào SHEET_ID
# SHEET_TAB_VIDEOS / SHEET_TAB_QUOTES để trống nếu Sheet vẫn giữ đúng tên tab mặc định
# ("Nguồn Video" / "Quotes")

cp service-account.json.example service-account.json
# thay bằng nội dung file JSON thật tải từ Google Cloud Console
```

## Chạy local

```bash
node src/index.js
```

Kết quả: quote mới được ghi vào tab Quotes của Google Sheet, trạng thái ở tab Nguồn Video được
cập nhật tương ứng. Script sẽ log tiến độ từng video; nếu 1 video lỗi, script log lỗi và tiếp
tục video kế tiếp, cuối cùng in tổng kết video nào thành công/lỗi.

## Xử lý lỗi thường gặp

- **"Google Sheets API has not been used ... or it is disabled"** → chưa bật Google Sheets API
  cho project, xem lại mục Yêu cầu #2 ở trên.
- **"The caller does not have permission"** → chưa share Sheet cho đúng email service account
  với quyền Editor, xem lại mục Yêu cầu #3.
- **"got status: 429 Too Many Requests"** → hết quota Gemini API (free tier giới hạn theo
  phút/ngày). Kiểm tra tại trang Rate Limit của Google AI Studio, đợi quota reset hoặc bật
  billing cho project.
- **"This model models/xxx is no longer available"** → Google đã ngừng hỗ trợ model đang dùng.
  Chạy `node scripts/list-gemini-models.js` để lấy đúng danh sách model hiện còn khả dụng cho
  API key của bạn, rồi cập nhật hằng số `MODEL` trong `src/gemini.js`.

## Chạy tự động (GitHub Actions)

Sau khi đã test ổn định ở local (xem Milestone 6 trong `ROADMAP.md`), script có thể chạy tự
động theo lịch qua GitHub Actions — xem log/kết quả tại tab **Actions** của repo trên GitHub.
Có thể bấm "Run workflow" để chạy tay bất cứ lúc nào, không cần chờ lịch.

## Cấu trúc thư mục

```
quotetracker/
├── .env.example
├── .gitignore
├── service-account.json.example
├── PROJECT_BRIEF.md
├── CLAUDE.md
├── ROADMAP.md
├── README.md
├── scripts/
│   └── list-gemini-models.js   # liệt kê model Gemini hiện khả dụng cho API key
└── src/
    ├── index.js
    ├── sheets.js
    ├── gemini.js
    └── config.js
```
