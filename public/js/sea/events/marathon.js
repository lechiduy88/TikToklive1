// 🏃 Sân chạy marathon: 5 làn đường piste; vạch kẻ mỗi làn trôi theo tốc độ của đội đó, vận động viên
// chạy nhanh/chậm theo tốc độ, đội đang chậm lại hiện lời kêu gọi "gõ VN!" để cổ động viên vào cứu.
import { W } from '../../layout.js';
import { shape, circle, rrect, grad, offscreen, seededRandom } from '../../paint.js';
import { outlinedText, formatTime } from '../../text.js';
import { TEAMS, teamOf, ARENA, COLUMN_W, columnX } from '../teams.js';
import { drawFlag } from '../flags.js';

const SKY_H = 150;
const TRACK_TOP = ARENA.top + SKY_H;
const RUN_TOP = TRACK_TOP + 110; // vận động viên dẫn đầu chạy ở đây
const RUN_BOTTOM = ARENA.bottom - 190; // vận động viên chưa chạy ở đây
const DASH = 60;
const SKIN = '#ffd2a6';
const SMOOTH = 5;
const SLOW_RATIO = 0.25; // dưới 25% tốc độ đội nhanh nhất => "đang chậm lại"

let scenery = null;
let shown = {};

function renderScenery() {
  const { canvas, ctx } = offscreen(W, SKY_H);
  ctx.fillStyle = grad(ctx, 0, 0, 0, SKY_H, ['#ffb36b', '#ff7a8a', '#7a4fa8']);
  ctx.fillRect(0, 0, W, SKY_H);
  const rand = seededRandom(5);
  for (let x = 0; x < W;) {
    const w = 50 + rand() * 70;
    const h = 40 + rand() * 90;
    ctx.fillStyle = rand() > 0.5 ? '#3b2a5e' : '#2e2050';
    ctx.fillRect(x, SKY_H - h, w, h);
    ctx.fillStyle = 'rgba(255,230,150,0.5)';
    for (let wy = SKY_H - h + 10; wy < SKY_H - 8; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 14) if (rand() > 0.5) ctx.fillRect(wx, wy, 6, 8);
    }
    x += w + 4;
  }
  return canvas;
}

function drawTrack(ctx) {
  ctx.fillStyle = grad(ctx, 0, TRACK_TOP, 0, ARENA.bottom, ['#c4473b', '#a8362d']);
  ctx.fillRect(0, TRACK_TOP, W, ARENA.bottom - TRACK_TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i <= TEAMS.length; i += 1) ctx.fillRect(ARENA.left + COLUMN_W * i - 3, TRACK_TOP, 6, ARENA.bottom - TRACK_TOP);
  // Vạch kẻ giữa làn trôi theo quãng đường đã chạy => nhìn là thấy đội nào đang nhanh.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const t of TEAMS) {
    const x = columnX(t.id);
    const offset = (shown[t.id]?.pos ?? 0) % (DASH * 2);
    for (let y = TRACK_TOP - DASH * 2 + offset; y < ARENA.bottom; y += DASH * 2) {
      const top = Math.max(TRACK_TOP, y);
      const bottom = Math.min(ARENA.bottom, y + DASH);
      if (bottom > top) ctx.fillRect(x - 3, top, 6, bottom - top);
    }
  }
}

function drawRunner(ctx, x, y, teamId, cadence, now) {
  const t = teamOf(teamId);
  const swing = Math.sin(now / Math.max(60, 260 - cadence * 200)) * Math.min(1, 0.15 + cadence);
  const bounce = Math.abs(swing) * 8;
  ctx.save();
  ctx.translate(x, y - bounce);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 12;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 9, 30);
    ctx.lineTo(side * 9 + swing * side * 22, 70);
    ctx.stroke();
  }
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 9;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 22, -8);
    ctx.lineTo(side * 26 - swing * side * 18, 22);
    ctx.stroke();
  }
  shape(ctx, rrect(-24, -16, 48, 52, 16), grad(ctx, -24, -16, 24, 36, [t.light, t.color, t.dark]), 4);
  shape(ctx, circle(0, -38, 22), SKIN, 4);
  shape(ctx, rrect(-22, -54, 44, 9, 4), t.color, 2);
  shape(ctx, circle(-7, -36, 3), '#1a1220', 0);
  shape(ctx, circle(7, -36, 3), '#1a1220', 0);
  ctx.restore();
}

