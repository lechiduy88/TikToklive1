// Tương tác người xem => chọn đội + sức tiếp cho đội trong môn đang thi. Hàm thuần.
import { SEA_EFFORT, SEA_SCALE } from './config.js';
import { resolveCountry, ensureAthlete, updateAthlete } from './roster.js';
import { giftEffort, giftTier, likeEffort, commentEffort } from './effort.js';
import { EVENT_MODULES } from './events/index.js';
import { buffsFor } from './balance.js';

const SWITCH_PHASES = new Set(['opening', 'intro', 'podium', 'closing']);
const SWITCH_LOCK_EFFORT = 5;

function register(state, user, requested, now) {
  const { athletes, athlete, joined } = ensureAthlete(state.athletes, user, requested);
  if (joined) return { state: { ...state, athletes }, athlete, events: [{ type: 'join', name: athlete.name, team: athlete.team }] };
  // Ngoài lúc đang thi, gõ mã nước khác để đổi đội — trừ khi đã góp thật cho đội cũ trong kỳ này
  // (chống "nhảy sang đội nhỏ để ăn buff ít người").
  const locked = athlete.effort >= SWITCH_LOCK_EFFORT;
  if (requested && requested !== athlete.team && SWITCH_PHASES.has(state.phase) && !locked) {
    const moved = updateAthlete(athletes, athlete.id, { team: requested });
    return { state: { ...state, athletes: moved }, athlete: moved[athlete.id], events: [{ type: 'join', name: athlete.name, team: requested }] };
  }
  return { state, athlete, events: [] };
}

/** Phần quà được đổ ngay vào môn: giới hạn theo từng món và theo tổng của người đó trong môn. */
function giftAllowance(athlete, amount, scale) {
  const personLeft = Math.max(0, SEA_SCALE.athleteGiftShare * scale - athlete.eventGiftApplied);
  return Math.min(amount, SEA_SCALE.giftShare * scale, personLeft);
}

const addPending = (state, team, amount) => ({ ...state, pendingEffort: { ...state.pendingEffort, [team]: state.pendingEffort[team] + amount } });
const bankedEvent = (a, amount) => ({ type: 'banked', team: a.team, name: a.name, amount: Math.round(amount) });

/**
 * Đổ sức tiếp vào môn đang thi. Không bao giờ làm mất sức tiếp:
 *  - môn chưa bắt đầu, hoặc đội đã về đích / bị loại => để dành cho môn sau;
 *  - quà vượt giftShare × scale của môn => phần dư để dành (một món quà không thể quyết định cả môn).
 */
function contribute(state, athlete, amount, { free, gift }) {
  if (amount <= 0) return { state, events: [] };
  const a = state.athletes[athlete.id];
  const athletes = updateAthlete(state.athletes, a.id, {
    effort: a.effort + amount,
    eventEffort: a.eventEffort + amount,
    eventFreeEffort: a.eventFreeEffort + (free ? amount : 0),
  });
  const base = { ...state, athletes };
  if (state.phase !== 'live') return { state: addPending(base, a.team, amount), events: [] };
  const mod = EVENT_MODULES[state.event.id];
  if (!mod.accepts(state.event.state, a.team)) return { state: addPending(base, a.team, amount), events: [bankedEvent(a, amount)] };

  const applied = gift ? giftAllowance(a, amount, state.eventScale) : amount;
  const overflow = amount - applied;
  // Tự cân bằng: đội đang bị bỏ xa được nhân sức tiếp (đội dẫn đầu luôn ×1).
  const boosted = applied * buffsFor(state)[a.team];
  const result = mod.addEffort(state.event.state, a.team, boosted);
  const next = {
    ...base,
    athletes: gift ? updateAthlete(athletes, a.id, { eventGiftApplied: a.eventGiftApplied + applied }) : athletes,
    event: { ...state.event, state: result.state },
    teamEventEffort: { ...state.teamEventEffort, [a.team]: state.teamEventEffort[a.team] + boosted },
    // Đo độ sôi động bằng sức tiếp GỐC (chưa buff), để buff không làm méo độ khó môn sau.
    rawEventEffort: (state.rawEventEffort ?? 0) + applied,
  };
  if (overflow <= 0) return { state: next, events: result.events };
  return { state: addPending(next, a.team, overflow), events: [...result.events, bankedEvent(a, overflow)] };
}

const HANDLERS = {
  comment(state, a, action, now) {
    const amount = commentEffort(a.lastCommentAt, now);
    if (amount <= 0) return { state, amount: 0 };
    const athletes = updateAthlete(state.athletes, a.id, { lastCommentAt: now, comments: a.comments + 1 });
    return { state: { ...state, athletes }, amount, free: true };
  },
  like(state, a, action) {
    const { effort, buffer } = likeEffort(state.likeBuffer[a.team], action.count);
    const athletes = updateAthlete(state.athletes, a.id, { likes: a.likes + action.count });
    return { state: { ...state, athletes, likeBuffer: { ...state.likeBuffer, [a.team]: buffer } }, amount: effort, free: true };
  },
  gift(state, a, action) {
    const diamonds = action.diamonds * action.count;
    const athletes = updateAthlete(state.athletes, a.id, { diamonds: a.diamonds + diamonds, eventDiamonds: a.eventDiamonds + diamonds });
    const show = { type: 'gift', name: a.name, team: a.team, giftName: action.giftName, count: action.count, diamonds, tier: giftTier(action.diamonds) };
    return { state: { ...state, athletes }, amount: giftEffort(action.diamonds, action.count), free: false, show };
  },
  follow: (state, a) => ({ state, amount: SEA_EFFORT.follow, free: true, show: { type: 'cheer', name: a.name, team: a.team, kind: 'follow' } }),
  share: (state, a) => ({ state, amount: SEA_EFFORT.share, free: true, show: { type: 'cheer', name: a.name, team: a.team, kind: 'share' } }),
};

/**
 * @param {object} state trạng thái đại hội
 * @param {{type: string, user: {id: string, name: string}}} action
 * @param {number} now
 */
export function applySeaAction(state, action, now) {
  const handler = HANDLERS[action.type];
  if (!handler) return { state, events: [] };
  const requested = action.type === 'comment' ? resolveCountry(action.text) : null;
  const reg = register(state, action.user, requested, now);
  // (Lúc bế mạc vẫn nhận: sức tiếp được để dành sang kỳ đại hội sau.)
  const athlete = reg.state.athletes[action.user.id];
  const handled = handler(reg.state, athlete, action, now);
  const done = contribute(handled.state, athlete, handled.amount, { free: handled.free, gift: action.type === 'gift' });
  const shown = handled.show ? [handled.show] : [];
  return { state: done.state, events: [...reg.events, ...shown, ...done.events] };
}
