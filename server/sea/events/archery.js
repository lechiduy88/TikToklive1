// 🎯 Bắn cung: cứ volleyEveryMs cả 5 đội cùng bắn một mũi. Đội tiếp sức nhiều nhất trong lượt ngắm
// bắn chuẩn nhất, đội khác vẫn có thể trúng điểm cao (tay run ít hơn) => mỗi loạt là một khoảnh khắc hồi hộp.
import { ARCHERY, TEAM_IDS } from '../config.js';

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
const MISS = 0;
const MAX_RING = 9; // vòng 0 = hồng tâm 10 điểm, vòng 9 = 1 điểm

function shoot(team, aim, best, rng) {
  const angle = rng() * Math.PI * 2;
  if (aim <= 0) return { team, score: MISS, ring: MAX_RING + 1, angle };
  const share = aim / best;
  const wobble = 0.35 + 0.65 * rng();
  const ring = Math.max(0, Math.min(MAX_RING, Math.floor(ARCHERY.spread * wobble * (1 - ARCHERY.focus * share))));
  return { team, score: 10 - ring, ring, angle };
}

export const archery = Object.freeze({
  id: 'archery',
  name: 'Bắn cung',
  icon: '🎯',
  rule: 'Tiếp sức trong lúc ngắm · đội góp nhiều nhất bắn chuẩn nhất',
  maxMs: ARCHERY.volleys * ARCHERY.volleyEveryMs + 1_000,

  create(now) {
    return { aim: zeros(), totals: zeros(), effort: zeros(), volley: 0, nextVolleyAt: now + ARCHERY.volleyEveryMs, last: null };
  },

  buffMinLead: ARCHERY.buffMinLead,

  /** Tổng điểm hiện tại (để tính buff). */
  standing(ev) {
    return { ...ev.totals };
  },

  accepts(ev, team) {
    return Object.hasOwn(ev.aim, team) && ev.volley < ARCHERY.volleys;
  },

  addEffort(ev, team, amount) {
    if (!Object.hasOwn(ev.aim, team) || amount <= 0) return { state: ev, events: [] };
    return {
      state: { ...ev, aim: { ...ev.aim, [team]: ev.aim[team] + amount }, effort: { ...ev.effort, [team]: ev.effort[team] + amount } },
      events: [],
    };
  },

  step(ev, _dtMs, now, rng) {
    if (ev.volley >= ARCHERY.volleys || now < ev.nextVolleyAt) return { state: ev, events: [], done: ev.volley >= ARCHERY.volleys };
    const best = Math.max(...Object.values(ev.aim));
    const results = TEAM_IDS.map((team) => shoot(team, ev.aim[team], best, rng));
    const totals = { ...ev.totals };
    for (const r of results) totals[r.team] += r.score;
    const volley = ev.volley + 1;
    const state = { ...ev, aim: zeros(), totals, volley, nextVolleyAt: ev.nextVolleyAt + ARCHERY.volleyEveryMs, last: results };
    return { state, events: [{ type: 'volley', volley, results }], done: volley >= ARCHERY.volleys };
  },

  ranking(ev) {
    return [...TEAM_IDS].sort((a, b) => ev.totals[b] - ev.totals[a] || ev.effort[b] - ev.effort[a]);
  },

  view(ev, now) {
    return {
      volley: ev.volley,
      volleys: ARCHERY.volleys,
      nextVolleyInMs: Math.max(0, ev.nextVolleyAt - now),
      aim: ev.aim,
      totals: ev.totals,
      last: ev.last,
    };
  },
});
