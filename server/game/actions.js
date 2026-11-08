// Chuyển tương tác của người xem (comment, like, quà, follow, share) thành thay đổi trong trận.
import {
  COMMENT_COOLDOWN_MS, LIKES_PER_SOLDIER, MAX_SOLDIERS_PER_LIKE_EVENT, MAX_GIFT_UNITS_PER_EVENT,
  DRAGON, METEOR, TEAM_COMBO_DIAMONDS, FOLLOW_HEAL, SHARE_HEAL, GOLDEN_TIME,
} from '../config.js';
import { resolveTeamFromText, ensurePlayer, addStat, updatePlayer } from './players.js';
import { spawnUnits, areaStrike, healBase, giftEffectFor } from './effects.js';

const MAX_PENDING_ACTIONS = 300;
const MAX_DRAGONS_PER_EVENT = 3;
const COMBO_ELIGIBLE = new Set(['archer', 'knight']); // chỉ quà nhỏ mới góp vào combo cộng đồng

function goldenMultiplier(state, now) {
  const g = state.golden;
  return g && now >= g.startsAt && now < g.endsAt ? GOLDEN_TIME.multiplier : 1;
}

function register(state, user, requestedTeam) {
  const { players, player, joined } = ensurePlayer(state.players, user, requestedTeam);
  const events = joined ? [{ type: 'join', id: player.id, name: player.name, team: player.team }] : [];
  return { state: { ...state, players }, player, events };
}

function spawnFor(state, player, type, count, now) {
  const total = count * goldenMultiplier(state, now);
  const { state: next, spawned } = spawnUnits(state, { team: player.team, type, owner: player, count: total });
  const events = spawned > 0
    ? [{ type: 'spawn', team: player.team, unitType: type, name: player.name, count: spawned }]
    : [];
  return { state: next, events };
}

// Trong lúc chờ trận, người chơi vẫn được đổi phe bằng cách gõ 1/2
// (kể cả khi đã bị tự xếp phe do thả tim/tặng quà trước đó).
function switchTeamInLobby(state, player, requestedTeam) {
  if (state.phase !== 'lobby' || !requestedTeam || player.team === requestedTeam) return { state, events: [] };
  const players = updatePlayer(state.players, player.id, { team: requestedTeam });
  return { state: { ...state, players }, events: [{ type: 'join', id: player.id, name: player.name, team: requestedTeam }] };
}

function onComment(state, action, now) {
  const requestedTeam = resolveTeamFromText(action.text);
  const reg = register(state, action.user, requestedTeam);
  const switched = switchTeamInLobby(reg.state, reg.player, requestedTeam);
  reg.events.push(...switched.events);
  let next = { ...switched.state, players: addStat(switched.state.players, reg.player.id, 'comments', 1) };
  const player = next.players[reg.player.id];
  if (state.phase !== 'battle' || now - player.lastCommentSpawnAt < COMMENT_COOLDOWN_MS) {
    return { state: next, events: reg.events };
  }
  next = { ...next, players: updatePlayer(next.players, player.id, { lastCommentSpawnAt: now }) };
  const spawned = spawnFor(next, player, 'soldier', 1, now);
  return { state: spawned.state, events: [...reg.events, ...spawned.events] };
}

function onLike(state, action, now) {
  const reg = register(state, action.user, null);
  const { team, id } = reg.player;
  const count = Math.max(0, Math.floor(action.count ?? 1));
  // Giới hạn bộ đệm để một lượt like khổng lồ không sinh lính liên tục quá lâu.
  const maxBuffer = LIKES_PER_SOLDIER * MAX_SOLDIERS_PER_LIKE_EVENT;
  const buffered = Math.min(maxBuffer, state.likeBuffer[team] + count);
  const soldiers = Math.min(MAX_SOLDIERS_PER_LIKE_EVENT, Math.floor(buffered / LIKES_PER_SOLDIER));
  const next = {
    ...reg.state,
    players: addStat(reg.state.players, id, 'likes', count),
    likeBuffer: { ...state.likeBuffer, [team]: buffered - soldiers * LIKES_PER_SOLDIER },
  };
  if (soldiers === 0) return { state: next, events: reg.events };
  const spawned = spawnFor(next, reg.player, 'soldier', soldiers, now);
  return { state: spawned.state, events: [...reg.events, ...spawned.events] };
}

