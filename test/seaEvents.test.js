import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragonBoat } from '../server/sea/events/dragonBoat.js';
import { archery } from '../server/sea/events/archery.js';
import { weightlifting } from '../server/sea/events/weightlifting.js';
import { DRAGON_BOAT, ARCHERY, WEIGHTLIFTING } from '../server/sea/config.js';

const half = () => 0.5;

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

test('archery: nobody shoots before the volley time, then everyone does', () => {
  let ev = archery.create(0);
  ev = archery.addEffort(ev, 'vn', 20).state;
  ev = archery.addEffort(ev, 'th', 5).state;
  assert.equal(archery.step(ev, 50, ARCHERY.volleyEveryMs - 1, half).events.length, 0);
  const r = archery.step(ev, 50, ARCHERY.volleyEveryMs, half);
  const byTeam = Object.fromEntries(r.events[0].results.map((x) => [x.team, x.score]));
  assert.ok(byTeam.vn > byTeam.th, 'the team that aimed harder scores higher');
  assert.equal(byTeam.id, 0, 'a team that did not aim misses');
  assert.equal(r.state.aim.vn, 0, 'aim resets after each volley');
  assert.equal(r.state.totals.vn, byTeam.vn);
});

test('archery: ends after the last volley and ranks by total score', () => {
  let ev = archery.create(0);
  let done = false;
  for (let v = 1; v <= ARCHERY.volleys; v += 1) {
    ev = archery.addEffort(ev, 'ph', 3).state;
    const r = archery.step(ev, 50, v * ARCHERY.volleyEveryMs, half);
    ev = r.state;
    done = r.done;
  }
  assert.equal(done, true);
  assert.equal(archery.ranking(ev)[0], 'ph');
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
  assert.equal(archery.accepts(archery.create(0), 'my'), true);
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
