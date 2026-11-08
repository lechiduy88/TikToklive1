// 🏐 Sân cầu mây (kiểu "giữ cầu"): mỗi đội một cột, quả cầu mây đan rơi dần; tiếp sức = cú tâng.
// Cầu thấp nhất nhấp nháy đỏ; rơi xuống đất = "RƠI CẦU", đội bị loại.
import { shape, circle, ellipse, rrect, grad, offscreen } from '../../paint.js';
import { outlinedText, formatTime } from '../../text.js';
import { TEAMS, teamOf, columnX, COLUMN_W } from '../teams.js';
import { drawFlag } from '../flags.js';
import { ARENA, ARENA_W, ARENA_H } from '../stage.js';
import { headerPill, createSmoother } from './kit.js';

const GROUND_Y = ARENA.bottom - 150;
const SKY_Y = ARENA.top + 170;
const BALL_R = 30;
const SKIN = '#ffd2a6';
const smoother = createSmoother(8);
let court = null;
let lastHeight = {};

function renderCourt() {
  const { canvas, ctx } = offscreen(ARENA_W, ARENA_H);
  ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#22305e', '#2c3f7a', '#1a2448']);
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const ground = GROUND_Y - ARENA.top;
  ctx.fillStyle = grad(ctx, 0, ground, 0, ARENA_H, ['#2f9e6e', '#1f7a52']);
  ctx.fillRect(0, ground, ARENA_W, ARENA_H - ground);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(0, ground, ARENA_W, 5);
  for (let i = 1; i < TEAMS.length; i += 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(COLUMN_W * i - 2, 0, 4, ground);
  }
  return canvas;
}

function drawBall(ctx, x, y, spin, danger, now) {
  shape(ctx, circle(x, y, BALL_R), grad(ctx, x - BALL_R, y - BALL_R, x + BALL_R, y + BALL_R, ['#ffe9a8', '#e8b64a', '#a8761e']), 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = 'rgba(110,70,20,0.8)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, BALL_R - 4, (BALL_R - 4) * 0.45, (k * Math.PI) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (danger) {
    ctx.strokeStyle = `rgba(255,70,70,${0.5 + Math.sin(now / 100) * 0.5})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, x, team, kicking, out) {
  const t = teamOf(team);
  const y = GROUND_Y;
  ctx.save();
  if (out) ctx.globalAlpha = 0.45;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 70);
  ctx.lineTo(x - 18, y);
  ctx.moveTo(x + 8, y - 70);
  ctx.lineTo(kicking ? x + 54 : x + 18, kicking ? y - 96 : y);
  ctx.stroke();
  shape(ctx, rrect(x - 24, y - 130, 48, 64, 16), grad(ctx, 0, y - 130, 0, y - 66, [t.light, t.color, t.dark]), 4);
  shape(ctx, circle(x, y - 152, 22), SKIN, 4);
  shape(ctx, rrect(x - 22, y - 170, 44, 9, 4), t.color, 2);
  ctx.restore();
}

/** view = { height, alive, dropped, endsInMs, graceInMs } */
export function drawTakraw(ctx, view, dt, now) {
  court ??= renderCourt();
  ctx.drawImage(court, ARENA.left, ARENA.top);
  if (!view) return;
  const shown = smoother.update(view.height, dt);
  const lowest = view.alive.length > 1 ? [...view.alive].sort((a, b) => view.height[a] - view.height[b])[0] : null;
  for (const t of TEAMS) {
    const x = columnX(t.id);
    const out = view.dropped.includes(t.id);
    const kicking = (view.height[t.id] ?? 0) > (lastHeight[t.id] ?? 0) + 0.001;
    drawFlag(ctx, t.id, x - 44, ARENA.top + 80, 88, 58, now, out ? 0 : 0.12);
    drawPlayer(ctx, x - 50, t.id, kicking, out);
    const by = out ? GROUND_Y - BALL_R : GROUND_Y - BALL_R - shown[t.id] * (GROUND_Y - SKY_Y - BALL_R);
    shape(ctx, ellipse(x + 20, GROUND_Y + 4, 30 * (1 - shown[t.id] * 0.5), 8), 'rgba(0,0,0,0.3)', 0);
    drawBall(ctx, x + 20, by, now / 200, t.id === lowest, now);
    outlinedText(ctx, out ? '❌ RƠI CẦU' : `${Math.round(shown[t.id] * 100)}%`, x, GROUND_Y + 60, { size: 30, color: out ? '#ff6b6b' : t.light, stroke: 6 });
    if (t.id === lowest) outlinedText(ctx, `⚠️ GÕ ${t.short}!`, x + 20, by - 60, { size: 28 * (1 + Math.sin(now / 120) * 0.08), color: '#ff6b6b', stroke: 6 });
  }
  lastHeight = view.height;
  const text = view.graceInMs > 0
    ? `Khởi động: cầu bắt đầu rơi sau ${Math.ceil(view.graceInMs / 1000)}s!`
    : `Còn ${formatTime(view.endsInMs)} · tiếp sức để giữ cầu trên không!`;
  headerPill(ctx, text, { color: view.graceInMs > 0 ? '#ffd54a' : '#fff' });
}

export function resetTakraw() {
  smoother.reset();
  lastHeight = {};
}