function drawSpeedBar(ctx, x, ratio, team) {
  const y = ARENA.bottom - 70;
  shape(ctx, rrect(x - 70, y, 140, 22, 11), '#1a1220', 3);
  if (ratio > 0) shape(ctx, rrect(x - 67, y + 3, Math.max(14, 134 * ratio), 16, 8), grad(ctx, x - 67, 0, x + 67, 0, ['#ffd54a', team.color]), 0);
  outlinedText(ctx, ratio > 0.8 ? '🔥 TỐC ĐỘ' : 'tốc độ', x, y - 16, { size: 22, color: '#fff7c2', stroke: 5, weight: 700 });
}

function smooth(view, dt) {
  const k = Math.min(1, dt * SMOOTH);
  shown = Object.fromEntries(TEAMS.map((t) => {
    const prev = shown[t.id] ?? { pos: view.pos[t.id], speed: view.speed[t.id] };
    return [t.id, { pos: prev.pos + (view.pos[t.id] - prev.pos) * k, speed: prev.speed + (view.speed[t.id] - prev.speed) * k }];
  }));
}

/** view = { pos, speed, endsInMs, expectedMeters } */
export function drawMarathon(ctx, view, dt, now) {
  scenery ??= renderScenery();
  ctx.drawImage(scenery, 0, ARENA.top);
  if (!view) return;
  smooth(view, dt);
  drawTrack(ctx);
  const leaderPos = Math.max(1, ...TEAMS.map((t) => shown[t.id].pos));
  const topSpeed = Math.max(1, ...TEAMS.map((t) => shown[t.id].speed));
  const leader = TEAMS.reduce((a, b) => (view.pos[b.id] > view.pos[a.id] ? b : a)).id;
  for (const t of TEAMS) {
    const x = columnX(t.id);
    const { pos, speed } = shown[t.id];
    const y = RUN_BOTTOM - (pos / leaderPos) * (RUN_BOTTOM - RUN_TOP);
    const ratio = speed / topSpeed;
    drawRunner(ctx, x, y, t.id, ratio, now);
    const isLeader = t.id === leader && view.pos[t.id] > 0;
    // Cờ nhỏ ngay trên đầu vận động viên, nhãn km bên dưới cờ.
    drawFlag(ctx, t.id, x - 24, y - 132, 48, 32, now, 0.12);
    outlinedText(ctx, `${isLeader ? '👑 ' : ''}${(pos / 1000).toFixed(2)} km`, x, y - 80, { size: isLeader ? 30 : 26, color: isLeader ? '#ffd54a' : t.light, stroke: 6 });
    drawSpeedBar(ctx, x, ratio, t);
    if (pos > 0 && ratio < SLOW_RATIO) {
      const pulse = 1 + Math.sin(now / 140) * 0.08;
      outlinedText(ctx, `😮‍💨 GÕ ${t.short}!`, x, y + 100, { size: 26 * pulse, color: '#ffffff', stroke: 6 });
    }
  }
  shape(ctx, rrect(W / 2 - 290, ARENA.top + 20, 580, 60, 30), 'rgba(18,13,34,0.82)', 4);
  outlinedText(ctx, `Còn ${formatTime(view.endsInMs)} · cổ vũ liên tục để giữ tốc độ!`, W / 2, ARENA.top + 52, { size: 30, stroke: 6 });
}

export function resetMarathon() {
  shown = {};
}
