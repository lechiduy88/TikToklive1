import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCountry, ensureAthlete, countByCountry, addAthleteStat, resetEventStats,
} from '../server/sea/roster.js';
import { SEA_TEAMS } from '../server/sea/config.js';

test('country codes, numbers and names (with or without accents) pick a team', () => {
  assert.equal(resolveCountry('VN'), 'vn');
  assert.equal(resolveCountry('1'), 'vn');
  assert.equal(resolveCountry('Việt Nam vô địch'), 'vn');
  assert.equal(resolveCountry('vn cố lên!!'), 'vn');
  assert.equal(resolveCountry('thái lan'), 'th');
  assert.equal(resolveCountry('Indo'), 'id');
  assert.equal(resolveCountry('4'), 'ph');
  assert.equal(resolveCountry('Mã Lai'), 'my');
  assert.equal(resolveCountry('MY'), 'my');
});

test('ordinary chat does not accidentally join a team', () => {
  assert.equal(resolveCountry('my god hay quá'), null);
  assert.equal(resolveCountry('hello'), null);
  assert.equal(resolveCountry('12'), null);
  assert.equal(resolveCountry('   '), null);
  assert.equal(resolveCountry(undefined), null);
});

test('an athlete joins the requested country, otherwise the smallest one', () => {
  const first = ensureAthlete({}, { id: 'a', name: 'A' }, 'th');
  assert.equal(first.athlete.team, 'th');
  assert.equal(first.joined, true);
  const second = ensureAthlete(first.athletes, { id: 'b', name: 'B' }, null);
  assert.equal(second.athlete.team, SEA_TEAMS[0].id);
  const again = ensureAthlete(second.athletes, { id: 'a', name: 'A' }, 'vn');
  assert.equal(again.athlete.team, 'th', 'joining is sticky');
  assert.equal(again.joined, false);
});

test('counts and stats are immutable and prototype-safe', () => {
  const { athletes } = ensureAthlete({}, { id: 'constructor', name: 'X' }, 'vn');
  assert.equal(countByCountry(athletes).vn, 1);
  const next = addAthleteStat(athletes, 'constructor', 'effort', 5);
  assert.equal(next.constructor.effort, 5);
  assert.equal(athletes.constructor.effort, 0);
  assert.equal(addAthleteStat(next, 'ghost', 'effort', 5), next);
});

test('event stats reset between events while session stats stay', () => {
  const { athletes } = ensureAthlete({}, { id: 'a', name: 'A' }, 'vn');
  const busy = addAthleteStat(addAthleteStat(athletes, 'a', 'eventEffort', 9), 'a', 'effort', 9);
  const reset = resetEventStats(busy);
  assert.equal(reset.a.eventEffort, 0);
  assert.equal(reset.a.effort, 9);
});
