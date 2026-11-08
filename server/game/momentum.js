// Phản công: khi một phe bị áp đảo liên tục, lâu đài tung một đợt dân quân miễn phí
// và màn hình kêu gọi người xem phe đó comment để giữ thành. Hàm thuần, không thay đổi input.
import { MOMENTUM } from '../config.js';
import { redShare, armyPower, CASTLE_OWNER } from './combat.js';
import { spawnUnits } from './effects.js';
import { countByTeam } from './players.js';

export { CASTLE_OWNER };

const MILITIA = Object.freeze({ id: CASTLE_OWNER, name: 'Dân quân' });

export function createMomentum() {
  return { weakTeam: null, weakSince: null, lastRallyAt: { red: -Infinity, blue: -Infinity } };
}

/** Phe bị đè trên sân, đang thua hoặc hoà máu nhà, và có người chơi (không thưởng cho việc cố tình đứng yên). */
function weakSide({ units, bases, players }) {
  const share = redShare(units);
  if (share === null) return null;
  const team = share < MOMENTUM.weakShare ? 'red' : 1 - share < MOMENTUM.weakShare ? 'blue' : null;
  if (!team) return null;
  const enemy = team === 'red' ? 'blue' : 'red';
  const teamPlayers = countByTeam(players)[team];
  if (bases[team] > bases[enemy] || teamPlayers === 0) return null;
  return { team, gap: armyPower(units, enemy) - armyPower(units, team), teamPlayers };
}

/** Bị đè càng nặng (chênh sức mạnh càng lớn), đợt dân quân càng đông. */
export function waveSize(powerGap) {
  return Math.max(MOMENTUM.waveMin, Math.min(MOMENTUM.waveMax, Math.round(powerGap * MOMENTUM.waveGapRatio)));
}

const withMomentum = (state, momentum) => ({ state: { ...state, momentum }, events: [] });

/**
 * Gọi mỗi tick trong trận.
 * @returns {{state: object, events: object[]}}
 */
export function applyMomentum(state, now) {
  if (state.phase !== 'battle') return { state, events: [] };
  const m = state.momentum ?? createMomentum();
  const weak = weakSide(state);
  if (!weak) return m.weakTeam === null ? { state, events: [] } : withMomentum(state, { ...m, weakTeam: null, weakSince: null });
  if (m.weakTeam !== weak.team) return withMomentum(state, { ...m, weakTeam: weak.team, weakSince: now });
  const pressured = now - m.weakSince >= MOMENTUM.holdMs;
  const ready = now - m.lastRallyAt[weak.team] >= MOMENTUM.cooldownMs;
  if (!pressured || !ready) return { state, events: [] };

  const { state: next, spawned } = spawnUnits(state, {
    team: weak.team, type: 'soldier', owner: MILITIA, count: Math.min(waveSize(weak.gap), Math.max(MOMENTUM.waveMin, weak.teamPlayers * MOMENTUM.militiaPerPlayer)),
  });
  const momentum = { ...m, weakSince: now, lastRallyAt: { ...m.lastRallyAt, [weak.team]: now } };
  const events = spawned > 0 ? [{ type: 'rally', team: weak.team, count: spawned }] : [];
  return { state: { ...next, momentum }, events };
}
