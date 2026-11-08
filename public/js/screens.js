// Màn chờ (lobby) và màn vinh danh cuối trận (peak-end).
import { W, H, COLORS, TEAM_LABEL, teamColor } from './layout.js';
import { outlinedText, roundRect, truncate } from './text.js';
import { TEAM_PALETTE, shape, rrect, grad } from './paint.js';
import { getSprite } from './sprites.js';

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(5, 8, 18, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function teamCard(ctx, team, x, key, count, now) {
  const p = TEAM_PALETTE[team];
  const lift = Math.sin(now / 300) * 6;
  const y = 760 + lift;
  shape(ctx, rrect(x - 8, y - 8, 436, 316, 46), grad(ctx, 0, y, 0, y + 300, ['#fff1a8', COLORS.gold, '#b88a12']), 5);
  shape(ctx, rrect(x, y, 420, 300, 40), grad(ctx, 0, y, 0, y + 300, [p.light, p.main, p.dark]), 0);
  shape(ctx, rrect(x + 16, y + 12, 388, 90, 30), 'rgba(255,255,255,0.18)', 0);
  ctx.drawImage(getSprite('knight', team), x + 300, y + 150, 120, 120);
  outlinedText(ctx, `GÕ ${key}`, x + 200, y + 100, { size: 96 });
  outlinedText(ctx, `${TEAM_LABEL[team]} · ${count}`, x + 160, y + 220, { size: 52 });
}

export function drawLobby(ctx, state, now) {
  dim(ctx, 0.72);
  const pulse = 1 + Math.sin(now / 250) * 0.04;
  outlinedText(ctx, 'CHỌN PHE NGAY!', W / 2, 520, { size: 96 * pulse, color: COLORS.gold });
  outlinedText(ctx, `Trận bắt đầu sau ${Math.ceil(state.timeLeftMs / 1000)}s`, W / 2, 640, { size: 48 });

  teamCard(ctx, 'red', 90, '1', state.teamCounts.red, now);
  teamCard(ctx, 'blue', W - 510, '2', state.teamCounts.blue, now + 400);

  if (state.queued > 0) {
    outlinedText(ctx, `🎁 ${state.queued} lượt quà/tim đang chờ xuất trận`, W / 2, 1120, { size: 38, color: COLORS.gold });
  }
}

function titleRow(ctx, icon, label, entry, y) {
  if (!entry) return;
  outlinedText(ctx, `${icon} ${label}`, 140, y, { size: 38, color: COLORS.muted, align: 'left', weight: 700 });
  outlinedText(ctx, truncate(entry.name, 14), W - 140, y, { size: 44, color: teamColor(entry.team), align: 'right' });
}

const RAY_COUNT = 14;

function drawRays(ctx, x, y, color, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(now / 4000);
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = color;
  for (let i = 0; i < RAY_COUNT; i += 1) {
    const a = (i / RAY_COUNT) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 700, a, a + Math.PI / RAY_COUNT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawVictory(ctx, state, now) {
  const result = state.result;
  if (!result) return;
  dim(ctx, 0.8);
  const color = result.winner === 'draw' ? COLORS.gold : teamColor(result.winner);
  const headline = result.winner === 'draw' ? 'HOÀ!' : `PHE ${TEAM_LABEL[result.winner]} THẮNG!`;
  const scale = 1 + Math.sin(now / 180) * 0.05;
  drawRays(ctx, W / 2, 360, color, now);
  outlinedText(ctx, '🏆', W / 2, 360, { size: 200 * scale, stroke: 0 });
  outlinedText(ctx, headline, W / 2, 560, { size: 110, color });

  const mvp = result.titles.mvp;
  if (mvp) {
    ctx.fillStyle = 'rgba(255, 213, 74, 0.15)';
    roundRect(ctx, 100, 660, W - 200, 230, 36);
    ctx.fill();
    outlinedText(ctx, '👑 MVP TRẬN', W / 2, 720, { size: 44, color: COLORS.gold });
    outlinedText(ctx, truncate(mvp.name, 16), W / 2, 800, { size: 84, color: teamColor(mvp.team) });
    outlinedText(ctx, `${mvp.value} sát thương`, W / 2, 862, { size: 34, color: COLORS.muted, weight: 700 });
  }
  titleRow(ctx, '💬', 'Người cổ vũ nhiệt nhất', result.titles.chatter, 960);
  titleRow(ctx, '❤️', 'Vua thả tim', result.titles.liker, 1030);
  titleRow(ctx, '💚', 'Người cứu cả phe', result.titles.healer, 1100);
  outlinedText(ctx, `Trận mới sau ${Math.ceil(state.timeLeftMs / 1000)}s — gõ 1 hoặc 2 để chiến tiếp!`, W / 2, 1180, { size: 36, color: COLORS.gold });
}
