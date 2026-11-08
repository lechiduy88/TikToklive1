// Cảnh "sức bền" trên màn hình ngang (🏃 marathon, 🚴 đua xe đạp): 5 làn ngang, vạch kẻ mỗi làn trôi theo
// quãng đường của đội; vận động viên đứng ở vị trí tương đối so với đội dẫn đầu; thanh tốc độ ở lề làn;
// đội đang chậm lại nhấp nháy "GÕ VN!" để cổ động viên vào cứu.
import { shape, circle, rrect, grad } from '../../paint.js';
import { outlinedText, formatTime } from '../../text.js';
import { TEAMS, teamOf, laneY, laneTop, LANE_H, LANES_TOP } from '../teams.js';
import { ARENA, ARENA_W } from '../stage.js';
import { TRACK_START, TRACK_END, GUTTER_W, drawLaneGutters, headerPill, leaderAura, leaderOf, createSmoother } from './kit.js';

const SKIN = '#ffd2a6';
const DASH = 70;
const SLOW_RATIO = 0.25;
const LABEL_GAP = 50;
const posSmoother = createSmoother(5);
const speedSmoother = createSmoother(5);

const SURFACE = {
  marathon: { fill: ['#c4473b', '#a8362d'], line: 'rgba(255,255,255,0.85)', dash: 'rgba(255,255,255,0.35)' },
  cycling: { fill: ['#4a4f5c', '#383c47'], line: 'rgba(255,255,255,0.6)', dash: 'rgba(255,214,74,0.7)' },
};

function drawSurface(ctx, skin, pos) {
  const s = SURFACE[skin] ?? SURFACE.marathon;
  ctx.fillStyle = grad(ctx, 0, ARENA.top, 0, ARENA.bottom, s.fill);
  ctx.fillRect(ARENA.left, ARENA.top, ARENA_W, ARENA.bottom - ARENA.top);
  ctx.fillStyle = s.line;
  for (let i = 0; i < TEAMS.length; i += 1) ctx.fillRect(ARENA.left, LANES_TOP + LANE_H * i - 3, ARENA_W, 6);
  // Vạch giữa làn trôi sang trái theo quãng đường => nhìn là thấy đội nào đang nhanh.
  ctx.fillStyle = s.dash;
  for (const t of TEAMS) {
    const y = laneY(t.id) + 46;
    const offset = (pos[t.id] ?? 0) % (DASH * 2);
    for (let x = GUTTER_W - offset; x < ARENA.right; x += DASH * 2) {
      const left = Math.max(GUTTER_W, x);
      const right = Math.min(ARENA.right, x + DASH);
      if (right > left) ctx.fillRect(left, y, right - left, 6);
    }
  }
}

function drawRunner(ctx, x, y, team, cadence, now) {
  const t = teamOf(team);
  const swing = Math.sin(now / Math.max(55, 260 - cadence * 200)) * Math.min(1, 0.15 + cadence);
  ctx.save();
  ctx.translate(x, y - Math.abs(swing) * 6);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 11;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(swing * side * 26, 52);
    ctx.stroke();
  }
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 8;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-swing * side * 22, 12);
    ctx.stroke();
  }
  shape(ctx, rrect(-16, -24, 32, 46, 12), grad(ctx, 0, -24, 0, 22, [t.light, t.color, t.dark]), 4);
  shape(ctx, circle(4, -40, 17), SKIN, 4);
  shape(ctx, rrect(-12, -54, 32, 8, 4), t.color, 2);
  ctx.restore();
}

function drawCyclist(ctx, x, y, team, cadence, now) {
  const t = teamOf(team);
  const spin = now / Math.max(40, 220 - cadence * 180);
  ctx.save();
  ctx.translate(x, y);
  for (const wx of [-34, 34]) {
    shape(ctx, circle(wx, 30, 24), null, 5);
    ctx.strokeStyle = 'rgba(30,25,45,0.8)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k += 1) {
      const a = spin + (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(a) * 22, 30 - Math.sin(a) * 22);
      ctx.lineTo(wx + Math.cos(a) * 22, 30 + Math.sin(a) * 22);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = t.color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-34, 30);
  ctx.lineTo(-6, 0);
  ctx.lineTo(28, 2);
  ctx.lineTo(34, 30);
  ctx.moveTo(-6, 0);
  ctx.lineTo(4, 30);
  ctx.stroke();
  shape(ctx, rrect(-20, -36, 30, 36, 12), grad(ctx, 0, -36, 0, 0, [t.light, t.color, t.dark]), 4);
  shape(ctx, circle(18, -40, 15), SKIN, 4);
  shape(ctx, (c) => { c.arc(18, -42, 17, Math.PI, Math.PI * 2); c.closePath(); }, t.color, 3);
  ctx.restore();
}

function speedBar(ctx, team, ratio) {
  const t = teamOf(team);
  const x = ARENA.left + 14;
  const y = laneY(team) + 26;
  shape(ctx, rrect(x, y, GUTTER_W - 28, 16, 8), '#1a1220', 2);
  if (ratio > 0) shape(ctx, rrect(x + 2, y + 2, Math.max(10, (GUTTER_W - 32) * ratio), 12, 6), ratio > 0.8 ? '#ffd54a' : t.color, 0);
}

/** view = { pos, speed, endsInMs, expectedMeters }, skin = 'marathon' | 'cycling'. */
export function drawEndurance(ctx, view, dt, now, skin) {
  if (!view) return;
  const pos = posSmoother.update(view.pos, dt);
  const speed = speedSmoother.update(view.speed, dt);
  drawSurface(ctx, skin, pos);
  drawLaneGutters(ctx, now, 'rgba(10,6,20,0.6)');
  const leaderPos = Math.max(1, ...TEAMS.map((t) => pos[t.id]));
  const topSpeed = Math.max(1, ...TEAMS.map((t) => speed[t.id]));
  const leader = leaderOf(view.pos);
  for (const t of TEAMS) {
    const ratio = speed[t.id] / topSpeed;
    const x = TRACK_START + (pos[t.id] / leaderPos) * (TRACK_END - TRACK_START - 60);
    const y = laneY(t.id) - 4;
    if (t.id === leader) leaderAura(ctx, x, y, now, 100);
    (skin === 'cycling' ? drawCyclist : drawRunner)(ctx, x, y, t.id, ratio, now);
    // Nhãn đặt bên trái vận động viên (không tràn mép phải); lúc mới xuất phát thì đặt bên phải.
    const onLeft = x - LABEL_GAP > TRACK_START + 160;
    const lx = onLeft ? x - LABEL_GAP : x + LABEL_GAP;
    const align = onLeft ? 'right' : 'left';
    outlinedText(ctx, `${t.id === leader ? '👑 ' : ''}${(pos[t.id] / 1000).toFixed(2)} km`, lx, laneY(t.id) - 22, { size: 28, color: t.id === leader ? '#ffd54a' : t.light, stroke: 6, align });
    speedBar(ctx, t.id, ratio);
    if (pos[t.id] > 0 && ratio < SLOW_RATIO) {
      const pulse = 1 + Math.sin(now / 140) * 0.08;
      outlinedText(ctx, `😮‍💨 GÕ ${t.short}!`, lx, laneY(t.id) + 20, { size: 26 * pulse, stroke: 6, align });
    }
  }
  headerPill(ctx, `Còn ${formatTime(view.endsInMs)} · cổ vũ liên tục để giữ tốc độ!`, { color: view.endsInMs < 20_000 ? '#ff6b6b' : '#fff' });
}

export function resetEndurance() {
  posSmoother.reset();
  speedSmoother.reset();
}
