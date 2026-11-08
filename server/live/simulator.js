// Giả lập người xem để thử game khi chưa live (npm run sim).
const NAMES = [
  'Minh', 'Lan', 'Tuấn', 'Hà', 'Phong', 'Mai', 'Khoa', 'Linh', 'Dũng', 'Thảo',
  'Bảo', 'Ngọc', 'Quân', 'Vy', 'Huy', 'Trang', 'Long', 'Yến', 'Sơn', 'Châu',
];
const GIFTS = [
  { giftName: 'Hoa hồng', diamonds: 1, weight: 70 },
  { giftName: 'Kem', diamonds: 5, weight: 18 },
  { giftName: 'Mũ', diamonds: 99, weight: 3 },
  { giftName: 'Nhẫn', diamonds: 299, weight: 8 },
  { giftName: 'Sư tử', diamonds: 29_999, weight: 1 },
];
const INTERVAL_MS = 250;

function pickWeighted(items, rng) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = rng() * total;
  return items.find((i) => (roll -= i.weight) < 0) ?? items[0];
}

const DEFAULT_JOIN_TEXTS = Object.freeze(['1', '2']);

function randomAction(rng, joinTexts) {
  const idx = Math.floor(rng() * NAMES.length);
  const user = { id: `sim_${idx}`, name: NAMES[idx] };
  const roll = rng();
  if (roll < 0.45) return { type: 'comment', user, text: rng() < 0.4 ? joinTexts[idx % joinTexts.length] : 'cố lên!' };
  if (roll < 0.85) return { type: 'like', user, count: 1 + Math.floor(rng() * 15) };
  if (roll < 0.97) {
    const gift = pickWeighted(GIFTS, rng);
    return { type: 'gift', user, diamonds: gift.diamonds, giftName: gift.giftName, count: 1 + Math.floor(rng() * 3) };
  }
  return { type: rng() < 0.5 ? 'follow' : 'share', user };
}

/**
 * @param {{onAction: (a: object) => void, onStatus: (s: object) => void, rng?: () => number, joinTexts?: string[]}} opts
 * joinTexts: các comment chọn đội mà người xem giả lập sẽ gõ (mỗi người luôn chọn cùng một đội).
 */
export function startSimulator({ onAction, onStatus, rng = Math.random, joinTexts = DEFAULT_JOIN_TEXTS }) {
  onStatus({ source: 'simulator', connected: true, message: 'Chế độ giả lập (không kết nối TikTok)' });
  const timer = setInterval(() => onAction(randomAction(rng, joinTexts)), INTERVAL_MS);
  return { stop: async () => clearInterval(timer) };
}
