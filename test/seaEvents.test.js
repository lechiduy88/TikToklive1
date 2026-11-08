import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragonBoat } from '../server/sea/events/dragonBoat.js';
import { marathon } from '../server/sea/events/marathon.js';
import { weightlifting } from '../server/sea/events/weightlifting.js';
import { EVENT_MODULES } from '../server/sea/events/index.js';
import { DRAGON_BOAT, MARATHON, WEIGHTLIFTING, SEA_SESSION } from '../server/sea/config.js';

test('only events where viewer interaction drives the result are in the rotation', () => {
  assert.equal(EVENT_MODULES.archery, undefined);
  for (const id of SEA_SESSION.eventCycle) assert.ok(EVENT_MODULES[id], id);
});

test('every event lasts long enough to build tension (at least 90 seconds)', () => {
  assert.ok(DRAGON_BOAT.maxMs >= 120_000);
  assert.ok(MARATHON.durationMs >= 90_000);
  assert.ok(WEIGHTLIFTING.roundMs * 4 >= 90_000, 'four elimination rounds');
});

test('dragon boat: the track length in effort follows the event scale', () => {
  const ev = dragonBoat.create(0, 50);
  const { state } = dragonBoat.addEffort(ev, 'vn', 10);
  assert.equal(state.pos.vn, (10 / 50) * DRAGON_BOAT.track);
  assert.equal(ev.pos.vn, 0, 'input is not mutated');
});

test('dragon boat: the same effort moves every boat the same distance (buffs live in balance.js)', () => {
  let ev = dragonBoat.create(0, 100);
  ev = dragonBoat.addEffort(ev, 'vn', 40).state;
  assert.equal(dragonBoat.addEffort(ev, 'th', 10).state.pos.th, (10 / 100) * DRAGON_BOAT.track);
});

test('dragon boat: finishing order decides medals and the race ends after three finish', () => {
  let ev = dragonBoat.create(0);
  const events = [];
  for (const team of ['th', 'vn', 'my']) {
    const r = dragonBoat.addEffort(ev, team, 10_000);
    ev = r.state;
    events.push(...r.events);
  }
  assert.deepEqual(events.map((e) => [e.team, e.place]), [['th', 1], ['vn', 2], ['my', 3]]);
  assert.equal(dragonBoat.addEffort(ev, 'th', 5).state, ev, 'finished boats ignore effort');
  assert.equal(dragonBoat.step(ev).done, true);
  assert.deepEqual(dragonBoat.ranking(ev).slice(0, 3), ['th', 'vn', 'my']);
});

test('marathon: effort raises speed, and speed fades when supporters stop cheering', () => {
  let ev = marathon.create(0, 100);
  ev = marathon.addEffort(ev, 'vn', 10).state;
  assert.ok(ev.speed.vn > 0);
  const moved = marathon.step(ev, 1000, 1000).state;
  assert.ok(moved.pos.vn > 0, 'runner moved');
  assert.ok(moved.speed.vn < ev.speed.vn, 'speed decays without new effort');
  assert.equal(ev.pos.vn, 0, 'input is not mutated');
});

test('marathon: a runner only keeps moving while supporters keep cheering (a gift is never wasted)', () => {
  let steady = marathon.create(0, 100);
  let burst = marathon.addEffort(marathon.create(0, 100), 'th', 60).state;
  for (let s = 1; s <= 60; s += 1) {
    steady = marathon.addEffort(steady, 'vn', 1).state;
    steady = marathon.step(steady, 1000, s * 1000).state;
    burst = marathon.step(burst, 1000, s * 1000).state;
  }
  assert.ok(burst.speed.th < 0.01 * steady.speed.vn, 'burst-then-silence has stopped running');
  assert.ok(steady.speed.vn > 0, 'steady cheering is still running at the end');
  assert.ok(burst.pos.th > 0.9 * steady.pos.vn, 'the burst still bought a comparable distance');
});

test('marathon: runs for its full duration and ranks by distance', () => {
  let ev = marathon.create(0, 100);
  ev = marathon.addEffort(ev, 'ph', 20).state;
  ev = marathon.addEffort(ev, 'my', 5).state;
  assert.equal(marathon.step(ev, 50, MARATHON.durationMs - 1).done, false);
  const end = marathon.step(ev, 50, MARATHON.durationMs);
  assert.equal(end.done, true);
  assert.deepEqual(marathon.ranking(end.state).slice(0, 2), ['ph', 'my']);
  assert.equal(marathon.standing(end.state).ph, end.state.pos.ph);
  assert.equal(marathon.accepts(ev, 'vn'), true);
});

test('weightlifting: the weakest lifter of each round is eliminated', () => {
  let ev = weightlifting.create(0);
  for (const [team, amount] of [['vn', 30], ['th', 20], ['id', 10], ['ph', 5], ['my', 1]]) ev = weightlifting.addEffort(ev, team, amount).state;
  const r = weightlifting.step(ev, 50, WEIGHTLIFTING.roundMs);
  assert.deepEqual(r.events[0], { type: 'eliminated', team: 'my', round: 1, meter: 1 });
  assert.equal(r.state.meter.vn, 0, 'meters reset every round');
  assert.equal(weightlifting.addEffort(r.state, 'my', 50).state, r.state, 'eliminated teams cannot lift');
});

test('events tell whether a team can still receive effort', () => {
  let boat = dragonBoat.create(0);
  boat = dragonBoat.addEffort(boat, 'vn', 10_000).state;
  assert.equal(dragonBoat.accepts(boat, 'vn'), false);
  assert.equal(dragonBoat.accepts(boat, 'th'), true);
  let lift = weightlifting.create(0);
  lift = weightlifting.step(lift, 50, WEIGHTLIFTING.roundMs).state;
  assert.equal(weightlifting.accepts(lift, lift.eliminated[0]), false);
});

test('weightlifting: last one standing wins, elimination order gives silver and bronze', () => {
  let ev = weightlifting.create(0);
  let done = false;
  for (let round = 1; round <= 4; round += 1) {
    ev = weightlifting.addEffort(ev, 'id', 10).state;
    ev = weightlifting.addEffort(ev, 'th', 5).state;
    const r = weightlifting.step(ev, 50, round * WEIGHTLIFTING.roundMs);
    ev = r.state;
    done = r.done;
  }
  assert.equal(done, true);
  assert.deepEqual(weightlifting.ranking(ev).slice(0, 2), ['id', 'th']);
  assert.equal(weightlifting.ranking(ev).length, 5);
});
