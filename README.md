# quotetracker

Script trích quote hay từ video YouTube bằng Gemini API, ghi kết quả vào Google Sheet trung
tâm, làm nguồn dữ liệu để dựng video ngắn hàng loạt bằng Remotion (`npm run render:quotes`,
xem mục "Dựng video bằng Remotion" bên dưới).

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
node src/index.js --gen-images --image-scope=video   # chỉ sinh 1 ảnh dùng chung cho cả video
node src/index.js --gen-images --image-topic=quote   # chọn style ảnh trong src/image-prompts/
node src/index.js --resume-images         # chỉ sinh bù ảnh còn thiếu, không trích quote lại
node src/index.js --gen-images --upload-drive         # kèm upload từng ảnh nền lên Google Drive
```

- `--topic=<tên>`: chọn file prompt tương ứng trong `src/prompts/` (xem mục "Thư viện prompt
  theo chủ đề" bên dưới). Không truyền thì mặc định dùng `quote`.
- `--gen-images`: bật bước sinh ảnh nền bằng Gemini Flash Image (xem model đang dùng ở
  `IMAGE_MODEL` trong `src/image-gen.js`) sau khi ghi quote vào Sheet.
  **Mặc định tắt** vì đây là API tính phí riêng (10-15 lần gọi/video) — chỉ thêm cờ này khi đã
  tính toán xong chi phí. Xem điều kiện cần chuẩn bị trước ở mục "Sinh ảnh nền cho quote".
- `--image-scope=quote|video`: chọn sinh 1 ảnh/quote (mặc định `quote`, xem mục bên dưới) hay chỉ
  1 ảnh duy nhất dùng chung cho tất cả quote của cùng 1 video (`video`) — cùng 1 file
  `image_filename` sẽ được ghi cho mọi dòng quote thuộc video đó, tốn ít lệnh gọi Gemini Flash
  Image hơn hẳn. Chỉ có tác dụng khi đi kèm `--gen-images` hoặc `--resume-images`.
- `--image-topic=<tên>`: chọn file style ảnh tương ứng trong `src/image-prompts/` (tương tự
  `--topic` cho prompt text, xem mục "Thư viện style ảnh theo chủ đề" bên dưới). Không truyền thì
  mặc định dùng `quote`. Chỉ có tác dụng khi đi kèm `--gen-images` hoặc `--resume-images`.
- `--resume-images`: dùng khi lần chạy trước bị lỗi/hết quota giữa chừng lúc sinh ảnh (ví dụ hết
  prepayment credits ở giữa 1 video). Cờ này **đọc thẳng các quote đã có sẵn trong tab Quotes**,
  tìm quote nào cột `image_filename` còn trống rồi sinh bù, gom theo từng video để giữ đúng bối
  cảnh/tính tuần tự (hoặc chỉ 1 ảnh nếu dùng kèm `--image-scope=video`) — **không gọi lại Gemini
  để trích quote**, nên không tốn thêm token cho phần đã trích xong. Bỏ qua `--topic` khi dùng
  cờ này.
- `--upload-drive`: đi kèm `--gen-images` hoặc `--resume-images` — mỗi ảnh nền sinh xong sẽ được
  upload luôn lên thư mục Google Drive đã cấu hình (`GOOGLE_DRIVE_FOLDER_ID`, xem mục "Upload
  video output lên Google Drive" bên dưới — dùng chung 1 thư mục cho cả ảnh lẫn video, tên file
  đã phân biệt rõ). Lỗi upload 1 ảnh chỉ log lại, không chặn các ảnh/quote còn lại. Cần setup
  Drive trước (xem mục dưới) trước khi dùng cờ này.

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
- **`npm run render:quotes` không render được ảnh nền / báo lỗi tải Chrome** → lần đầu chạy,
  Remotion cần tải về 1 bản Chrome headless riêng qua mạng, đảm bảo máy có kết nối internet bình
  thường (không qua proxy chặn). Nếu báo "Không tìm thấy ảnh nền" cho 1 quote cụ thể → kiểm tra
  file tương ứng có tồn tại trong `output/images/` không (phải chạy `--gen-images` trước).

## Thư viện prompt theo chủ đề

Prompt gọi Gemini được tách riêng vào `src/prompts/`, mỗi chủ đề 1 file (hiện có `quote.js`).
`gemini.js` gọi `extractQuotes(link, tieuDe, topic)` với `topic` mặc định là `'quote'`. Muốn thêm
chủ đề mới (ví dụ trích 1 loại nội dung khác ngoài quote): tạo file mới trong `src/prompts/`
export `{ build(vars), parse(text) }`, rồi đăng ký vào `TOPICS` trong `src/prompts/index.js`.

Prompt chủ đề `quote` hiện yêu cầu Gemini viết **quote đầu tiên là 1 câu hook tự sáng tác** dựa
trên tiêu đề video (không phải trích nguyên văn) — dạng "hành động/lợi ích cụ thể + mốc tuổi 40",
ví dụ "Nâng cấp bản thân nhanh chóng khi ở tuổi 40 để không hối tiếc", đọc lướt được trong 2-3
giây đầu video. Các quote còn lại vẫn giữ đúng lời đã nói trong video, nhưng được phép **ghép
thêm ý liền kề** (không bịa thêm nội dung ngoài video) để mỗi quote đủ trọn 1 ý, khoảng 80-200 ký
tự — tránh vừa cụt lủn/khó hiểu khi tách khỏi video, vừa không dài tới mức tràn khung hình lúc
render video.

## Thư viện style ảnh theo chủ đề

Style/prompt sinh ảnh được tách riêng vào `src/image-prompts/`, mỗi chủ đề 1 file (hiện có
`quote.js`) export `{ styleSuffix, sceneAnchors }` — song song với `src/prompts/` cho prompt
text. `image-gen.js` gọi qua `topic` (mặc định `'quote'`), chọn được bằng cờ `--image-topic=`.
Muốn thêm chủ đề ảnh mới (ví dụ 1 phong cách hình khác cho 1 loại nội dung khác): tạo file mới
trong `src/image-prompts/` export `{ styleSuffix, sceneAnchors }`, rồi đăng ký vào `TOPICS`
trong `src/image-prompts/index.js`.

## Sinh ảnh nền cho quote (mặc định tắt)

`src/image-gen.js` có hàm `generateBackgroundImage(...)` gọi model Gemini Flash Image (hằng số
`IMAGE_MODEL`, hiện đang tạm dùng `gemini-2.5-flash-image`, sẽ đổi sang `gemini-3.1-flash-image`
sau khi hết hạn dùng thử) để sinh 1 ảnh nền (9:16) theo nội dung quote + phong cách cố định (xem
`src/image-prompts/quote.js`): 1 tấm ảnh thật liền mạch (không phải ảnh ghép hay có mảng màu đặc
rời rạc chèn vào khung hình), người (nếu có) là người châu Á (ưu tiên Việt Nam), chiếm khoảng
1/4 khung hình — không bị cắt cụt chỉ còn tay/vai, thường đang làm 1 hành động đời thường như
nấu ăn/vẽ tranh/đi dạo, không lộ mặt, tông pastel sáng, và **không chèn bất kỳ chữ/text nào vào
ảnh**. Ảnh lưu vào `output/images/quote_XXX.png` (STT quote 3 chữ số, khớp cột STT trong tab
Quotes).

Mặc định (`--image-scope=quote`), toàn bộ ảnh của **cùng 1 video** dùng chung 1 bối cảnh/hành
động (chọn ngẫu nhiên trong `sceneAnchors` của chủ đề ảnh đang dùng), và mỗi ảnh sau được sinh
kèm ảnh ngay trước làm ảnh tham chiếu — để cả chuỗi ảnh giữ đúng nhân vật/bối cảnh/ánh sáng, chỉ
tiến triển nhẹ qua từng khung hình, tạo cảm giác như đang xem 1 đoạn video chuyển động khi ghép
các ảnh lại theo thứ tự quote. Dùng `--image-scope=video` nếu chỉ muốn 1 ảnh duy nhất đại diện
cho cả video, áp dụng chung cho mọi quote của video đó.

Bước này **mặc định tắt** trong `src/index.js` — chỉ chạy khi bật cờ `--gen-images` trên dòng
lệnh, vì đây là API tính phí riêng, tốn thêm 10-15 lần gọi/video. Khi đã tính chi phí xong và
muốn dùng:
1. Vào Google Sheet thật, thêm cột `image_filename` ở header hàng 3, cột J của tab `Quotes`
   (chưa có sẵn — sheet mẫu ban đầu chỉ có tới cột I)
2. Chạy `node src/index.js --gen-images`
3. Chạy tiếp `npm run render:quotes` (xem mục "Dựng video bằng Remotion" bên dưới) để dựng
   video MP4 từ các quote đã có ảnh nền

`output/` không được commit vào Git (đã thêm vào `.gitignore`).

## Chạy nối tiếp trích quote + dựng video (1 lệnh)

```bash
npm run run:all
npm run run:all -- --gen-images --build-script --logo=song.canbang
```

`src/run-all.js` chạy nối tiếp `node src/index.js` rồi `node src/render-quotes.js` (2 process
con riêng, không gộp code) — tiện khi muốn làm hết 1 lần thay vì gõ 2 lệnh. Mọi cờ dòng lệnh được
chuyển tiếp cho cả 2 bước, mỗi bước tự bỏ qua cờ không liên quan tới mình. Nếu bước trích quote
lỗi (thoát mã khác 0), bước dựng video sẽ **không** chạy tiếp.

## Dựng video bằng Remotion

Sau khi quote đã có ảnh nền (cột `image_filename` ở tab `Quotes` không trống — xem mục trên),
dựng video ngắn (MP4, 1080x1920) bằng [Remotion](https://www.remotion.dev), thay cho việc thao
tác tay qua Canva Bulk Create ở kế hoạch ban đầu (xem Milestone 5b ở `ROADMAP.md` để biết lý do
đổi hướng).

```bash
npm run render:quotes
npm run render:quotes -- --logo=song.canbang   # kèm badge "@song.canbang sưu tầm" trong video
npm run render:quotes -- --upload-drive        # upload video lên Google Drive + ghi link vào Sheet
```

Script (`src/render-quotes.js`) sẽ:
1. Đọc tab `Quotes`, lọc các quote có Trạng thái sử dụng = "Chưa dùng" **và** đã có
   `image_filename`, rồi **gom theo cột "STT Video nguồn"**
2. Với mỗi video nguồn, ghép các quote cùng video thành **1 file MP4 duy nhất**, phát nối tiếp
   nhau, đặt tên theo STT Video nguồn (ví dụ `output/video_003.mp4`). Quote đầu tiên của mỗi
   video được hiểu là **title**, hiển thị to/đậm hơn hẳn các quote còn lại. Quote hiển thị ở
   **phía trên khung hình** (không phải giữa trang), trong khối có background mờ (blur) + chữ có
   viền đen (text-stroke) để luôn nổi rõ trên mọi ảnh nền, fade-in nhẹ. Cột "Bối cảnh/ý nghĩa"
   không hiển thị trong video — chỉ dùng nội bộ lúc trích quote. **Thời lượng mỗi slide được tính
   động theo đúng độ dài quote** (xem `src/timing.js`, tốc độ đọc lướt ~3 từ/giây, chặn trong
   khoảng 3-8 giây/slide, riêng slide title cộng thêm ~1 giây để bắt nhịp video) — quote dài hiện
   lâu hơn, quote ngắn hiện nhanh hơn, không cố định 4-5 giây/slide như trước
3. Nếu bật cờ `--logo=<tên>` → hiện badge `@<tên> sưu tầm` ở dưới khung trong suốt video (mặc
   định không hiện gì nếu không truyền cờ)
4. Nếu 1 quote lỗi (ví dụ ảnh nền không tồn tại trong `output/images/`) → bỏ qua đúng quote đó,
   vẫn ghép các quote còn lại của cùng video; nếu cả video không còn quote nào đủ ảnh → log lỗi,
   bỏ qua cả video, tiếp tục video kế tiếp, không dừng cả vòng lặp
5. Sau khi render xong, tự cập nhật Trạng thái sử dụng thành "Đã dùng" cho các quote **đã được
   đưa vào video render thành công** trên Google Sheet (quote bị bỏ qua vẫn giữ nguyên
   "Chưa dùng" để chạy lại lần sau)

Lần chạy đầu tiên, Remotion sẽ tự tải về 1 bản Chrome headless riêng (khác Chrome cài sẵn trên
máy) để render — cần có mạng, chỉ tải 1 lần.

## Upload video output lên Google Drive (tuỳ chọn, mặc định tắt)

Vì `output/` không được commit vào Git (và sẽ mất trắng sau mỗi lần chạy trên GitHub Actions —
runner là máy tạm), có thể upload thẳng video vừa render lên 1 thư mục Google Drive cố định rồi
ghi link vào cột **"Link video output"** (cột H, tab `Quotes` — cột này cũ vốn để cho Canva,
giờ không dùng nữa nên tái dùng luôn).

**Quan trọng — Service Account KHÔNG dùng để upload Drive được**: Service Account không có dung
lượng lưu trữ riêng, nên dù đã share thư mục với quyền Editor, nó vẫn không tự tạo file mới được
trong Drive cá nhân (lỗi `Service Accounts do not have storage quota`). Vì vậy upload Drive phải
xác thực bằng OAuth qua chính tài khoản Google của bạn (Sheets vẫn dùng service account như cũ,
không đổi gì — vì Sheets không tạo file mới, không bị giới hạn này).

Setup 1 lần:
1. Vào [Google Cloud Console](https://console.cloud.google.com) → cùng project đang dùng cho
   Sheets API → bật thêm **Google Drive API**
2. Vẫn trong Cloud Console → **APIs & Services → OAuth consent screen** → tạo consent screen loại
   **External**, thêm chính email Google của bạn vào mục **Test users**
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → chọn loại
   **Desktop app** → lấy **Client ID** và **Client Secret**, điền vào `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```
4. Chạy `npm run drive:login`, làm theo hướng dẫn trên terminal (mở link, đăng nhập đúng tài
   khoản Google muốn dùng, bấm "Cho phép" — nếu Google cảnh báo "unverified app" thì bấm
   "Advanced" → "Go to ... (unsafe)", bình thường vì đây là app cá nhân do chính bạn tạo). Terminal
   sẽ in ra dòng cần dán vào `.env`:
   ```
   GOOGLE_DRIVE_REFRESH_TOKEN=...
   ```
5. **Publish app** (khuyến nghị): OAuth consent screen → bấm **Publish App** để chuyển từ
   "Testing" sang "In production" — nếu bỏ qua bước này, refresh token sẽ **hết hạn sau 7 ngày**
   và cần chạy lại `npm run drive:login`, gây gián đoạn khi chạy tự động trên GitHub Actions
6. Tạo 1 thư mục bất kỳ trên Google Drive của bạn, lấy Folder ID trong URL thư mục
   (`https://drive.google.com/drive/folders/XXXXX` → `XXXXX`), điền vào `.env`:
   ```
   GOOGLE_DRIVE_FOLDER_ID=XXXXX
   ```

