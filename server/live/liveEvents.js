// Chuẩn hoá dữ liệu từ TikTok (hoặc từ trang điều khiển giả lập) thành action của game.
// Dữ liệu bên ngoài luôn được coi là không tin cậy: kiểm tra kiểu và giới hạn kích thước.

const MAX_NAME_LENGTH = 24;
const MAX_TEXT_LENGTH = 200;
const MAX_COUNT = 10_000;
const MAX_DIAMONDS = 100_000;
const ACTION_TYPES = new Set(['comment', 'like', 'gift', 'follow', 'share']);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function cleanName(value, fallback) {
  const name = isNonEmptyString(value) ? value.trim() : fallback;
  return String(name).slice(0, MAX_NAME_LENGTH);
}

function toUser(raw) {
  const id = raw?.uniqueId ?? raw?.userId;
  if (id === undefined || id === null || String(id).length === 0) return null;
  const idText = String(id).slice(0, 64);
  return { id: idText, name: cleanName(raw.nickname, idText) };
}

function boundedInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function giftDiamonds(data) {
  const raw = data.giftDetails?.diamondCount ?? data.diamondCount ?? data.extendedGiftInfo?.diamond_count;
  return boundedInt(raw, 1, MAX_DIAMONDS, 1);
}

function normalizeGift(user, data) {
  const giftType = data.giftDetails?.giftType ?? data.giftType;
  // Quà dạng chuỗi (giftType 1) bắn sự kiện liên tục; chỉ tính khi chuỗi kết thúc.
  if (giftType === 1 && !data.repeatEnd) return null;
  return {
    type: 'gift',
    user,
    diamonds: giftDiamonds(data),
    count: boundedInt(data.repeatCount, 1, MAX_COUNT, 1),
    giftName: cleanName(data.giftDetails?.giftName ?? data.giftName, 'Quà'),
  };
}

const MAPPERS = Object.freeze({
  chat: (user, data) => ({ type: 'comment', user, text: String(data.comment ?? '').slice(0, MAX_TEXT_LENGTH) }),
  like: (user, data) => ({ type: 'like', user, count: boundedInt(data.likeCount, 1, MAX_COUNT, 1) }),
  gift: normalizeGift,
  follow: (user) => ({ type: 'follow', user }),
  share: (user) => ({ type: 'share', user }),
});

/**
 * @param {string} kind tên sự kiện của tiktok-live-connector (chat, like, gift, follow, share)
 * @param {unknown} data payload thô
 * @returns {object|null} action cho engine, hoặc null nếu bỏ qua
 */
export function normalizeLiveEvent(kind, data) {
  const mapper = MAPPERS[kind];
  if (!mapper || !data || typeof data !== 'object') return null;
  const user = toUser(data.user);
  if (!user) return null;
  return mapper(user, data);
}

/**
 * Kiểm tra action gửi từ trang điều khiển giả lập (qua WebSocket).
 * @param {unknown} input
 * @returns {object|null}
 */
export function validateClientAction(input) {
  if (!input || typeof input !== 'object') return null;
  const { type, user } = input;
  if (!ACTION_TYPES.has(type)) return null;
  if (!user || !isNonEmptyString(user.id) || !isNonEmptyString(user.name)) return null;
  const cleanUser = { id: user.id.trim().slice(0, 64), name: cleanName(user.name, user.id) };

  if (type === 'gift') {
    const diamonds = Number(input.diamonds);
    if (!Number.isFinite(diamonds) || diamonds < 1 || diamonds > MAX_DIAMONDS) return null;
    return {
      type, user: cleanUser,
      diamonds: Math.floor(diamonds),
      count: boundedInt(input.count, 1, MAX_COUNT, 1),
      giftName: cleanName(input.giftName, 'Quà'),
    };
  }
  if (type === 'like') return { type, user: cleanUser, count: boundedInt(input.count, 1, MAX_COUNT, 1) };
  if (type === 'comment') return { type, user: cleanUser, text: String(input.text ?? '').slice(0, MAX_TEXT_LENGTH) };
  return { type, user: cleanUser };
}
