# CLAUDE.md — hướng dẫn cho Claude Code khi làm việc trong repo này

Đọc `PROJECT_BRIEF.md` trước khi bắt đầu bất kỳ task nào trong repo này.

## Nguyên tắc làm việc
- Đây là script cá nhân quy mô nhỏ, không phải sản phẩm thương mại — **ưu tiên đơn giản, dễ đọc**
  hơn là "đúng chuẩn enterprise". Không tạo class/abstraction không cần thiết.
- Làm từng milestone trong `ROADMAP.md` theo đúng thứ tự, không nhảy cóc.
- Sau mỗi milestone: dừng lại, báo cáo ngắn gọn đã làm gì, chờ xác nhận trước khi sang milestone
  tiếp theo — không tự ý làm hết toàn bộ roadmap trong 1 lần.
- Khi không chắc về 1 quyết định kỹ thuật (ví dụ chọn model Gemini nào), hỏi lại thay vì tự
  quyết định và code luôn.

## Cấu trúc thư mục mong muốn
```
quotetracker/
├── .env.example          # mẫu biến môi trường, KHÔNG chứa giá trị thật
├── .gitignore
├── package.json
├── PROJECT_BRIEF.md
├── CLAUDE.md
├── ROADMAP.md
├── README.md              # hướng dẫn setup + chạy, viết cho tương lai chính mình đọc lại
├── src/
│   ├── index.js           # entry point, chạy bằng `node src/index.js`
│   ├── sheets.js           # các hàm đọc/ghi Google Sheets
│   ├── gemini.js           # hàm gọi Gemini API trích quote
│   └── config.js           # đọc biến môi trường, validate sớm (fail fast nếu thiếu key)
└── service-account.json.example  # hướng dẫn định dạng, KHÔNG chứa giá trị thật
```

## Quy ước code
- CommonJS hay ESM đều được, nhưng **chọn 1 và nhất quán toàn bộ project** — không trộn lẫn
- Dùng `async/await`, không dùng `.then()` chain dài
- Mọi lỗi gọi API (Gemini, Sheets) phải có `try/catch` với thông báo lỗi rõ ràng bằng tiếng Việt,
  vì người đọc log là 1 người không chuyên sâu debug
- Không hardcode Sheet ID/tab name rải rác nhiều nơi — đặt hằng số 1 chỗ trong `config.js`

## Bảo mật (kiểm tra trước mỗi commit)
- [ ] `.env` có nằm trong `.gitignore` chưa?
- [ ] `service-account.json` có nằm trong `.gitignore` chưa?
- [ ] Có dòng code nào lỡ `console.log(process.env...)` hoặc log toàn bộ response chứa key không?
- [ ] `.env.example` chỉ chứa tên biến, không chứa giá trị thật

## Bảo mật riêng cho Milestone 6 (GitHub Actions) — vì repo đang Public
- [ ] `GEMINI_API_KEY` và nội dung `service-account.json` chỉ được đặt trong GitHub Secrets, đọc
      qua `${{ secrets.TEN_SECRET }}` trong file workflow YAML — không bao giờ hardcode
- [ ] File workflow YAML không được `echo`/log giá trị secret ra ngoài, kể cả để debug tạm thời
- [ ] Không thêm trigger `pull_request_target` hoặc mở quyền Secrets cho workflow chạy từ fork
      bên ngoài nếu không thực sự hiểu rõ rủi ro — đây là lỗi bảo mật phổ biến nhất ở repo Public
- [ ] Sau khi thêm Secrets trên GitHub, xoá luôn `service-account.json` khỏi máy local nếu không
      còn cần dùng cho chạy local nữa, giảm số nơi lưu trữ key nhạy cảm

## Khi tạo Pull Request / commit
- Message ngắn gọn, tiếng Việt hoặc tiếng Anh đều được, miễn rõ ràng
- Mỗi commit nên tương ứng 1 milestone nhỏ trong ROADMAP.md, không gộp nhiều việc không liên quan
