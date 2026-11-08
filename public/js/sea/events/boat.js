// 🚣 Sân đua thuyền rồng: 5 làn nước dọc, thuyền đi từ dưới lên vạch đích phía trên.
// Khán đài vẫy cờ ở vạch đích, mốc quãng đường, nước bắn ở mái chèo, hào quang cho thuyền dẫn đầu.
import { W } from '../../layout.js';
import { OUTLINE, shape, ellipse, circle, rrect, grad, offscreen, seededRandom } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, ARENA, COLUMN_W, columnX, MEDAL_EMOJI } from '../teams.js';
import { drawFlag, flagImage } from '../flags.js';

const STANDS_H = 92; // khán đài phía trên vạch đích
const FINISH_Y = ARENA.top + STANDS_H + 24;
const BOAT_W = 92;
const BOAT_H = 260;
const START_Y = ARENA.bottom - 140; // tâm thuyền lúc xuất phát
const END_Y = FINISH_Y + BOAT_H / 2; // tâm thuyền khi mũi chạm đích
const PLACE_MEDAL = ['gold', 'silver', 'bronze'];
const SMOOTH = 6;
const MARKERS = [0.25, 0.5, 0.75];
const FAN_COUNT = 40;

let water = null;
let stands = null;
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

/** Khán đài: bậc ngồi + đầu cổ động viên mặc áo màu 5 đội (render sẵn); cờ vẫy được vẽ động. */
function renderStands() {
  const { canvas, ctx } = offscreen(W, STANDS_H);
  ctx.fillStyle = grad(ctx, 0, 0, 0, STANDS_H, ['#3a2a5e', '#241a3d']);
  ctx.fillRect(0, 0, W, STANDS_H);
  for (let row = 0; row < 3; row += 1) {
    ctx.fillStyle = row % 2 ? '#2f2250' : '#35275a';
    ctx.fillRect(0, 12 + row * 26, W, 22);
  }
  const rand = seededRandom(21);
  for (let i = 0; i < 160; i += 1) {
    const team = TEAMS[Math.floor(rand() * TEAMS.length)];
    const x = rand() * W;
    const y = 22 + Math.floor(rand() * 3) * 26;
    shape(ctx, ellipse(x, y + 8, 9, 7), team.color, 0);
    shape(ctx, circle(x, y - 2, 6), '#f0c9a0', 0);
  }
  return canvas;
}

function fans() {
  const rand = seededRandom(33);
  return Array.from({ length: FAN_COUNT }, () => ({
    team: TEAMS[Math.floor(rand() * TEAMS.length)].id,
    x: rand() * W,
    y: 10 + rand() * (STANDS_H - 40),
    phase: rand() * Math.PI * 2,
  }));
}
const FANS = fans();

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
  shape(ctx, circle(cx, 22, 17), grad(ctx, cx - 17, 5, cx + 17, 39, ['#7ef0a8', '#2fbf71', '#16804a']), 3);
  for (const side of [-1, 1]) {
    shape(ctx, (c) => { c.moveTo(cx + side * 8, 10); c.lineTo(cx + side * 16, -2); c.lineTo(cx + side * 14, 12); c.closePath(); }, '#ffd54a', 2);
    shape(ctx, circle(cx + side * 7, 18, 4), '#fff', 2);
    shape(ctx, circle(cx + side * 7, 18, 1.8), OUTLINE, 0);
  }
  shape(ctx, ellipse(cx, 32, 7, 4), '#ff5a5a', 2);
  shape(ctx, circle(cx, 62, 11), '#c0392b', 3);
  shape(ctx, circle(cx, 62, 6), '#f5d6a8', 0);
  return canvas;
}

function boatImage(teamId) {
  if (!boats.has(teamId)) boats.set(teamId, renderBoat(teamId));
  return boats.get(teamId);
}

