import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepCombat, damageMultipliers } from '../server/game/combat.js';
import { BASE_MAX_HP, FIELD, UNIT_TYPES, UNDERDOG } from '../server/config.js';

const unit = (overrides) => ({
  id: 1, team: 'red', type: 'soldier', ownerId: 'a', ownerName: 'A',
  x: 0, lane: 0, hp: UNIT_TYPES.soldier.hp, maxHp: UNIT_TYPES.soldier.hp,
  ...overrides,
});

const fullBases = { red: BASE_MAX_HP, blue: BASE_MAX_HP };

test('units with no enemy in range move toward the enemy base', () => {
  const units = [unit({ id: 1, team: 'red', x: 100 }), unit({ id: 2, team: 'blue', x: 900 })];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.equal(result.units[0].x, 100 + UNIT_TYPES.soldier.speed);
  assert.equal(result.units[1].x, 900 - UNIT_TYPES.soldier.speed);
  assert.equal(units[0].x, 100, 'input must not be mutated');
});

test('units in range fight instead of moving and damage is credited to owner', () => {
  const units = [
    unit({ id: 1, team: 'red', x: 500, ownerId: 'r' }),
    unit({ id: 2, team: 'blue', x: 500, ownerId: 'b' }), // đứng đúng giữa sân: không có buff sân nhà
  ];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.equal(result.units[0].x, 500);
  assert.equal(result.units[0].hp, UNIT_TYPES.soldier.hp - UNIT_TYPES.soldier.dps);
  assert.equal(result.damageByOwner.r, UNIT_TYPES.soldier.dps);
});

test('dead units are removed and counted as kills', () => {
  const units = [
    unit({ id: 1, team: 'red', x: 500, ownerId: 'r' }),
    unit({ id: 2, team: 'blue', x: 505, hp: 1 }),
  ];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.equal(result.units.length, 1);
  assert.equal(result.killsByOwner.r, 1);
});

test('units at the enemy base damage it', () => {
  const units = [unit({ id: 1, team: 'red', x: FIELD.length, ownerId: 'r' })];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.equal(result.bases.blue, BASE_MAX_HP - UNIT_TYPES.soldier.baseDamage);
  assert.equal(result.bases.red, BASE_MAX_HP);
});

test('the losing team gets the underdog damage multiplier', () => {
  const gap = BASE_MAX_HP * (UNDERDOG.hpGapRatio + 0.05);
  const mult = damageMultipliers({ red: BASE_MAX_HP - gap, blue: BASE_MAX_HP });
  assert.equal(mult.red, UNDERDOG.damageMultiplier);
  assert.equal(mult.blue, 1);
  assert.deepEqual(damageMultipliers(fullBases), { red: 1, blue: 1 });
});

// --- Cơ chế cò cưa ---
import { armyPower, castleShot } from '../server/game/combat.js';
import { CASTLE_DEFENSE } from '../server/config.js';

test('a castle shoots the nearest enemy inside its defense zone', () => {
  const units = [
    unit({ id: 1, team: 'blue', x: CASTLE_DEFENSE.range - 50, hp: 1000, maxHp: 1000 }),
    unit({ id: 2, team: 'blue', x: CASTLE_DEFENSE.range - 100, hp: 1000, maxHp: 1000 }),
  ];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  const near = result.units.find((u) => u.id === 2);
  const far = result.units.find((u) => u.id === 1);
  assert.equal(near.hp, 1000 - CASTLE_DEFENSE.baseDps);
  assert.equal(far.hp, 1000);
  assert.equal(result.castleTargets.red, 2);
  assert.equal(result.castleTargets.blue, null);
});

test('a castle ignores enemies outside its zone', () => {
  const units = [unit({ id: 1, team: 'blue', x: CASTLE_DEFENSE.range + 50 })];
  assert.equal(castleShot('red', units, fullBases, 1), null);
});

test('a damaged castle fires harder, giving the defender a comeback chance', () => {
  const units = [unit({ id: 1, team: 'blue', x: 10 })];
  const healthy = castleShot('red', units, fullBases, 1);
  const desperate = castleShot('red', units, { red: BASE_MAX_HP * 0.25, blue: BASE_MAX_HP }, 1);
  assert.ok(desperate.damage > healthy.damage);
  assert.equal(desperate.damage, CASTLE_DEFENSE.baseDps + CASTLE_DEFENSE.desperateDps * 0.75);
});

