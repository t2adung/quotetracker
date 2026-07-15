function build({ tieuDe }) {
  return `Bạn là trợ lý trích quote hay từ video YouTube để dựng video ngắn (TikTok/Shorts), nhắm
tới khán giả U40 (những người gần hoặc đã qua tuổi 40).

Tiêu đề video: "${tieuDe}"

Hãy xem video và trích ra 10-15 câu quote hay nhất, đáng chú ý nhất, phù hợp để làm nội dung
cho video ngắn.

QUAN TRỌNG — quote đầu tiên (vị trí số 1 trong mảng JSON) KHÔNG phải trích nguyên văn từ video,
mà là 1 câu hook do bạn tự viết dựa trên tiêu đề video ở trên, mục đích thu hút người xem dừng
lại xem tiếp. Câu hook phải theo dạng "nêu hành động/lợi ích cụ thể + mốc tuổi 40", viết liền
thành 1 câu tự nhiên — KHÔNG gọi thẳng đối tượng kiểu "U40 ơi...", không dùng dấu chấm than.
Ví dụ đúng format (chỉ để tham khảo cách viết, nội dung thật phải bám theo tiêu đề video):
"Nâng cấp bản thân nhanh chóng khi ở tuổi 40 để không hối tiếc".

Yêu cầu bắt buộc cho câu hook:
- 1 câu duy nhất, súc tích, đọc lướt được trong khoảng 2-3 giây đầu video (khoảng 8-14 từ)
- Có nhắc đến mốc tuổi 40 một cách tự nhiên trong câu (ví dụ "tuổi 40", "ở tuổi 40", "trước tuổi
  40"...) — không bắt buộc viết tắt "U40"
- Nội dung hook phải lấy đúng ý/hành động chính từ tiêu đề video ở trên, không viết chung chung
Từ quote vị trí số 2 trở đi mới là trích nguyên văn thật từ nội dung video, độ dài như bình
thường, không bị giới hạn ngắn gọn như câu hook.

Yêu cầu bắt buộc cho các quote từ vị trí số 2 trở đi:
- Chỉ chọn những câu nói QUAN TRỌNG, mang thông điệp/ý nghĩa rõ ràng — bỏ qua câu nói đệm, câu dẫn
  dắt không đáng chú ý, câu lặp ý không thêm giá trị
- Sắp xếp đúng theo TRÌNH TỰ xuất hiện trong video (timestamp tăng dần từ đầu đến cuối, không đảo
  lộn thứ tự các quote đã chọn)
- Ưu tiên chọn các câu có TÍNH LIÊN KẾT với nhau — cùng nằm trong 1 mạch ý/chủ đề xuyên suốt của
  video, để sau này dễ ghép lại thành 1 kịch bản mạch lạc; tránh chọn các câu rời rạc, mỗi câu 1
  chủ đề không liên quan đến nhau

Với mỗi quote, trả về:
- quote: nguyên văn câu nói (tiếng Việt, giữ đúng lời) — riêng quote đầu tiên là câu hook tự viết
  như mô tả ở trên
- context: bối cảnh/ý nghĩa ngắn gọn của câu nói (quote đầu tiên ghi "Câu hook mở đầu")
- timestamp: thời điểm xuất hiện trong video, định dạng "mm:ss" (quote đầu tiên để trống "")
- hookScore: điểm hook từ 1 đến 5 (5 = hấp dẫn nhất để mở đầu video ngắn; quote đầu tiên luôn là 5)

CHỈ trả về một mảng JSON hợp lệ theo đúng định dạng sau, không thêm bất kỳ chữ giải thích,
markdown hay text nào khác:

[
  { "quote": "...", "context": "...", "timestamp": "mm:ss", "hookScore": 1 }
]`;
}

function parse(text) {
  const match = text.match(/\[[\s\S]*\]/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) {
    throw new Error('Kết quả trả về không phải là một mảng JSON');
  }

  return parsed.map((item) => ({
    quote: item.quote || '',
    context: item.context || '',
    timestamp: item.timestamp || '',
    hookScore: item.hookScore ?? item.hook_score ?? null,
  }));
}

module.exports = { build, parse };
