// 🚣 Sân đua thuyền rồng: 5 làn nước dọc, thuyền đi từ dưới lên vạch đích phía trên.
import { W } from '../../layout.js';
import { OUTLINE, shape, ellipse, circle, grad, offscreen, seededRandom } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, ARENA, COLUMN_W, columnX, MEDAL_EMOJI } from '../teams.js';
import { drawFlag } from '../flags.js';

const FINISH_Y = 300;
const BOAT_W = 92;
const BOAT_H = 260;
const START_Y = ARENA.bottom - 140; // tâm thuyền lúc xuất phát
const END_Y = FINISH_Y + BOAT_H / 2; // tâm thuyền khi mũi chạm đích
const PLACE_MEDAL = ['gold', 'silver', 'bronze'];
const SMOOTH = 6;

let water = null;
const boats = new Map(); // team -> canvas
let shown = {}; // vị trí hiển thị (nội suy mượt)

function renderWater() {
  const h = ARENA.bottom - ARENA.top;
  const { canvas, ctx } = offscreen(W, h * 2);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, ['#1f7fb8', '#145f93', '#0e4a78']);
  ctx.fillRect(0, 0, W, h * 2);
  const rand = seededRandom(7);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 260; i += 1) {
    const x = rand() * W;
    const y = rand() * h;
    const r = 14 + rand() * 18;
    for (const offset of [0, h]) {
      ctx.beginPath();
      ctx.arc(x, y + offset, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  return { canvas, h };
}

function hullPath(cx, inset) {
  return (c) => {
    c.moveTo(cx, 14 + inset * 1.6);
    c.quadraticCurveTo(BOAT_W - 4 - inset, 50, BOAT_W - 10 - inset, 140);
    c.lineTo(BOAT_W - 18 - inset, BOAT_H - 22 - inset);
    c.quadraticCurveTo(cx, BOAT_H - 2 - inset, 18 + inset, BOAT_H - 22 - inset);
    c.lineTo(10 + inset, 140);
    c.quadraticCurveTo(4 + inset, 50, cx, 14 + inset * 1.6);
    c.closePath();
  };
}

function renderBoat(teamId) {
  const t = teamOf(teamId);
  const { canvas, ctx } = offscreen(BOAT_W * 2, BOAT_H * 2);
  ctx.scale(2, 2);
  const cx = BOAT_W / 2;
  shape(ctx, hullPath(cx, 0), grad(ctx, 0, 0, BOAT_W, 0, ['#7a4a1f', '#c98b4a', '#7a4a1f']), 4);
  shape(ctx, hullPath(cx, 10), grad(ctx, 0, 0, BOAT_W, 0, [t.dark, t.color, t.dark]), 2);
  // đầu rồng
  shape(ctx, circle(cx, 22, 17), grad(ctx, cx - 17, 5, cx + 17, 39, ['#7ef0a8', '#2fbf71', '#16804a']), 3);
  for (const side of [-1, 1]) {
    shape(ctx, (c) => { c.moveTo(cx + side * 8, 10); c.lineTo(cx + side * 16, -2); c.lineTo(cx + side * 14, 12); c.closePath(); }, '#ffd54a', 2);
    shape(ctx, circle(cx + side * 7, 18, 4), '#fff', 2);
    shape(ctx, circle(cx + side * 7, 18, 1.8), OUTLINE, 0);
  }
  shape(ctx, ellipse(cx, 32, 7, 4), '#ff5a5a', 2);
  // trống ở mũi thuyền
  shape(ctx, circle(cx, 62, 11), '#c0392b', 3);
  shape(ctx, circle(cx, 62, 6), '#f5d6a8', 0);
  return canvas;
}

function boatImage(teamId) {
  if (!boats.has(teamId)) boats.set(teamId, renderBoat(teamId));
  return boats.get(teamId);
}

function drawRowers(ctx, x, y, teamId, now, seed) {
  const t = teamOf(teamId);
  for (let i = 0; i < 5; i += 1) {
    const ry = y - BOAT_H / 2 + 96 + i * 30;
    const stroke = Math.sin(now / 140 + seed + i * 0.35) * 14;
    ctx.strokeStyle = '#e8d2a6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 24, ry);
    ctx.lineTo(x - 52, ry + stroke);
    ctx.moveTo(x + 24, ry);
    ctx.lineTo(x + 52, ry + stroke);
    ctx.stroke();
    shape(ctx, circle(x - 15, ry, 8), t.light, 2.5);
    shape(ctx, circle(x + 15, ry, 8), t.light, 2.5);
  }
}

function drawCourse(ctx, now) {
  water ??= renderWater();
  const offset = (now / 25) % water.h;
  ctx.drawImage(water.canvas, 0, water.h - offset, W, water.h, 0, ARENA.top, W, water.h);
  for (let i = 1; i < TEAMS.length; i += 1) {
    const x = ARENA.left + COLUMN_W * i;
    let n = 0;
    for (let y = ARENA.top + 10; y < ARENA.bottom; y += 34, n += 1) shape(ctx, circle(x, y, 7), n % 2 === 0 ? '#ff4d4d' : '#ffffff', 2);
  }
  for (let x = 0, col = 0; x < W; x += 24, col += 1) {
    for (let r = 0; r < 2; r += 1) {
      ctx.fillStyle = (col + r) % 2 === 0 ? '#fff' : '#1a1220';
      ctx.fillRect(x, FINISH_Y - 24 + r * 12, 24, 12);
    }
  }
  outlinedText(ctx, '🏁 ĐÍCH', W / 2, FINISH_Y - 46, { size: 34, stroke: 6 });
}

const boatY = (pos, track) => START_Y - (pos / track) * (START_Y - END_Y);

function drawWake(ctx, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x - 30, y + BOAT_H / 2 - 20);
  ctx.lineTo(x + 30, y + BOAT_H / 2 - 20);
  ctx.lineTo(x + 52, y + BOAT_H / 2 + 60);
  ctx.lineTo(x - 52, y + BOAT_H / 2 + 60);
  ctx.fill();
}

/** Vẽ toàn bộ sân đua. view = { pos, finished, track } từ server. */
export function drawBoatRace(ctx, view, dt, now) {
  drawCourse(ctx, now);
  if (!view) return;
  const k = Math.min(1, dt * SMOOTH);
  shown = Object.fromEntries(TEAMS.map((t) => {
    const prev = shown[t.id] ?? view.pos[t.id];
    return [t.id, prev + (view.pos[t.id] - prev) * k];
  }));
  TEAMS.forEach((t, i) => {
    const x = columnX(t.id);
    const y = boatY(shown[t.id], view.track);
    drawWake(ctx, x, y);
    ctx.drawImage(boatImage(t.id), x - BOAT_W / 2, y - BOAT_H / 2, BOAT_W, BOAT_H);
    drawRowers(ctx, x, y, t.id, now, i * 1.3);
    drawFlag(ctx, t.id, x - 30, y + BOAT_H / 2 - 50, 60, 40, now, 0.15);
    const place = view.finished.indexOf(t.id);
    if (place >= 0) outlinedText(ctx, MEDAL_EMOJI[PLACE_MEDAL[place]] ?? `#${place + 1}`, x, y - BOAT_H / 2 - 40, { size: 64, stroke: 0 });
    else outlinedText(ctx, `${Math.round((view.pos[t.id] / view.track) * 100)}%`, x, y - BOAT_H / 2 - 24, { size: 30, color: t.light, stroke: 6 });
  });
}

export function resetBoatRace() {
  shown = {};
}
