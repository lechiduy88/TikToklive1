// Vòng đời trận đấu: lobby -> battle -> victory -> lobby ... Hàm thuần, không thay đổi input.
import { BASE_MAX_HP, PHASE_DURATION_MS, GOLDEN_TIME, SIEGE } from '../config.js';
import { stepCombat } from './combat.js';
import { applyAction } from './actions.js';
import { addStat } from './players.js';
import { buildResult } from './results.js';
import { applyMomentum, createMomentum } from './momentum.js';

export { applyAction };
export { toSnapshot } from './results.js';

const emptyTeams = (value) => ({ red: value, blue: value });

/**
 * @param {number} now
 * @param {() => number} _rng
 * @param {{matchNumber?: number, pendingActions?: object[]}} [carry] dữ liệu chuyển từ trận trước
 */
export function createMatch(now, _rng, carry = {}) {
  return {
    matchNumber: carry.matchNumber ?? 1,
    phase: 'lobby',
    phaseStartedAt: now,
    phaseEndsAt: now + PHASE_DURATION_MS.lobby,
    bases: emptyTeams(BASE_MAX_HP),
    units: [],
    nextUnitId: 1,
    players: {},
    likeBuffer: emptyTeams(0),
    comboDiamonds: emptyTeams(0),
    pendingActions: carry.pendingActions ?? [],
    golden: null,
    momentum: createMomentum(),
    castleTargets: { red: null, blue: null },
    finalRush: false,
    result: null,
  };
}

function startBattle(state, now, rng) {
  const startsAt = now + GOLDEN_TIME.startAfterMs + Math.floor(rng() * GOLDEN_TIME.jitterMs);
  let next = {
    ...state,
    phase: 'battle',
    phaseStartedAt: now,
    phaseEndsAt: now + PHASE_DURATION_MS.battle,
    golden: { startsAt, endsAt: startsAt + GOLDEN_TIME.durationMs, started: false, ended: false },
    pendingActions: [],
  };
  const events = [{ type: 'phase', phase: 'battle' }];
  for (const action of state.pendingActions) {
    const applied = applyAction(next, action, now);
    next = applied.state;
    events.push(...applied.events);
  }
  return { state: next, events };
}

function goldenEvents(state, now) {
  const g = state.golden;
  if (!g) return { state, events: [] };
  if (!g.started && now >= g.startsAt) {
    return { state: { ...state, golden: { ...g, started: true } }, events: [{ type: 'golden_start', endsAt: g.endsAt }] };
  }
  if (g.started && !g.ended && now >= g.endsAt) {
    return { state: { ...state, golden: { ...g, ended: true } }, events: [{ type: 'golden_end' }] };
  }
  return { state, events: [] };
}

function creditCombat(players, damageByOwner, killsByOwner) {
  let next = players;
  for (const [id, dmg] of Object.entries(damageByOwner)) next = addStat(next, id, 'damage', dmg);
  for (const [id, kills] of Object.entries(killsByOwner)) next = addStat(next, id, 'kills', kills);
  return next;
}

function finalRushStep(state, now) {
  if (state.finalRush || state.phaseEndsAt - now > SIEGE.finalRushMs) return { state, events: [] };
  return { state: { ...state, finalRush: true }, events: [{ type: 'final_rush' }] };
}

function battleTick(state, dtMs, now) {
  const rush = finalRushStep(state, now);
  const siegeMultiplier = rush.state.finalRush ? SIEGE.finalRushMultiplier : 1;
  const combat = stepCombat({ ...rush.state, siegeMultiplier }, dtMs);
  const fought = {
    ...rush.state,
    units: combat.units,
    bases: combat.bases,
    castleTargets: combat.castleTargets,
    players: creditCombat(state.players, combat.damageByOwner, combat.killsByOwner),
  };
  const rally = applyMomentum(fought, now);
  const goldenStep = goldenEvents(rally.state, now);
  const golden = { state: goldenStep.state, events: [...rush.events, ...rally.events, ...goldenStep.events] };
  const baseFell = golden.state.bases.red <= 0 || golden.state.bases.blue <= 0;
  if (!baseFell && now < state.phaseEndsAt) return golden;

  const result = buildResult(golden.state);
  const ended = {
    ...golden.state,
    phase: 'victory',
    phaseStartedAt: now,
    phaseEndsAt: now + PHASE_DURATION_MS.victory,
    result,
  };
  return {
    state: ended,
    events: [...golden.events, { type: 'phase', phase: 'victory' }, { type: 'match_end', result }],
  };
}

/**
 * Tiến thời gian của trận thêm `dtMs`.
 * @returns {{state: object, events: object[]}}
 */
export function tick(state, dtMs, now, rng) {
  if (state.phase === 'lobby') {
    return now >= state.phaseEndsAt ? startBattle(state, now, rng) : { state, events: [] };
  }
  if (state.phase === 'battle') return battleTick(state, dtMs, now);
  if (now < state.phaseEndsAt) return { state, events: [] };
  const lobby = createMatch(now, rng, {
    matchNumber: state.matchNumber + 1,
    pendingActions: state.pendingActions,
  });
  return { state: lobby, events: [{ type: 'phase', phase: 'lobby' }] };
}
