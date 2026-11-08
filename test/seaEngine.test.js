import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyAction, tick, toSnapshot } from '../server/sea/engine.js';
import { SEA_PHASE_MS, SEA_SESSION, SEA_EFFORT, SEA_SCALE, DRAGON_BOAT } from '../server/sea/config.js';

const rng = () => 0.5;
const user = (id) => ({ id, name: `Fan ${id}` });
const comment = (id, text) => ({ type: 'comment', user: user(id), text });
const gift = (id, diamonds, count = 1) => ({ type: 'gift', user: user(id), diamonds, count, giftName: 'Quà' });

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

const liveAt = SEA_PHASE_MS.opening + SEA_PHASE_MS.intro;

test('a session opens with country selection and empty medals', () => {
  const state = createMatch(0, rng);
  assert.equal(state.phase, 'opening');
  const snap = toSnapshot(state, 0, () => 1);
  assert.equal(snap.mode, 'sea');
  assert.equal(snap.medals.length, 5);
  assert.ok(snap.medals.every((r) => r.total === 0));
  assert.equal(snap.eventCount, SEA_SESSION.eventsPerSession);
});

test('typing a country code joins that team and can be changed before the event starts', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'TH'), 0).state;
  assert.equal(state.athletes.a.team, 'th');
  const switched = applyAction(state, comment('a', 'việt nam'), 100);
  assert.equal(switched.state.athletes.a.team, 'vn');
  assert.ok(switched.events.some((e) => e.type === 'join' && e.team === 'vn'));
});

test('the team cannot be switched in the middle of an event', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'TH'), 0).state;
  state = run(state, 0, liveAt).state;
  assert.equal(state.phase, 'live');
  state = applyAction(state, comment('a', 'VN'), liveAt + 5000).state;
  assert.equal(state.athletes.a.team, 'th');
});

test('effort sent before the event starts is carried into it', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, gift('a', 5), 0).state;
  state = run(state, 0, liveAt).state;
  const snap = toSnapshot(state, liveAt, () => 1);
  const team = state.athletes.a.team;
  assert.ok(snap.event.view.pos[team] > 0, 'boat moved at the start');
});

test('the session runs through intro, live and podium, awarding medals', () => {
  let state = createMatch(0, rng);
  // Mỗi đội 2 cổ động viên (một người không thể một mình kéo cả đội về đích).
  const fans = [['a', 'VN'], ['a2', 'VN'], ['b', 'TH'], ['b2', 'TH'], ['c', 'ID'], ['c2', 'ID']];
  for (const [id, text] of fans) state = applyAction(state, comment(id, text), 0).state;
  state = run(state, 0, liveAt).state;
  for (const [id] of fans) {
    const count = id === 'a' ? 12 : 10; // "a" góp nhiều nhất => vận động viên tiêu biểu của VN
    for (let i = 0; i < count; i += 1) state = applyAction(state, gift(id, 99), liveAt + 100).state;
  }
  const r = run(state, liveAt, liveAt + 200);
  assert.equal(r.state.phase, 'podium');
  const podium = r.events.find((e) => e.type === 'podium');
  assert.deepEqual(podium.medals, { gold: 'vn', silver: 'th', bronze: 'id' });
  assert.ok(r.events.some((e) => e.type === 'match_end' && e.result.participants.length === 6));
  const snap = toSnapshot(r.state, liveAt + 200, () => 1);
  assert.equal(snap.medals[0].team, 'vn');
  assert.equal(snap.podium.stars.vn.name, 'Fan a');
});

test('teams with no effort get no medal even if few teams competed', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'PH'), 0).state;
  state = run(state, 0, liveAt).state;
  for (let i = 0; i < 400; i += 1) state = applyAction(state, gift('a', 99), liveAt + 100).state;
  const r = run(state, liveAt, liveAt + DRAGON_BOAT.maxMs + 200, 100);
  const podium = r.events.find((e) => e.type === 'podium');
  assert.deepEqual(podium.medals, { gold: 'ph' });
});

test('after the last event a closing ceremony crowns a champion and a new session starts', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'MY'), 0).state;
  const events = [];
  let now = 0;
  const totalMs = 20 * 60_000;
  while (now < totalMs && !events.some((e) => e.type === 'session_start')) {
    now += 100;
    if (now % 500 === 0) state = applyAction(state, gift('a', 1, 10), now).state;
    const r = tick(state, 100, now, rng);
    state = r.state;
    events.push(...r.events);
  }
  const closing = events.find((e) => e.type === 'closing');
  assert.equal(closing.champion, 'my');
  assert.equal(events.filter((e) => e.type === 'podium').length, SEA_SESSION.eventsPerSession);
  assert.equal(state.phase, 'opening');
  assert.equal(state.session, 2);
  assert.ok(toSnapshot(state, now, () => 1).medals.every((r) => r.total === 0), 'medals reset for the new session');
});

