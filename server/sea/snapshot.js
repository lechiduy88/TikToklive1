// Dữ liệu gửi cho màn hình hiển thị (10 lần/giây). Chỉ những gì màn hình cần, không lộ trạng thái nội bộ.
import { SEA_TEAMS } from './config.js';
import { countByCountry } from './roster.js';
import { sortTable } from './medals.js';
import { EVENT_MODULES } from './events/index.js';
import { buffsFor } from './balance.js';

const LEADERS = 5;

function eventView(state, now) {
  if (!state.event) return null;
  const mod = EVENT_MODULES[state.event.id];
  return {
    id: mod.id,
    kind: mod.kind,
    name: mod.name,
    icon: mod.icon,
    rule: mod.rule,
    view: state.event.state ? mod.view(state.event.state, now) : null,
  };
}

function leaders(athletes, levelOf) {
  return Object.values(athletes)
    .filter((a) => a.effort > 0)
    .sort((a, b) => b.effort - a.effort)
    .slice(0, LEADERS)
    .map((a) => ({ name: a.name, team: a.team, value: Math.round(a.effort), level: levelOf(a.id) }));
}

export function toSnapshot(state, now, levelOf) {
  const counts = countByCountry(state.athletes);
  return {
    mode: 'sea',
    session: state.session,
    phase: state.phase,
    timeLeftMs: Math.max(0, state.phaseEndsAt - now),
    phaseDurationMs: state.phaseEndsAt - state.phaseStartedAt,
    eventIndex: state.eventIndex,
    eventCount: state.eventOrder.length,
    eventOrder: state.eventOrder,
    nextEvent: state.eventOrder[state.phase === 'opening' ? 0 : state.eventIndex + 1] ?? null,
    event: eventView(state, now),
    teams: SEA_TEAMS.map((t) => ({
      id: t.id,
      name: t.name,
      short: t.short,
      number: t.number,
      players: counts[t.id],
      effort: Math.round(state.teamEventEffort[t.id] + state.pendingEffort[t.id]),
    })),
    medals: sortTable(state.medals),
    buffs: Object.fromEntries(Object.entries(buffsFor(state)).map(([t, b]) => [t, Math.round(b * 100) / 100])),
    podium: state.podium,
    closing: state.closing,
    leaders: leaders(state.athletes, levelOf),
    fighters: Object.keys(state.athletes).length,
  };
}
