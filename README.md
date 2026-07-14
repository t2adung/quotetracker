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

### Tuỳ chọn dòng lệnh

```bash
node src/index.js --topic=quote           # chọn chủ đề prompt trong src/prompts/ (mặc định "quote")
node src/index.js --gen-images            # bật sinh ảnh nền cho từng quote (mặc định TẮT)
node src/index.js --topic=quote --gen-images
```

- `--topic=<tên>`: chọn file prompt tương ứng trong `src/prompts/` (xem mục bên dưới). Không
  truyền thì mặc định dùng `quote`.
- `--gen-images`: bật bước sinh ảnh nền bằng Gemini 3.1 Flash Image sau khi ghi quote vào Sheet.
  **Mặc định tắt** vì đây là API tính phí riêng (10-15 lần gọi/video) — chỉ thêm cờ này khi đã
  tính toán xong chi phí. Xem điều kiện cần chuẩn bị trước ở mục "Sinh ảnh nền cho quote".

## Xử lý lỗi thường gặp

- **"Google Sheets API has not been used ... or it is disabled"** → chưa bật Google Sheets API
  cho project, xem lại mục Yêu cầu #2 ở trên.
- **"The caller does not have permission"** → chưa share Sheet cho đúng email service account
  với quyền Editor, xem lại mục Yêu cầu #3.
- **"got status: 429 Too Many Requests"** → hết quota Gemini API (free tier giới hạn theo
  phút/ngày). Kiểm tra tại trang Rate Limit của Google AI Studio, đợi quota reset hoặc bật
  billing cho project.
- **"Your prepayment credits are depleted" (code 429, status RESOURCE_EXHAUSTED)** → khác với
  lỗi rate-limit ở trên — đây là hết tiền credit đã nạp trước cho project. Vào
  [AI Studio → Billing](https://ai.studio/projects) để nạp thêm, script không tự retry được lỗi
  này (chỉ retry khi timeout).
- **"This model models/xxx is no longer available"** → Google đã ngừng hỗ trợ model đang dùng.
  Chạy `node scripts/list-gemini-models.js` để lấy đúng danh sách model hiện còn khả dụng cho
  API key của bạn, rồi cập nhật hằng số `MODEL` trong `src/gemini.js`.

## Thư viện prompt theo chủ đề

Prompt gọi Gemini được tách riêng vào `src/prompts/`, mỗi chủ đề 1 file (hiện có `quote.js`).
`gemini.js` gọi `extractQuotes(link, tieuDe, topic)` với `topic` mặc định là `'quote'`. Muốn thêm
chủ đề mới (ví dụ trích 1 loại nội dung khác ngoài quote): tạo file mới trong `src/prompts/`
export `{ build(vars), parse(text) }`, rồi đăng ký vào `TOPICS` trong `src/prompts/index.js`.

Prompt chủ đề `quote` hiện yêu cầu Gemini viết **quote đầu tiên là 1 câu hook tự sáng tác** dựa
trên tiêu đề video (không phải trích nguyên văn) — dạng "hành động/lợi ích cụ thể + mốc tuổi 40",
ví dụ "Nâng cấp bản thân nhanh chóng khi ở tuổi 40 để không hối tiếc", đọc lướt được trong 2-3
giây đầu video. Các quote còn lại vẫn là trích nguyên văn từ video như trước.

## Sinh ảnh nền cho quote (mặc định tắt)

`src/image-gen.js` có hàm `generateBackgroundImage(...)` gọi model `gemini-3.1-flash-image` để
sinh 1 ảnh nền (9:16) theo nội dung quote + phong cách cố định (chỉ hé lộ 1 phần nhỏ của người,
không lộ mặt, tông pastel sáng, chừa khoảng trống để chèn chữ quote sau này), lưu vào
`output/images/quote_XXX.png` (STT quote 3 chữ số, khớp cột STT trong tab Quotes).

Toàn bộ ảnh của **cùng 1 video** dùng chung 1 bối cảnh (chọn ngẫu nhiên trong `SCENE_ANCHORS`),
và mỗi ảnh sau được sinh kèm ảnh ngay trước làm ảnh tham chiếu — để cả chuỗi ảnh giữ đúng nhân
vật/bối cảnh/ánh sáng, chỉ tiến triển nhẹ qua từng khung hình, tạo cảm giác như đang xem 1 đoạn
video chuyển động khi ghép các ảnh lại theo thứ tự quote.

Bước này **mặc định tắt** trong `src/index.js` — chỉ chạy khi bật cờ `--gen-images` trên dòng
lệnh, vì đây là API tính phí riêng, tốn thêm 10-15 lần gọi/video. Khi đã tính chi phí xong và
muốn dùng:
1. Vào Google Sheet thật, thêm cột `image_filename` ở header hàng 3, cột J của tab `Quotes`
   (chưa có sẵn — sheet mẫu ban đầu chỉ có tới cột I)
2. Chạy `node src/index.js --gen-images`
3. Upload hàng loạt các file trong `output/images/` vào thư mục Uploads của Canva; Canva Bulk
   Create sẽ tự khớp ảnh theo tên file trùng với giá trị ở cột `image_filename`

`output/` không được commit vào Git (đã thêm vào `.gitignore`).

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
    ├── image-gen.js            # sinh ảnh nền cho quote (đang tắt, xem mục ở trên)
    ├── config.js
    └── prompts/                # thư viện prompt theo chủ đề
        ├── index.js
        └── quote.js
```