test('comments are rate-limited and xp from gifts is capped', () => {
  let state = createMatch(0, rng);
  state = run(applyAction(state, comment('a', 'VN'), 0).state, 0, liveAt).state;
  const before = state.athletes.a.eventEffort;
  state = applyAction(state, comment('a', 'cố lên'), liveAt).state;
  state = applyAction(state, comment('a', 'cố lên'), liveAt + 10).state;
  assert.equal(state.athletes.a.eventEffort - before, SEA_EFFORT.comment);
  for (let i = 0; i < 5; i += 1) state = applyAction(state, gift('a', 29_999), liveAt + 20).state;
  const r = run(state, liveAt, liveAt + DRAGON_BOAT.maxMs + 100, 100);
  const xp = r.events.find((e) => e.type === 'match_end').result.participants[0].xp;
  assert.ok(xp <= 15 + 15 + 10 + 10, `xp ${xp} is capped`);
});

test('effort for a team that is already out of the event is banked for the next event, not lost', () => {
  let state = createMatch(0, rng);
  for (const [id, text] of [['a', 'VN'], ['b', 'TH']]) state = applyAction(state, comment(id, text), 0).state;
  state = run(state, 0, liveAt).state;
  for (let i = 0; i < 30; i += 1) state = applyAction(state, gift('a', 99), liveAt + 10).state; // VN về đích
  const banked = applyAction(state, gift('a', 99), liveAt + 20);
  assert.ok(banked.events.some((e) => e.type === 'banked' && e.team === 'vn'));
  assert.ok(banked.state.pendingEffort.vn > 0);
});

test('one huge gift is capped per event and the rest is banked for later events', () => {
  let state = createMatch(0, rng);
  for (const [id, text] of [['a', 'VN'], ['b', 'TH']]) state = applyAction(state, comment(id, text), 0).state;
  state = run(state, 0, liveAt).state;
  const scale = state.eventScale;
  const before = state.teamEventEffort.vn;
  const r = applyAction(state, gift('a', 29_999), liveAt + 10);
  const cap = SEA_SCALE.giftShare * scale;
  assert.ok(Math.abs(r.state.teamEventEffort.vn - before - cap) < 1e-9, 'only the per-gift cap goes into this event');
  assert.ok(r.state.pendingEffort.vn > 0, 'the rest is banked');
  assert.ok(r.events.some((e) => e.type === 'banked'));
  assert.ok(toSnapshot(r.state, liveAt + 10, () => 1).event.view.pos.vn < 1000 * 0.5, 'a whale cannot win the race alone');
});

test('banked effort is released gradually at the start of later events', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'VN'), 0).state;
  state = applyAction(state, gift('a', 29_999), 0).state; // gửi lúc khai mạc => để dành
  const before = state.pendingEffort.vn;
  state = run(state, 0, liveAt).state;
  const released = state.teamEventEffort.vn;
  assert.ok(Math.abs(released - SEA_SCALE.carryShare * state.eventScale) < 1e-9);
  assert.ok(Math.abs(state.pendingEffort.vn - (before - released)) < 1e-9);
});

test('the event scale adapts to how lively the stream is', () => {
  const quiet = createMatch(0, rng);
  const busy = createMatch(0, rng, { activityRate: SEA_SCALE.defaultRate * 10 });
  const q = run(quiet, 0, liveAt).state;
  const b = run(busy, 0, liveAt).state;
  assert.ok(b.eventScale > q.eventScale);
  assert.ok(q.eventScale >= SEA_SCALE.minScale);
});

test('the marathon runs live: cheering moves the runner during the event', () => {
  let state = { ...createMatch(0, rng), eventOrder: ['marathon'] }; // kỳ chỉ có môn marathon
  state = applyAction(state, comment('a', 'TH'), 0).state;
  state = run(state, 0, liveAt).state;
  assert.equal(toSnapshot(state, liveAt, () => 1).event.id, 'marathon');
  state = applyAction(state, gift('a', 99), liveAt + 10).state;
  const r = run(state, liveAt + 10, liveAt + 5_000);
  assert.ok(toSnapshot(r.state, liveAt + 5_000, () => 1).event.view.pos.th > 0);
});

test('a session plays several different interactive sports', () => {
  const state = createMatch(0, rng);
  assert.equal(new Set(state.eventOrder).size, SEA_SESSION.eventsPerSession);
});
