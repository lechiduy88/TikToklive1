// Kiểu "sức bền" (marathon, đua xe đạp): sức tiếp làm vận động viên TĂNG TỐC, tốc độ giảm dần theo
// e^(−λt) khi không ai cổ vũ => phải cổ vũ đều tay suốt môn. Xếp hạng theo quãng đường khi hết giờ.
import { SPORTS, SEA_SCALE, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));

export function enduranceEvent(id) {
  const cfg = SPORTS[id];
  const lambda = -Math.log(cfg.keepPerSecond);
  return Object.freeze({
    id,
    kind: 'endurance',
    name: cfg.name,
    icon: cfg.icon,
    rule: cfg.rule,
    maxMs: cfg.durationMs + 500,
    buffMinLead: cfg.buffMinLead,

    /** Gia tốc chọn sao cho một đội tiếp sức đều ở mức kỳ vọng đi được khoảng expectedMeters. */
    create(now, scale = 100) {
      const ratePerSecond = Math.max(0.01, scale / SEA_SCALE.targetSeconds);
      const steadySpeed = cfg.expectedMeters / (cfg.durationMs / 1000);
      return { pos: zeros(), speed: zeros(), accel: (steadySpeed * lambda) / ratePerSecond, endsAt: now + cfg.durationMs };
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
      const keep = Math.exp(-lambda * (dtMs / 1000));
      // Quãng đường đúng theo tích phân của v·e^(−λt) trong khoảng dt.
      const pos = Object.fromEntries(TEAM_IDS.map((t) => [t, ev.pos[t] + (ev.speed[t] * (1 - keep)) / lambda]));
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
        expectedMeters: cfg.expectedMeters,
      };
    },
  });
}
