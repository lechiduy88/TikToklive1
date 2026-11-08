import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giftEffort, giftTier, likeEffort, commentEffort } from '../server/sea/effort.js';
import { emptyTable, awardMedals, addMedals, sortTable, sanitizeTable } from '../server/sea/medals.js';
import { SEA_EFFORT } from '../server/sea/config.js';

test('gift effort grows with the square root of diamonds, per gift in a streak', () => {
  const rose = giftEffort(1, 1);
  const ring = giftEffort(299, 1);
  const lion = giftEffort(29_999, 1);
  assert.equal(rose, SEA_EFFORT.giftPerSqrtDiamond);
  assert.ok(ring > rose && lion > ring);
  assert.ok(lion / ring < 29_999 / 299, 'diminishing returns for huge gifts');
  assert.equal(giftEffort(1, 10), 10 * rose, 'a streak of 10 roses counts every rose');
  assert.equal(giftEffort(0, 5), 0);
});

test('gift tiers drive the on-screen show', () => {
  assert.equal(giftTier(1), 'small');
  assert.equal(giftTier(299), 'big');
  assert.equal(giftTier(29_999), 'mega');
});

test('likes accumulate per team and are capped per event', () => {
  assert.deepEqual(likeEffort(0, 25), { effort: 2, buffer: 5 });
  const flood = likeEffort(0, 100_000);
  assert.equal(flood.effort, SEA_EFFORT.maxLikeEffortPerEvent);
  assert.ok(flood.buffer <= SEA_EFFORT.likesPerEffort * SEA_EFFORT.maxLikeEffortPerEvent);
});

test('comments are rate-limited per person', () => {
  assert.equal(commentEffort(-Infinity, 0), 1);
  assert.equal(commentEffort(0, SEA_EFFORT.commentCooldownMs - 1), 0);
  assert.equal(commentEffort(0, SEA_EFFORT.commentCooldownMs), 1);
});

test('medals go to the top three teams that actually competed', () => {
  const { table, medals } = awardMedals(emptyTable(), ['th', 'vn', 'id', 'ph', 'my'], (t) => t !== 'vn');
  assert.deepEqual(medals, { gold: 'th', silver: 'id', bronze: 'ph' });
  assert.equal(table.th.gold, 1);
  assert.equal(table.vn.silver, 0);
});

test('the medal table sorts by gold, then silver, then bronze', () => {
  let table = emptyTable();
  table = addMedals(table, { gold: 'my', silver: 'vn' });
  table = addMedals(table, { silver: 'vn', bronze: 'th' });
  table = addMedals(table, { gold: 'th' });
  const order = sortTable(table).map((r) => r.team);
  assert.deepEqual(order.slice(0, 3), ['th', 'my', 'vn']);
  assert.equal(sortTable(table)[0].total, 2);
});

test('a medal table loaded from disk is sanitized', () => {
  const clean = sanitizeTable({ vn: { gold: 3, silver: -1, bronze: 'x' }, hacker: { gold: 99 }, __proto__: { gold: 5 } });
  assert.deepEqual(clean.vn, { gold: 3, silver: 0, bronze: 0 });
  assert.equal(clean.hacker, undefined);
  assert.deepEqual(sanitizeTable(null), emptyTable());
});
