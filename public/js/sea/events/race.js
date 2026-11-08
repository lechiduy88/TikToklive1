// Cảnh "đua về đích" trên màn hình ngang. 3 giao diện:
//  🚣 dragon_boat: thuyền rồng chạy ngang trên sông  · 🏊 swimming: vận động viên bơi trong hồ
//  🧗 climbing: leo vách đá theo 5 cột từ dưới lên đỉnh
import { shape, circle, ellipse, rrect, grad, offscreen, seededRandom } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, laneY, laneTop, LANE_H, HEADER_H, columnX, COLUMN_W, MEDAL_EMOJI } from '../teams.js';
import { drawFlag } from '../flags.js';
import { ARENA, ARENA_W, ARENA_H } from '../stage.js';
import { TRACK_START, TRACK_END, drawLaneGutters, drawLaneLines, headerPill, leaderAura, leaderOf, createSmoother } from './kit.js';

const PLACE = ['gold', 'silver', 'bronze'];
const SKIN = '#ffd2a6';
const smoother = createSmoother();
const backgrounds = new Map();

function background(key, painter) {
  if (!backgrounds.has(key)) {
    const { canvas, ctx } = offscreen(ARENA_W, ARENA_H);
    painter(ctx);
    backgrounds.set(key, canvas);
  }
  return backgrounds.get(key);
}

function waves(ctx, color, count, seed) {
  const rand = seededRandom(seed);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let i = 0; i < count; i += 1) {
    ctx.beginPath();
    ctx.arc(rand() * ARENA_W, rand() * ARENA_H, 12 + rand() * 16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
}

const PAINT = {
  river(ctx) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#1f7fb8', '#145f93', '#0e4a78']);
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    waves(ctx, 'rgba(255,255,255,0.16)', 320, 7);
  },
  pool(ctx) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#5fd0f0', '#2aa6d8', '#1b86c0']);
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.fillStyle = 'rgba(10,60,110,0.35)';
    for (let i = 0; i < TEAMS.length; i += 1) ctx.fillRect(0, HEADER_H + LANE_H * (i + 0.5) - 5, ARENA_W, 10); // vạch đáy hồ
    waves(ctx, 'rgba(255,255,255,0.22)', 260, 13);
  },
  wall(ctx) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#8a7b6a', '#6e5f50', '#54473b']);
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    const rand = seededRandom(17);
    const holds = ['#e8384f', '#3d6bff', '#ffd54a', '#16b39a', '#ff8c1a'];
    for (let i = 0; i < 260; i += 1) shape(ctx, ellipse(rand() * ARENA_W, rand() * ARENA_H, 8 + rand() * 8, 6 + rand() * 6), holds[i % holds.length], 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < TEAMS.length; i += 1) ctx.fillRect(COLUMN_W * i - 3, 0, 6, ARENA_H);
  },
};

// ---------- 🚣 thuyền rồng (nằm ngang, mũi rồng bên phải) ----------
function drawBoat(ctx, x, y, team, now, active) {
  const t = teamOf(team);
  const len = 230;
  shape(ctx, (c) => { c.moveTo(x - len / 2, y - 18); c.quadraticCurveTo(x, y - 34, x + len / 2, y - 8); c.lineTo(x + len / 2, y + 8); c.quadraticCurveTo(x, y + 34, x - len / 2, y + 18); c.closePath(); }, grad(ctx, 0, y - 34, 0, y + 34, ['#c98b4a', '#7a4a1f']), 4);
  shape(ctx, rrect(x - len / 2 + 14, y - 12, len - 40, 24, 10), grad(ctx, 0, y - 12, 0, y + 12, [t.light, t.color, t.dark]), 2);
  shape(ctx, circle(x + len / 2 + 6, y, 20), grad(ctx, 0, y - 20, 0, y + 20, ['#7ef0a8', '#2fbf71', '#16804a']), 3);
  shape(ctx, circle(x + len / 2 + 12, y - 6, 4), '#fff', 2);
  for (let i = 0; i < 6; i += 1) {
    const rx = x - len / 2 + 34 + i * 30;
    const stroke = Math.sin(now / (active ? 130 : 320) + i * 0.4) * 14;
    ctx.strokeStyle = '#e8d2a6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rx, y - 10);
    ctx.lineTo(rx + stroke, y - 44);
    ctx.moveTo(rx, y + 10);
    ctx.lineTo(rx + stroke, y + 44);
    ctx.stroke();
    shape(ctx, circle(rx, y, 8), t.light, 2.5);
  }
  drawFlag(ctx, team, x - len / 2 - 44, y - 20, 48, 32, now, 0.15);
}

// ---------- 🏊 vận động viên bơi (sải tay luân phiên) ----------
function drawSwimmer(ctx, x, y, team, now, active) {
  const t = teamOf(team);
  const phase = now / (active ? 150 : 360);
  shape(ctx, ellipse(x - 40, y + 4, 60, 14), 'rgba(255,255,255,0.35)', 0);
  shape(ctx, ellipse(x - 30, y, 46, 13), SKIN, 3);
  for (const side of [-1, 1]) {
    const a = phase + (side > 0 ? Math.PI : 0);
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 10 + Math.cos(a) * 46, y + side * Math.abs(Math.sin(a)) * 30);
    ctx.stroke();
  }
  shape(ctx, circle(x + 20, y, 18), t.color, 3); // mũ bơi màu đội
  if (active) for (let k = 0; k < 4; k += 1) shape(ctx, circle(x - 70 - k * 14, y + Math.sin(now / 90 + k) * 10, 4 - k * 0.7), 'rgba(255,255,255,0.8)', 0);
}

