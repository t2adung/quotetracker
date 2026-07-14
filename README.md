# quotetracker

Script trích quote hay từ video YouTube bằng Gemini API, ghi kết quả vào Google Sheet trung
tâm, làm nguồn dữ liệu để dựng video ngắn hàng loạt (ví dụ qua Canva Bulk Create).

Xem chi tiết bối cảnh và mục tiêu ở [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md), lộ trình triển
khai từng bước ở [`ROADMAP.md`](./ROADMAP.md), quy ước code cho Claude Code ở
[`CLAUDE.md`](./CLAUDE.md).

## Yêu cầu trước khi chạy

1. **Node.js** bản LTS hiện tại
2. **Google Cloud Service Account** có quyền Google Sheets API, đã được share quyền **Editor**
   vào đúng Google Sheet bạn dùng làm kho dữ liệu
3. **Gemini API key** — lấy tại [Google AI Studio](https://aistudio.google.com)

## Setup

```bash
git clone <repo-url>
cd quotetracker
npm install

cp .env.example .env
# mở .env, điền GEMINI_API_KEY và SHEET_ID

cp service-account.json.example service-account.json
# thay bằng nội dung file JSON thật tải từ Google Cloud Console
```

## Chạy local

```bash
node src/index.js
```

Kết quả: quote mới được ghi vào tab Quotes của Google Sheet, trạng thái ở tab Nguồn Video được
cập nhật tương ứng.

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
└── src/
    ├── index.js
    ├── sheets.js
    ├── gemini.js
    └── config.js
```
