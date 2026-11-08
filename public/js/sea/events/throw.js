// Cảnh "lấy đà rồi ném" (💪 đẩy tạ, 🏹 ném lao, 🦘 nhảy xa) trên màn hình ngang: 5 làn ngang, vạch cự ly.
// Trong lượt: thanh "đà" + bóng mờ ở vị trí sẽ rơi nếu ném ngay (càng cổ vũ càng xa). Hết lượt: vật bay theo
// đường cong tới điểm rơi; cờ cắm ở thành tích tốt nhất của mỗi đội.
import { shape, circle, rrect, grad } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, laneY, laneTop, LANE_H } from '../teams.js';
import { drawFlag } from '../flags.js';
import { ARENA, ARENA_W } from '../stage.js';
import { TRACK_START, TRACK_END, GUTTER_W, drawLaneGutters, drawLaneLines, headerPill, leaderOf, createSmoother } from './kit.js';

const FLIGHT_MS = 1100;
const SKIN = '#ffd2a6';
const LAND_START = TRACK_START + 90;
const chargeSmoother = createSmoother(6);
let lastAttempt = null;
let flightStart = -Infinity;

const FIELD = {
  shot_put: { fill: ['#3f9a4a', '#2f7f3a'], landing: null },
  javelin: { fill: ['#47a352', '#2f7f3a'], landing: null },
  long_jump: { fill: ['#c9603a', '#a84a2a'], landing: ['#f2d79b', '#e0bf78'] },
};

const xFor = (distance, max) => LAND_START + (distance / max) * (TRACK_END - LAND_START);

function drawField(ctx, skin, max) {
  const f = FIELD[skin] ?? FIELD.shot_put;
  ctx.fillStyle = grad(ctx, 0, ARENA.top, 0, ARENA.bottom, f.fill);
  ctx.fillRect(ARENA.left, ARENA.top, ARENA_W, ARENA.bottom - ARENA.top);
  if (f.landing) {
    ctx.fillStyle = grad(ctx, 0, ARENA.top, 0, ARENA.bottom, f.landing);
    ctx.fillRect(xFor(max * 0.45, max), ARENA.top, TRACK_END - xFor(max * 0.45, max) + 40, ARENA.bottom - ARENA.top);
  }
  drawLaneLines(ctx, 'rgba(255,255,255,0.45)');
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 1; k <= 4; k += 1) {
    const d = (max * k) / 5;
    const x = xFor(d, max);
    ctx.fillRect(x - 2, ARENA.top, 4, ARENA.bottom - ARENA.top);
    outlinedText(ctx, `${Math.round(d)} m`, x, ARENA.bottom - 18, { size: 22, color: '#fff7c2', stroke: 4, weight: 700 });
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(LAND_START - 4, ARENA.top, 8, ARENA.bottom - ARENA.top); // vạch giậm / vạch ném
}

function drawAthlete(ctx, x, y, team, charge) {
  const t = teamOf(team);
  const lean = Math.min(1, charge) * 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.3);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-6, 18);
  ctx.lineTo(-16, 50);
  ctx.moveTo(6, 18);
  ctx.lineTo(18, 50);
  ctx.stroke();
  shape(ctx, rrect(-16, -22, 32, 42, 12), grad(ctx, 0, -22, 0, 20, [t.light, t.color, t.dark]), 4);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(10, -14);
  ctx.lineTo(-24 - lean * 20, -34);
  ctx.stroke();
  shape(ctx, circle(2, -38, 15), SKIN, 4);
  ctx.restore();
}

function drawProjectile(ctx, skin, x, y, angle, team) {
  if (skin === 'javelin') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-46, -3, 92, 6);
    ctx.fillStyle = teamOf(team).color;
    ctx.fillRect(-10, -4, 20, 8);
    ctx.restore();
  } else if (skin === 'long_jump') {
    shape(ctx, circle(x, y, 16), teamOf(team).color, 4);
    shape(ctx, circle(x + 4, y - 18, 11), SKIN, 3);
  } else {
    shape(ctx, circle(x, y, 13), '#2a2433', 4);
  }
}

