// Thông tin hiển thị của 5 đội tuyển. Thứ tự và id phải khớp server/sea/config.js (SEA_TEAMS).
import { W } from '../layout.js';

export const TEAMS = Object.freeze([
  { id: 'vn', name: 'Việt Nam', short: 'VN', number: '1', color: '#e8384f', light: '#ff8a96', dark: '#7c1424' },
  { id: 'th', name: 'Thái Lan', short: 'TH', number: '2', color: '#3d6bff', light: '#93abff', dark: '#1b2f87' },
  { id: 'id', name: 'Indonesia', short: 'ID', number: '3', color: '#ff8c1a', light: '#ffc27a', dark: '#8a3f00' },
  { id: 'ph', name: 'Philippines', short: 'PH', number: '4', color: '#f5c518', light: '#ffe27a', dark: '#7a5d00' },
  { id: 'my', name: 'Malaysia', short: 'MY', number: '5', color: '#16b39a', light: '#7fe3d2', dark: '#08584b' },
].map((t) => Object.freeze(t)));

export const TEAM = Object.freeze(Object.fromEntries(TEAMS.map((t) => [t.id, t])));
const FALLBACK = Object.freeze({ id: '?', name: '?', short: '?', number: '', color: '#888', light: '#ccc', dark: '#333' });
export const teamOf = (id) => TEAM[id] ?? FALLBACK;

// Vùng thi đấu (giữa HUD trên và bảng huy chương dưới) chia 5 cột theo thứ tự đội.
export const ARENA = Object.freeze({ top: 196, bottom: 1340, left: 40, right: W - 40 });
export const COLUMN_W = (ARENA.right - ARENA.left) / TEAMS.length;

export function columnX(teamId) {
  const index = TEAMS.findIndex((t) => t.id === teamId);
  return ARENA.left + COLUMN_W * (Math.max(0, index) + 0.5);
}

export const MEDAL_EMOJI = Object.freeze({ gold: '🥇', silver: '🥈', bronze: '🥉' });
export const MEDAL_COLOR = Object.freeze({ gold: '#ffd54a', silver: '#d7dde8', bronze: '#d98a4b' });
