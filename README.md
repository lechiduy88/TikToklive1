# Game tương tác TikTok LIVE

Có hai chế độ. Mặc định là **SEA Games LIVE**.

| Chế độ | Chạy | Màn hình |
|---|---|---|
| **SEA Games LIVE** — 5 nước Đông Nam Á tranh huy chương | `npm run sim` / `npm start -- --user kenh` | `/` |
| **Đại chiến hai phe** — Đỏ vs Xanh | thêm `-- --mode battle` | `/` (hoặc `/battle.html`) |

Màn hình dọc 9:16 (1080×1920), đưa vào **TikTok LIVE Studio** hoặc **OBS** dưới dạng nguồn trình duyệt.

## SEA Games LIVE

Người xem gõ `VN`, `TH`, `ID`, `PH`, `MY` (hoặc `1`–`5`, hoặc tên nước) để vào đội tuyển. Mỗi **kỳ đại hội** (~7–8 phút):

1. **Khai mạc** (20s): chọn đội, xem lịch thi đấu và bảng tổng sắp toàn mùa.
2. **6 môn thi** xoay vòng, mỗi môn: giới thiệu → thi đấu → bục trao huy chương 🥇🥈🥉 (chỉ đội có tham gia mới được huy chương).
   - 🚣 **Đua thuyền rồng**: sức tiếp cộng dồn thành quãng đường; 3 thuyền về đích đầu giành huy chương. Thuyền đi sau được đẩy thêm (bám đuổi).
   - 🎯 **Bắn cung**: cứ 7 giây cả 5 đội bắn một loạt; đội tiếp sức nhiều nhất trong lượt ngắm bắn chuẩn nhất.
   - 🏋️ **Cử tạ**: mỗi lượt 10 giây, đội nâng yếu nhất bị loại; đội trụ lại cuối giành Vàng.
3. **Bế mạc**: quốc gia vô địch (bằng nhau tuyệt đối thì đồng vô địch), vận động viên xuất sắc.

Đội tuyển của mỗi người được giữ sang kỳ sau. Bảng tổng sắp toàn mùa lưu ở `data/medals.json`.

| Tương tác | Sức tiếp |
|---|---|
| Bình luận | 1 (tối đa 1 lần / 2 giây / người) |
| 10 tim | 1 |
| Follow / Share | 3 / 5 |
| Quà | 3 × √(kim cương mỗi món) × số món — Hoa hồng 3, quà 99💎 ≈ 30, Sư tử ≈ 520 |

**Công bằng & chống "một người quyết định tất cả":**
- Một món quà góp tối đa 35% sức tiếp cần cho một môn; một người góp tối đa 60% mỗi môn. **Phần dư không mất** mà được để dành, nhả dần vào các môn sau (màn hình báo "💰 để dành cho môn sau").
- Đội đã về đích / bị loại vẫn nhận quà — để dành cho môn sau.
- Độ khó tự điều chỉnh theo độ sôi động của buổi live (live ít người hay đông người, mỗi bình luận đều có ý nghĩa).
- XP huy chương chỉ dành cho người góp thật (≥ 5 sức tiếp trong môn).

**Tự cân bằng — buff đội yếu (không bao giờ trừ đội mạnh)**, hiện huy hiệu `🔥×2.3` trên bảng và banner "LỘI NGƯỢC DÒNG":

| Lớp buff | Khi nào | Tối đa |
|---|---|---|
| Trong môn | Đội đạt dưới 80% điểm đội dẫn đầu (bị bỏ càng xa càng mạnh) | ×2.5 |
| Tinh thần dân tộc | Kém đầu bảng tổng sắp (Vàng 3, Bạc 2, Đồng 1 điểm), +8%/điểm | ×2 |
| Đội ít người | √(số người đội đông nhất / đội mình) | ×2.5 |
| Tổng (nhân các lớp) | | ×6 |

Đo bằng giả lập 8 kỳ × 6 môn, khi một nước có **35% khán giả**: trước khi cân bằng nước đó giành 33/48 HC Vàng và vô địch 8/8 kỳ; sau khi cân bằng là 18/48 Vàng, vô địch 4/8 kỳ, mọi nước đều có Vàng. Khi một nước chiếm **55%** khán giả họ vẫn mạnh nhất (28/48 Vàng) — đông người vẫn được ưu thế xứng đáng. Chỉnh độ mạnh trong `SEA_BALANCE` ([server/sea/config.js](server/sea/config.js)).

