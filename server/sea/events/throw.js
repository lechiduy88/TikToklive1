// Kiểu "lấy đà rồi ném" (💪 đẩy tạ, 🏹 ném lao, 🦘 nhảy xa): mỗi lượt attemptMs, sức tiếp nạp vào "đà";
// hết lượt thì ném: khoảng cách = maxDistance × (1 − e^(−đà / đà kỳ vọng)) — càng nhiều đà càng xa nhưng
// không vượt kỷ lục. 3 lượt, tính lượt xa nhất. Không lấy đà => phạm quy (0 m).
import { SPORTS, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
const round2 = (x) => Math.round(x * 100) / 100;
// Đà kỳ vọng của một lượt chỉ đưa tới ~40% kỷ lục, chừa khoảng trống để đội cổ vũ mạnh hơn thấy rõ xa hơn
// (thay vì mọi đội đều dồn sát kỷ lục).
const HEADROOM = 2;

export function throwEvent(id) {
  const cfg = SPORTS[id];
  const distanceFor = (power, perAttempt) => (power > 0 ? round2(cfg.maxDistance * (1 - Math.exp(-power / (perAttempt * HEADROOM)))) : 0);

  return Object.freeze({
    id,
    kind: 'throw',
    name: cfg.name,
    icon: cfg.icon,
    rule: cfg.rule,
    maxMs: cfg.attempts * cfg.attemptMs + 500,
    buffMinLead: cfg.buffMinLead,

    create(now, scale = 100) {
      return {
        attempt: 1,
        attemptEndsAt: now + cfg.attemptMs,
        perAttempt: Math.max(1, scale / cfg.attempts),
        power: zeros(),
        totalPower: zeros(),
        best: zeros(),
        last: null,
      };
    },

    accepts(ev, team) {
      return Object.hasOwn(ev.power, team) && ev.attempt <= cfg.attempts;
    },

    addEffort(ev, team, amount) {
      if (!this.accepts(ev, team) || amount <= 0) return { state: ev, events: [] };
      return {
        state: {
          ...ev,
          power: { ...ev.power, [team]: ev.power[team] + amount },
          totalPower: { ...ev.totalPower, [team]: ev.totalPower[team] + amount },
        },
        events: [],
      };
    },

    /** Kết quả tốt nhất hoặc cú ném đang lấy đà (nếu xa hơn) — để tính buff. */
    standing(ev) {
      return Object.fromEntries(TEAM_IDS.map((t) => [t, Math.max(ev.best[t], distanceFor(ev.power[t], ev.perAttempt))]));
    },

    step(ev, _dtMs, now) {
      if (ev.attempt > cfg.attempts) return { state: ev, events: [], done: true };
      if (now < ev.attemptEndsAt) return { state: ev, events: [], done: false };
      const results = TEAM_IDS.map((team) => ({ team, distance: distanceFor(ev.power[team], ev.perAttempt) }));
      const best = { ...ev.best };
      for (const r of results) best[r.team] = Math.max(best[r.team], r.distance);
      const attempt = ev.attempt + 1;
      const state = { ...ev, attempt, attemptEndsAt: ev.attemptEndsAt + cfg.attemptMs, power: zeros(), best, last: results };
      return { state, events: [{ type: 'throw', attempt: ev.attempt, results }], done: attempt > cfg.attempts };
    },

    ranking(ev) {
      return [...TEAM_IDS].sort((a, b) => ev.best[b] - ev.best[a] || ev.totalPower[b] - ev.totalPower[a]);
    },

    view(ev, now) {
      return {
        attempt: Math.min(ev.attempt, cfg.attempts),
        attempts: cfg.attempts,
        attemptEndsInMs: Math.max(0, ev.attemptEndsAt - now),
        charge: Object.fromEntries(TEAM_IDS.map((t) => [t, distanceFor(ev.power[t], ev.perAttempt)])),
        best: ev.best,
        last: ev.last,
        maxDistance: cfg.maxDistance,
        unit: cfg.unit,
      };
    },
  });
}
