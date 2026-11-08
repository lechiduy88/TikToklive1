// Kết quả trận, XP và ảnh chụp trạng thái gửi cho màn hình hiển thị.
import {
  BASE_MAX_HP, FIELD, LEADERBOARD_SIZE, LIKES_PER_SOLDIER, TEAM_COMBO_DIAMONDS, UNIT_TYPES, XP,
} from '../config.js';
import { countByTeam } from './players.js';
import { damageMultipliers, redShare } from './combat.js';

function decideWinner(bases) {
  if (bases.red === bases.blue) return 'draw';
  return bases.red > bases.blue ? 'red' : 'blue';
}

const topBy = (players, stat) => [...players]
  .filter((p) => p[stat] > 0)
  .sort((a, b) => b[stat] - a[stat]);

function xpFor(player, winner, mvpId) {
  const base = Math.min(XP.maxCommentXpPerMatch, player.comments * XP.comment)
    + Math.floor(player.likes / LIKES_PER_SOLDIER) * XP.likeSoldier
    + Math.min(XP.maxGiftXpPerMatch, player.diamonds * XP.perDiamond);
  const winBonus = player.team === winner ? XP.win : 0;
  const mvpBonus = player.id === mvpId ? XP.mvp : 0;
  return base + winBonus + mvpBonus;
}

const brief = (p, value) => (p ? { id: p.id, name: p.name, team: p.team, value: Math.round(value) } : null);

/** Tổng kết trận: phe thắng, MVP và các danh hiệu cho cả người chơi miễn phí. */
export function buildResult(state) {
  const players = Object.values(state.players);
  const winner = decideWinner(state.bases);
  const [mvp] = topBy(players, 'damage');
  const [chatter] = topBy(players, 'comments');
  const [liker] = topBy(players, 'likes');
  const [healer] = topBy(players, 'heals');
  return {
    winner,
    bases: { ...state.bases },
    titles: {
      mvp: brief(mvp, mvp?.damage),
      chatter: brief(chatter, chatter?.comments),
      liker: brief(liker, liker?.likes),
      healer: brief(healer, healer?.heals),
    },
    participants: players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      xp: xpFor(p, winner, mvp?.id),
    })),
  };
}

function board(players, stat, levelOf) {
  return topBy(players, stat)
    .slice(0, LEADERBOARD_SIZE)
    .map((p) => ({ name: p.name, team: p.team, value: Math.round(p[stat]), level: levelOf(p.id) }));
}

/**
 * Dữ liệu gọn nhẹ gửi xuống trình duyệt ~10 lần/giây.
 * @param {(id: string) => number} levelOf
 */
/**
 * Cán cân cho màn hình: tỉ lệ sức mạnh phe đỏ (0..1) và vị trí chiến tuyến (x trên sân 0..1000),
 * tính bằng trung bình vị trí lính có trọng số theo sức mạnh. Sân trống => giữa sân.
 */
export function battleBalance(units) {
  const share = redShare(units);
  let weight = 0;
  let sum = 0;
  for (const u of units) {
    const w = UNIT_TYPES[u.type].value * (u.hp / u.maxHp);
    weight += w;
    sum += w * u.x;
  }
  return {
    red: share === null ? 0.5 : Math.round(share * 100) / 100,
    front: weight > 0 ? Math.round(sum / weight) : FIELD.length / 2,
  };
}

export function toSnapshot(state, now, levelOf) {
  const players = Object.values(state.players);
  const g = state.golden;
  return {
    matchNumber: state.matchNumber,
    phase: state.phase,
    timeLeftMs: Math.max(0, state.phaseEndsAt - now),
    bases: state.bases,
    baseMax: BASE_MAX_HP,
    units: state.units.map((u) => ({
      id: u.id, team: u.team, type: u.type, x: Math.round(u.x), lane: u.lane,
      hpPct: Math.round((u.hp / u.maxHp) * 100), owner: u.ownerName,
    })),
    teamCounts: countByTeam(state.players),
    fighters: players.length,
    golden: g ? { active: now >= g.startsAt && now < g.endsAt, endsInMs: Math.max(0, g.endsAt - now) } : null,
    multipliers: damageMultipliers(state.bases, state.units),
    balance: battleBalance(state.units),
    castleTargets: state.castleTargets ?? { red: null, blue: null },
    finalRush: Boolean(state.finalRush),
    combo: { red: state.comboDiamonds.red, blue: state.comboDiamonds.blue, threshold: TEAM_COMBO_DIAMONDS },
    queued: state.pendingActions.length,
    leaderboards: {
      damage: board(players, 'damage', levelOf),
      comments: board(players, 'comments', levelOf),
      likes: board(players, 'likes', levelOf),
    },
    result: state.result,
  };
}
