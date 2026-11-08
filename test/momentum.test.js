import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMomentum, createMomentum, CASTLE_OWNER } from '../server/game/momentum.js';
import { BASE_MAX_HP, MOMENTUM, UNIT_TYPES } from '../server/config.js';

const soldier = (id, team, x) => ({
  id, team, type: 'soldier', ownerId: 'p', ownerName: 'P', x, lane: 0,
  hp: UNIT_TYPES.soldier.hp, maxHp: UNIT_TYPES.soldier.hp,
});

function lopsided() {
  const blues = Array.from({ length: 20 }, (_, i) => soldier(i + 1, 'blue', 600));
  return {
    phase: 'battle',
    bases: { red: BASE_MAX_HP, blue: BASE_MAX_HP },
    units: [soldier(100, 'red', 300), ...blues],
    nextUnitId: 200,
    players: { r1: { id: 'r1', team: 'red' }, r2: { id: 'r2', team: 'red' }, r3: { id: 'r3', team: 'red' }, r4: { id: 'r4', team: 'red' }, b1: { id: 'b1', team: 'blue' } },
    momentum: createMomentum(),
  };
}

test('no counter-attack until the weak side has been crushed for a while', () => {
  const first = applyMomentum(lopsided(), 0);
  assert.equal(first.events.length, 0);
  const early = applyMomentum(first.state, MOMENTUM.holdMs - 1);
  assert.equal(early.events.length, 0);
});

test('a crushed side gets a free militia wave and a rally call', () => {
  const first = applyMomentum(lopsided(), 0).state;
  const { state, events } = applyMomentum(first, MOMENTUM.holdMs);
  const rally = events.find((e) => e.type === 'rally');
  assert.equal(rally.team, 'red');
  assert.ok(rally.count >= MOMENTUM.waveMin && rally.count <= MOMENTUM.waveMax);
  assert.equal(rally.count, Math.round((20 - 1) * MOMENTUM.waveGapRatio), 'wave scales with the power gap');
  const militia = state.units.filter((u) => u.ownerId === CASTLE_OWNER);
  assert.equal(militia.length, rally.count);
  assert.ok(militia.every((u) => u.team === 'red' && u.x === 0));
});

test('counter-attacks respect a cooldown', () => {
  let state = applyMomentum(lopsided(), 0).state;
  state = applyMomentum(state, MOMENTUM.holdMs).state;
  const blues = Array.from({ length: 60 }, (_, i) => soldier(i + 500, 'blue', 600));
  state = { ...state, units: [...state.units, ...blues] };
  const soon = applyMomentum(state, MOMENTUM.holdMs + MOMENTUM.cooldownMs - 1);
  assert.equal(soon.events.length, 0, 'still on cooldown');
  const later = applyMomentum(soon.state, MOMENTUM.holdMs + MOMENTUM.cooldownMs);
  assert.equal(later.events.filter((e) => e.type === 'rally').length, 1);
});

test('a balanced fight resets the pressure timer', () => {
  let state = applyMomentum(lopsided(), 0).state;
  const reds = Array.from({ length: 20 }, (_, i) => soldier(i + 300, 'red', 300));
  state = applyMomentum({ ...state, units: [...state.units, ...reds] }, 1000).state;
  const crushedAgain = { ...state, units: state.units.filter((u) => u.id < 300) };
  const { events } = applyMomentum(crushedAgain, MOMENTUM.holdMs + 500);
  assert.equal(events.length, 0);
});

test('momentum does nothing outside battle', () => {
  const state = { ...lopsided(), phase: 'victory' };
  assert.equal(applyMomentum(state, 0).state, state);
});

test('no militia for a side that is ahead on base hp (no sandbagging)', () => {
  const state = { ...lopsided(), bases: { red: BASE_MAX_HP, blue: BASE_MAX_HP - 100 } };
  const first = applyMomentum(state, 0).state;
  assert.equal(applyMomentum(first, MOMENTUM.holdMs).events.length, 0);
});

test('no militia for a side with no players, and waves are capped per player', () => {
  const empty = { ...lopsided(), players: {} };
  assert.equal(applyMomentum(applyMomentum(empty, 0).state, MOMENTUM.holdMs).events.length, 0);
  const solo = { ...lopsided(), players: { r1: { id: 'r1', team: 'red' } } };
  const { events } = applyMomentum(applyMomentum(solo, 0).state, MOMENTUM.holdMs);
  assert.equal(events[0].count, Math.max(MOMENTUM.waveMin, MOMENTUM.militiaPerPlayer));
});
