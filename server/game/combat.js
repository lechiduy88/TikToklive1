import { BASE_MAX_HP, CASTLE_DEFENSE, FIELD, HOME_GROUND, SIEGE, TEAMS, UNDERDOG, UNIT_TYPES } from '../config.js';

const DIRECTION = Object.freeze({ red: 1, blue: -1 });
const OVERLAP_TOLERANCE = 10;
const BASE_X = Object.freeze({ red: 0, blue: FIELD.length });

/** Chủ sở hữu "ảo" cho sát thương/lính của lâu đài: không được ghi công cho người chơi nào. */
export const CASTLE_OWNER = '__castle__';

const enemyOf = (team) => (team === 'red' ? 'blue' : 'red');

/** Sức mạnh quân trên sân của một phe, quy ra số lính thường (giá trị × phần máu còn lại). */
export function armyPower(units, team) {
  let total = 0;
  for (const u of units) if (u.team === team) total += UNIT_TYPES[u.type].value * (u.hp / u.maxHp);
  return total;
}

/** Tỉ lệ sức mạnh của phe đỏ trên tổng (0..1), hoặc null nếu sân gần trống. */
export function redShare(units) {
  const red = armyPower(units, 'red');
  const total = red + armyPower(units, 'blue');
  return total < UNDERDOG.minTotalPower ? null : red / total;
}

function armyMultipliers(units) {
  const share = redShare(units);
  if (share === null) return { red: 1, blue: 1 };
  const weaker = share < 0.5 ? 'red' : 'blue';
  const weakShare = Math.min(share, 1 - share);
  if (weakShare >= UNDERDOG.armyShare) return { red: 1, blue: 1 };
  const bonus = Math.min(UNDERDOG.maxArmyBonus, (UNDERDOG.armyShare - weakShare) * UNDERDOG.armySlope);
  return { red: 1, blue: 1, [weaker]: 1 + bonus };
}

/**
 * Phe yếu hơn được buff sát thương: theo máu nhà và/hoặc theo lực lượng trên sân (lấy mức cao hơn).
 * @param {{red: number, blue: number}} bases
 * @param {object[]} [units]
 */
export function damageMultipliers(bases, units = []) {
  const byArmy = armyMultipliers(units);
  const gap = Math.abs(bases.red - bases.blue);
  const byBase = { red: 1, blue: 1 };
  if (gap >= BASE_MAX_HP * UNDERDOG.hpGapRatio) byBase[bases.red < bases.blue ? 'red' : 'blue'] = UNDERDOG.damageMultiplier;
  return { red: Math.max(byArmy.red, byBase.red), blue: Math.max(byArmy.blue, byBase.blue) };
}

/**
 * Lâu đài của `team` bắn lính địch gần nhất trong vùng phòng thủ.
 * @returns {{targetId: number, damage: number} | null}
 */
export function castleShot(team, enemies, bases, dt) {
  let target = null;
  let best = Infinity;
  for (const enemy of enemies) {
    const distance = Math.abs(enemy.x - BASE_X[team]);
    if (distance <= CASTLE_DEFENSE.range && distance < best) {
      target = enemy;
      best = distance;
    }
  }
  if (!target) return null;
  const danger = 1 - Math.max(0, bases[team]) / BASE_MAX_HP;
  return { targetId: target.id, damage: (CASTLE_DEFENSE.baseDps + CASTLE_DEFENSE.desperateDps * danger) * dt };
}

/** Hệ số sân nhà: 1 ở giữa sân trở về phía địch, tăng tuyến tính tới 1 + bonus ở sát lâu đài mình. */
export function homeGroundBonus(unit) {
  const half = FIELD.length / 2;
  const depth = Math.max(0, Math.min(1, (half - Math.abs(unit.x - BASE_X[unit.team])) / half));
  return 1 + HOME_GROUND.bonus * depth;
}

