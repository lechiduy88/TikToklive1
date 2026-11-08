// Tự cân bằng: đội bị bỏ xa (trong môn hoặc trên bảng huy chương) được buff sức tiếp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventBuffs, medalBuffs, combineBuffs, medalPoints, sizeBuffs } from '../server/sea/balance.js';
import { SEA_BALANCE, SEA_PHASE_MS, WEIGHTLIFTING } from '../server/sea/config.js';
import { createMatch, applyAction, tick, toSnapshot } from '../server/sea/engine.js';
import { dragonBoat } from '../server/sea/events/dragonBoat.js';
import { marathon } from '../server/sea/events/marathon.js';
import { weightlifting } from '../server/sea/events/weightlifting.js';

const rng = () => 0.5;
const ONES = { vn: 1, th: 1, id: 1, ph: 1, my: 1 };

test('no event buff while the leader has not pulled clearly ahead', () => {
  assert.deepEqual(eventBuffs({ vn: 5, th: 0, id: 0, ph: 0, my: 0 }, 10), ONES, 'lead below the minimum');
  assert.deepEqual(eventBuffs({ vn: 100, th: 90, id: 85, ph: 95, my: 100 }, 10), ONES, 'everyone is close');
});

test('teams far behind the leader get a bigger boost, the leader never gets less than 1', () => {
  const buffs = eventBuffs({ vn: 100, th: 50, id: 0, ph: 80, my: 100 }, 10);
  assert.equal(buffs.vn, 1);
  assert.equal(buffs.my, 1);
  assert.ok(buffs.th > buffs.ph && buffs.ph >= 1);
  assert.ok(buffs.id > buffs.th);
  assert.equal(buffs.id, 1 + SEA_BALANCE.maxEventBonus, 'capped');
});

test('teams that are out of the event are not part of the standing', () => {
  const buffs = eventBuffs({ vn: 100, th: 20 }, 10);
  assert.ok(buffs.th > 1);
  assert.equal(buffs.id, 1);
});

test('medal points are olympic-style and teams far behind on the table get national spirit', () => {
  const table = {
    vn: { gold: 3, silver: 0, bronze: 0 },
    th: { gold: 0, silver: 1, bronze: 0 },
    id: { gold: 0, silver: 0, bronze: 0 },
    ph: { gold: 3, silver: 0, bronze: 0 },
    my: { gold: 0, silver: 0, bronze: 1 },
  };
  assert.equal(medalPoints(table.vn), 9);
  const buffs = medalBuffs(table);
  assert.equal(buffs.vn, 1);
  assert.equal(buffs.ph, 1);
  assert.ok(buffs.id > buffs.my && buffs.my > buffs.th && buffs.th > 1);
  assert.ok(buffs.id <= 1 + SEA_BALANCE.maxMedalBonus);
  assert.deepEqual(medalBuffs({}), ONES, 'empty table');
});

test('teams with fewer supporters get a headcount boost; the biggest team and empty teams get none', () => {
  const buffs = sizeBuffs({ vn: 16, th: 4, id: 1, ph: 0, my: 16 });
  assert.equal(buffs.vn, 1);
  assert.equal(buffs.my, 1);
  assert.equal(buffs.th, 2, 'sqrt(16/4)');
  assert.equal(buffs.id, 1 + SEA_BALANCE.maxSizeBonus, 'capped');
  assert.equal(buffs.ph, 1);
  assert.deepEqual(sizeBuffs({ vn: 0, th: 0, id: 0, ph: 0, my: 0 }), ONES);
});

test('combined buffs multiply but stay under the overall cap', () => {
  const combined = combineBuffs({ ...ONES, id: 2 }, { ...ONES, id: 1.5, th: 1.2 }, { ...ONES, id: 2 });
  assert.equal(combined.id, SEA_BALANCE.maxTotal);
  assert.equal(combined.th, 1.2);
  assert.equal(combined.vn, 1);
});

test('every event reports a standing of the teams still competing', () => {
  let boat = dragonBoat.create(0, 100);
  boat = dragonBoat.addEffort(boat, 'vn', 30).state;
  assert.equal(dragonBoat.standing(boat).vn, 300);
  let run = marathon.create(0, 100);
  run = marathon.addEffort(run, 'th', 5).state;
  run = marathon.step(run, 1000, 1000).state;
  assert.ok(marathon.standing(run).th > 0);
  let lift = weightlifting.create(0);
  lift = weightlifting.addEffort(lift, 'id', 9).state;
  assert.equal(weightlifting.standing(lift).id, 9);
  lift = weightlifting.step(lift, 50, WEIGHTLIFTING.roundMs).state; // hết lượt 1: một đội bị loại
  assert.equal(Object.keys(weightlifting.standing(lift)).length, 4);
});

