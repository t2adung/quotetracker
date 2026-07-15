# ROADMAP.md — quotetracker

Làm tuần tự từng milestone. Sau mỗi milestone, dừng lại và xác nhận trước khi tiếp tục.

## Milestone 0 — Khởi tạo repo (trước khi mở Claude Code)
Việc của bạn (Dung), làm thủ công trước:
- [ ] Tạo Google Cloud project riêng cho việc này (hoặc dùng chung project sẵn có)
- [ ] Bật Google Sheets API cho project đó
- [ ] Tạo Service Account, tải file JSON key
- [ ] Mở Google Sheet hiện tại → Share → thêm email của service account (dạng
      `xxx@xxx.iam.gserviceaccount.com`) với quyền **Editor**
- [ ] Lấy Gemini API key từ Google AI Studio
- [ ] Clone repo `quotetracker` về máy, copy 3 file `PROJECT_BRIEF.md`, `CLAUDE.md`,
      `ROADMAP.md` vào thư mục gốc, commit + push
- [ ] Mở Claude Code tại thư mục repo này

## Milestone 1 — Project skeleton
Mục tiêu: repo chạy được `node src/index.js` mà không lỗi (chưa cần logic thật).
- [ ] `package.json` với `googleapis`, `@google/genai`, `dotenv`
- [ ] `.gitignore` (bao gồm `.env`, `service-account.json`, `node_modules`)
- [ ] `.env.example` liệt kê: `GEMINI_API_KEY`, `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_PATH`
- [ ] `src/config.js` đọc `.env`, validate đủ biến, throw lỗi rõ ràng nếu thiếu
- [ ] `src/index.js` chỉ in ra "Config OK" nếu đọc `.env` thành công

**Nghiệm thu**: chạy `node src/index.js` in ra "Config OK", không crash.

## Milestone 2 — Đọc dữ liệu từ Google Sheet
Mục tiêu: đọc được tab `Nguồn Video`, lọc đúng các dòng có Trạng thái xử lý = "Chưa xử lý".
- [ ] `src/sheets.js`: hàm `getUnprocessedVideos()` trả về mảng object
      `{ stt, link, tieuDe, chuDe }`
- [ ] Test bằng cách in ra console danh sách video chưa xử lý

**Nghiệm thu**: chạy script, thấy đúng danh sách video khớp với Sheet thật (kể cả khi Sheet
trống — không được crash, chỉ in mảng rỗng).

## Milestone 3 — Gọi Gemini API trích quote
Mục tiêu: với 1 link YouTube, gọi Gemini trả về JSON quote hợp lệ.
- [ ] `src/gemini.js`: hàm `extractQuotes(youtubeUrl, tieuDe)` trả về mảng
      `{ quote, context, timestamp, hookScore }`
- [ ] Prompt yêu cầu model trả CHỈ JSON, có xử lý trường hợp model trả kèm text thừa
      (parse an toàn, không crash nếu JSON lỗi)
- [ ] Test độc lập với 1 link thật, in kết quả ra console để kiểm tra bằng mắt

**Nghiệm thu**: chạy thử với link video Tuổi 40 đã dùng trước đó, ra ít nhất 8-10 quote hợp lý.

## Milestone 4 — Ghi kết quả vào Google Sheet
Mục tiêu: nối M2 + M3 + ghi vào tab `Quotes`, cập nhật trạng thái ở tab `Nguồn Video`.
- [ ] `src/sheets.js`: thêm hàm `appendQuotes(sttVideo, quotes)` và
      `updateVideoStatus(stt, newStatus)`
- [ ] `src/index.js`: vòng lặp qua từng video chưa xử lý → gọi Gemini → ghi Sheet → cập nhật
      trạng thái → log tiến độ ra console mỗi bước

**Nghiệm thu**: chạy toàn bộ end-to-end với ít nhất 1 video thật, kiểm tra bằng mắt trên Google
Sheet thấy đúng dữ liệu ở cả 2 tab.

## Milestone 5 — Chịu lỗi tốt hơn (polish nhẹ, không bắt buộc làm ngay)
- [ ] Nếu 1 video lỗi (Gemini fail, link die...) → log lỗi, **không dừng cả vòng lặp**, tiếp tục
      video kế tiếp
- [ ] Retry 1 lần nếu Gemini API timeout
- [ ] `README.md` mô tả cách setup từ đầu cho người (kể cả chính bạn 6 tháng sau) đọc lại được

**Nghiệm thu**: chạy với danh sách 3-5 video, kể cả khi 1 video cố tình để link sai, script vẫn
chạy hết và báo cáo rõ video nào lỗi.

## Milestone 5b — Dựng video bằng Remotion (thay thế Canva Bulk Create)

