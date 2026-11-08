// Thông số chế độ SEA Games LIVE. Đổi tên đội hay độ khó từng môn tại đây.

const secondsFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value * 1000 : fallback;
};

// number: gõ số để chọn đội.
// codes: mã ngắn, tính khi là cả comment hoặc là chữ đầu tiên ("vn cố lên").
// exactOnly: mã dễ trùng từ thông dụng (tiếng Anh "my"), chỉ tính khi đứng một mình.
// names: tên dài (không dấu), tính khi xuất hiện như một cụm từ trong comment.
export const SEA_TEAMS = Object.freeze([
  { id: 'vn', name: 'Việt Nam', short: 'VN', number: '1', codes: ['vn'], exactOnly: [], names: ['viet nam', 'vietnam'] },
  { id: 'th', name: 'Thái Lan', short: 'TH', number: '2', codes: ['th'], exactOnly: [], names: ['thai lan', 'thailand', 'thai'] },
  { id: 'id', name: 'Indonesia', short: 'ID', number: '3', codes: ['id'], exactOnly: [], names: ['indonesia', 'indo'] },
  { id: 'ph', name: 'Philippines', short: 'PH', number: '4', codes: ['ph'], exactOnly: [], names: ['philippines', 'philippin', 'phi'] },
  { id: 'my', name: 'Malaysia', short: 'MY', number: '5', codes: [], exactOnly: ['my'], names: ['malaysia', 'malay', 'ma lai'] },
].map((t) => Object.freeze(t)));

export const TEAM_IDS = Object.freeze(SEA_TEAMS.map((t) => t.id));

export const SEA_PHASE_MS = Object.freeze({
  opening: secondsFromEnv('OPENING_SECONDS', 20_000),
  intro: secondsFromEnv('INTRO_SECONDS', 5_000),
  podium: secondsFromEnv('PODIUM_SECONDS', 8_000),
  closing: secondsFromEnv('CLOSING_SECONDS', 15_000),
});

export const SEA_SESSION = Object.freeze({
  // Chỉ các môn mà tương tác của người xem quyết định trực tiếp kết quả; mỗi kỳ chơi đủ 3 môn (~1.5–2.5 phút/môn).
  eventsPerSession: Number(process.env.EVENTS_PER_SESSION) || 3,
  eventCycle: Object.freeze(['dragon_boat', 'marathon', 'weightlifting']),
});

// Quy đổi tương tác => "sức tiếp" (effort) cho đội.
// Quà: giftPerSqrtDiamond × √(kim cương mỗi món) × số món. Hoa hồng = 3, quà 99💎 ≈ 30, Sư tử ≈ 520.
export const SEA_EFFORT = Object.freeze({
  comment: 1,
  commentCooldownMs: 2_000,
  likesPerEffort: 10,
  maxLikeEffortPerEvent: 5,
  follow: 3,
  share: 5,
  giftPerSqrtDiamond: 3,
  bigGiftDiamonds: 100,
  megaGiftDiamonds: 1_000,
});

// Độ khó tự điều chỉnh theo độ sôi động của buổi live:
//  scale = sức tiếp kỳ vọng của MỘT đội trong một môn = max(minScale, activityRate / 5 đội × targetSeconds).
//  activityRate (sức tiếp/giây của cả live) được đo lại sau mỗi môn (trung bình trượt emaWeight).
//  Một món quà chỉ góp tối đa giftShare × scale vào môn đang thi; phần dư để dành cho các môn sau.
//  Đầu mỗi môn, phần để dành được nhả tối đa carryShare × scale.
export const SEA_SCALE = Object.freeze({
  defaultRate: 4,
  targetSeconds: 100, // một đội tiếp sức ở mức trung bình cần ~100 giây để hoàn thành môn
  minScale: 80,
  emaWeight: 0.5,
  giftShare: 0.35, // một món quà
  athleteGiftShare: 0.6, // tổng quà của MỘT người trong một môn (nhiều người cùng đội thì cộng dồn được)
  carryShare: 0.5,
});

// Tự cân bằng (buff đội yếu, KHÔNG trừ đội mạnh):
//  - Trong môn: đội đạt dưới closeRatio điểm đội dẫn đầu được nhân sức tiếp,
//    bị bỏ càng xa càng mạnh, tối đa +maxEventBonus (khi đội dẫn đầu đã vượt mức buffMinLead của môn).
//  - Bảng huy chương (Vàng 3, Bạc 2, Đồng 1 điểm): mỗi điểm thua đội đầu bảng +medalPointBonus, tối đa +maxMedalBonus.
//  - Đội ít người: √(số người đội đông nhất / đội mình), tối đa +maxSizeBonus.
//  - Các lớp nhân với nhau, tối đa maxTotal. Buff ≥ announceAt thì màn hình hô "LỘI NGƯỢC DÒNG".
export const SEA_BALANCE = Object.freeze({
  closeRatio: 0.8,
  maxEventBonus: 1.5,
  medalPointBonus: 0.08,
  maxMedalBonus: 1.0,
  maxSizeBonus: 1.5,
  maxTotal: 6,
  announceAt: 1.4,
});

// Đua thuyền rồng: cộng dồn tới đích (scale sức tiếp = cả đường đua).
export const DRAGON_BOAT = Object.freeze({ track: 1000, finishers: 3, maxMs: 150_000, buffMinLead: 150 });

// Chạy marathon (sức bền): sức tiếp tăng TỐC ĐỘ, tốc độ còn lại keepPerSecond mỗi giây nếu không ai cổ vũ
// => phải cổ vũ đều tay suốt durationMs. Đội tiếp sức ở mức trung bình chạy được khoảng expectedMeters.
export const MARATHON = Object.freeze({ durationMs: 120_000, keepPerSecond: 0.75, expectedMeters: 4_000, buffMinLead: 200 });

// Cử tạ: mỗi lượt roundMs, đội có lực nâng thấp nhất bị loại; đội trụ lại cuối giành Vàng (4 lượt ≈ 100 giây).
export const WEIGHTLIFTING = Object.freeze({ roundMs: 25_000, buffMinLead: 3 });

// XP mỗi môn (lưu qua nhiều buổi live). Phần từ quà bị giới hạn để cấp độ không "mua" được.
export const SEA_XP = Object.freeze({
  maxFreeXpPerEvent: 15, maxGiftXpPerEvent: 15, perDiamond: 1, gold: 10, silver: 6, bronze: 3, star: 10,
  minEffortForMedal: 5, // phải góp thật mới được XP huy chương (chống vào phút chót "ăn ké")
});