// ---- tích hợp engine ----
const liveAt = SEA_PHASE_MS.opening + SEA_PHASE_MS.intro;
const comment = (id, text) => ({ type: 'comment', user: { id, name: id }, text });
const gift = (id, diamonds) => ({ type: 'gift', user: { id, name: id }, diamonds, count: 1, giftName: 'Quà' });

function run(state, from, to, step = 50) {
  let s = state;
  const events = [];
  for (let now = from + step; now <= to; now += step) {
    const r = tick(s, step, now, rng);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function boatRaceWithLeader() {
  let state = createMatch(0, rng);
  for (const [id, code] of [['v1', 'VN'], ['v2', 'VN'], ['t1', 'TH']]) state = applyAction(state, comment(id, code), 0).state;
  state = run(state, 0, liveAt).state;
  // VN bỏ xa (~700m) nhưng chưa về đích; TH mới có 1 comment.
  for (const id of ['v1', 'v2']) state = applyAction(state, gift(id, 99), liveAt + 10).state;
  return state;
}

test('a team left behind gets more out of the same effort', () => {
  const state = boatRaceWithLeader();
  const snap = toSnapshot(state, liveAt + 10, () => 1);
  assert.ok(snap.buffs.th > 1, `th buff ${snap.buffs.th}`);
  assert.equal(snap.buffs.vn, 1);
  const before = state.teamEventEffort.th;
  const after = applyAction(state, comment('t1', 'cố lên'), liveAt + 3_000).state.teamEventEffort.th;
  assert.ok(Math.abs(after - before - snap.buffs.th) < 0.01, 'one comment counts as the buff multiplier (snapshot is rounded)');
});

test('the comeback buff is announced once per team per event', () => {
  const state = boatRaceWithLeader();
  const r = run(state, liveAt + 10, liveAt + 2_000);
  const calls = r.events.filter((e) => e.type === 'underdog' && e.team === 'th');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].multiplier >= SEA_BALANCE.announceAt);
});

test('medal-table and headcount buffs alone do not trigger comeback calls (they are always on)', () => {
  let state = createMatch(0, rng);
  for (const [id, code] of [['v1', 'VN'], ['v2', 'VN'], ['v3', 'VN'], ['i1', 'ID']]) state = applyAction(state, comment(id, code), 0).state;
  state = { ...state, medals: { ...state.medals, vn: { gold: 3, silver: 0, bronze: 0 } } };
  const r = run(state, 0, liveAt + 1_000);
  assert.ok(toSnapshot(r.state, liveAt + 1_000, () => 1).buffs.id >= SEA_BALANCE.announceAt);
  assert.equal(r.events.filter((e) => e.type === 'underdog').length, 0);
});

test('comeback calls are rate-limited across teams', () => {
  let state = createMatch(0, rng);
  const fans = [['v1', 'VN'], ['v2', 'VN'], ['t1', 'TH'], ['i1', 'ID'], ['p1', 'PH']];
  for (const [id, code] of fans) state = applyAction(state, comment(id, code), 0).state;
  state = run(state, 0, liveAt).state;
  for (const id of ['v1', 'v2']) state = applyAction(state, gift(id, 99), liveAt + 10).state;
  const r = run(state, liveAt + 10, liveAt + 1_000);
  assert.equal(r.events.filter((e) => e.type === 'underdog').length, 1, 'one call at a time');
});

test('the headcount buff counts only supporters who actually contributed', () => {
  let state = createMatch(0, rng);
  for (const id of ['v1', 'v2', 'v3']) state = { ...state, athletes: { ...state.athletes, [id]: { id, name: id, team: 'vn', effort: 0 } } };
  state = applyAction(state, comment('i1', 'ID'), 0).state; // i1 góp 1 (comment)
  const snap = toSnapshot(state, 0, () => 1);
  assert.equal(snap.buffs.id, 1, '3 idle registrants on VN do not make Indonesia "small"');
});

test('supporters who already contributed for real cannot hop to a smaller team', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('a', 'VN'), 0).state;
  state = applyAction(state, gift('a', 99), 10).state; // đã góp thật cho VN
  state = applyAction(state, comment('a', 'MY'), 3_000).state;
  assert.equal(state.athletes.a.team, 'vn');
});

test('teams far behind on the medal table start each event with national spirit', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, comment('i1', 'ID'), 0).state;
  state = { ...state, medals: { ...state.medals, vn: { gold: 3, silver: 0, bronze: 0 } } };
  const snap = toSnapshot(run(state, 0, liveAt).state, liveAt, () => 1);
  assert.ok(snap.buffs.id > 1);
  assert.equal(snap.buffs.vn, 1);
});
