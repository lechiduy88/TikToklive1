// Tất cả thông số cân bằng game nằm ở đây để chỉnh mà không phải sửa logic.

export const TEAMS = Object.freeze(['red', 'blue']);

const secondsFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value * 1000 : fallback;
};

// Có thể đổi độ dài mỗi giai đoạn bằng biến môi trường LOBBY_SECONDS / BATTLE_SECONDS / VICTORY_SECONDS.
export const PHASE_DURATION_MS = Object.freeze({
  lobby: secondsFromEnv('LOBBY_SECONDS', 15_000),
  battle: secondsFromEnv('BATTLE_SECONDS', 180_000),
  victory: secondsFromEnv('VICTORY_SECONDS', 12_000),
});

export const TICK_MS = 50;
export const BROADCAST_EVERY_TICKS = 2; // 10 lần/giây

export const FIELD = Object.freeze({
  length: 1000, // nhà Đỏ ở x=0, nhà Xanh ở x=FIELD.length
  lanes: 5,
});

export const BASE_MAX_HP = 2000;

// Đơn vị lính. dps = sát thương mỗi giây, range = tầm đánh theo trục x.
// value = giá trị chiến đấu quy ra "số lính thường", dùng để đo cán cân hai phe.
export const UNIT_TYPES = Object.freeze({
  soldier: { hp: 30, dps: 8, speed: 60, range: 18, baseDamage: 10, value: 1 },
  archer: { hp: 22, dps: 10, speed: 55, range: 120, baseDamage: 12, value: 1 },
  knight: { hp: 160, dps: 22, speed: 50, range: 22, baseDamage: 35, value: 4 },
  giant: { hp: 600, dps: 45, speed: 32, range: 28, baseDamage: 90, value: 12 },
});

// Hành động miễn phí
export const COMMENT_COOLDOWN_MS = 2_000; // chống spam: tối đa 1 lính/2s/người qua comment
export const LIKES_PER_SOLDIER = 15; // like dồn theo phe
export const MAX_SOLDIERS_PER_LIKE_EVENT = 5;

// Quà: chọn bậc theo số kim cương của MỘT món quà
export const GIFT_TIERS = Object.freeze([
  { minDiamonds: 1000, effect: 'dragon' },
  { minDiamonds: 100, effect: 'giant' },
  { minDiamonds: 5, effect: 'knight' },
  { minDiamonds: 1, effect: 'archer' },
]);
export const MAX_GIFT_UNITS_PER_EVENT = 20;

// Rồng: hiệu ứng điện ảnh, quét lính địch nhưng chỉ gây sát thương nhà có giới hạn
// để quà lớn KHÔNG tự quyết định thắng thua.
export const DRAGON = Object.freeze({ unitDamage: 120, baseDamagePct: 0.08 });

// Combo cộng đồng: tổng kim cương của cả phe đạt mốc => siêu chiêu
export const TEAM_COMBO_DIAMONDS = 50;
export const METEOR = Object.freeze({ unitDamage: 80, baseDamagePct: 0.05 });

// Follow / share: hồi máu nhà
export const FOLLOW_HEAL = 40;
export const SHARE_HEAL = 60;

// ---- Cơ chế cò cưa: giữ trận giằng co thay vì một phe đè bẹp từ đầu ----

// Lội ngược dòng: phe yếu hơn nhận buff sát thương.
//  - theo máu nhà (chênh >= hpGapRatio)  -> damageMultiplier
//  - theo lực lượng trên sân (sức mạnh < armyShare tổng) -> 1 + (armyShare - share) * armySlope, tối đa +maxArmyBonus
export const UNDERDOG = Object.freeze({
  hpGapRatio: 0.2,
  damageMultiplier: 1.5,
  armyShare: 0.4,
  armySlope: 4,
  maxArmyBonus: 1.0,
  minTotalPower: 10, // tính theo số lính thường quy đổi; sân gần trống thì không buff
});

// Sân nhà: lính đánh trên nửa sân của mình mạnh dần về phía lâu đài (tối đa +bonus ở sát cổng).
// Đẩy càng sâu càng khó => trận tự kéo về giữa sân, hai bên giằng co.
export const HOME_GROUND = Object.freeze({ bonus: 1.0 });

// Tháp canh: lâu đài bắn lính địch đã vào gần. Máu nhà càng thấp, bắn càng mạnh
// (dps = baseDps + desperateDps * phần máu đã mất) => phe tấn công bị chặn trước cổng, thế trận đảo chiều.
export const CASTLE_DEFENSE = Object.freeze({ range: 260, baseDps: 50, desperateDps: 150 });

// Phản công: phe bị áp đảo (sức mạnh < weakShare) liên tục holdMs, đang thua/hoà máu nhà và có người chơi,
// sẽ được lâu đài tung một đợt dân quân miễn phí.
// Số dân quân = khoảng chênh sức mạnh × waveGapRatio, trong [waveMin, waveMax].
export const MOMENTUM = Object.freeze({
  weakShare: 0.28,
  holdMs: 5_000,
  cooldownMs: 20_000,
  waveGapRatio: 0.3,
  waveMin: 5,
  waveMax: 30,
  militiaPerPlayer: 4, // chống "cố tình yếu để ăn dân quân": đợt phản công tỉ lệ với số người chơi của phe
});

// Tường thành: tổng sát thương lính gây lên một lâu đài bị giới hạn mỗi giây,
// nên muốn phá thành phải vây đủ lâu để phe kia kịp kêu gọi cứu viện.
// (Rồng/siêu chiêu tính riêng và đã có giới hạn % máu.)
// Tổng tấn công: finalRushMs cuối trận, giới hạn vây thành nhân finalRushMultiplier => cao trào, nhà yếu có thể sập.
export const SIEGE = Object.freeze({ maxBaseDps: 50, finalRushMs: 30_000, finalRushMultiplier: 2 });

// Khung giờ vàng X2
export const GOLDEN_TIME = Object.freeze({
  startAfterMs: 75_000,
  jitterMs: 30_000,
  durationMs: 30_000,
  multiplier: 2,
});

export const MAX_UNITS_PER_TEAM = 220;
export const LEADERBOARD_SIZE = 5;

// Tiến trình lưu qua nhiều buổi live
export const XP = Object.freeze({
  comment: 1,
  likeSoldier: 1,
  perDiamond: 2,
  maxCommentXpPerMatch: 40, // chống spam comment để cày cấp
  maxGiftXpPerMatch: 60, // để cấp độ không thể "mua" bằng tiền, người chơi miễn phí vẫn lên cấp ngang ngửa
  win: 20,
  mvp: 50,
});
export const XP_PER_LEVEL = 100;