Dùng:
```bash
npm run render:quotes -- --upload-drive
```

Script sẽ upload từng video vừa render thành công vào thư mục trên, rồi ghi cùng 1 link đó vào
cột H cho mọi quote đã được ghép vào video đó. Không tự đổi quyền chia sẻ file (không public) —
vì thư mục vốn thuộc Drive của bạn nên mở link lên vẫn xem/tải được khi đăng nhập đúng tài khoản
Google đó. Nếu 1 video upload lỗi (mất mạng, hết quota...) → log lỗi, bỏ qua video đó (không ghi
link), vẫn tiếp tục các video khác, Trạng thái sử dụng của quote vẫn được cập nhật bình thường dù
upload lỗi.

**Ảnh nền cũng upload được lên cùng thư mục này** — dùng `--upload-drive` kèm `--gen-images`
(xem mục "Tuỳ chọn dòng lệnh" ở trên). Khi `npm run render:quotes` không tìm thấy ảnh nền cục bộ
trong `output/images/` (ví dụ chạy trên máy/job khác với lúc sinh ảnh), script sẽ **tự tìm và
tải ảnh đó về từ Drive theo đúng tên file** trước khi bỏ qua quote — chỉ thử khi đã cấu hình
`GOOGLE_DRIVE_FOLDER_ID`, không cần thêm bước thủ công nào. Nhờ vậy có thể chạy `--gen-images
--upload-drive` và `render:quotes` ở 2 lần riêng biệt (kể cả trên 2 job GitHub Actions khác nhau)
mà không cần sinh lại ảnh.

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
│   ├── list-gemini-models.js   # liệt kê model Gemini hiện khả dụng cho API key
│   └── drive-oauth-login.js    # lấy Google Drive refresh token (chạy 1 lần, xem mục Drive ở trên)
└── src/
    ├── index.js
    ├── sheets.js
    ├── gemini.js
    ├── image-gen.js            # sinh ảnh nền cho quote (đang tắt, xem mục ở trên)
    ├── render-quotes.js        # dựng video MP4 bằng Remotion, xem mục "Dựng video bằng Remotion"
    ├── drive.js                # upload/tải video + ảnh nền qua Google Drive (đang tắt, xem mục ở trên)
    ├── config.js
    ├── remotion/                # composition Remotion + Root đăng ký composition
    │   ├── index.jsx
    │   ├── Root.jsx
    │   ├── VideoSequence.jsx    # ghép nhiều quote cùng "STT Video nguồn" thành 1 video
    │   └── QuoteVideo.jsx       # 1 slide/quote (dùng bên trong VideoSequence)
    └── prompts/                # thư viện prompt theo chủ đề
        ├── index.js
        └── quote.js
```
