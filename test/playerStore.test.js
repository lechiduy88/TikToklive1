import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { levelFromXp, awardXp, loadStore, saveStore } from '../server/store/playerStore.js';
import { XP_PER_LEVEL } from '../server/config.js';

test('levelFromXp starts at level 1', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(XP_PER_LEVEL), 2);
});

test('awardXp adds xp immutably and reports level ups', () => {
  const store = { a: { name: 'A', xp: XP_PER_LEVEL - 5, matches: 1 } };
  const { store: next, levelUps } = awardXp(store, [{ id: 'a', name: 'A', xp: 10 }, { id: 'b', name: 'B', xp: 3 }]);
  assert.equal(next.a.xp, XP_PER_LEVEL + 5);
  assert.equal(next.a.matches, 2);
  assert.equal(next.b.xp, 3);
  assert.equal(store.a.xp, XP_PER_LEVEL - 5);
  assert.deepEqual(levelUps, [{ id: 'a', name: 'A', level: 2 }]);
});

test('awardXp handles ids that collide with Object.prototype keys', () => {
  const { store } = awardXp({}, [{ id: 'constructor', name: 'C', xp: 5 }]);
  assert.equal(store.constructor.xp, 5);
});

test('a viewer named __proto__ keeps their xp and cannot replace the store prototype', () => {
  const { store } = awardXp({}, [{ id: '__proto__', name: 'P', xp: 7 }]);
  assert.ok(Object.hasOwn(store, '__proto__'));
  assert.equal(store.__proto__.xp, 7); // eslint-disable-line no-proto
  assert.equal(Object.getPrototypeOf(store), Object.prototype);
  assert.equal(JSON.parse(JSON.stringify(store)).__proto__.xp, 7); // eslint-disable-line no-proto
});

test('loadStore returns empty store for missing or corrupt files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  assert.deepEqual(await loadStore(join(dir, 'missing.json')), {});
  const bad = join(dir, 'bad.json');
  await writeFile(bad, '{not json');
  assert.deepEqual(await loadStore(bad), {});
});

test('saveStore round-trips and drops malformed records on load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  const file = join(dir, 'players.json');
  await saveStore(file, { a: { name: 'A', xp: 7, matches: 1 } });
  assert.deepEqual(await loadStore(file), { a: { name: 'A', xp: 7, matches: 1 } });
  await writeFile(file, JSON.stringify({ a: { name: 'A', xp: 'lots' }, b: { name: 'B', xp: 2, matches: 1 } }));
  assert.deepEqual(Object.keys(await loadStore(file)), ['b']);
  JSON.parse(await readFile(file, 'utf8'));
});