// ---------- 🧗 vận động viên leo núi (cột) ----------
function drawClimber(ctx, x, y, team, now, active) {
  const t = teamOf(team);
  const reach = Math.sin(now / (active ? 160 : 400)) * 16;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, ARENA.top + 70);
  ctx.lineTo(x, y - 30);
  ctx.stroke();
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 12);
  ctx.lineTo(x - 34, y - 46 + reach);
  ctx.moveTo(x + 14, y - 12);
  ctx.lineTo(x + 34, y - 46 - reach);
  ctx.stroke();
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 28);
  ctx.lineTo(x - 26, y + 60 - reach);
  ctx.moveTo(x + 8, y + 28);
  ctx.lineTo(x + 26, y + 60 + reach);
  ctx.stroke();
  shape(ctx, rrect(-22 + x, y - 18, 44, 50, 14), grad(ctx, 0, y - 18, 0, y + 32, [t.light, t.color, t.dark]), 4);
  shape(ctx, circle(x, y - 36, 18), SKIN, 4);
  shape(ctx, (c) => { c.arc(x, y - 38, 20, Math.PI, Math.PI * 2); c.closePath(); }, t.color, 3); // mũ bảo hiểm
}

function placeLabel(ctx, x, y, view, team, isLeader) {
  const place = view.finished.indexOf(team);
  if (place >= 0) return outlinedText(ctx, MEDAL_EMOJI[PLACE[place]] ?? `#${place + 1}`, x, y, { size: 54, stroke: 0 });
  return outlinedText(ctx, `${isLeader ? '👑 ' : ''}${Math.round((view.pos[team] / view.track) * 100)}%`, x, y, { size: isLeader ? 32 : 28, color: isLeader ? '#ffd54a' : teamOf(team).light, stroke: 6 });
}

function drawRows(ctx, view, shown, now, skin) {
  ctx.drawImage(background(skin, skin === 'swimming' ? PAINT.pool : PAINT.river), ARENA.left, ARENA.top);
  drawLaneLines(ctx, skin === 'swimming' ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.4)');
  // vạch đích
  for (let y = ARENA.top, n = 0; y < ARENA.bottom; y += 24, n += 1) {
    ctx.fillStyle = n % 2 ? '#1a1220' : '#fff';
    ctx.fillRect(TRACK_END + 20, y, 18, 24);
  }
  drawLaneGutters(ctx, now);
  const leader = leaderOf(view.pos, TEAMS.map((t) => t.id).filter((id) => !view.finished.includes(id)));
  for (const t of TEAMS) {
    const x = TRACK_START + (shown[t.id] / view.track) * (TRACK_END - TRACK_START - 120);
    const y = laneY(t.id) + Math.sin(now / 300 + t.number * 1.7) * 3;
    const active = view.pos[t.id] - shown[t.id] > 0.5;
    if (t.id === leader) leaderAura(ctx, x, y, now, 110);
    (skin === 'swimming' ? drawSwimmer : drawBoat)(ctx, x, y, t.id, now, active);
    placeLabel(ctx, x, laneTop(t.id) + 24, view, t.id, t.id === leader);
  }
}

function drawColumns(ctx, view, shown, now) {
  ctx.drawImage(background('wall', PAINT.wall), ARENA.left, ARENA.top);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(ARENA.left, ARENA.top + 60, ARENA_W, 8); // đỉnh
  outlinedText(ctx, '⛰️ ĐỈNH', ARENA.left + 70, ARENA.top + 40, { size: 26, stroke: 5 });
  const leader = leaderOf(view.pos, TEAMS.map((t) => t.id).filter((id) => !view.finished.includes(id)));
  const bottom = ARENA.bottom - 140;
  const topY = ARENA.top + 130;
  for (const t of TEAMS) {
    const x = columnX(t.id);
    const y = bottom - (shown[t.id] / view.track) * (bottom - topY);
    if (t.id === leader) leaderAura(ctx, x, y, now, 100);
    drawClimber(ctx, x, y, t.id, now, view.pos[t.id] - shown[t.id] > 0.5);
    placeLabel(ctx, x, y - 80, view, t.id, t.id === leader);
    drawFlag(ctx, t.id, x - 36, ARENA.bottom - 70, 72, 48, now, 0.1);
  }
}

/** view = { pos, finished, track }, skin = id môn. */
export function drawRace(ctx, view, dt, now, skin) {
  if (!view) return;
  const shown = smoother.update(view.pos, dt);
  if (skin === 'climbing') drawColumns(ctx, view, shown, now);
  else drawRows(ctx, view, shown, now, skin);
  headerPill(ctx, skin === 'climbing' ? 'Tiếp sức để leo lên · chạm đỉnh trước giành Vàng!' : 'Tiếp sức để tiến lên · về đích trước giành Vàng!');
}

export const resetRace = () => smoother.reset();
