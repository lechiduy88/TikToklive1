// Tạo lính và các hiệu ứng đặc biệt (rồng, thiên thạch, hồi máu). Tất cả đều không thay đổi input.
import {
  BASE_MAX_HP, FIELD, MAX_UNITS_PER_TEAM, UNIT_TYPES, GIFT_TIERS,
} from '../config.js';
import { addStat } from './players.js';

export const enemyOf = (team) => (team === 'red' ? 'blue' : 'red');

/** @returns {'dragon'|'giant'|'knight'|'archer'} */
export function giftEffectFor(diamondsPerGift) {
  const tier = GIFT_TIERS.find((t) => diamondsPerGift >= t.minDiamonds);
  return tier ? tier.effect : 'archer';
}

/**
 * Thêm `count` lính loại `type` cho người chơi `owner`. Bị giới hạn bởi MAX_UNITS_PER_TEAM.
 * @returns {{state: object, spawned: number}}
 */
export function spawnUnits(state, { team, type, owner, count }) {
  const stats = UNIT_TYPES[type];
  const teamCount = state.units.filter((u) => u.team === team).length;
  const room = Math.max(0, MAX_UNITS_PER_TEAM - teamCount);
  const amount = Math.min(count, room);
  if (amount <= 0) return { state, spawned: 0 };

  const created = Array.from({ length: amount }, (_, i) => {
    const id = state.nextUnitId + i;
    return {
      id,
      team,
      type,
      ownerId: owner.id,
      ownerName: owner.name,
      x: team === 'red' ? 0 : FIELD.length,
      lane: id % FIELD.lanes,
      hp: stats.hp,
      maxHp: stats.hp,
    };
  });
  return {
    state: { ...state, units: [...state.units, ...created], nextUnitId: state.nextUnitId + amount },
    spawned: amount,
  };
}

/**
 * Đòn diện rộng lên phe địch của `team`: trừ máu mọi lính địch và một phần máu nhà địch.
 * Sát thương được ghi công cho `ownerId` (nếu có).
 */
export function areaStrike(state, { team, ownerId, unitDamage, baseDamagePct }) {
  const enemy = enemyOf(team);
  let dealt = 0;
  const units = [];
  for (const u of state.units) {
    if (u.team !== enemy) {
      units.push(u);
      continue;
    }
    const hp = u.hp - unitDamage;
    dealt += Math.min(u.hp, unitDamage);
    if (hp > 0) units.push({ ...u, hp });
  }
  const baseHit = Math.min(state.bases[enemy], BASE_MAX_HP * baseDamagePct);
  const bases = { ...state.bases, [enemy]: state.bases[enemy] - baseHit };
  const players = ownerId ? addStat(state.players, ownerId, 'damage', dealt + baseHit) : state.players;
  return { ...state, units, bases, players };
}

export function healBase(state, team, amount) {
  const current = state.bases[team];
  const healed = Math.min(BASE_MAX_HP, current + amount);
  return { state: { ...state, bases: { ...state.bases, [team]: healed } }, healed: healed - current };
}