function drawFlight(ctx, view, skin, now) {
  if (!view.last) return;
  const t = Math.min(1, (now - flightStart) / FLIGHT_MS);
  for (const r of view.last) {
    if (r.distance <= 0) continue;
    const y0 = laneY(r.team) - 10;
    const x1 = xFor(r.distance, view.maxDistance);
    const x = TRACK_START + (x1 - TRACK_START) * t;
    const height = Math.min(LANE_H * 0.42, 40 + (r.distance / view.maxDistance) * LANE_H * 0.4);
    const y = y0 - Math.sin(t * Math.PI) * height;
    const angle = Math.atan2(-Math.cos(t * Math.PI) * height * Math.PI, x1 - TRACK_START);
    if (t < 1) drawProjectile(ctx, skin, x, y, angle, r.team);
    else shape(ctx, circle(x1, y0 + 10, 7), 'rgba(255,255,255,0.8)', 2);
  }
}

/** view = { attempt, attempts, attemptEndsInMs, charge, best, last, maxDistance, unit }, skin = id môn. */
export function drawThrow(ctx, view, dt, now, skin) {
  if (!view) return;
  // Có kết quả ném mới (kể cả lượt cuối, khi số lượt không còn tăng) => chạy hoạt ảnh bay.
  const throwKey = view.last ? view.last.map((r) => r.distance).join('|') : null;
  if (throwKey !== lastAttempt) {
    if (throwKey !== null) flightStart = now;
    lastAttempt = throwKey;
  }
  const charge = chargeSmoother.update(view.charge, dt);
  drawField(ctx, skin, view.maxDistance);
  drawLaneGutters(ctx, now, 'rgba(10,6,20,0.55)');
  const leader = leaderOf(view.best);
  for (const t of TEAMS) {
    const y = laneY(t.id);
    const frac = charge[t.id] / view.maxDistance;
    drawAthlete(ctx, TRACK_START, y, t.id, frac);
    // thanh đà dưới vận động viên
    shape(ctx, rrect(GUTTER_W + 10, y + 52, 120, 12, 6), '#1a1220', 2);
    if (frac > 0) shape(ctx, rrect(GUTTER_W + 12, y + 54, Math.max(8, 116 * frac), 8, 4), '#ffd54a', 0);
    // bóng mờ: nếu ném ngay thì rơi ở đây
    if (charge[t.id] > 0) {
      const gx = xFor(charge[t.id], view.maxDistance);
      shape(ctx, circle(gx, y + 10, 14), 'rgba(255,255,255,0.25)', 2);
      outlinedText(ctx, `${charge[t.id].toFixed(1)} m`, gx, y - 22, { size: 22, color: '#ffffff', stroke: 5, weight: 700 });
    }
    // thành tích tốt nhất: cờ cắm
    if (view.best[t.id] > 0) {
      const bx = xFor(view.best[t.id], view.maxDistance);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 2, laneTop(t.id) + 20, 4, LANE_H * 0.5);
      drawFlag(ctx, t.id, bx + 2, laneTop(t.id) + 20, 44, 30, now, 0.15);
      outlinedText(ctx, `${t.id === leader ? '👑 ' : ''}${view.best[t.id].toFixed(2)} m`, bx, laneTop(t.id) + LANE_H - 26, { size: 26, color: t.id === leader ? '#ffd54a' : t.light, stroke: 6 });
    }
  }
  drawFlight(ctx, view, skin, now);
  const seconds = Math.ceil(view.attemptEndsInMs / 1000);
  const verb = skin === 'long_jump' ? 'nhảy' : skin === 'javelin' ? 'ném' : 'đẩy';
  headerPill(ctx, `LƯỢT ${view.attempt}/${view.attempts} · ${verb} sau ${seconds}s · cổ vũ để lấy đà!`, { color: seconds <= 5 ? '#ffd54a' : '#fff' });
}

export function resetThrow() {
  chargeSmoother.reset();
  lastAttempt = null;
  flightStart = -Infinity;
}
