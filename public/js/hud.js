// HUD trên (đồng hồ, quân số) và dưới (combo, bảng xếp hạng, luật chơi) theo phong cách khung vàng.
import { W, H, COLORS, TEAM_LABEL, teamColor } from './layout.js';
import { TEAM_PALETTE, shape, rrect, grad } from './paint.js';
import { outlinedText, formatTime, truncate } from './text.js';

const TOP_H = 178;
const BOTTOM_Y = 1578;
const GOLD_EDGE = ['#fff1a8', '#ffd54a', '#b88a12'];
const PANEL = ['#2a1f45', '#120d22'];
const MEDALS = ['🥇', '🥈', '🥉'];

function panel(ctx, y, h, edgeAt) {
  ctx.fillStyle = grad(ctx, 0, y, 0, y + h, PANEL);
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = grad(ctx, 0, 0, W, 0, ['#b88a12', '#fff1a8', '#ffd54a', '#fff1a8', '#b88a12']);
  ctx.fillRect(0, edgeAt - 3, W, 6);
}

function teamPill(ctx, team, x, count) {
  const p = TEAM_PALETTE[team];
  shape(ctx, rrect(x, 34, 300, 92, 46), grad(ctx, 0, 34, 0, 126, [p.light, p.main, p.dark]), 5);
  shape(ctx, rrect(x + 10, 40, 280, 30, 15), 'rgba(255,255,255,0.18)', 0);
  outlinedText(ctx, TEAM_LABEL[team], x + 150, 62, { size: 30, stroke: 6 });
  outlinedText(ctx, `${count} chiến binh`, x + 150, 102, { size: 34, stroke: 6 });
}

function drawTop(ctx, state) {
  panel(ctx, 0, TOP_H, TOP_H);
  teamPill(ctx, 'blue', 24, state.teamCounts.blue);
  teamPill(ctx, 'red', W - 324, state.teamCounts.red);
  shape(ctx, rrect(W / 2 - 160, 14, 320, 132, 34), grad(ctx, 0, 14, 0, 146, GOLD_EDGE), 5);
  shape(ctx, rrect(W / 2 - 150, 24, 300, 112, 28), grad(ctx, 0, 24, 0, 136, PANEL), 0);
  outlinedText(ctx, `TRẬN ${state.matchNumber}`, W / 2, 46, { size: 26, color: COLORS.gold, stroke: 5 });
  const urgent = state.phase === 'battle' && state.timeLeftMs < 30000;
  outlinedText(ctx, formatTime(state.timeLeftMs), W / 2, 98, { size: 76, color: urgent ? '#ff6b6b' : '#fff' });
  const text = state.golden?.active
    ? `⚡ GIỜ VÀNG ×2 · còn ${Math.ceil(state.golden.endsInMs / 1000)}s`
    : `🔥 ${state.fighters} người đang chiến đấu`;
  const ribbonW = 520;
  shape(ctx, rrect(W / 2 - ribbonW / 2, 142, ribbonW, 46, 23), grad(ctx, 0, 142, 0, 188, state.golden?.active ? ['#fff1a8', '#ff9f1a'] : ['#3d2f66', '#1d1536']), 4);
  outlinedText(ctx, text, W / 2, 166, { size: 28, color: state.golden?.active ? '#fff' : COLORS.gold, stroke: 6 });
}

function comboBar(ctx, combo, team, x) {
  const w = 480;
  const p = TEAM_PALETTE[team];
  const pct = Math.min(1, combo[team] / combo.threshold);
  shape(ctx, rrect(x, 1600, w, 46, 23), '#0b0816', 4);
  if (pct > 0) shape(ctx, rrect(x + 4, 1604, Math.max(38, (w - 8) * pct), 38, 19), grad(ctx, 0, 1604, 0, 1642, [p.light, p.main, p.dark]), 0);
  shape(ctx, rrect(x + 10, 1607, w - 20, 12, 6), 'rgba(255,255,255,0.12)', 0);
  outlinedText(ctx, `☄️ Siêu chiêu ${TEAM_LABEL[team]} ${combo[team]}/${combo.threshold}💎`, x + w / 2, 1624, { size: 26, stroke: 6 });
}

function board(ctx, title, rows, x) {
  const w = 336;
  shape(ctx, rrect(x, 1668, w, 186, 20), 'rgba(255,255,255,0.05)', 0);
  ctx.strokeStyle = 'rgba(255,213,74,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  shape(ctx, rrect(x + 40, 1654, w - 80, 36, 18), grad(ctx, 0, 1654, 0, 1690, GOLD_EDGE), 3);
  outlinedText(ctx, title, x + w / 2, 1673, { size: 24, color: '#fff', stroke: 5 });
  if (rows.length === 0) {
    outlinedText(ctx, 'Chưa có ai — vào ngay!', x + w / 2, 1764, { size: 24, color: COLORS.muted, stroke: 4, weight: 700 });
  }
  rows.slice(0, 3).forEach((row, i) => {
    const y = 1720 + i * 44;
    outlinedText(ctx, MEDALS[i], x + 24, y, { size: 28, stroke: 0 });
    outlinedText(ctx, truncate(row.name, 9), x + 46, y, { size: 27, color: teamColor(row.team), align: 'left', stroke: 5 });
    outlinedText(ctx, String(row.value), x + w - 14, y, { size: 27, align: 'right', stroke: 5 });
  });
}

function drawBottom(ctx, state) {
  panel(ctx, BOTTOM_Y, H - BOTTOM_Y, BOTTOM_Y);
  comboBar(ctx, state.combo, 'blue', 32);
  comboBar(ctx, state.combo, 'red', W - 512);
  board(ctx, '⚔️ SÁT THƯƠNG', state.leaderboards.damage, 12);
  board(ctx, '💬 BÌNH LUẬN', state.leaderboards.comments, 372);
  board(ctx, '❤️ THẢ TIM', state.leaderboards.likes, 732);
  ctx.fillStyle = grad(ctx, 0, H - 58, 0, H, GOLD_EDGE);
  ctx.fillRect(0, H - 58, W, 58);
  outlinedText(ctx, 'Gõ 1 = ĐỎ  ·  Gõ 2 = XANH  ·  Tim = lính  ·  Quà = quân mạnh', W / 2, H - 28, { size: 30, color: '#3a2405', stroke: 0, weight: 700 });
}

export function drawHud(ctx, state) {
  drawTop(ctx, state);
  drawBottom(ctx, state);
}
