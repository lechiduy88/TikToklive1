// HUD SEA Games: thanh trên (logo, môn đang thi, đồng hồ, tiến trình), bảng tổng sắp và luật chơi ở dưới.
import { W, H } from '../layout.js';
import { shape, rrect, grad } from '../paint.js';
import { outlinedText, formatTime, truncate } from '../text.js';
import { teamOf } from './teams.js';
import { drawFlag } from './flags.js';

const TOP_H = 186;
const TABLE_Y = 1352;
const ROW_H = 62;
const GOLD = ['#fff1a8', '#ffd54a', '#b88a12'];
const PANEL = ['#2a1f45', '#120d22'];

export const FEED_AREA = Object.freeze({ x: 24, y: TABLE_Y + 5 * ROW_H + 44, w: W - 48, h: 150 });

function goldEdge(ctx, y) {
  ctx.fillStyle = grad(ctx, 0, 0, W, 0, ['#b88a12', '#fff1a8', '#ffd54a', '#fff1a8', '#b88a12']);
  ctx.fillRect(0, y - 3, W, 6);
}

function eventDots(ctx, state) {
  const n = state.eventCount;
  const gap = 34;
  const x0 = W / 2 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i += 1) {
    const done = i < state.eventIndex || (i === state.eventIndex && state.phase === 'podium');
    const current = i === state.eventIndex && ['intro', 'live'].includes(state.phase);
    shape(ctx, (c) => c.arc(x0 + i * gap, 166, current ? 11 : 8, 0, Math.PI * 2), done ? '#ffd54a' : current ? '#fff' : '#4a3d72', 3);
  }
}

function titleFor(state) {
  if (state.phase === 'opening') return { icon: '🔥', text: 'LỄ KHAI MẠC' };
  if (state.phase === 'closing') return { icon: '🏆', text: 'LỄ BẾ MẠC' };
  return { icon: state.event?.icon ?? '🏅', text: (state.event?.name ?? '').toUpperCase() };
}

function drawTop(ctx, state) {
  ctx.fillStyle = grad(ctx, 0, 0, 0, TOP_H, PANEL);
  ctx.fillRect(0, 0, W, TOP_H);
  goldEdge(ctx, TOP_H);
  outlinedText(ctx, 'SEA GAMES', 150, 52, { size: 40, color: '#ffd54a' });
  outlinedText(ctx, `LIVE · KỲ ${state.session}`, 150, 98, { size: 26, color: '#cfc6ff', stroke: 5 });
  const title = titleFor(state);
  outlinedText(ctx, `${title.icon} ${title.text}`, W / 2 + 40, 52, { size: 40 });
  if (['intro', 'live', 'podium'].includes(state.phase)) {
    outlinedText(ctx, `Môn ${state.eventIndex + 1}/${state.eventCount}`, W / 2 + 40, 102, { size: 28, color: '#cfc6ff', stroke: 5 });
  }
  shape(ctx, rrect(W - 200, 22, 176, 100, 26), grad(ctx, 0, 22, 0, 122, GOLD), 4);
  shape(ctx, rrect(W - 192, 30, 160, 84, 20), grad(ctx, 0, 30, 0, 114, PANEL), 0);
  const urgent = state.phase === 'live' && state.timeLeftMs < 10_000;
  outlinedText(ctx, formatTime(state.timeLeftMs), W - 112, 74, { size: 54, color: urgent ? '#ff6b6b' : '#fff' });
  eventDots(ctx, state);
}

const BUFF_SHOW_AT = 1.15; // buff nhỏ hơn thì không hiện cho đỡ rối

/** Huy hiệu tự cân bằng "🔥×2.3" — đội đang bị bỏ xa / ít người được nhân sức tiếp. */
function drawBuffBadge(ctx, buff, x, y, now) {
  if (buff < BUFF_SHOW_AT) return;
  const strong = buff >= 2;
  const pulse = strong ? 1 + Math.sin(now / 160) * 0.06 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  shape(ctx, rrect(-44, -18, 88, 36, 18), grad(ctx, 0, -18, 0, 18, strong ? ['#ffb347', '#ff4d00'] : ['#ffd27a', '#ff9f1a']), 3);
  outlinedText(ctx, `🔥×${buff.toFixed(1)}`, 0, 1, { size: 22, stroke: 4 });
  ctx.restore();
}

function medalCount(ctx, x, y, emoji, value) {
  outlinedText(ctx, emoji, x, y, { size: 34, stroke: 0 });
  outlinedText(ctx, String(value), x + 44, y + 2, { size: 36, stroke: 6 });
}

function drawTable(ctx, state, now) {
  ctx.fillStyle = grad(ctx, 0, TABLE_Y - 12, 0, H, PANEL);
  ctx.fillRect(0, TABLE_Y - 12, W, H - TABLE_Y + 12);
  goldEdge(ctx, TABLE_Y - 12);
  const players = Object.fromEntries(state.teams.map((t) => [t.id, t.players]));
  state.medals.forEach((row, i) => {
    const t = teamOf(row.team);
    const y = TABLE_Y + 8 + i * ROW_H;
    shape(ctx, rrect(16, y, W - 32, ROW_H - 8, 16), i === 0 && row.total > 0 ? 'rgba(255,213,74,0.16)' : 'rgba(255,255,255,0.05)', 0);
    outlinedText(ctx, String(i + 1), 46, y + 27, { size: 30, color: '#cfc6ff', stroke: 5 });
    drawFlag(ctx, row.team, 72, y + 8, 60, 40, now, 0.08);
    outlinedText(ctx, truncate(t.name, 11), 150, y + 27, { size: 32, color: t.light, align: 'left', stroke: 6 });
    drawBuffBadge(ctx, state.buffs?.[row.team] ?? 1, 395, y + 27, now);
    outlinedText(ctx, `👥${players[row.team] ?? 0}`, 485, y + 27, { size: 26, color: '#cfc6ff', stroke: 5 });
    medalCount(ctx, 600, y + 26, '🥇', row.gold);
    medalCount(ctx, 740, y + 26, '🥈', row.silver);
    medalCount(ctx, 880, y + 26, '🥉', row.bronze);
  });
}

function drawFooter(ctx) {
  ctx.fillStyle = grad(ctx, 0, H - 58, 0, H, GOLD);
  ctx.fillRect(0, H - 58, W, 58);
  outlinedText(ctx, 'Gõ VN · TH · ID · PH · MY (hoặc 1–5) để vào đội · Tim & quà = tiếp sức', W / 2, H - 28, { size: 27, color: '#3a2405', stroke: 0, weight: 800 });
}

export function drawSeaHud(ctx, state, now) {
  drawTop(ctx, state);
  drawTable(ctx, state, now);
  drawFooter(ctx);
}
