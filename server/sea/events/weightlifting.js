// 🏋️ Cử tạ loại trực tiếp: mỗi lượt roundMs, đội có lực nâng thấp nhất bị loại. Lực nâng tính lại từ 0
// mỗi lượt, nên đội đang dẫn cũng có thể bị loại nếu lơ là => ai cũng phải tiếp sức đến lượt cuối.
import { WEIGHTLIFTING, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));

function weakest(ev) {
  return [...ev.alive].sort((a, b) => ev.meter[a] - ev.meter[b] || ev.total[a] - ev.total[b] || TEAM_IDS.indexOf(b) - TEAM_IDS.indexOf(a))[0];
}

export const weightlifting = Object.freeze({
  id: 'weightlifting',
  name: 'Cử tạ',
  icon: '🏋️',
  rule: 'Mỗi lượt 10 giây · đội nâng yếu nhất bị loại',
  maxMs: WEIGHTLIFTING.roundMs * (TEAM_IDS.length - 1) + 1_000,

  create(now) {
    return { alive: [...TEAM_IDS], eliminated: [], round: 1, roundEndsAt: now + WEIGHTLIFTING.roundMs, meter: zeros(), total: zeros() };
  },

  buffMinLead: WEIGHTLIFTING.buffMinLead,

  /** Lực nâng lượt này của các đội còn trụ (để tính buff: đội sắp bị loại được tiếp sức mạnh hơn). */
  standing(ev) {
    return Object.fromEntries(ev.alive.map((t) => [t, ev.meter[t]]));
  },

  accepts(ev, team) {
    return ev.alive.includes(team) && ev.alive.length > 1;
  },

  addEffort(ev, team, amount) {
    if (!ev.alive.includes(team) || amount <= 0) return { state: ev, events: [] };
    return {
      state: { ...ev, meter: { ...ev.meter, [team]: ev.meter[team] + amount }, total: { ...ev.total, [team]: ev.total[team] + amount } },
      events: [],
    };
  },

  step(ev, _dtMs, now) {
    if (ev.alive.length <= 1 || now < ev.roundEndsAt) return { state: ev, events: [], done: ev.alive.length <= 1 };
    const out = weakest(ev);
    const alive = ev.alive.filter((t) => t !== out);
    const state = {
      ...ev,
      alive,
      eliminated: [...ev.eliminated, out],
      round: ev.round + 1,
      roundEndsAt: ev.roundEndsAt + WEIGHTLIFTING.roundMs,
      meter: zeros(),
    };
    return { state, events: [{ type: 'eliminated', team: out, round: ev.round, meter: ev.meter[out] }], done: alive.length <= 1 };
  },

  ranking(ev) {
    const alive = [...ev.alive].sort((a, b) => ev.total[b] - ev.total[a]);
    return [...alive, ...[...ev.eliminated].reverse()];
  },

  view(ev, now) {
    return {
      round: ev.round,
      rounds: TEAM_IDS.length - 1,
      roundEndsInMs: Math.max(0, ev.roundEndsAt - now),
      meter: ev.meter,
      alive: ev.alive,
      eliminated: ev.eliminated,
    };
  },
});
