import { TEAMS } from '../config.js';

const JOIN_KEYWORDS = Object.freeze({
  red: ['1', 'đỏ', 'do', 'red'],
  blue: ['2', 'xanh', 'blue'],
});

/**
 * @param {unknown} text
 * @returns {'red'|'blue'|null}
 */
export function resolveTeamFromText(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase();
  const match = TEAMS.find((team) => JOIN_KEYWORDS[team].includes(normalized));
  return match ?? null;
}

/** @returns {{red: number, blue: number}} */
export function countByTeam(players) {
  const sizes = Object.fromEntries(TEAMS.map((t) => [t, 0]));
  for (const p of Object.values(players)) sizes[p.team] += 1;
  return sizes;
}

function smallestTeam(players) {
  const sizes = countByTeam(players);
  return TEAMS.reduce((best, t) => (sizes[t] < sizes[best] ? t : best), TEAMS[0]);
}

function newPlayer(user, team) {
  return {
    id: user.id,
    name: user.name,
    team,
    damage: 0,
    kills: 0,
    comments: 0,
    likes: 0,
    diamonds: 0,
    heals: 0,
    lastCommentSpawnAt: -Infinity,
  };
}

/**
 * Trả về người chơi hiện có, hoặc tạo mới (vào phe yêu cầu, hoặc phe ít người hơn).
 * Một người đã chọn phe thì giữ phe đó đến hết trận.
 * @param {Record<string, object>} players
 * @param {{id: string, name: string}} user
 * @param {'red'|'blue'|null} requestedTeam
 */
export function ensurePlayer(players, user, requestedTeam) {
  // Object.hasOwn: ID như "constructor" hay "__proto__" không được trùng với thuộc tính kế thừa.
  if (Object.hasOwn(players, user.id)) return { players, player: players[user.id], joined: false };
  const team = requestedTeam ?? smallestTeam(players);
  const player = newPlayer(user, team);
  return { players: { ...players, [user.id]: player }, player, joined: true };
}

/** Cập nhật một số trường của người chơi, trả về map mới. */
export function updatePlayer(players, id, patch) {
  if (!Object.hasOwn(players, id)) return players;
  return { ...players, [id]: { ...players[id], ...patch } };
}

export function addStat(players, id, stat, amount) {
  if (!Object.hasOwn(players, id)) return players;
  return updatePlayer(players, id, { [stat]: players[id][stat] + amount });
}
