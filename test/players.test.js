import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeamFromText, ensurePlayer, addStat } from '../server/game/players.js';

test('resolveTeamFromText maps join keywords to teams', () => {
  assert.equal(resolveTeamFromText('1'), 'red');
  assert.equal(resolveTeamFromText(' Đỏ '), 'red');
  assert.equal(resolveTeamFromText('2'), 'blue');
  assert.equal(resolveTeamFromText('xanh'), 'blue');
  assert.equal(resolveTeamFromText('12'), null);
  assert.equal(resolveTeamFromText('hello'), null);
  assert.equal(resolveTeamFromText(undefined), null);
});

test('ensurePlayer joins requested team and does not mutate input', () => {
  const players = {};
  const result = ensurePlayer(players, { id: 'a', name: 'An' }, 'blue');
  assert.equal(result.player.team, 'blue');
  assert.equal(result.joined, true);
  assert.deepEqual(players, {});
});

test('ensurePlayer auto-assigns to the smaller team when no team requested', () => {
  const { players } = ensurePlayer({}, { id: 'a', name: 'A' }, 'red');
  const result = ensurePlayer(players, { id: 'b', name: 'B' }, null);
  assert.equal(result.player.team, 'blue');
});

test('ensurePlayer keeps a player on their original team for the whole match', () => {
  const { players } = ensurePlayer({}, { id: 'a', name: 'A' }, 'red');
  const result = ensurePlayer(players, { id: 'a', name: 'A' }, 'blue');
  assert.equal(result.player.team, 'red');
  assert.equal(result.joined, false);
});

test('ids that collide with Object.prototype keys are treated as new players', () => {
  for (const id of ['constructor', 'toString', '__proto__']) {
    const { players, player, joined } = ensurePlayer({}, { id, name: id }, 'red');
    assert.equal(joined, true);
    assert.equal(player.id, id);
    assert.equal(addStat(players, id, 'comments', 1)[id].comments, 1);
  }
});

test('addStat increments a stat immutably', () => {
  const { players } = ensurePlayer({}, { id: 'a', name: 'A' }, 'red');
  const next = addStat(players, 'a', 'comments', 2);
  assert.equal(next.a.comments, 2);
  assert.equal(players.a.comments, 0);
  assert.equal(addStat(players, 'missing', 'comments', 1), players);
});
