// Vẽ chiến trường và lính. Hình nặng (địa hình, sprite, lâu đài) đã được render sẵn.
import { W, H, FIELD, toScreen } from './layout.js';
import { TEAM_PALETTE, shape, rrect } from './paint.js';
import { outlinedText, truncate, FONT_FAMILY } from './text.js';
import { renderTerrain } from './terrain.js';
import { getSprite, SPRITE_SIZE, FOOT_RATIO } from './sprites.js';

const BOB_SPEED = 110; // ms mỗi nhịp bước
const LABELLED = new Set(['knight', 'giant']);
let terrain = null;

export function drawBackground(ctx, golden, now) {
  terrain ??= renderTerrain();
  ctx.drawImage(terrain, 0, 0);
  if (!golden) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.55 + Math.sin(now / 300) * 0.15;
  ctx.fillStyle = '#ffb300';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function hpBar(ctx, x, y, w, pct, team) {
  shape(ctx, rrect(x - w / 2, y, w, 10, 5), '#1a1220', 0);
  shape(ctx, rrect(x - w / 2 + 2, y + 2, Math.max(4, (w - 4) * pct / 100), 6, 3), TEAM_PALETTE[team].light, 0);
}

function drawUnit(ctx, u, now) {
  const size = SPRITE_SIZE[u.type] ?? SPRITE_SIZE.soldier;
  const phase = now / BOB_SPEED + u.id * 1.7;
  const bob = Math.abs(Math.sin(phase)) * size * 0.07;
  const tilt = Math.sin(phase) * 0.06;
  ctx.save();
  ctx.translate(u.sx, u.sy);
  ctx.rotate(tilt);
  ctx.drawImage(getSprite(u.type, u.team), -size / 2, -size * FOOT_RATIO - bob, size, size);
  ctx.restore();
  if (!LABELLED.has(u.type)) return;
  hpBar(ctx, u.sx, u.sy - size * FOOT_RATIO - 14, size * 0.7, u.hpPct, u.team);
  outlinedText(ctx, truncate(u.owner ?? '', 10), u.sx, u.sy + 18, { size: 22, stroke: 5, color: TEAM_PALETTE[u.team].light });
}

export function drawUnits(ctx, units, now) {
  // Vẽ từ trên xuống để lính phía dưới che lính phía trên (giả chiều sâu).
  const sorted = [...units].sort((a, b) => a.sy - b.sy);
  for (const u of sorted) drawUnit(ctx, u, now);
}

// ---- Dây cò cưa: chiến tuyến chạy lên/xuống theo thế trận ----
const FRONT_SMOOTHING = 2.5; // càng nhỏ dây càng trôi chậm, mượt
let frontY = null;

function sharePill(ctx, x, y, text, team) {
  const p = TEAM_PALETTE[team];
  ctx.font = `800 26px ${FONT_FAMILY}`;
  const w = ctx.measureText(text).width + 36;
  shape(ctx, rrect(x - w / 2, y - 20, w, 40, 20), p.main, 3);
  outlinedText(ctx, text, x, y + 1, { size: 26, stroke: 5 });
}

/** Gọi khi rời trận để trận sau không trôi dây từ vị trí cũ. */
export function resetFrontline() {
  frontY = null;
}

export function drawFrontline(ctx, balance, dt, now) {
  if (!balance) return;
  const target = toScreen(balance.front, 0).y;
  frontY = frontY === null ? target : frontY + (target - frontY) * Math.min(1, dt * FRONT_SMOOTHING);
  const y = frontY;
  const glow = ctx.createLinearGradient(0, y - 26, 0, y + 26);
  glow.addColorStop(0, 'rgba(61,165,255,0)');
  glow.addColorStop(0.5, 'rgba(255,230,140,0.45)');
  glow.addColorStop(1, 'rgba(255,77,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(FIELD.left, y - 26, FIELD.right - FIELD.left, 52);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#5a3a1e';
  ctx.beginPath();
  ctx.moveTo(FIELD.left + 20, y);
  ctx.lineTo(FIELD.right - 20, y);
  ctx.stroke();
  ctx.setLineDash([14, 12]);
  ctx.lineDashOffset = -now / 40;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#d9a35b';
  ctx.stroke();
  ctx.restore();

  const redPct = Math.round(balance.red * 100);
  shape(ctx, (c) => c.arc(W / 2, y, 30, 0, Math.PI * 2), '#2a1f45', 4);
  outlinedText(ctx, '⚔️', W / 2, y + 2, { size: 32, stroke: 0 });
  sharePill(ctx, W / 2 - 150, y, `XANH ${100 - redPct}%`, 'blue');
  sharePill(ctx, W / 2 + 150, y, `ĐỎ ${redPct}%`, 'red');
}