test('castle kills are not credited to any player', () => {
  const units = [unit({ id: 1, team: 'blue', x: 10, hp: 1 })];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.equal(result.units.length, 0);
  assert.deepEqual(result.killsByOwner, {});
});

test('army power counts units by combat value scaled by remaining hp', () => {
  const giant = unit({ id: 4, team: 'blue', type: 'giant', hp: 300, maxHp: 600 });
  const units = [unit({ team: 'red' }), unit({ id: 2, team: 'red', hp: 15 }), unit({ id: 3, team: 'blue' }), giant];
  assert.equal(armyPower(units, 'red'), 1.5);
  assert.equal(armyPower(units, 'blue'), 1 + UNIT_TYPES.giant.value / 2);
});

test('the side outnumbered on the field gets a damage boost before its base is hurt', () => {
  const reds = Array.from({ length: 2 }, (_, i) => unit({ id: i + 1, team: 'red' }));
  const blues = Array.from({ length: 18 }, (_, i) => unit({ id: i + 10, team: 'blue', x: 900 }));
  const mult = damageMultipliers(fullBases, [...reds, ...blues]);
  assert.ok(mult.red > 1, 'outnumbered red should be boosted');
  assert.ok(mult.red <= 1 + UNDERDOG.maxArmyBonus);
  assert.equal(mult.blue, 1);
});

test('no army boost when the field is nearly empty', () => {
  const mult = damageMultipliers(fullBases, [unit({ team: 'blue', x: 900 })]);
  assert.deepEqual(mult, { red: 1, blue: 1 });
});

import { HOME_GROUND } from '../server/config.js';

test('defenders fighting deep in their own half hit harder (home ground)', () => {
  const atMid = stepCombat({ units: [unit({ id: 1, team: 'red', x: 500, ownerId: 'r' }), unit({ id: 2, team: 'blue', x: 510 })], bases: fullBases }, 1000);
  const atHome = stepCombat({ units: [unit({ id: 1, team: 'red', x: 300, ownerId: 'r' }), unit({ id: 2, team: 'blue', x: 310 })], bases: fullBases }, 1000);
  assert.equal(atMid.damageByOwner.r, UNIT_TYPES.soldier.dps);
  const depth = (500 - 300) / 500;
  assert.ok(Math.abs(atHome.damageByOwner.r - UNIT_TYPES.soldier.dps * (1 + HOME_GROUND.bonus * depth)) < 1e-9);
});

import { SIEGE } from '../server/config.js';

test('walls cap how fast units can damage a base, and credit is scaled to match', () => {
  const giants = Array.from({ length: 10 }, (_, i) => unit({
    id: i + 1, team: 'red', type: 'giant', x: FIELD.length, ownerId: 'r', hp: 600, maxHp: 600,
  }));
  const result = stepCombat({ units: giants, bases: fullBases }, 1000);
  assert.ok(Math.abs(result.bases.blue - (BASE_MAX_HP - SIEGE.maxBaseDps)) < 1e-9);
  assert.ok(Math.abs(result.damageByOwner.r - SIEGE.maxBaseDps) < 1e-9);
});

test('the final rush multiplies how fast a base can be sieged', () => {
  const giants = Array.from({ length: 10 }, (_, i) => unit({
    id: i + 1, team: 'red', type: 'giant', x: FIELD.length, ownerId: 'r', hp: 600, maxHp: 600,
  }));
  const result = stepCombat({ units: giants, bases: fullBases, siegeMultiplier: 2 }, 1000);
  assert.ok(Math.abs(result.bases.blue - (BASE_MAX_HP - SIEGE.maxBaseDps * 2)) < 1e-9);
});

test('a player keeps the kill when the castle lands the final blow on their target', () => {
  const units = [
    unit({ id: 1, team: 'red', x: 30, ownerId: 'r' }),
    unit({ id: 2, team: 'blue', x: 40, hp: 1 }),
  ];
  const result = stepCombat({ units, bases: fullBases }, 1000);
  assert.ok(!result.units.some((u) => u.id === 2));
  assert.equal(result.killsByOwner.r, 1);
});
