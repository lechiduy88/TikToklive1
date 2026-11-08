// Lâu đài của mỗi phe: render sẵn phần đá/tháp, khi vẽ thì thêm thanh máu, chớp sáng khi bị đánh.
import { W, BASE_Y, COLORS, TEAM_LABEL } from './layout.js';
import { TEAM_PALETTE, shape, rrect, grad, offscreen } from './paint.js';
import { outlinedText } from './text.js';

const CASTLE_H = 160;
const PLAQUE_Y = 92; // vị trí thanh máu trong lâu đài = BASE_Y
const TOWERS = [110, W - 110];
const STONE = ['#c3c9d6', '#9aa2b4', '#646c80'];
const HIT_FLASH_MS = 160;

function bricks(ctx, x0, x1, y0, y1) {
  ctx.strokeStyle = 'rgba(30,25,45,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = y0, row = 0; y < y1; y += 18, row += 1) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    for (let x = x0 + (row % 2) * 22; x < x1; x += 44) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(y + 18, y1));
    }
  }
  ctx.stroke();
}

function tower(ctx, cx, p) {
  shape(ctx, rrect(cx - 58, 48, 116, 112, 8), grad(ctx, cx - 58, 0, cx + 58, 0, STONE), 5);
  bricks(ctx, cx - 56, cx + 56, 62, 158);
  shape(ctx, rrect(cx - 12, 84, 24, 34, 12), '#1d1626', 3);
  shape(ctx, (c) => { c.moveTo(cx - 74, 58); c.lineTo(cx, 2); c.lineTo(cx + 74, 58); c.closePath(); }, grad(ctx, cx - 74, 0, cx + 74, 0, [p.light, p.main, p.dark]), 5);
}

function banner(ctx, x, p) {
  shape(ctx, (c) => { c.moveTo(x - 24, 74); c.lineTo(x + 24, 74); c.lineTo(x + 24, 142); c.lineTo(x, 128); c.lineTo(x - 24, 142); c.closePath(); }, grad(ctx, x - 24, 0, x + 24, 0, [p.light, p.main, p.dark]), 4);
  shape(ctx, (c) => { c.arc(x, 100, 11, 0, Math.PI * 2); }, COLORS.gold, 3);
}

function renderCastle(team) {
  const p = TEAM_PALETTE[team];
  const { canvas, ctx } = offscreen(W, CASTLE_H);
  shape(ctx, rrect(150, 64, W - 300, 96, 6), grad(ctx, 0, 64, 0, 160, STONE), 5);
  bricks(ctx, 152, W - 152, 80, 158);
  for (let x = 160; x < W - 180; x += 54) shape(ctx, rrect(x, 46, 34, 24, 4), grad(ctx, 0, 46, 0, 70, STONE), 4);
  for (const x of [270, W - 270]) banner(ctx, x, p);
  shape(ctx, (c) => { c.moveTo(480, 160); c.lineTo(480, 140); c.arc(540, 140, 60, Math.PI, 0); c.lineTo(600, 160); c.closePath(); }, '#2a1d14', 5);
  for (const cx of TOWERS) tower(ctx, cx, p);
  return canvas;
}

function drawPlaque(ctx, team, y, hp, max) {
  const p = TEAM_PALETTE[team];
  const x = 330;
  const w = W - 660;
  shape(ctx, rrect(x - 6, y - 30, w + 12, 60, 30), grad(ctx, 0, y - 30, 0, y + 30, ['#fff1a8', COLORS.gold, '#b88a12']), 4);
  shape(ctx, rrect(x, y - 24, w, 48, 24), '#1a1220', 0);
  const pct = Math.max(0, Math.min(1, hp / max));
  if (pct > 0) shape(ctx, rrect(x + 3, y - 21, Math.max(42, (w - 6) * pct), 42, 21), grad(ctx, 0, y - 21, 0, y + 21, [p.light, p.main, p.dark]), 0);
  outlinedText(ctx, `${TEAM_LABEL[team]} · ${Math.ceil(hp)}`, W / 2, y + 2, { size: 32, stroke: 6 });
}

function drawUnderdog(ctx, team, multiplier, now) {
  const y = team === 'blue' ? BASE_Y.blue + 92 : BASE_Y.red - 96;
  const scale = 1 + Math.sin(now / 160) * 0.05;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(scale, scale);
  shape(ctx, rrect(-200, -24, 400, 48, 24), grad(ctx, 0, -24, 0, 24, ['#ffb347', '#ff6a00']), 4);
  outlinedText(ctx, `🔥 LỘI NGƯỢC DÒNG ×${multiplier.toFixed(1)}`, 0, 2, { size: 28, stroke: 5 });
  ctx.restore();
}

/** Trả về hàm vẽ cả hai lâu đài; tự nhớ máu khung trước để chớp sáng khi bị đánh. */
export function createCastles() {
  const images = { red: renderCastle('red'), blue: renderCastle('blue') };
  let lastHp = { red: null, blue: null };
  let hitAt = { red: 0, blue: 0 };

  return function drawCastles(ctx, state, now) {
    for (const team of ['blue', 'red']) {
      const hp = state.bases[team];
      if (lastHp[team] !== null && hp < lastHp[team]) hitAt = { ...hitAt, [team]: now };
      const top = BASE_Y[team] - PLAQUE_Y;
      const hit = now - hitAt[team] < HIT_FLASH_MS;
      const jitter = hit ? (Math.random() - 0.5) * 8 : 0;
      ctx.drawImage(images[team], jitter, top);
      if (hit) {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(images[team], jitter, top);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      drawPlaque(ctx, team, BASE_Y[team], hp, state.baseMax);
      if (state.multipliers[team] > 1) drawUnderdog(ctx, team, state.multipliers[team], now);
    }
    lastHp = { red: state.bases.red, blue: state.bases.blue };
  };
}

// ---- Tháp canh bắn tên vào lính địch đang áp sát ----
const SHOT_PERIOD_MS = 360;
const TOWER_TIP_Y = { blue: BASE_Y.blue - 40, red: BASE_Y.red - 40 };

function arrow(ctx, from, to, t) {
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,220,120,0.35)';
  ctx.fillRect(-46, -3, 46, 6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-26, -2, 26, 4);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-2, -7);
  ctx.lineTo(-2, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Vẽ tên bay từ tháp tới mục tiêu mà server báo (castleTargets). */
export function drawCastleShots(ctx, targets, units, now) {
  if (!targets) return;
  for (const team of ['blue', 'red']) {
    const id = targets[team];
    if (id == null) continue;
    const target = units.find((u) => u.id === id);
    if (!target) continue;
    TOWERS.forEach((towerX, i) => {
      const t = ((now + i * SHOT_PERIOD_MS / 2) % SHOT_PERIOD_MS) / SHOT_PERIOD_MS;
      arrow(ctx, { x: towerX, y: TOWER_TIP_Y[team] }, { x: target.sx, y: target.sy - 20 }, t);
    });
  }
}