> **Đổi hướng so với kế hoạch ban đầu**: milestone này ban đầu dự định dùng Canva Bulk Create
> (thao tác tay, kết nối trực tiếp Sheet). Sau khi thử nghiệm, đổi sang **Remotion**
> (Node.js/React, render bằng code) vì: Remotion miễn phí ở quy mô cá nhân trong khi Canva cần
> gói Pro trả phí; Canva yêu cầu nhúng ảnh thật vào ô Sheet mới nhận diện được là ảnh, gây lỗi
> liên tục khi tự động hoá; Remotion render 100% tự động bằng script, khớp thẳng vào kế hoạch
> tự động hoá GitHub Actions ở Milestone 6. Mọi nhắc tới "Canva Bulk Create" ở các milestone
> trước (và ở `PROJECT_BRIEF.md`) coi như không còn áp dụng cho bước dựng video.

Mục tiêu: đọc dữ liệu quote (quote, context, đường dẫn ảnh nền) từ tab `Quotes` → render ra file
MP4 riêng cho từng quote bằng Remotion, không qua Canva.

- [ ] `src/remotion/QuoteVideo.jsx`: composition nhận props `quote`, `context`, `imagePath`.
      Layout: ảnh nền phủ full khung 1080x1920, overlay đen mờ (~35%) để chữ luôn đọc được,
      text quote lớn ở giữa (fade-in nhẹ), text context nhỏ hơn phía dưới
- [ ] Đăng ký composition trong Remotion Root, thời lượng mỗi video ~6-8 giây, fps 30
- [ ] `src/render-quotes.js`: đọc quote có Trạng thái sử dụng = "Chưa dùng" từ Sheet (tái dùng
      hàm ở `sheets.js`), với mỗi quote gọi `renderMedia()` từ `@remotion/renderer`, xuất MP4 vào
      `output/`, đặt tên theo STT quote
- [ ] Lỗi ở 1 quote (ví dụ ảnh nền không tồn tại) → log lỗi, tiếp tục quote kế tiếp, không dừng
      cả vòng lặp
- [ ] Sau khi render xong, gọi hàm cập nhật Sheet có sẵn để đổi Trạng thái sử dụng thành
      "Đã dùng" cho các quote vừa render
- [ ] Thêm script npm `render:quotes`, cập nhật `README.md` thay hướng dẫn Canva bằng
      `npm run render:quotes`

**Nghiệm thu**: chạy `npm run render:quotes` với ít nhất 2-3 quote thật đã có ảnh nền → ra đúng
số file MP4 trong `output/`, mở lên đúng nội dung quote + ảnh nền + overlay đọc rõ chữ → Sheet tự
cập nhật đúng trạng thái.

## Milestone 6 — Tự động hoá bằng GitHub Actions (chỉ làm sau khi Milestone 1-5 đã chạy ổn định local)
Mục tiêu: script tự chạy theo lịch, không cần bật máy tay mỗi lần. Dùng GitHub Actions vì repo
đang Public → chạy hoàn toàn miễn phí, không cần VPS.

- [ ] Tạo `.github/workflows/extract-quotes.yml` với `schedule` (cron) — gợi ý chạy 1 lần/tuần,
      vào sáng thứ Hai, khớp với nhịp thêm video mới thực tế của bạn
- [ ] Thêm `workflow_dispatch` để có thể bấm chạy tay từ tab Actions trên GitHub bất cứ lúc nào,
      không cần chờ tới lịch
- [ ] Workflow: checkout code → cài Node.js → `npm ci` → chạy `node src/index.js`
- [ ] Đưa `GEMINI_API_KEY` và toàn bộ nội dung `service-account.json` vào **GitHub Secrets**
      (Settings → Secrets and variables → Actions), KHÔNG commit 2 giá trị này vào repo dưới bất
      kỳ hình thức nào
- [ ] Trong workflow, ghi nội dung service account từ Secret ra file tạm lúc runtime (không lưu
      vào repo), ví dụ: `echo "$SERVICE_ACCOUNT_JSON" > service-account.json` trong 1 step riêng
- [ ] Kiểm tra kỹ: log của Actions run không được in ra bất kỳ giá trị secret nào (GitHub tự
      mask, nhưng vẫn nên tự rà lại log sau lần chạy đầu)
- [ ] Thêm 1 dòng trong `README.md` mô tả cách xem log/kết quả chạy trong tab Actions

**Nghiệm thu**: bấm "Run workflow" thủ công trên GitHub → thấy job chạy xanh (success) → dữ liệu
xuất hiện đúng trong Google Sheet, giống hệt khi chạy local ở Milestone 4.

**Lưu ý an toàn vì repo Public**: không tự ý đổi trigger sang `pull_request` từ fork bên ngoài
mà không hiểu rõ cơ chế — mặc định GitHub đã chặn Secrets cho PR từ fork lạ, đừng cấu hình lại
điều này trừ khi thực sự cần và hiểu rõ rủi ro.

---

**Không làm ở roadmap này** (để sau, không đưa cho Claude Code làm luôn kẻo lan man):
~~tích hợp Canva API~~ (không còn áp dụng — đã đổi sang Remotion, xem Milestone 5b), deploy VPS
riêng (GitHub Actions đã thay thế nhu cầu này ở quy mô hiện tại), dashboard theo dõi riêng.
