// HUD màn hình ngang: thanh trên (logo, môn đang thi, tiến trình, đồng hồ), cột phải (bảng tổng sắp có
// huy hiệu buff + dòng thông báo) và thanh luật chơi ở dưới.
import { shape, rrect, grad } from '../paint.js';
import { outlinedText, formatTime, truncate } from '../text.js';
import { teamOf } from './teams.js';
import { drawFlag } from './flags.js';
import { SW, SH, TOP_H, FOOT_H, SIDE_X } from './stage.js';

const GOLD = ['#fff1a8', '#ffd54a', '#b88a12'];
const PANEL = ['#2a1f45', '#120d22'];
const TABLE_TOP = TOP_H + 70;
const ROW_H = 74;
const BUFF_SHOW_AT = 1.15;

export const FEED_AREA = Object.freeze({ x: SIDE_X + 16, y: TABLE_TOP + 5 * ROW_H + 70, w: SW - SIDE_X - 32, h: 300 });

/** Toạ độ dọc hàng của một đội trong bảng tổng sắp (để hiệu ứng bay ra từ đúng hàng). */
export function tableRowY(medals, team) {
  const index = Math.max(0, (medals ?? []).findIndex((r) => r.team === team));
  return TABLE_TOP + index * ROW_H + ROW_H / 2 - 4;
}

function goldLine(ctx, x, y, w, h) {
  ctx.fillStyle = grad(ctx, x, 0, x + w, 0, ['#b88a12', '#fff1a8', '#ffd54a', '#fff1a8', '#b88a12']);
  ctx.fillRect(x, y, w, h);
}

function titleFor(state) {
  if (state.phase === 'opening') return { icon: '🔥', text: 'LỄ KHAI MẠC' };
  if (state.phase === 'closing') return { icon: '🏆', text: 'LỄ BẾ MẠC' };
  return { icon: state.event?.icon ?? '🏅', text: (state.event?.name ?? '').toUpperCase() };
}

function eventDots(ctx, state, cx, y) {
  const n = state.eventCount;
  const gap = 30;
  const x0 = cx - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i += 1) {
    const done = i < state.eventIndex || (i === state.eventIndex && state.phase === 'podium');
    const current = i === state.eventIndex && ['intro', 'live'].includes(state.phase);
    shape(ctx, (c) => c.arc(x0 + i * gap, y, current ? 10 : 7, 0, Math.PI * 2), done ? '#ffd54a' : current ? '#fff' : '#4a3d72', 3);
  }
}

function drawTop(ctx, state) {
  ctx.fillStyle = grad(ctx, 0, 0, 0, TOP_H, PANEL);
  ctx.fillRect(0, 0, SW, TOP_H);
  goldLine(ctx, 0, TOP_H - 4, SW, 6);
  outlinedText(ctx, 'SEA GAMES', 150, 38, { size: 40, color: '#ffd54a' });
  outlinedText(ctx, `LIVE · KỲ ${state.session}`, 150, 76, { size: 24, color: '#cfc6ff', stroke: 5 });
  const title = titleFor(state);
  const cx = SIDE_X / 2 + 60;
  outlinedText(ctx, `${title.icon} ${title.text}`, cx, 38, { size: 42 });
  if (['intro', 'live', 'podium'].includes(state.phase)) {
    outlinedText(ctx, `Môn ${state.eventIndex + 1}/${state.eventCount}`, cx - 140, 78, { size: 24, color: '#cfc6ff', stroke: 5, align: 'right' });
  }
  eventDots(ctx, state, cx + 40, 78);
  const tx = SW - 120;
  shape(ctx, rrect(tx - 96, 14, 192, 72, 22), grad(ctx, 0, 14, 0, 86, GOLD), 4);
  shape(ctx, rrect(tx - 88, 21, 176, 58, 17), grad(ctx, 0, 21, 0, 79, PANEL), 0);
  const urgent = state.phase === 'live' && state.timeLeftMs < 10_000;
  outlinedText(ctx, formatTime(state.timeLeftMs), tx, 51, { size: 46, color: urgent ? '#ff6b6b' : '#fff' });
}