function drawRowers(ctx, x, y, teamId, now, seed, active) {
  const t = teamOf(teamId);
  const tempo = active ? 140 : 320;
  for (let i = 0; i < 5; i += 1) {
    const ry = y - BOAT_H / 2 + 96 + i * 30;
    const phase = now / tempo + seed + i * 0.35;
    const stroke = Math.sin(phase) * 14;
    ctx.strokeStyle = '#e8d2a6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 24, ry);
    ctx.lineTo(x - 52, ry + stroke);
    ctx.moveTo(x + 24, ry);
    ctx.lineTo(x + 52, ry + stroke);
    ctx.stroke();
    // nước bắn khi mái chèo đập xuống
    if (active && Math.cos(phase) > 0.7) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k += 1) {
          ctx.beginPath();
          ctx.arc(x + side * (56 + k * 6), ry + stroke + (k - 1) * 6, 3.5 - k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    shape(ctx, circle(x - 15, ry, 8), t.light, 2.5);
    shape(ctx, circle(x + 15, ry, 8), t.light, 2.5);
  }
}

function drawStands(ctx, now) {
  stands ??= renderStands();
  ctx.drawImage(stands, 0, ARENA.top);
  // Cờ nhỏ: chỉ 1 drawImage + 1 fillRect mỗi cổ động viên (nhẹ cho OBS), nhún theo nhịp cổ vũ.
  ctx.fillStyle = '#d9d9d9';
  for (const fan of FANS) {
    const wave = Math.sin(now / 220 + fan.phase);
    const y = ARENA.top + fan.y - Math.abs(wave) * 4;
    ctx.fillRect(fan.x - 1, y, 2, 22);
    ctx.drawImage(flagImage(fan.team), fan.x + 1, y + wave * 2, 26, 17);
  }
}

function drawCourse(ctx, track, now) {
  water ??= renderWater();
  const top = ARENA.top + STANDS_H;
  const h = ARENA.bottom - top;
  const offset = (now / 25) % water.h;
  ctx.drawImage(water.canvas, 0, water.h - offset, W, h, 0, top, W, h);
  for (let i = 1; i < TEAMS.length; i += 1) {
    const x = ARENA.left + COLUMN_W * i;
    let n = 0;
    for (let y = top + 34; y < ARENA.bottom; y += 34, n += 1) shape(ctx, circle(x, y, 7), n % 2 === 0 ? '#ff4d4d' : '#ffffff', 2);
  }
  // mốc quãng đường
  ctx.save();
  ctx.setLineDash([16, 14]);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 3;
  const markerYs = MARKERS.map((m) => boatY(m * track, track) - BOAT_H / 2);
  for (const y of markerYs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore(); // tắt nét đứt trước khi vẽ chữ (viền chữ phải liền)
  MARKERS.forEach((m, i) => {
    outlinedText(ctx, `${Math.round(m * track)}m`, 6, markerYs[i] - 16, { size: 22, color: '#d8f0ff', align: 'left', stroke: 4, weight: 700 });
  });
  drawStands(ctx, now);
  for (let x = 0, col = 0; x < W; x += 24, col += 1) {
    for (let r = 0; r < 2; r += 1) {
      ctx.fillStyle = (col + r) % 2 === 0 ? '#fff' : '#1a1220';
      ctx.fillRect(x, FINISH_Y - 24 + r * 12, 24, 12);
    }
  }
  shape(ctx, rrect(W / 2 - 74, FINISH_Y - 34, 148, 44, 22), '#1a1220', 3);
  outlinedText(ctx, '🏁 ĐÍCH', W / 2, FINISH_Y - 11, { size: 28, stroke: 0, color: '#ffd54a' });
}

const boatY = (pos, track) => START_Y - (pos / track) * (START_Y - END_Y);

function drawWake(ctx, x, y, speedy) {
  ctx.fillStyle = speedy ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(x - 30, y + BOAT_H / 2 - 20);
  ctx.lineTo(x + 30, y + BOAT_H / 2 - 20);
  ctx.lineTo(x + (speedy ? 64 : 48), y + BOAT_H / 2 + (speedy ? 110 : 50));
  ctx.lineTo(x - (speedy ? 64 : 48), y + BOAT_H / 2 + (speedy ? 110 : 50));
  ctx.fill();
}

function drawLeaderAura(ctx, x, y, now) {
  const pulse = 0.85 + Math.sin(now / 180) * 0.15;
  const g = ctx.createRadialGradient(x, y, 20, x, y, 150 * pulse);
  g.addColorStop(0, 'rgba(255,220,90,0.55)');
  g.addColorStop(1, 'rgba(255,220,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 160, y - 160, 320, 320);
}

/** Vẽ toàn bộ sân đua. view = { pos, finished, track } từ server. */
export function drawBoatRace(ctx, view, dt, now) {
  drawCourse(ctx, view?.track ?? 1000, now);
  if (!view) return;
  const k = Math.min(1, dt * SMOOTH);
  const prevShown = shown;
  shown = Object.fromEntries(TEAMS.map((t) => {
    const prev = prevShown[t.id] ?? view.pos[t.id];
    return [t.id, prev + (view.pos[t.id] - prev) * k];
  }));
  const racing = TEAMS.filter((t) => !view.finished.includes(t.id));
  const leader = racing.length ? racing.reduce((a, b) => (view.pos[b.id] > view.pos[a.id] ? b : a)).id : null;
  TEAMS.forEach((t, i) => {
    const x = columnX(t.id) + Math.sin(now / 900 + i) * 3;
    const y = boatY(shown[t.id], view.track) + Math.sin(now / 300 + i * 1.7) * 4;
    const moving = view.pos[t.id] - (prevShown[t.id] ?? view.pos[t.id]) > 0.5;
    const isLeader = t.id === leader && view.pos[t.id] > 0;
    if (isLeader) drawLeaderAura(ctx, x, y, now);
    drawWake(ctx, x, y, moving);
    ctx.drawImage(boatImage(t.id), x - BOAT_W / 2, y - BOAT_H / 2, BOAT_W, BOAT_H);
    drawRowers(ctx, x, y, t.id, now, i * 1.3, moving || view.pos[t.id] > 0);
    drawFlag(ctx, t.id, x - 30, y + BOAT_H / 2 - 50, 60, 40, now, 0.15);
    const place = view.finished.indexOf(t.id);
    const labelY = y - BOAT_H / 2 - 30;
    if (place >= 0) outlinedText(ctx, MEDAL_EMOJI[PLACE_MEDAL[place]] ?? `#${place + 1}`, x, labelY - 10, { size: 64, stroke: 0 });
    else outlinedText(ctx, `${isLeader ? '👑 ' : ''}${Math.round((view.pos[t.id] / view.track) * 100)}%`, x, labelY, { size: isLeader ? 34 : 30, color: isLeader ? '#ffd54a' : t.light, stroke: 6 });
  });
}

export function resetBoatRace() {
  shown = {};
}
