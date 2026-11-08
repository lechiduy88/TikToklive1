// 🎯 Trường bắn cung: bia lớn ở giữa, 5 cột cung thủ bên dưới. Mỗi loạt bắn có tên bay vào bia.
import { W } from '../../layout.js';
import { shape, circle, rrect, grad, offscreen, seededRandom } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, ARENA, columnX } from '../teams.js';
import { drawFlag } from '../flags.js';

const TARGET = Object.freeze({ x: W / 2, y: 640, r: 300 });
// Từ ngoài vào trong: trắng, đen, xanh, đỏ, vàng (hồng tâm).
const RING_COLORS = ['#f4f1ea', '#f4f1ea', '#2a2433', '#2a2433', '#3d8bff', '#3d8bff', '#e8384f', '#e8384f', '#ffd54a', '#ffd54a'];
const FLIGHT_MS = 480;
const CARD_Y = 1030;

let scenery = null;
let targetImg = null;
let lastVolley = 0;
let flightStart = -Infinity;

function renderScenery() {
  const h = ARENA.bottom - ARENA.top;
  const { canvas, ctx } = offscreen(W, h);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, ['#8fd3ff', '#cdeeff', '#9be27a', '#5fa344', '#3b7a2e']);
  ctx.fillRect(0, 0, W, h);
  const rand = seededRandom(11);
  for (let i = 0; i < 9; i += 1) shape(ctx, circle(rand() * W, 470 + rand() * 60, 120 + rand() * 90), i % 2 ? '#6fbf55' : '#5aae46', 0);
  ctx.fillStyle = '#4f9a3c';
  ctx.fillRect(0, 560, W, h - 560);
  return canvas;
}

function renderTarget() {
  const size = TARGET.r * 2 + 20;
  const { canvas, ctx } = offscreen(size, size);
  const c = size / 2;
  RING_COLORS.forEach((color, i) => {
    const r = TARGET.r * (1 - i / RING_COLORS.length);
    shape(ctx, circle(c, c, r), color, 3);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(c - 6, c);
  ctx.lineTo(c + 6, c);
  ctx.moveTo(c, c - 6);
  ctx.lineTo(c, c + 6);
  ctx.stroke();
  return canvas;
}

function arrowPoint(result) {
  const radius = result.ring > 9 ? TARGET.r * 1.12 : ((result.ring + 0.5) / 10) * TARGET.r;
  return { x: TARGET.x + Math.cos(result.angle) * radius, y: TARGET.y + Math.sin(result.angle) * radius };
}

function drawArrow(ctx, x, y, teamId, angle) {
  const t = teamOf(teamId);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(0, -3, 70, 6);
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.moveTo(56, -3);
  ctx.lineTo(80, -14);
  ctx.lineTo(74, 0);
  ctx.lineTo(80, 14);
  ctx.lineTo(56, 3);
  ctx.fill();
  ctx.restore();
  shape(ctx, circle(x, y, 7), t.color, 3);
}

function drawArrows(ctx, view, now) {
  if (!view.last) return;
  const t = Math.min(1, (now - flightStart) / FLIGHT_MS);
  for (const result of view.last) {
    const to = arrowPoint(result);
    const from = { x: columnX(result.team), y: CARD_Y };
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 120;
    // đuôi tên luôn hướng về phía cung thủ đã bắn
    drawArrow(ctx, x, y, result.team, Math.atan2(from.y - to.y, from.x - to.x));
  }
}

function drawCards(ctx, view, now) {
  const maxAim = Math.max(1, ...Object.values(view.aim));
  const best = Math.max(...Object.values(view.totals));
  for (const team of TEAMS) {
    const x = columnX(team.id);
    shape(ctx, rrect(x - 92, CARD_Y, 184, 300, 22), 'rgba(18,13,34,0.78)', 3);
    drawFlag(ctx, team.id, x - 60, CARD_Y + 16, 120, 80, now, 0.1);
    outlinedText(ctx, team.short, x, CARD_Y + 124, { size: 32, color: team.light, stroke: 6 });
    const leading = view.totals[team.id] === best && best > 0;
    outlinedText(ctx, String(view.totals[team.id]), x, CARD_Y + 184, { size: 62, color: leading ? '#ffd54a' : '#fff' });
    const last = view.last?.find((r) => r.team === team.id);
    if (last) outlinedText(ctx, last.score === 0 ? 'trượt' : `+${last.score}`, x, CARD_Y + 230, { size: 26, color: last.score >= 9 ? '#ffd54a' : '#cfd6ff', stroke: 5 });
    shape(ctx, rrect(x - 74, CARD_Y + 256, 148, 22, 11), '#0b0816', 2);
    const pct = view.aim[team.id] / maxAim;
    if (pct > 0) shape(ctx, rrect(x - 72, CARD_Y + 258, Math.max(18, 144 * pct), 18, 9), grad(ctx, 0, CARD_Y + 258, 0, CARD_Y + 276, [team.light, team.color]), 0);
  }
  outlinedText(ctx, 'Thanh ngắm đầy = bắn chuẩn nhất', W / 2, CARD_Y - 26, { size: 26, color: '#fff7c2', stroke: 6, weight: 700 });
}

/** view = { volley, volleys, nextVolleyInMs, aim, totals, last } */
export function drawArcheryRange(ctx, view, dt, now) {
  scenery ??= renderScenery();
  targetImg ??= renderTarget();
  ctx.drawImage(scenery, 0, ARENA.top);
  ctx.fillStyle = '#7a4a1f';
  ctx.fillRect(TARGET.x - 120, TARGET.y + 200, 18, 200);
  ctx.fillRect(TARGET.x + 102, TARGET.y + 200, 18, 200);
  ctx.drawImage(targetImg, TARGET.x - targetImg.width / 2, TARGET.y - targetImg.height / 2);
  if (!view) return;
  if (view.volley !== lastVolley) {
    lastVolley = view.volley;
    flightStart = now;
  }
  const seconds = Math.ceil(view.nextVolleyInMs / 1000);
  const label = view.volley >= view.volleys ? 'Hết lượt bắn!' : `LOẠT ${view.volley + 1}/${view.volleys} · bắn sau ${seconds}s`;
  shape(ctx, rrect(W / 2 - 250, ARENA.top + 24, 500, 60, 30), 'rgba(18,13,34,0.82)', 4);
  outlinedText(ctx, label, W / 2, ARENA.top + 56, { size: 34, color: seconds <= 2 ? '#ffd54a' : '#fff', stroke: 6 });
  drawArrows(ctx, view, now);
  drawCards(ctx, view, now);
}

export function resetArchery() {
  lastVolley = 0;
  flightStart = -Infinity;
}
