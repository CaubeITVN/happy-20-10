# Đảo tình yêu 💗 (quà 20/10)

Trang web 3D nhỏ: mở hộp quà, rồi đọc thư, tìm 8 trái tim "lý do thương em", chạm gấu, bóng bay và ảnh polaroid.
Không cần cài đặt hay build gì cả, chỉ là các file tĩnh.

## Sửa nội dung

Mọi chữ trên trang (tiêu đề, lá thư, 8 lý do, chú thích ảnh, câu gấu nói, lời chúc cuối) nằm trong **`js/config.js`**.
Mở file đó ra, sửa chữ trong dấu nháy `'...'`, lưu lại là xong.

- Muốn xưng hô kiểu khác (ví dụ "Anh thương em"), sửa thẳng trong `letter.paragraphs` và `letter.sign`.
- Thêm hoặc bớt lý do trong `reasons` thì số trái tim bay quanh đảo cũng tăng hoặc giảm theo. Nhớ sửa luôn con số "8" trong `hints.explore`.
- Ảnh polaroid nhận một trong các kiểu `art`: `bear`, `tulip`, `cake`, `moon`, `hearts`.

## Xem thử trên máy

Trang dùng ES module nên **không mở được bằng cách bấm đúp vào `index.html`**. Hãy chạy một server nhỏ:

```bash
python -m http.server 5500
```

Sau đó mở <http://localhost:5500>. Nếu dùng VS Code, extension "Live Server" cũng được.

Muốn thử trên điện thoại cùng mạng Wi-Fi thì chạy `python -m http.server 5500 --bind 0.0.0.0`, rồi mở `http://<IP-máy-tính>:5500` trên điện thoại.

## Đưa lên mạng để gửi cho người ấy

### Cách 1: Netlify (dễ nhất, khoảng 1 phút)
1. Vào <https://app.netlify.com/drop> và đăng nhập (miễn phí).
2. Kéo **cả thư mục `Em`** thả vào trang.
3. Netlify sẽ đưa cho bạn một link dạng `https://ten-ngau-nhien.netlify.app`. Có thể đổi tên link trong *Site configuration → Change site name*, ví dụ `dao-cua-em.netlify.app`.

### Cách 2: GitHub Pages
1. Tạo một repository mới trên GitHub, ví dụ `dao-cua-em`.
2. Tải lên toàn bộ file trong thư mục này (giữ nguyên các thư mục `css/` và `js/`).
3. Vào *Settings → Pages*, mục *Source* chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.
4. Đợi 1–2 phút, link sẽ là `https://<tên-github>.github.io/dao-cua-em/`.

> Lưu ý: link GitHub Pages / Netlify là công khai, ai có link cũng xem được.

## Mẹo
- Nhạc hộp nhạc tự phát khi mở quà và có thể tắt bằng nút 🎵. (Trên iPhone, nếu bật chế độ im lặng thì sẽ không nghe thấy nhạc.)
- Trang cần mạng để tải thư viện 3D (three.js) và phông chữ.

## Cấu trúc
```
index.html        khung trang
css/style.css     giao diện
js/config.js      ✏️ nội dung để sửa
js/main.js        cảnh 3D, ánh sáng + bloom, tương tác, trình tự mở quà
js/models.js      mô hình 3D (đảo, gấu, hộp quà, trái tim, bóng bay...)
js/garden.js      hoa tulip, cỏ, cổng hoa trái tim treo ảnh, cây anh đào, xích đu, bướm
js/sky.js         bầu trời hoàng hôn, cầu vồng, biển mây, đảo nhỏ phía xa
js/textures.js    hình vẽ trên polaroid, biển gỗ, chấm bi
js/effects.js     hạt lấp lánh, mưa tim, confetti, tween
js/music.js       hộp nhạc WebAudio
js/ui.js          thư, thẻ lý do, ảnh phóng to
```
