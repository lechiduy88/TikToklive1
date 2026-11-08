// 10 môn thể thao, 5 kiểu luật chơi — môn nào cũng do tương tác của người xem quyết định.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_MODULES } from '../server/sea/events/index.js';
import { SPORTS, SEA_SESSION } from '../server/sea/config.js';
import { eventOrderFor } from '../server/sea/engine.js';

const INTERACTIVE_KINDS = new Set(['race', 'endurance', 'elimination', 'survival', 'throw']);
const sport = (id) => EVENT_MODULES[id];

test('ten sports are registered, each with an interactive kind and a full module interface', () => {
  const ids = Object.keys(SPORTS);
  assert.equal(ids.length, 10);
  assert.deepEqual([...SEA_SESSION.eventCycle].sort(), [...ids].sort());
  for (const id of ids) {
    const mod = sport(id);
    assert.ok(mod, id);
    assert.ok(INTERACTIVE_KINDS.has(mod.kind), `${id} kind ${mod.kind}`);
    for (const fn of ['create', 'accepts', 'addEffort', 'standing', 'step', 'ranking', 'view']) assert.equal(typeof mod[fn], 'function', `${id}.${fn}`);
    assert.ok(mod.maxMs >= 90_000, `${id} lasts at least 90s`);
    assert.ok(mod.name && mod.icon && mod.rule);
  }
});

test('consecutive sessions play different sports so all ten come round', () => {
  const seen = new Set([...eventOrderFor(1), ...eventOrderFor(2)]);
  assert.equal(seen.size, Math.min(10, SEA_SESSION.eventsPerSession * 2));
  assert.equal(new Set(eventOrderFor(1)).size, SEA_SESSION.eventsPerSession, 'no repeats within a session');
});

test('every sport turns effort into progress for that team only', () => {
  for (const id of Object.keys(SPORTS)) {
    const mod = sport(id);
    let ev = mod.create(0, 100);
    ev = mod.addEffort(ev, 'th', 30).state;
    ev = mod.step(ev, 1000, 1000).state;
    const standing = mod.standing(ev);
    const view = JSON.stringify(mod.view(ev, 1000));
    assert.ok(view.length > 2, id);
    assert.ok((standing.th ?? 0) >= (standing.vn ?? 0), `${id}: th ahead of vn`);
  }
});

// ---- 🏐 Cầu mây (giữ cầu) ----
test('takraw: the ball falls without support and the team drops out when it hits the ground', () => {
  const mod = sport('sepak_takraw');
  const cfg = SPORTS.sepak_takraw;
  let ev = mod.create(0, 100);
  ev = mod.step(ev, cfg.graceMs, cfg.graceMs).state;
  assert.equal(ev.height.vn, cfg.startHeight, 'no falling during the grace period');
  const events = [];
  for (let t = cfg.graceMs; t <= cfg.graceMs + 10_000; t += 100) {
    ev = mod.addEffort(ev, 'th', 1).state; // TH tâng cầu liên tục
    const r = mod.step(ev, 100, t + 100);
    ev = r.state;
    events.push(...r.events);
  }
  assert.ok(events.some((e) => e.type === 'dropped' && e.team === 'vn'));
  assert.ok(ev.alive.includes('th'));
  assert.equal(mod.accepts(ev, 'vn'), false);
  assert.equal(mod.ranking(ev)[0], 'th');
});

test('takraw: ends when one team is left or time runs out', () => {
  const mod = sport('sepak_takraw');
  let ev = mod.create(0, 100);
  const r = mod.step(ev, 50, SPORTS.sepak_takraw.durationMs);
  assert.equal(r.done, true);
  ev = { ...ev, alive: ['my'], dropped: ['vn', 'th', 'id', 'ph'] };
  assert.equal(mod.step(ev, 50, 10).done, true);
});

// ---- 💪 Đẩy tạ / 🏹 Ném lao / 🦘 Nhảy xa (lấy đà rồi ném) ----
test('throws: effort charges power, each attempt releases a throw, best attempt counts', () => {
  const mod = sport('shot_put');
  const cfg = SPORTS.shot_put;
  let ev = mod.create(0, 90);
  ev = mod.addEffort(ev, 'vn', 30).state;
  ev = mod.addEffort(ev, 'th', 5).state;
  assert.equal(mod.step(ev, 50, cfg.attemptMs - 1).events.length, 0);
  const r1 = mod.step(ev, 50, cfg.attemptMs);
  const throw1 = r1.events.find((e) => e.type === 'throw');
  const dist = Object.fromEntries(throw1.results.map((x) => [x.team, x.distance]));
  assert.ok(dist.vn > dist.th && dist.th > 0);
  assert.equal(dist.id, 0, 'no run-up, no throw');
  assert.ok(dist.vn < cfg.maxDistance, 'distance saturates below the record');
  ev = r1.state;
  assert.equal(ev.power.vn, 0, 'power resets each attempt');
  ev = mod.addEffort(ev, 'vn', 1).state;
  ev = mod.step(ev, 50, cfg.attemptMs * 2).state;
  assert.equal(ev.best.vn, dist.vn, 'a weaker later throw does not lower the best');
  const last = mod.step(ev, 50, cfg.attemptMs * 3);
  assert.equal(last.done, true);
  assert.equal(mod.ranking(last.state)[0], 'vn');
});
