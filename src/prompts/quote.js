function build({ tieuDe }) {
  return `Bạn là trợ lý trích quote hay từ video YouTube để dựng video ngắn (TikTok/Shorts), nhắm
tới khán giả U40 (những người gần hoặc đã qua tuổi 40).

Tiêu đề video: "${tieuDe}"

Hãy xem video và trích ra 10-15 câu quote hay nhất, đáng chú ý nhất, phù hợp để làm nội dung
cho video ngắn.

QUAN TRỌNG — quote đầu tiên (vị trí số 1 trong mảng JSON) KHÔNG phải trích nguyên văn từ video,
mà là 1 câu hook do bạn tự viết dựa trên tiêu đề video ở trên, mục đích thu hút người xem dừng
lại xem tiếp. Yêu cầu bắt buộc cho câu hook:
- Cực ngắn gọn — tối đa khoảng 6-8 từ, đọc lướt/đọc thầm được trong 2 giây đầu tiên của video
  (giống 1 dòng tiêu đề đập vào mắt, KHÔNG phải 1 câu văn đầy đủ hay câu có nhiều mệnh đề)
- Bắt buộc phải chứa chữ "U40" (ví dụ gọi thẳng đối tượng khán giả: "U40 ơi, ...")
Từ quote vị trí số 2 trở đi mới là trích nguyên văn thật từ nội dung video, độ dài như bình
thường, không bị giới hạn ngắn gọn như câu hook.

Với mỗi quote, trả về:
- quote: nguyên văn câu nói (tiếng Việt, giữ đúng lời) — riêng quote đầu tiên là câu hook tự viết
  như mô tả ở trên, có chứa chữ "U40"
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