function drawBuffBadge(ctx, buff, x, y, now) {
  if (buff < BUFF_SHOW_AT) return;
  const strong = buff >= 2;
  const pulse = strong ? 1 + Math.sin(now / 160) * 0.06 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  shape(ctx, rrect(-40, -16, 80, 32, 16), grad(ctx, 0, -16, 0, 16, strong ? ['#ffb347', '#ff4d00'] : ['#ffd27a', '#ff9f1a']), 3);
  outlinedText(ctx, `🔥×${buff.toFixed(1)}`, 0, 1, { size: 20, stroke: 4 });
  ctx.restore();
}

function drawSidebar(ctx, state, now) {
  ctx.fillStyle = grad(ctx, 0, TOP_H, 0, SH - FOOT_H, PANEL);
  ctx.fillRect(SIDE_X, TOP_H, SW - SIDE_X, SH - FOOT_H - TOP_H);
  goldLine(ctx, SIDE_X - 3, TOP_H, 6, SH - FOOT_H - TOP_H);
  outlinedText(ctx, '🏅 BẢNG TỔNG SẮP', SIDE_X + (SW - SIDE_X) / 2, TOP_H + 36, { size: 30, color: '#ffd54a' });
  const players = Object.fromEntries(state.teams.map((t) => [t.id, t.players]));
  state.medals.forEach((row, i) => {
    const t = teamOf(row.team);
    const y = TABLE_TOP + i * ROW_H;
    const x = SIDE_X + 14;
    shape(ctx, rrect(x, y, SW - SIDE_X - 28, ROW_H - 8, 14), i === 0 && row.total > 0 ? 'rgba(255,213,74,0.16)' : 'rgba(255,255,255,0.05)', 0);
    outlinedText(ctx, String(i + 1), x + 20, y + 33, { size: 26, color: '#cfc6ff', stroke: 5 });
    drawFlag(ctx, row.team, x + 40, y + 12, 60, 40, now, 0.08);
    outlinedText(ctx, truncate(t.name, 10), x + 112, y + 22, { size: 26, color: t.light, align: 'left', stroke: 5 });
    outlinedText(ctx, `👥${players[row.team] ?? 0}`, x + 112, y + 50, { size: 18, color: '#cfc6ff', align: 'left', stroke: 4 });
    drawBuffBadge(ctx, state.buffs?.[row.team] ?? 1, x + 210, y + 50, now);
    const medals = [['🥇', row.gold], ['🥈', row.silver], ['🥉', row.bronze]];
    medals.forEach(([emoji, value], k) => {
      const mx = x + 280 + k * 50;
      outlinedText(ctx, emoji, mx, y + 20, { size: 24, stroke: 0 });
      outlinedText(ctx, String(value), mx, y + 48, { size: 26, stroke: 5 });
    });
  });
  outlinedText(ctx, '📣 TRỰC TIẾP', SIDE_X + (SW - SIDE_X) / 2, FEED_AREA.y - 30, { size: 24, color: '#cfc6ff', stroke: 5 });
}

function drawFooter(ctx) {
  ctx.fillStyle = grad(ctx, 0, SH - FOOT_H, 0, SH, GOLD);
  ctx.fillRect(0, SH - FOOT_H, SW, FOOT_H);
  outlinedText(ctx, 'Gõ VN · TH · ID · PH · MY (hoặc 1–5) để vào đội tuyển   ·   Comment, thả tim, tặng quà = tiếp sức cho đội nhà', SW / 2, SH - FOOT_H / 2, { size: 26, color: '#3a2405', stroke: 0, weight: 800 });
}

export function drawSeaHud(ctx, state, now) {
  drawTop(ctx, state);
  drawSidebar(ctx, state, now);
  drawFooter(ctx);
}