function applyCombo(state, team, diamonds) {
  const total = state.comboDiamonds[team] + diamonds;
  if (total < TEAM_COMBO_DIAMONDS) {
    return { state: { ...state, comboDiamonds: { ...state.comboDiamonds, [team]: total } }, events: [] };
  }
  const withCombo = { ...state, comboDiamonds: { ...state.comboDiamonds, [team]: total % TEAM_COMBO_DIAMONDS } };
  const struck = areaStrike(withCombo, { team, ownerId: null, ...METEOR });
  return { state: struck, events: [{ type: 'meteor', team }] };
}

function onGift(state, action, now) {
  const reg = register(state, action.user, null);
  const player = reg.player;
  const perGift = Math.max(1, Math.floor(action.diamonds ?? 1));
  const count = Math.max(1, Math.floor(action.count ?? 1));
  const effect = giftEffectFor(perGift);
  let next = { ...reg.state, players: addStat(reg.state.players, player.id, 'diamonds', perGift * count) };
  const events = [...reg.events, { type: 'gift', team: player.team, name: player.name, giftName: action.giftName, count }];

  if (effect === 'dragon') {
    const strikes = Math.min(count, MAX_DRAGONS_PER_EVENT);
    for (let i = 0; i < strikes; i += 1) {
      next = areaStrike(next, { team: player.team, ownerId: player.id, ...DRAGON });
    }
    events.push({ type: 'dragon', team: player.team, name: player.name, count: strikes });
  } else {
    const spawned = spawnFor(next, player, effect, Math.min(count, MAX_GIFT_UNITS_PER_EVENT), now);
    next = spawned.state;
    events.push(...spawned.events);
  }

  if (COMBO_ELIGIBLE.has(effect)) {
    const combo = applyCombo(next, player.team, perGift * count);
    next = combo.state;
    events.push(...combo.events);
  }
  return { state: next, events };
}

function onHeal(amount) {
  return (state, action) => {
    const reg = register(state, action.user, null);
    const { state: healed, healed: amountHealed } = healBase(reg.state, reg.player.team, amount);
    const next = { ...healed, players: addStat(healed.players, reg.player.id, 'heals', amountHealed) };
    return {
      state: next,
      events: [...reg.events, { type: 'heal', team: reg.player.team, name: reg.player.name, amount: amountHealed, reason: action.type }],
    };
  };
}

const HANDLERS = Object.freeze({
  comment: onComment,
  like: onLike,
  gift: onGift,
  follow: onHeal(FOLLOW_HEAL),
  share: onHeal(SHARE_HEAL),
});

const QUEUED_OUTSIDE_BATTLE = new Set(['gift', 'like']);

/**
 * Áp dụng một tương tác của người xem.
 * Ngoài giờ chiến đấu: comment vẫn cho chọn phe, quà/like được xếp hàng để tung ra khi trận bắt đầu.
 * @param {object} state
 * @param {{type: string, user: {id: string, name: string}}} action
 * @param {number} now
 */
export function applyAction(state, action, now) {
  const handler = HANDLERS[action?.type];
  if (!handler || !action.user?.id) return { state, events: [] };

  if (state.phase !== 'battle' && QUEUED_OUTSIDE_BATTLE.has(action.type)) {
    const pending = [...state.pendingActions, action].slice(-MAX_PENDING_ACTIONS);
    const reg = state.phase === 'lobby' ? register(state, action.user, null) : { state, events: [] };
    return { state: { ...reg.state, pendingActions: pending }, events: [...reg.events, { type: 'queued', name: action.user.name }] };
  }
  const allowed = state.phase === 'battle' || (state.phase === 'lobby' && action.type === 'comment');
  if (!allowed) return { state, events: [] };
  return handler(state, action, now);
}
