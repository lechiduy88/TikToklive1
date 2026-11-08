import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyAction, tick, toSnapshot } from '../server/game/engine.js';
import {
  BASE_MAX_HP, PHASE_DURATION_MS, LIKES_PER_SOLDIER, TEAM_COMBO_DIAMONDS,
  COMMENT_COOLDOWN_MS, FOLLOW_HEAL, DRAGON, XP, SIEGE,
} from '../server/config.js';

const rng = () => 0.5;
const user = (id) => ({ id, name: `User ${id}` });

function startBattle(now = 0) {
  const lobby = createMatch(now, rng);
  return tick(lobby, 0, now + PHASE_DURATION_MS.lobby, rng).state;
}

test('a new match starts in the lobby with full bases', () => {
  const state = createMatch(0, rng);
  assert.equal(state.phase, 'lobby');
  assert.equal(state.bases.red, BASE_MAX_HP);
  assert.equal(state.units.length, 0);
});

test('lobby transitions to battle when its timer expires', () => {
  const state = startBattle(0);
  assert.equal(state.phase, 'battle');
  assert.equal(state.phaseEndsAt, PHASE_DURATION_MS.lobby + PHASE_DURATION_MS.battle);
});

test('commenting the join keyword joins a team and spawns a soldier in battle', () => {
  const { state, events } = applyAction(startBattle(), { type: 'comment', user: user('a'), text: '2' }, 20_000);
  assert.equal(state.players.a.team, 'blue');
  assert.equal(state.units.length, 1);
  assert.equal(state.units[0].team, 'blue');
  assert.ok(events.some((e) => e.type === 'join' && e.name === 'User a'));
});

test('comment spawns are rate-limited per user', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'comment', user: user('a'), text: '1' }, 20_000).state;
  state = applyAction(state, { type: 'comment', user: user('a'), text: 'go' }, 20_500).state;
  assert.equal(state.units.length, 1);
  state = applyAction(state, { type: 'comment', user: user('a'), text: 'go' }, 20_000 + COMMENT_COOLDOWN_MS).state;
  assert.equal(state.units.length, 2);
  assert.equal(state.players.a.comments, 3);
});

test('actions during the lobby are queued and spawn when battle starts', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, { type: 'gift', user: user('g'), diamonds: 1, count: 3, giftName: 'Rose' }, 1000).state;
  assert.equal(state.units.length, 0);
  state = tick(state, 0, PHASE_DURATION_MS.lobby, rng).state;
  assert.equal(state.units.filter((u) => u.type === 'archer').length, 3);
});

test('likes accumulate per team and convert into soldiers', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'comment', user: user('a'), text: '1' }, 20_000).state;
  const before = state.units.length;
  state = applyAction(state, { type: 'like', user: user('a'), count: LIKES_PER_SOLDIER * 2 + 3 }, 20_100).state;
  assert.equal(state.units.length - before, 2);
  assert.equal(state.likeBuffer.red, 3);
});

test('gifts reaching the team combo threshold trigger a meteor', () => {
  const state = startBattle();
  const { events } = applyAction(state, {
    type: 'gift', user: user('g'), diamonds: 1, count: TEAM_COMBO_DIAMONDS, giftName: 'Rose',
  }, 20_000);
  assert.ok(events.some((e) => e.type === 'meteor'));
});

test('a dragon gift damages the enemy base by a capped amount only', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'comment', user: user('d'), text: '1' }, 20_000).state;
  const { state: next, events } = applyAction(state, {
    type: 'gift', user: user('d'), diamonds: 1000, count: 1, giftName: 'Lion',
  }, 20_100);
  assert.ok(events.some((e) => e.type === 'dragon' && e.name === 'User d'));
  assert.equal(next.bases.blue, BASE_MAX_HP - BASE_MAX_HP * DRAGON.baseDamagePct);
});

test('follow heals the player team base without exceeding max hp', () => {
  let state = startBattle();
  state = { ...state, bases: { red: 100, blue: BASE_MAX_HP } };
  state = applyAction(state, { type: 'comment', user: user('f'), text: '1' }, 20_000).state;
  state = applyAction(state, { type: 'follow', user: user('f') }, 20_100).state;
  assert.equal(state.bases.red, 100 + FOLLOW_HEAL);
});

test('battle ends with a winner and MVP when a base falls', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'comment', user: user('a'), text: '1' }, 20_000).state;
  state = { ...state, bases: { red: BASE_MAX_HP, blue: 0 } };
  const { state: next, events } = tick(state, 50, 20_050, rng);
  assert.equal(next.phase, 'victory');
  assert.equal(next.result.winner, 'red');
  const end = events.find((e) => e.type === 'match_end');
  assert.ok(end);
  assert.ok(end.result.participants.some((p) => p.id === 'a'));
});

