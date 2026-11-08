// Kiểu "đua về đích" (đua thuyền rồng, bơi lội, leo núi): sức tiếp cộng dồn thành quãng đường;
// 3 đội về đích đầu tiên giành huy chương. Đội bị bỏ xa được buff chung qua balance.js.
import { SPORTS, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));

export function raceEvent(id) {
  const cfg = SPORTS[id];
  return Object.freeze({
    id,
    kind: 'race',
    name: cfg.name,
    icon: cfg.icon,
    rule: cfg.rule,
    maxMs: cfg.maxMs,
    buffMinLead: cfg.buffMinLead,

    /** @param {number} scale sức tiếp cần để một đội đi hết đường đua (tự điều chỉnh theo độ sôi động) */
    create(_now, scale = 100) {
      return { pos: zeros(), finished: [], metersPerEffort: cfg.track / Math.max(1, scale) };
    },

    accepts(ev, team) {
      return Object.hasOwn(ev.pos, team) && !ev.finished.includes(team);
    },

    addEffort(ev, team, amount) {
      if (!this.accepts(ev, team) || amount <= 0) return { state: ev, events: [] };
      const next = Math.min(cfg.track, ev.pos[team] + amount * ev.metersPerEffort);
      const pos = { ...ev.pos, [team]: next };
      if (next < cfg.track) return { state: { ...ev, pos }, events: [] };
      const finished = [...ev.finished, team];
      return { state: { ...ev, pos, finished }, events: [{ type: 'finish', team, place: finished.length }] };
    },

    /** Quãng đường của các đội chưa về đích (để tính buff). */
    standing(ev) {
      return Object.fromEntries(TEAM_IDS.filter((t) => !ev.finished.includes(t)).map((t) => [t, ev.pos[t]]));
    },

    step(ev) {
      return { state: ev, events: [], done: ev.finished.length >= cfg.finishers };
    },

    ranking(ev) {
      const rest = TEAM_IDS.filter((t) => !ev.finished.includes(t)).sort((a, b) => ev.pos[b] - ev.pos[a]);
      return [...ev.finished, ...rest];
    },

    view(ev) {
      return { pos: ev.pos, finished: ev.finished, track: cfg.track };
    },
  });
}
