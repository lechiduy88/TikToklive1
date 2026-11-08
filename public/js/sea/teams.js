// Thông tin hiển thị của 5 đội tuyển và vị trí làn/cột của mỗi đội trên màn hình ngang.
// Thứ tự và id phải khớp server/sea/config.js (SEA_TEAMS).
import { ARENA, ARENA_W, ARENA_H } from './stage.js';

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
const indexOf = (teamId) => Math.max(0, TEAMS.findIndex((t) => t.id === teamId));

// 5 làn NGANG (đua, chạy, ném) bên dưới dải tiêu đề HEADER_H (khung "LƯỢT 2/3 ·..." không che làn đầu).
export const HEADER_H = 64;
export const LANES_TOP = ARENA.top + HEADER_H;
export const LANE_H = (ARENA_H - HEADER_H) / TEAMS.length;
export const laneTop = (teamId) => LANES_TOP + LANE_H * indexOf(teamId);
export const laneY = (teamId) => laneTop(teamId) + LANE_H / 2;

// 5 CỘT dọc (cử tạ, cầu mây, leo núi): mỗi cột rộng COLUMN_W.
export const COLUMN_W = ARENA_W / TEAMS.length;
export const columnX = (teamId) => ARENA.left + COLUMN_W * (indexOf(teamId) + 0.5);

export const MEDAL_EMOJI = Object.freeze({ gold: '🥇', silver: '🥈', bronze: '🥉' });
export const MEDAL_COLOR = Object.freeze({ gold: '#ffd54a', silver: '#d7dde8', bronze: '#d98a4b' });