test('a viewer auto-assigned by a lobby like can still pick a team by commenting', () => {
  let state = createMatch(0, rng);
  state = applyAction(state, { type: 'comment', user: user('x'), text: '1' }, 100).state;
  state = applyAction(state, { type: 'like', user: user('y'), count: 3 }, 200).state;
  assert.equal(state.players.y.team, 'blue');
  state = applyAction(state, { type: 'comment', user: user('y'), text: '1' }, 300).state;
  assert.equal(state.players.y.team, 'red');
});

test('comment xp is capped per match', () => {
  let state = startBattle();
  for (let i = 0; i < 500; i += 1) {
    state = applyAction(state, { type: 'comment', user: user('spam'), text: 'x' }, 20_000 + i).state;
  }
  state = { ...state, bases: { red: BASE_MAX_HP, blue: 0 } };
  const end = tick(state, 50, 30_000, rng).events.find((e) => e.type === 'match_end');
  const spam = end.result.participants.find((p) => p.id === 'spam');
  assert.ok(spam.xp <= XP.maxCommentXpPerMatch + XP.win + XP.mvp);
});

test('gift xp is capped per match so levels cannot be bought', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'gift', user: user('rich'), diamonds: 29_999, count: 1, giftName: 'Lion' }, 20_000).state;
  state = { ...state, bases: { red: BASE_MAX_HP, blue: 0 } };
  const end = tick(state, 50, 20_050, rng).events.find((e) => e.type === 'match_end');
  const rich = end.result.participants.find((p) => p.id === 'rich');
  assert.ok(rich.xp <= XP.maxGiftXpPerMatch + XP.win + XP.mvp);
});

test('battle ends on timeout and the healthier base wins', () => {
  let state = startBattle(0);
  state = { ...state, bases: { red: 500, blue: 900 } };
  const { state: next } = tick(state, 50, state.phaseEndsAt, rng);
  assert.equal(next.result.winner, 'blue');
});

test('victory phase rolls over into a fresh lobby', () => {
  let state = startBattle(0);
  state = { ...state, bases: { red: 0, blue: 10 } };
  state = tick(state, 50, 20_000, rng).state;
  const { state: next } = tick(state, 50, state.phaseEndsAt, rng);
  assert.equal(next.phase, 'lobby');
  assert.deepEqual(next.players, {});
  assert.equal(next.matchNumber, state.matchNumber + 1);
});

test('snapshot exposes fighter count and leaderboards', () => {
  let state = startBattle();
  state = applyAction(state, { type: 'comment', user: user('a'), text: '1' }, 20_000).state;
  const snap = toSnapshot(state, 20_000, () => 3);
  assert.equal(snap.fighters, 1);
  assert.equal(snap.leaderboards.comments[0].name, 'User a');
  assert.equal(snap.leaderboards.comments[0].level, 3);
});

test('snapshot exposes the tug-of-war balance and castle targets', () => {
  const state = startBattle(0);
  const snap = toSnapshot(state, 0, () => 1);
  assert.deepEqual(snap.balance, { red: 0.5, front: 500 });
  assert.deepEqual(snap.castleTargets, { red: null, blue: null });
});

test('a crushed team receives a militia counter-attack during battle', () => {
  let state = startBattle(0);
  for (let i = 0; i < 25; i += 1) state = applyAction(state, { type: 'comment', user: user(`b${i}`), text: '2' }, 0).state;
  state = applyAction(state, { type: 'comment', user: user('r'), text: '1' }, 0).state;
  const events = [];
  let now = PHASE_DURATION_MS.lobby;
  for (let t = 0; t < 8000; t += 50) {
    now += 50;
    const r = tick(state, 50, now, rng);
    state = r.state;
    events.push(...r.events);
  }
  const rally = events.find((e) => e.type === 'rally');
  assert.equal(rally?.team, 'red');
});

test('the final rush is announced once when the last seconds begin', () => {
  let state = startBattle(0);
  const rushAt = state.phaseEndsAt - SIEGE.finalRushMs;
  const before = tick(state, 50, rushAt - 50, rng);
  assert.ok(!before.events.some((e) => e.type === 'final_rush'));
  const at = tick(before.state, 50, rushAt, rng);
  assert.ok(at.events.some((e) => e.type === 'final_rush'));
  assert.equal(at.state.finalRush, true);
  const after = tick(at.state, 50, rushAt + 50, rng);
  assert.ok(!after.events.some((e) => e.type === 'final_rush'));
});
