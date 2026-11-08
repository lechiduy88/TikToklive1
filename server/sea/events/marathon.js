// 🏃 Chạy marathon (sức bền): sức tiếp làm vận động viên TĂNG TỐC, nhưng tốc độ giảm dần khi không ai cổ vũ.
// Cổ vũ đều tay suốt 2 phút thắng một cú bùng nổ rồi im lặng. Xếp hạng theo quãng đường khi hết giờ.
import { MARATHON, SEA_SCALE, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
const LAMBDA = -Math.log(MARATHON.keepPerSecond); // tốc độ giảm theo e^(−λt)

export const marathon = Object.freeze({
  id: 'marathon',
  name: 'Chạy marathon',
  icon: '🏃',
  rule: 'Cổ vũ liên tục để giữ tốc độ · ngừng là chậm lại!',
  maxMs: MARATHON.durationMs + 500,
  buffMinLead: MARATHON.buffMinLead,

  /**
   * @param {number} scale sức tiếp kỳ vọng của một đội trong môn (tự điều chỉnh theo độ sôi động).
   * Gia tốc được chọn để một đội tiếp sức đều ở mức kỳ vọng chạy được khoảng expectedMeters.
   */
  create(now, scale = 100) {
    const ratePerSecond = Math.max(0.01, scale / SEA_SCALE.targetSeconds);
    const steadySpeed = MARATHON.expectedMeters / (MARATHON.durationMs / 1000);
    return { pos: zeros(), speed: zeros(), accel: (steadySpeed * LAMBDA) / ratePerSecond, endsAt: now + MARATHON.durationMs };
  },

  accepts(ev, team) {
    return Object.hasOwn(ev.pos, team);
  },

  addEffort(ev, team, amount) {
    if (!this.accepts(ev, team) || amount <= 0) return { state: ev, events: [] };
    return { state: { ...ev, speed: { ...ev.speed, [team]: ev.speed[team] + amount * ev.accel } }, events: [] };
  },

  standing(ev) {
    return { ...ev.pos };
  },

  step(ev, dtMs, now) {
    const dt = dtMs / 1000;
    const keep = Math.exp(-LAMBDA * dt);
    // Quãng đường đúng theo tích phân của v·e^(−λt) trong khoảng dt.
    const travelled = (v) => (v * (1 - keep)) / LAMBDA;
    const pos = Object.fromEntries(TEAM_IDS.map((t) => [t, ev.pos[t] + travelled(ev.speed[t])]));
    const speed = Object.fromEntries(TEAM_IDS.map((t) => [t, ev.speed[t] * keep]));
    return { state: { ...ev, pos, speed }, events: [], done: now >= ev.endsAt };
  },

  ranking(ev) {
    return [...TEAM_IDS].sort((a, b) => ev.pos[b] - ev.pos[a]);
  },

  view(ev, now) {
    return {
      pos: Object.fromEntries(TEAM_IDS.map((t) => [t, Math.round(ev.pos[t])])),
      speed: Object.fromEntries(TEAM_IDS.map((t) => [t, Math.round(ev.speed[t] * 10) / 10])),
      endsInMs: Math.max(0, ev.endsAt - now),
      expectedMeters: MARATHON.expectedMeters,
    };
  },
});