Thông số trong [server/sea/config.js](server/sea/config.js). Biến môi trường rút ngắn để thử: `OPENING_SECONDS`, `INTRO_SECONDS`, `PODIUM_SECONDS`, `CLOSING_SECONDS`, `EVENTS_PER_SESSION`.

Giữ tinh thần **thi đấu thể thao giao hữu**: game không hiển thị nội dung comment (chỉ tên), không có câu kiểu "donate không thì nước bạn thua". Tránh gắn game với tranh chấp chính trị giữa các nước.

## Đại chiến hai phe (`--mode battle`)

Người xem chọn phe **Đỏ** hoặc **Xanh** bằng bình luận. Mỗi bình luận, lượt thả tim và món quà đều sinh quân ra chiến trường cho phe của họ. Trận kéo dài 3 phút; nhà chính nào bị phá trước (hoặc còn ít máu hơn khi hết giờ) thì thua.

## Chạy nhanh

Yêu cầu: Node.js 20+.

```bash
npm install
npm run sim                               # giả lập người xem, không cần live
npm start -- --user ten_kenh_tiktok       # kết nối buổi live thật (kênh phải đang live)
```

Sau đó mở:

| Trang | Dùng để |
|---|---|
| http://localhost:3000/ | Màn hình game. Thêm vào LIVE Studio/OBS làm **Browser source** 1080×1920 |
| http://localhost:3000/control.html | Bảng điều khiển: bấm để giả lập comment, tim, quà khi thử nghiệm |

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `TIKTOK_USERNAME` | — | Thay cho `--user` |
| `SIGN_API_KEY` | — | API key Euler Stream (tuỳ chọn, giúp kết nối ổn định hơn) |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Cổng web. Giữ `127.0.0.1` để chỉ máy bạn truy cập được bảng điều khiển |
| `LOBBY_SECONDS` / `BATTLE_SECONDS` / `VICTORY_SECONDS` | `15` / `180` / `12` | Độ dài từng giai đoạn |
| `ALLOW_CONTROL` | tắt khi live thật | Đặt `1` để bảng điều khiển gửi được quà/tim giả khi đang live thật. Ở `npm run sim` luôn bật |

## Luật chơi (hiển thị cố định ở đáy màn hình)

| Tương tác | Tác dụng |
|---|---|
| Gõ `1` / `đỏ` hoặc `2` / `xanh` | Vào phe (giữ nguyên phe đến hết trận) và sinh 1 lính |
| Bình luận bất kỳ | 1 lính (tối đa 1 lính / 2 giây / người) |
| Thả tim | Cứ 15 tim của cả phe = 1 lính |
| Follow / Share | Hồi máu nhà chính |
| Quà 1💎 (Hoa hồng) | Cung thủ |
| Quà 5–99💎 | Hiệp sĩ |
| Quà 100–999💎 | Người khổng lồ |
| Quà ≥1000💎 | Rồng bay qua màn hình kèm tên người tặng, quét lính địch, trừ tối đa 8% máu nhà |
| Cả phe góp đủ 50💎 quà nhỏ | Siêu chiêu cộng đồng ☄️ |

Người chưa chọn phe mà thả tim/tặng quà sẽ tự động vào phe ít người hơn. Quà và tim gửi lúc đang chờ trận sẽ được tung ra ngay khi trận bắt đầu, không bị phí.

## Thiết kế tâm lý đã cài sẵn

