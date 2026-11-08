// 🚣 Đua thuyền rồng: sức tiếp cộng dồn thành quãng đường; 3 thuyền về đích đầu tiên giành huy chương.
// (Thuyền bị bỏ xa được buff chung qua balance.js, như mọi môn khác.)
import { DRAGON_BOAT, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));

export const dragonBoat = Object.freeze({
  id: 'dragon_boat',
  name: 'Đua thuyền rồng',
  icon: '🚣',
  rule: 'Comment, thả tim để chèo · về đích trước giành Vàng',
  maxMs: DRAGON_BOAT.maxMs,
  buffMinLead: DRAGON_BOAT.buffMinLead,

  /** @param {number} scale sức tiếp cần để một đội chèo hết đường đua (tự điều chỉnh theo độ sôi động) */
  create(_now, scale = 100) {
    return { pos: zeros(), finished: [], metersPerEffort: DRAGON_BOAT.track / Math.max(1, scale) };
  },

  accepts(ev, team) {
    return Object.hasOwn(ev.pos, team) && !ev.finished.includes(team);
  },

  addEffort(ev, team, amount) {
    if (!this.accepts(ev, team) || amount <= 0) return { state: ev, events: [] };
    const next = Math.min(DRAGON_BOAT.track, ev.pos[team] + amount * ev.metersPerEffort);
    const pos = { ...ev.pos, [team]: next };
    if (next < DRAGON_BOAT.track) return { state: { ...ev, pos }, events: [] };
    const finished = [...ev.finished, team];
    return { state: { ...ev, pos, finished }, events: [{ type: 'finish', team, place: finished.length }] };
  },

  /** Quãng đường của các thuyền chưa về đích (để tính buff). */
  standing(ev) {
    return Object.fromEntries(TEAM_IDS.filter((t) => !ev.finished.includes(t)).map((t) => [t, ev.pos[t]]));
  },

  step(ev) {
    return { state: ev, events: [], done: ev.finished.length >= DRAGON_BOAT.finishers };
  },

  ranking(ev) {
    const rest = TEAM_IDS.filter((t) => !ev.finished.includes(t)).sort((a, b) => ev.pos[b] - ev.pos[a]);
    return [...ev.finished, ...rest];
  },

  view(ev) {
    return { pos: ev.pos, finished: ev.finished, track: DRAGON_BOAT.track };
  },
});
