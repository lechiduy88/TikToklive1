// Vòng đời một kỳ SEA Games LIVE:
//   khai mạc (chọn đội) -> [giới thiệu môn -> thi đấu -> trao huy chương] × N môn -> bế mạc -> kỳ mới.
// Cùng giao diện với engine 2 phe (createMatch / tick / applyAction / toSnapshot) để server dùng chung.
import { TEAM_IDS, SEA_PHASE_MS, SEA_SESSION, SEA_XP, SEA_SCALE, SEA_BALANCE } from './config.js';
import { resetEventStats, carryAthletes, countByCountry } from './roster.js';
import { buffsFor, eventBuffsFor } from './balance.js';
import { emptyTable, awardMedals, sortTable } from './medals.js';
import { EVENT_MODULES } from './events/index.js';
import { applySeaAction } from './actions.js';

export { toSnapshot } from './snapshot.js';
export const applyAction = applySeaAction;

const zeros = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
const MEDAL_XP = Object.freeze({ gold: SEA_XP.gold, silver: SEA_XP.silver, bronze: SEA_XP.bronze });
const TOP_ATHLETES = 5;

/** Thứ tự môn của kỳ: xoay vòng theo số kỳ để mỗi buổi mở màn bằng môn khác nhau. */
export function eventOrderFor(session) {
  const cycle = SEA_SESSION.eventCycle;
  // Kỳ sau bắt đầu ngay sau môn cuối của kỳ trước => các kỳ liên tiếp đi hết cả 10 môn.
  const start = ((session - 1) * SEA_SESSION.eventsPerSession) % cycle.length;
  return Array.from({ length: Math.min(SEA_SESSION.eventsPerSession, cycle.length) }, (_, i) => cycle[(start + i) % cycle.length]);
}

/**
 * @param {number} now
 * @param {() => number} _rng
 * @param {{session?: number, pendingEffort?: object, activityRate?: number}} [carry]
 */
export function createMatch(now, _rng, carry = {}) {
  const session = carry.session ?? 1;
  return {
    mode: 'sea',
    session,
    activityRate: carry.activityRate ?? SEA_SCALE.defaultRate,
    eventScale: SEA_SCALE.minScale,
    phase: 'opening',
    phaseStartedAt: now,
    phaseEndsAt: now + SEA_PHASE_MS.opening,
    eventOrder: eventOrderFor(session),
    eventIndex: 0,
    event: null,
    athletes: carryAthletes(carry.athletes ?? {}),
    likeBuffer: zeros(),
    pendingEffort: carry.pendingEffort ?? zeros(),
    teamEventEffort: zeros(),
    medals: emptyTable(),
    underdogAnnounced: [],
    podium: null,
    closing: null,
  };
}

const enterPhase = (state, phase, now) => ({ ...state, phase, phaseStartedAt: now, phaseEndsAt: now + SEA_PHASE_MS[phase] });

function startIntro(state, index, now) {
  const next = { ...enterPhase(state, 'intro', now), eventIndex: index, event: { id: state.eventOrder[index], state: null }, podium: null, athletes: resetEventStats(state.athletes) };
  return { state: next, events: [{ type: 'event_intro', eventId: next.event.id, index }] };
}

/** Sức tiếp kỳ vọng của một đội trong một môn, theo độ sôi động đo được. */
export function eventScaleFor(activityRate) {
  return Math.max(SEA_SCALE.minScale, (activityRate / TEAM_IDS.length) * SEA_SCALE.targetSeconds);
}

function startLive(state, now) {
  const mod = EVENT_MODULES[state.event.id];
  const scale = eventScaleFor(state.activityRate);
  let evState = mod.create(now, scale);
  const events = [{ type: 'event_start', eventId: mod.id }];
  const released = {};
  for (const team of TEAM_IDS) {
    // Phần để dành (kể cả quà lớn môn trước) được nhả dần, không dồn hết vào một môn.
    released[team] = Math.min(state.pendingEffort[team], SEA_SCALE.carryShare * scale);
    const applied = mod.addEffort(evState, team, released[team]);
    evState = applied.state;
    events.push(...applied.events);
  }
  const next = {
    ...state,
    phase: 'live',
    phaseStartedAt: now,
    phaseEndsAt: now + mod.maxMs,
    eventScale: scale,
    underdogAnnounced: [],
    event: { id: mod.id, state: evState },
    teamEventEffort: released,
    rawEventEffort: 0, // phần để dành không phải hoạt động trong môn => không tính vào độ sôi động
    pendingEffort: Object.fromEntries(TEAM_IDS.map((t) => [t, state.pendingEffort[t] - released[t]])),
    likeBuffer: zeros(),
  };
  return { state: next, events };
}

const MIN_MEASURE_SECONDS = 15; // môn kết thúc quá nhanh không được thổi phồng độ sôi động

/** Đo lại độ sôi động (sức tiếp gốc/giây của cả live) sau mỗi môn, trung bình trượt. */
function measuredRate(state, now) {
  const seconds = Math.max(MIN_MEASURE_SECONDS, (now - state.phaseStartedAt) / 1000);
  return state.activityRate * (1 - SEA_SCALE.emaWeight) + ((state.rawEventEffort ?? 0) / seconds) * SEA_SCALE.emaWeight;
}

