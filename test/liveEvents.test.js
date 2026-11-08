import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLiveEvent, validateClientAction } from '../server/live/liveEvents.js';

const user = { uniqueId: 'nam_99', nickname: 'Nam' };

test('chat events become comment actions', () => {
  const action = normalizeLiveEvent('chat', { user, comment: ' 1 ' });
  assert.deepEqual(action, { type: 'comment', user: { id: 'nam_99', name: 'Nam' }, text: ' 1 ' });
});

test('streakable gifts are only counted when the streak ends', () => {
  const inProgress = { user, giftDetails: { giftType: 1, diamondCount: 1, giftName: 'Rose' }, repeatCount: 4, repeatEnd: false };
  assert.equal(normalizeLiveEvent('gift', inProgress), null);
  const ended = normalizeLiveEvent('gift', { ...inProgress, repeatEnd: true });
  assert.deepEqual(ended, { type: 'gift', user: { id: 'nam_99', name: 'Nam' }, diamonds: 1, count: 4, giftName: 'Rose' });
});

test('non-streakable gifts count immediately and fall back to top-level diamond field', () => {
  const action = normalizeLiveEvent('gift', { user, giftType: 2, diamondCount: 1000, repeatCount: 1 });
  assert.equal(action.diamonds, 1000);
  assert.equal(action.count, 1);
});

test('likes, follows and shares are mapped', () => {
  assert.equal(normalizeLiveEvent('like', { user, likeCount: 12 }).count, 12);
  assert.equal(normalizeLiveEvent('follow', { user }).type, 'follow');
  assert.equal(normalizeLiveEvent('share', { user }).type, 'share');
});

test('events without a user or with unknown kinds are dropped', () => {
  assert.equal(normalizeLiveEvent('chat', { comment: 'x' }), null);
  assert.equal(normalizeLiveEvent('roomUser', { user }), null);
});

test('display names are trimmed and length-limited', () => {
  const action = normalizeLiveEvent('chat', { user: { uniqueId: 'u', nickname: `  ${'x'.repeat(80)}  ` }, comment: 'hi' });
  assert.equal(action.user.name.length, 24);
});

test('validateClientAction accepts well-formed simulator actions only', () => {
  assert.ok(validateClientAction({ type: 'gift', user: { id: 'a', name: 'A' }, diamonds: 5, count: 2 }));
  assert.equal(validateClientAction({ type: 'gift', user: { id: 'a', name: 'A' }, diamonds: -1 }), null);
  assert.equal(validateClientAction({ type: 'hack', user: { id: 'a', name: 'A' } }), null);
  assert.equal(validateClientAction({ type: 'comment', user: { id: '', name: 'A' }, text: '1' }), null);
  assert.equal(validateClientAction('nope'), null);
});
