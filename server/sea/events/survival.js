// Kiểu "giữ cầu" (🏐 cầu mây): quả cầu của mỗi đội rơi dần (sau thời gian khởi động graceMs);
// mỗi lượt tiếp sức là một cú tâng đẩy cầu lên. Cầu chạm đất => đội bị loại. Đội trụ lại cuối cùng thắng;
// hết giờ thì xếp theo độ cao còn lại. Cú tâng được chỉnh để đội tiếp sức ở mức kỳ vọng giữ được cầu.
import { SPORTS, SEA_SCALE, TEAM_IDS } from '../config.js';

const filled = (value) => Object.fromEntries(TEAM_IDS.map((t) => [t, value]));
const MAX_HEIGHT = 1;

export function survivalEvent(id) {
  const cfg = SPORTS[id];
  return Object.freeze({
    id,
    kind: 'survival',
    name: cfg.name,
    icon: cfg.icon,
    rule: cfg.rule,
    maxMs: cfg.durationMs + 500,
    buffMinLead: cfg.buffMinLead,

    create(now, scale = 100) {
      const ratePerSecond = Math.max(0.01, scale / SEA_SCALE.targetSeconds);
      return {
        height: filled(cfg.startHeight),
        alive: [...TEAM_IDS],
        dropped: [],
        kick: cfg.fallPerSecond / ratePerSecond,
        fallsFrom: now + cfg.graceMs,
        endsAt: now + cfg.durationMs,
      };
    },

    accepts(ev, team) {
      return ev.alive.includes(team);
    },

    addEffort(ev, team, amount) {
      if (!this.accepts(ev, team) || amount <= 0) return { state: ev, events: [] };
      const height = Math.min(MAX_HEIGHT, ev.height[team] + amount * ev.kick);
      return { state: { ...ev, height: { ...ev.height, [team]: height } }, events: [] };
    },

    standing(ev) {
      return Object.fromEntries(ev.alive.map((t) => [t, ev.height[t]]));
    },

    step(ev, dtMs, now) {
      if (ev.alive.length <= 1 || now >= ev.endsAt) return { state: ev, events: [], done: true };
      if (now <= ev.fallsFrom) return { state: ev, events: [], done: false };
      const fall = cfg.fallPerSecond * (Math.min(dtMs, now - ev.fallsFrom) / 1000);
      const height = { ...ev.height };
      for (const t of ev.alive) height[t] = Math.max(0, height[t] - fall);
      // Cầu rơi cùng lúc: đội thấp hơn trước khi rơi bị coi là rơi trước.
      const falling = ev.alive.filter((t) => height[t] <= 0).sort((a, b) => ev.height[a] - ev.height[b]);
      const alive = ev.alive.filter((t) => height[t] > 0);
      const events = falling.map((team) => ({ type: 'dropped', team }));
      const state = { ...ev, height, alive, dropped: [...ev.dropped, ...falling] };
      return { state, events, done: alive.length <= 1 };
    },

    ranking(ev) {
      const alive = [...ev.alive].sort((a, b) => ev.height[b] - ev.height[a]);
      return [...alive, ...[...ev.dropped].reverse()];
    },

    view(ev, now) {
      return {
        height: ev.height,
        alive: ev.alive,
        dropped: ev.dropped,
        endsInMs: Math.max(0, ev.endsAt - now),
        graceInMs: Math.max(0, ev.fallsFrom - now),
      };
    },
  });
}