function findTarget(unit, enemies, range) {
  const dir = DIRECTION[unit.team];
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    const distance = dir * (enemy.x - unit.x);
    if (distance < -OVERLAP_TOLERANCE || distance > range) continue;
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

function reachedEnemyBase(unit, range) {
  return unit.team === 'red' ? unit.x >= FIELD.length - range : unit.x <= range;
}

const addTo = (map, key, amount) => map.set(key, (map.get(key) ?? 0) + amount);

function castleFire(byTeam, bases, dt, unitDamage, lastHitter) {
  const targets = { red: null, blue: null };
  for (const team of TEAMS) {
    const shot = castleShot(team, byTeam[enemyOf(team)], bases, dt);
    if (!shot) continue;
    addTo(unitDamage, shot.targetId, shot.damage);
    // Không giành mạng của người chơi: tháp chỉ được ghi là kẻ hạ gục khi không người chơi nào đánh trúng.
    if (!lastHitter.has(shot.targetId)) lastHitter.set(shot.targetId, CASTLE_OWNER);
    targets[team] = shot.targetId;
  }
  return targets;
}

/** Giới hạn sát thương lên nhà mỗi giây; công được chia lại theo tỉ lệ đóng góp. */
function applySiegeCap(baseDamage, baseCredit, credit, dt, siegeMultiplier) {
  for (const team of TEAMS) {
    const cap = SIEGE.maxBaseDps * siegeMultiplier * dt;
    const scale = baseDamage[team] > cap ? cap / baseDamage[team] : 1;
    baseDamage[team] *= scale;
    for (const [owner, dmg] of baseCredit[team]) addTo(credit, owner, dmg * scale);
  }
}

/**
 * Chạy một bước mô phỏng chiến đấu. Không thay đổi input.
 * @param {{units: object[], bases: {red: number, blue: number}, siegeMultiplier?: number}} state
 * @param {number} dtMs
 */
export function stepCombat({ units, bases, siegeMultiplier = 1 }, dtMs) {
  const dt = dtMs / 1000;
  const multipliers = damageMultipliers(bases, units);
  const byTeam = Object.fromEntries(TEAMS.map((t) => [t, units.filter((u) => u.team === t)]));
  const unitDamage = new Map();
  const lastHitter = new Map();
  const baseDamage = { red: 0, blue: 0 };
  const baseCredit = { red: new Map(), blue: new Map() }; // ai đánh nhà nào, để chia lại công khi bị giới hạn
  const credit = new Map();
  const moves = new Map();

  for (const unit of units) {
    const stats = UNIT_TYPES[unit.type];
    const mult = multipliers[unit.team] * homeGroundBonus(unit);
    const target = findTarget(unit, byTeam[enemyOf(unit.team)], stats.range);
    if (target) {
      const dmg = stats.dps * dt * mult;
      addTo(unitDamage, target.id, dmg);
      lastHitter.set(target.id, unit.ownerId);
      addTo(credit, unit.ownerId, dmg);
    } else if (reachedEnemyBase(unit, stats.range)) {
      const dmg = stats.baseDamage * dt * mult;
      baseDamage[enemyOf(unit.team)] += dmg;
      addTo(baseCredit[enemyOf(unit.team)], unit.ownerId, dmg);
    } else {
      const x = unit.x + DIRECTION[unit.team] * stats.speed * dt;
      moves.set(unit.id, Math.min(FIELD.length, Math.max(0, x)));
    }
  }
  const castleTargets = castleFire(byTeam, bases, dt, unitDamage, lastHitter);
  applySiegeCap(baseDamage, baseCredit, credit, dt, siegeMultiplier);
  return { ...finalize(units, bases, { unitDamage, lastHitter, baseDamage, credit, moves }), castleTargets };
}

function finalize(units, bases, { unitDamage, lastHitter, baseDamage, credit, moves }) {
  const killsByOwner = {};
  const survivors = [];
  for (const unit of units) {
    const hp = unit.hp - (unitDamage.get(unit.id) ?? 0);
    if (hp > 0) {
      survivors.push({ ...unit, hp, x: moves.get(unit.id) ?? unit.x });
      continue;
    }
    const killer = lastHitter.get(unit.id);
    if (killer && killer !== CASTLE_OWNER) killsByOwner[killer] = (killsByOwner[killer] ?? 0) + 1;
  }
  credit.delete(CASTLE_OWNER);
  return {
    units: survivors,
    bases: {
      red: Math.max(0, bases.red - baseDamage.red),
      blue: Math.max(0, bases.blue - baseDamage.blue),
    },
    damageByOwner: Object.fromEntries(credit),
    killsByOwner,
  };
}
