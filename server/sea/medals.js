// Bảng tổng sắp huy chương kiểu Olympic/SEA Games: xếp theo Vàng, rồi Bạc, rồi Đồng.
import { TEAM_IDS } from './config.js';

const PLACES = Object.freeze(['gold', 'silver', 'bronze']);

export function emptyTable() {
  return Object.fromEntries(TEAM_IDS.map((t) => [t, { gold: 0, silver: 0, bronze: 0 }]));
}

/**
 * Trao huy chương cho 3 đội đứng đầu `ranking` mà có tham gia (eligible).
 * @returns {{table: object, medals: {gold?: string, silver?: string, bronze?: string}}}
 */
export function awardMedals(table, ranking, eligible) {
  const winners = ranking.filter(eligible).slice(0, PLACES.length);
  const medals = Object.fromEntries(winners.map((team, i) => [PLACES[i], team]));
  return { table: addMedals(table, medals), medals };
}

/** Cộng một lượt trao huy chương vào bảng (dùng cho cả bảng toàn mùa). Không thay đổi input. */
export function addMedals(table, medals) {
  const next = { ...emptyTable(), ...table };
  for (const place of PLACES) {
    const team = medals[place];
    if (!team || !Object.hasOwn(next, team)) continue;
    next[team] = { ...next[team], [place]: next[team][place] + 1 };
  }
  return next;
}

/** @returns {{team: string, gold: number, silver: number, bronze: number, total: number}[]} */
export function sortTable(table) {
  return TEAM_IDS
    .map((team, order) => ({ team, order, ...(table[team] ?? { gold: 0, silver: 0, bronze: 0 }) }))
    .map((row) => ({ ...row, total: row.gold + row.silver + row.bronze }))
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.order - b.order)
    .map(({ order, ...row }) => row);
}

/** Lọc bảng đọc từ file: chỉ giữ đội hợp lệ và số nguyên không âm. */
export function sanitizeTable(raw) {
  const table = emptyTable();
  if (!raw || typeof raw !== 'object') return table;
  for (const team of TEAM_IDS) {
    const row = raw[team];
    if (!row || typeof row !== 'object') continue;
    table[team] = Object.fromEntries(PLACES.map((p) => [p, Number.isInteger(row[p]) && row[p] >= 0 ? row[p] : 0]));
  }
  return table;
}