- **Hành động đầu tiên miễn phí, phản hồi tức thì:** gõ 1 chữ là tên hiện lên màn hình ngay.
- **Bản sắc nhóm:** hai phe, đếm số người mỗi phe, chữ màu theo phe.
- **Cò cưa (giữ trận giằng co đến phút cuối):**
  - *Tháp canh*: lâu đài tự bắn lính địch áp sát; máu nhà càng thấp bắn càng mạnh.
  - *Sân nhà*: lính đánh trên nửa sân của mình mạnh dần về phía lâu đài (tối đa +100%), đẩy càng sâu càng khó.
  - *Lội ngược dòng*: phe yếu hơn về lực lượng trên sân (hoặc máu nhà) được tăng sát thương, tối đa ×2.
  - *Phản công*: phe bị áp đảo liên tục 5 giây được lâu đài tung 5–30 dân quân miễn phí, màn hình kêu gọi gõ comment để giữ thành.
  - *Tường thành*: lính chỉ phá được tối đa 50 máu nhà/giây, muốn phá thành phải vây đủ lâu để phe kia kịp cứu.
  - *30 giây cuối – Tổng tấn công*: giới hạn vây thành ×2, tạo cao trào.
  - *Dây chiến tuyến* trên sân chạy lên/xuống theo thế trận, hiện % sức mạnh mỗi phe.
  - Thông số nằm trong `UNDERDOG`, `HOME_GROUND`, `CASTLE_DEFENSE`, `MOMENTUM`, `SIEGE` ở [server/config.js](server/config.js).
- **Giờ vàng ×2:** khoảng phút thứ 1:15–1:45 có 30 giây nhân đôi quân.
- **Nhiều bảng vinh danh:** sát thương, bình luận, thả tim, cuối trận có MVP, "Người cổ vũ nhiệt nhất", "Vua thả tim", "Người cứu cả phe". Người chơi miễn phí cũng có cơ hội nổi bật.
- **Combo cộng đồng:** biến quà nhỏ thành nỗ lực tập thể thay vì cuộc đua của vài người nhiều tiền.
- **Quà lớn hoành tráng nhưng không quyết định thắng thua:** rồng chỉ trừ tối đa 8% máu nhà.
- **Tiến trình qua nhiều buổi live:** XP và cấp độ (Lv) lưu ở `data/players.json`. XP từ quà bị giới hạn mỗi trận nên không thể "mua" cấp.
- **Kết thúc đỉnh cao:** màn vinh danh 12 giây, sau đó trận mới tự bắt đầu.

Mọi thông số cân bằng nằm trong [server/config.js](server/config.js).

## Cấu trúc

```
server/
  index.js            web server, WebSocket, vòng lặp game 20 tick/giây, chọn chế độ
  sea/                chế độ SEA Games (logic thuần, có unit test)
    config.js         đội tuyển, độ dài giai đoạn, cân bằng sức tiếp/quà
    engine.js         vòng đời kỳ đại hội: khai mạc → môn thi × N → bế mạc
    actions.js        tương tác → chọn đội + sức tiếp (giới hạn quà, để dành)
    events/           các môn: dragonBoat, archery, weightlifting
    medals.js         bảng tổng sắp; roster.js đội tuyển; snapshot.js dữ liệu màn hình
  config.js           thông số cân bằng chế độ 2 phe
  game/               chế độ 2 phe (logic thuần, có unit test)
    engine.js         vòng đời trận: lobby → battle → victory
    actions.js        tương tác người xem → quân/hiệu ứng
    combat.js         di chuyển, đánh nhau, buff lội ngược dòng
    effects.js        sinh quân, rồng, thiên thạch, hồi máu
    results.js        kết quả, XP, dữ liệu gửi màn hình
  live/
    tiktokSource.js   kết nối TikTok LIVE, tự kết nối lại
    liveEvents.js     chuẩn hoá và kiểm tra dữ liệu đầu vào
    simulator.js      người xem giả lập
  store/playerStore.js  lưu XP/cấp độ; medalStore.js bảng huy chương toàn mùa
public/               màn hình game (canvas) + bảng điều khiển
  index.html + js/sea/  màn hình SEA Games (cờ, 3 sân thi đấu, nghi lễ, HUD)
  battle.html + js/     màn hình đại chiến hai phe
test/                 unit test (node --test)
```

## Kiểm thử

```bash
npm test
npm run test:coverage
```

## Lưu ý quan trọng

- `tiktok-live-connector` là thư viện **không chính thức**: có thể ngừng hoạt động khi TikTok thay đổi. Nên luôn có kế hoạch dự phòng (chạy `npm run sim` hoặc dùng bảng điều khiển).
- Đọc kỹ **Chính sách LIVE và chính sách kiếm tiền** hiện hành của TikTok trước khi phát. Game này không có cơ chế quay thưởng hay phần thưởng giá trị tiền thật, và không có lời kêu gọi kiểu "sắp thua rồi, tặng quà ngay". Hãy giữ nguyên tinh thần đó khi chỉnh sửa.
