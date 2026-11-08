// Công bằng & chống lợi dụng trong chế độ SEA Games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyAction, tick, toSnapshot } from '../server/sea/engine.js';
import { SEA_PHASE_MS, SEA_SCALE, SEA_XP, DRAGON_BOAT } from '../server/sea/config.js';

const rng = () => 0.5;
const user = (id) => ({ id, name: `Fan ${id}` });
const comment = (id, text) => ({ type: 'comment', user: user(id), text });
const gift = (id, diamonds, count = 1) => ({ type: 'gift', user: user(id), diamonds, count, giftName: 'Quà' });
const liveAt = SEA_PHASE_MS.opening + SEA_PHASE_MS.intro;

function run(state, fromMs, toMs, step = 50) {
  let s = state;
  const events = [];
  for (let now = fromMs + step; now <= toMs; now += step) {
    const r = tick(s, step, now, rng);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function liveWith(teams) {
  let state = createMatch(0, rng);
  for (const [id, text] of teams) state = applyAction(state, comment(id, text), 0).state;
  return run(state, 0, liveAt).state;
}

test('one person cannot pour unlimited gifts into a single event; the rest is banked', () => {
  let state = liveWith([['a', 'VN'], ['b', 'TH']]);
  const before = state.teamEventEffort.vn;
  for (let i = 0; i < 20; i += 1) state = applyAction(state, gift('a', 99), liveAt + 10 + i).state;
  const applied = state.teamEventEffort.vn - before;
  assert.ok(applied <= SEA_SCALE.athleteGiftShare * state.eventScale + 1e-9, `applied ${applied}`);
  assert.ok(state.pendingEffort.vn > 0);
});

test('different supporters of the same team can each contribute their share', () => {
  let state = liveWith([['a', 'TH'], ['b', 'TH'], ['c', 'VN']]);
  const before = state.teamEventEffort.th;
  for (const id of ['a', 'b']) for (let i = 0; i < 20; i += 1) state = applyAction(state, gift(id, 99), liveAt + 10).state;
  assert.ok(state.teamEventEffort.th - before > SEA_SCALE.athleteGiftShare * state.eventScale);
});

test('gifts during the closing ceremony are banked for the next session', () => {
  let state = createMatch(0, rng);
  state = { ...state, phase: 'closing', phaseEndsAt: 1000 };
  state = applyAction(state, comment('a', 'PH'), 0).state;
  state = applyAction(state, gift('a', 99), 10).state;
  assert.ok(state.pendingEffort.ph > 0);
  const next = run(state, 0, 1000).state;
  assert.equal(next.session, 2);
  assert.ok(next.pendingEffort.ph > 0, 'carried into the new session');
});

test('teams with identical banked effort start the race level (no order bias)', () => {
  let state = createMatch(0, rng);
  const ids = ['VN', 'TH', 'ID', 'PH', 'MY'];
  ids.forEach((code, i) => { state = applyAction(state, comment(`u${i}`, code), 0).state; });
  ids.forEach((_code, i) => { state = applyAction(state, gift(`u${i}`, 25), 0).state; });
  state = run(state, 0, liveAt).state;
  const pos = Object.values(toSnapshot(state, liveAt, () => 1).event.view.pos);
  assert.ok(pos.every((p) => Math.abs(p - pos[0]) < 1e-9), `positions ${pos}`);
  assert.ok(pos[0] > 0);
});


test('a perfect tie at the top of the medal table crowns co-champions', () => {
  let state = createMatch(0, rng);
  state = {
    ...state,
    phase: 'podium',
    phaseEndsAt: 0,
    eventIndex: state.eventOrder.length - 1,
    medals: { ...state.medals, vn: { gold: 2, silver: 1, bronze: 0 }, th: { gold: 2, silver: 1, bronze: 0 } },
  };
  const { events } = tick(state, 50, 50, rng);
  const closing = events.find((e) => e.type === 'closing');
  assert.equal(closing.champion, null);
  assert.deepEqual([...closing.champions].sort(), ['th', 'vn']);
});

test('medal xp needs a real contribution, not a single last-second comment', () => {
  let state = liveWith([['a', 'VN']]);
  for (let i = 0; i < 40; i += 1) state = applyAction(state, gift('a', 99), liveAt + 10).state;
  state = applyAction(state, comment('late', 'VN'), liveAt + 20).state;
  const { events } = run(state, liveAt, liveAt + DRAGON_BOAT.maxMs + 1_000, 100);
  const xp = Object.fromEntries(events.find((e) => e.type === 'match_end').result.participants.map((p) => [p.id, p.xp]));
  assert.ok(xp.a >= SEA_XP.gold);
  assert.ok(xp.late < SEA_XP.gold, `late joiner xp ${xp.late}`);
});

test('athletes keep their country in the next session', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'MY'), 0).state;
  state = { ...state, phase: 'closing', phaseEndsAt: 100 };
  const next = run(state, 0, 100).state;
  assert.equal(next.athletes.a.team, 'my');
  assert.equal(next.athletes.a.effort, 0, 'session stats reset');
});

test('the snapshot tells the screen how long the current phase lasts', () => {
  const snap = toSnapshot(createMatch(0, rng), 0, () => 1);
  assert.equal(snap.phaseDurationMs, SEA_PHASE_MS.opening);
});
