// Vận động viên (người xem) và đội tuyển quốc gia của họ. Hàm thuần, không thay đổi input.
import { SEA_TEAMS, TEAM_IDS } from './config.js';

/** Chữ thường, bỏ dấu tiếng Việt, gộp khoảng trắng, bỏ ký tự lạ. */
export function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(team, text, firstWord) {
  if (text === team.number || team.codes.includes(text) || team.exactOnly.includes(text)) return true;
  if (team.codes.includes(firstWord)) return true;
  return team.names.some((name) => ` ${text} `.includes(` ${name} `));
}

/** @returns {string|null} id đội, hoặc null nếu comment không phải lời chọn đội */
export function resolveCountry(text) {
  if (typeof text !== 'string') return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const firstWord = normalized.split(' ')[0];
  return SEA_TEAMS.find((team) => matches(team, normalized, firstWord))?.id ?? null;
}

export function countByCountry(athletes) {
  const sizes = Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
  for (const a of Object.values(athletes)) sizes[a.team] += 1;
  return sizes;
}

function smallestCountry(athletes) {
  const sizes = countByCountry(athletes);
  return TEAM_IDS.reduce((best, t) => (sizes[t] < sizes[best] ? t : best), TEAM_IDS[0]);
}

function newAthlete(user, team) {
  return {
    id: user.id,
    name: user.name,
    team,
    effort: 0, // cả kỳ đại hội
    eventEffort: 0, // môn hiện tại
    eventFreeEffort: 0,
    eventDiamonds: 0,
    eventGiftApplied: 0, // phần quà đã đổ vào môn hiện tại (giới hạn mỗi người mỗi môn)
    comments: 0,
    likes: 0,
    diamonds: 0,
    lastCommentAt: -Infinity,
  };
}

/**
 * Lấy vận động viên hiện có hoặc tạo mới (vào đội yêu cầu, hoặc đội ít người nhất). Đã chọn đội thì giữ.
 * Object.hasOwn: ID như "constructor" không được trùng thuộc tính kế thừa.
 */
export function ensureAthlete(athletes, user, requestedTeam) {
  if (Object.hasOwn(athletes, user.id)) return { athletes, athlete: athletes[user.id], joined: false };
  const athlete = newAthlete(user, requestedTeam ?? smallestCountry(athletes));
  return { athletes: { ...athletes, [user.id]: athlete }, athlete, joined: true };
}

export function updateAthlete(athletes, id, patch) {
  if (!Object.hasOwn(athletes, id)) return athletes;
  return { ...athletes, [id]: { ...athletes[id], ...patch } };
}

export function addAthleteStat(athletes, id, stat, amount) {
  if (!Object.hasOwn(athletes, id)) return athletes;
  return updateAthlete(athletes, id, { [stat]: athletes[id][stat] + amount });
}

/** Đầu môn mới: xoá số liệu của môn trước, giữ số liệu cả kỳ. */
export function resetEventStats(athletes) {
  return Object.fromEntries(Object.entries(athletes).map(([id, a]) => [
    id, { ...a, eventEffort: 0, eventFreeEffort: 0, eventDiamonds: 0, eventGiftApplied: 0 },
  ]));
}

/** Kỳ đại hội mới: giữ đội tuyển của từng người, xoá số liệu. */
export function carryAthletes(athletes) {
  return Object.fromEntries(Object.values(athletes).map((a) => [a.id, newAthlete(a, a.team)]));
}