function starsByTeam(athletes) {
  const stars = {};
  for (const a of Object.values(athletes)) {
    if (a.eventEffort <= 0) continue;
    if (!stars[a.team] || a.eventEffort > stars[a.team].effort) stars[a.team] = { id: a.id, name: a.name, effort: Math.round(a.eventEffort) };
  }
  return stars;
}

function participantsXp(athletes, medals, stars) {
  const medalOf = Object.fromEntries(Object.entries(medals).map(([place, team]) => [team, place]));
  const starIds = new Set(Object.values(stars).map((s) => s.id));
  return Object.values(athletes)
    .filter((a) => a.eventEffort > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      xp: Math.min(SEA_XP.maxFreeXpPerEvent, Math.round(a.eventFreeEffort))
        + Math.min(SEA_XP.maxGiftXpPerEvent, a.eventDiamonds * SEA_XP.perDiamond)
        + (a.eventEffort >= SEA_XP.minEffortForMedal ? (MEDAL_XP[medalOf[a.team]] ?? 0) : 0)
        + (starIds.has(a.id) ? SEA_XP.star : 0),
    }));
}

function finishEvent(state, now) {
  const mod = EVENT_MODULES[state.event.id];
  const ranking = mod.ranking(state.event.state);
  const { table, medals } = awardMedals(state.medals, ranking, (team) => state.teamEventEffort[team] > 0);
  const stars = starsByTeam(state.athletes);
  const podium = { eventId: mod.id, ranking, medals, stars };
  const next = { ...enterPhase(state, 'podium', now), medals: table, podium, activityRate: measuredRate(state, now) };
  const participants = participantsXp(state.athletes, medals, stars);
  return { state: next, events: [{ type: 'podium', ...podium }, { type: 'match_end', result: { participants } }] };
}

function startClosing(state, now) {
  const table = sortTable(state.medals);
  const top = table[0];
  // Bằng nhau tuyệt đối về Vàng/Bạc/Đồng => đồng vô địch, không ưu tiên đội nào theo thứ tự danh sách.
  const champions = top.total > 0
    ? table.filter((r) => r.gold === top.gold && r.silver === top.silver && r.bronze === top.bronze).map((r) => r.team)
    : [];
  const champion = champions.length === 1 ? champions[0] : null;
  const topAthletes = Object.values(state.athletes)
    .filter((a) => a.effort > 0)
    .sort((a, b) => b.effort - a.effort)
    .slice(0, TOP_ATHLETES)
    .map((a) => ({ name: a.name, team: a.team, effort: Math.round(a.effort) }));
  const closing = { champion, champions, table, topAthletes };
  return { state: { ...enterPhase(state, 'closing', now), event: null, podium: null, closing }, events: [{ type: 'closing', ...closing }] };
}

const UNDERDOG_CALL_GAP_MS = 6_000;

/**
 * Hô "LỘI NGƯỢC DÒNG" khi một đội (có người chơi) bị bỏ xa NGAY TRONG MÔN (buff huy chương/ít người
 * luôn bật nên chỉ hiện huy hiệu, không hô). Mỗi đội một lần mỗi môn, mỗi lần chỉ một đội, cách nhau ≥ 6s.
 */
function announceUnderdogs(state, now) {
  if (now - (state.lastUnderdogAt ?? -Infinity) < UNDERDOG_CALL_GAP_MS) return { state, events: [] };
  const inEvent = eventBuffsFor(state);
  const players = countByCountry(state.athletes);
  const candidates = TEAM_IDS
    .filter((t) => inEvent[t] >= SEA_BALANCE.announceAt && players[t] > 0 && !state.underdogAnnounced.includes(t))
    .sort((a, b) => inEvent[b] - inEvent[a]);
  if (!candidates.length) return { state, events: [] };
  const team = candidates[0];
  const total = buffsFor(state)[team];
  return {
    state: { ...state, underdogAnnounced: [...state.underdogAnnounced, team], lastUnderdogAt: now },
    events: [{ type: 'underdog', team, multiplier: Math.round(total * 10) / 10 }],
  };
}

function liveTick(state, dtMs, now, rng) {
  const mod = EVENT_MODULES[state.event.id];
  const stepped = mod.step(state.event.state, dtMs, now, rng);
  const announced = announceUnderdogs({ ...state, event: { ...state.event, state: stepped.state } }, now);
  const next = announced.state;
  if (!stepped.done && now < state.phaseEndsAt) return { state: next, events: [...stepped.events, ...announced.events] };
  const finished = finishEvent(next, now);
  return { state: finished.state, events: [...stepped.events, ...finished.events] };
}

/**
 * Tiến thời gian của đại hội.
 * @returns {{state: object, events: object[]}}
 */
export function tick(state, dtMs, now, rng) {
  if (state.phase === 'live') return liveTick(state, dtMs, now, rng);
  if (now < state.phaseEndsAt) return { state, events: [] };
  if (state.phase === 'opening') return startIntro(state, 0, now);
  if (state.phase === 'intro') return startLive(state, now);
  if (state.phase === 'podium') {
    const nextIndex = state.eventIndex + 1;
    return nextIndex < state.eventOrder.length ? startIntro(state, nextIndex, now) : startClosing(state, now);
  }
  const fresh = createMatch(now, rng, {
    session: state.session + 1,
    pendingEffort: state.pendingEffort,
    activityRate: state.activityRate,
    athletes: state.athletes,
  });
  return { state: fresh, events: [{ type: 'session_start', session: fresh.session }] };
}
