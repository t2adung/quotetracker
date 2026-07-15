# PROJECT_BRIEF.md — quotetracker

## Mục tiêu
Tự động hoá việc trích quote hay từ video YouTube (dùng Gemini API), ghi vào Google Sheet
trung tâm, để sau đó dựng hàng loạt video ngắn (TikTok/YouTube Shorts) bằng Remotion (render
video tự động bằng code — xem Milestone 5b ở `ROADMAP.md`; ~~Canva Bulk Create~~ không còn
áp dụng cho bước dựng video).

Đây là 1 script/worker độc lập, **không phải** web app, không cần UI. Chạy bằng lệnh CLI,
local-first (chưa deploy VPS ở giai đoạn này).

## Bối cảnh
- Dự án phụ trợ cho việc sản xuất nội dung video ngắn (short-form) từ nguồn video YouTube dài
- Người vận hành: 1 người (không phải team), ưu tiên đơn giản, dễ bảo trì hơn là kiến trúc phức tạp
- Khối lượng xử lý nhỏ: vài video/tuần, không cần tối ưu cho scale lớn

## Nguồn dữ liệu đã có sẵn (không tạo lại)
  - Tạo 1 file sheet như sheet_mau.xlsx trên google sheets
  - Tab `Nguồn Video`: STT, Link YouTube, Tiêu đề video, Kênh gốc, Chủ đề chính, Trạng thái xử lý,
    Người phụ trách, Ngày thêm, Ghi chú
  - Tab `Quotes`: STT, STT Video nguồn, Quote, Bối cảnh / ý nghĩa, Timestamp, Điểm hook (1-5),
    Trạng thái sử dụng, Link video output (Canva), Ngày đăng, image_filename (cột J — thêm mới,
    xem ghi chú bên dưới)
  - **Không đổi tên cột/tab hiện có** — code phải khớp đúng theo cấu trúc này
  - Cột `image_filename` (J) cần được thêm thủ công (header ở hàng 3) vào Sheet thật trước khi
    bật tính năng sinh ảnh nền — xem `README.md` mục "Sinh ảnh nền cho quote"

## Luồng xử lý (end-to-end)
1. Đọc các dòng ở tab `Nguồn Video` có Trạng thái xử lý = "Chưa xử lý"
2. Với mỗi link YouTube: gọi Gemini API để trích 10-15 quote (JSON có cấu trúc: quote, context,
   timestamp, hook_score)
3. Ghi từng quote vào tab `Quotes`, tham chiếu đúng STT video nguồn
4. Cập nhật lại Trạng thái xử lý ở tab `Nguồn Video` thành "Đã trích quote"
5. Với mỗi quote đã có ảnh nền (chưa dùng): render video MP4 bằng Remotion (xem Milestone 5b),
   cập nhật Trạng thái sử dụng thành "Đã dùng"

## Tech stack
- Node.js (phiên bản LTS hiện tại)
- `@google/genai` — gọi Gemini API
- `googleapis` — đọc/ghi Google Sheets
- Không dùng framework web, không dùng database riêng — Google Sheet CHÍNH LÀ database

## Yêu cầu bảo mật (bắt buộc)
- `GEMINI_API_KEY`, `service-account.json` — không bao giờ commit vào Git
- `.env` và `service-account.json` phải nằm trong `.gitignore` ngay từ commit đầu tiên
- Không log giá trị secret ra console/log file
- Service account chỉ cấp quyền Editor **đúng 1 Sheet này**, không cấp quyền toàn bộ Drive

## Hạ tầng chạy code
- **Giai đoạn đầu (Milestone 1-5)**: chạy local bằng `node src/index.js`, thao tác tay. Ưu tiên
  làm đúng logic trước khi lo tự động hoá.
- **Giai đoạn sau (Milestone 6)**: tự động hoá bằng **GitHub Actions** (không dùng VPS) — vì
  repo `quotetracker` đang ở chế độ Public nên chạy Actions hoàn toàn miễn phí, không giới hạn
  số phút. Chạy theo lịch (cron hàng tuần) + có nút bấm chạy tay bất cứ lúc nào
  (`workflow_dispatch`). Xem chi tiết ở `ROADMAP.md`.

## Ngoài phạm vi (không làm ở giai đoạn này)
- Không deploy VPS/cloud riêng — GitHub Actions đã đáp ứng đủ nhu cầu tự động hoá ở quy mô hiện tại
- ~~Không tự động hoá phần Canva — vẫn thao tác tay~~ (không còn áp dụng — đã đổi sang Remotion,
  bước dựng video giờ tự động hoá hoàn toàn bằng code, xem Milestone 5b ở `ROADMAP.md`)
- Không cần test framework phức tạp — vài script kiểm tra thủ công là đủ ở giai đoạn MVP

## Định nghĩa "xong" (Definition of Done) cho MVP
Chạy `node index.js` với 1 link YouTube thật trong Sheet → quote xuất hiện đúng trong tab
`Quotes` → trạng thái ở tab `Nguồn Video` tự cập nhật. Không cần hoàn hảo, cần **chạy được thật**.
