// 🏋️ Sân khấu cử tạ (màn hình ngang): 5 lực sĩ theo cột, tạ nâng cao theo sức tiếp lượt này, cột đo lực
// bên cạnh mỗi lực sĩ. Đội yếu nhất nhấp nháy "NGUY HIỂM".
import { shape, circle, rrect, grad, offscreen } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, columnX, COLUMN_W } from '../teams.js';
import { drawFlag } from '../flags.js';
import { ARENA, ARENA_W, ARENA_H } from '../stage.js';
import { headerPill, createSmoother } from './kit.js';

const FLOOR_Y = ARENA.top + 740;
const BAR_LOW = FLOOR_Y - 150; // tạ ở ngực
const BAR_HIGH = FLOOR_Y - 320; // tạ qua đầu
const HEAD_Y = FLOOR_Y - 228;
const SKIN = '#ffd2a6';
const KG_PER_EFFORT = 5; // chỉ để hiển thị cho giống cử tạ thật
const GAUGE = Object.freeze({ dx: 112, top: ARENA.top + 190, bottom: FLOOR_Y - 10, w: 30 });
const smoother = createSmoother(5);
let stage = null;

function renderStage() {
  const { canvas, ctx } = offscreen(ARENA_W, ARENA_H);
  ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#1c1236', '#2c1a4f', '#120c22']);
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const floor = FLOOR_Y - ARENA.top;
  for (const team of TEAMS) {
    const x = columnX(team.id) - ARENA.left;
    const cone = ctx.createLinearGradient(0, 0, 0, floor);
    cone.addColorStop(0, 'rgba(255,240,200,0.28)');
    cone.addColorStop(1, 'rgba(255,240,200,0.04)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 20, 0);
    ctx.lineTo(x + 20, 0);
    ctx.lineTo(x + COLUMN_W / 2, floor);
    ctx.lineTo(x - COLUMN_W / 2, floor);
    ctx.fill();
  }
  ctx.fillStyle = grad(ctx, 0, floor, 0, ARENA_H, ['#a8743f', '#6e4520']);
  ctx.fillRect(0, floor, ARENA_W, ARENA_H - floor);
  return canvas;
}

function drawBarbell(ctx, x, y, team) {
  const t = teamOf(team);
  ctx.fillStyle = '#c9ced8';
  ctx.fillRect(x - 88, y - 4, 176, 8);
  for (const side of [-1, 1]) {
    shape(ctx, rrect(x + side * 68 - 9, y - 40, 18, 80, 6), grad(ctx, 0, y - 40, 0, y + 40, [t.light, t.color, t.dark]), 3);
    shape(ctx, rrect(x + side * 84 - 6, y - 26, 12, 52, 5), '#2a2433', 3);
  }
}

function drawLifter(ctx, x, lift, team, out, now) {
  const t = teamOf(team);
  const shake = !out && lift > 0.85 ? Math.sin(now / 30) * 2 : 0;
  const barY = out ? FLOOR_Y - 30 : BAR_LOW - (BAR_LOW - BAR_HIGH) * lift;
  ctx.save();
  if (out) ctx.globalAlpha = 0.45;
  ctx.translate(shake, 0);
  shape(ctx, rrect(x - 26, FLOOR_Y - 90, 20, 90, 8), '#3a2a5a', 3);
  shape(ctx, rrect(x + 6, FLOOR_Y - 90, 20, 90, 8), '#3a2a5a', 3);
  shape(ctx, rrect(x - 32, FLOOR_Y - 196, 64, 110, 22), grad(ctx, 0, FLOOR_Y - 196, 0, FLOOR_Y - 86, [t.light, t.color, t.dark]), 4);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  const grip = out ? FLOOR_Y - 150 : barY;
  ctx.beginPath();
  ctx.moveTo(x - 28, FLOOR_Y - 180);
  ctx.lineTo(x - 48, grip);
  ctx.moveTo(x + 28, FLOOR_Y - 180);
  ctx.lineTo(x + 48, grip);
  ctx.stroke();
  shape(ctx, circle(x, HEAD_Y, 28), SKIN, 4);
  shape(ctx, rrect(x - 28, HEAD_Y - 18, 56, 10, 5), t.color, 2);
  shape(ctx, circle(x - 9, HEAD_Y + 4, 3), '#1a1220', 0);
  shape(ctx, circle(x + 9, HEAD_Y + 4, 3), '#1a1220', 0);
  drawBarbell(ctx, x, barY, team);
  ctx.restore();
}

/** Cột đo lực bên cạnh lực sĩ: đầy = nâng mạnh nhất lượt này; đội sắp bị loại viền đỏ nhấp nháy. */
function drawGauge(ctx, x, frac, team, out, danger, now) {
  const t = teamOf(team);
  const gx = x + GAUGE.dx - GAUGE.w / 2;
  const h = GAUGE.bottom - GAUGE.top;
  shape(ctx, rrect(gx, GAUGE.top, GAUGE.w, h, 12), 'rgba(10,6,20,0.7)', 3);
  if (!out && frac > 0) {
    const fh = Math.max(12, (h - 6) * Math.min(1, frac));
    shape(ctx, rrect(gx + 3, GAUGE.bottom - 3 - fh, GAUGE.w - 6, fh, 9), grad(ctx, 0, GAUGE.bottom - fh, 0, GAUGE.bottom, [t.light, t.color, t.dark]), 0);
  }
  if (danger) {
    ctx.strokeStyle = `rgba(255,70,70,${0.55 + Math.sin(now / 110) * 0.45})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    rrect(gx - 4, GAUGE.top - 4, GAUGE.w + 8, h + 8, 14)(ctx);
    ctx.stroke();
  }
}

function weakestAlive(view) {
  if (view.alive.length <= 1) return null;
  return [...view.alive].sort((a, b) => view.meter[a] - view.meter[b])[0];
}

function drawStatus(ctx, x, team, out, danger, now) {
  if (out) {
    ctx.save();
    ctx.translate(x, FLOOR_Y - 150);
    ctx.rotate(-0.25);
    shape(ctx, rrect(-80, -34, 160, 68, 12), 'rgba(200,30,40,0.85)', 4);
    outlinedText(ctx, 'LOẠI', 0, 2, { size: 46, stroke: 6 });
    ctx.restore();
  } else if (team === danger) {
    const pulse = 1 + Math.sin(now / 120) * 0.08;
    outlinedText(ctx, '⚠️ NGUY HIỂM', x, BAR_HIGH - 70, { size: 28 * pulse, color: '#ff6b6b', stroke: 6 });
  }
}

/** view = { round, rounds, roundEndsInMs, meter, alive, eliminated } */
export function drawLiftingStage(ctx, view, dt, now) {
  stage ??= renderStage();
  ctx.drawImage(stage, ARENA.left, ARENA.top);
  if (!view) return;
  const maxMeter = Math.max(1, ...view.alive.map((tm) => view.meter[tm]));
  const target = Object.fromEntries(TEAMS.map((t) => [t.id, view.eliminated.includes(t.id) ? 0 : view.meter[t.id] / maxMeter]));
  const shown = smoother.update(target, dt);
  const danger = weakestAlive(view);
  for (const team of TEAMS) {
    const x = columnX(team.id) - 16;
    const out = view.eliminated.includes(team.id);
    drawFlag(ctx, team.id, x - 48, ARENA.top + 80, 96, 64, now, out ? 0 : 0.12);
    drawGauge(ctx, x, shown[team.id], team.id, out, team.id === danger, now);
    drawLifter(ctx, x, shown[team.id], team.id, out, now);
    outlinedText(ctx, `${Math.round(view.meter[team.id] * KG_PER_EFFORT)} kg`, x, FLOOR_Y + 50, { size: 34, color: team.light, stroke: 6 });
    outlinedText(ctx, team.short, x, FLOOR_Y + 100, { size: 30, stroke: 6 });
    drawStatus(ctx, x, team.id, out, danger, now);
  }
  const seconds = Math.ceil(view.roundEndsInMs / 1000);
  const text = view.alive.length <= 1 ? 'Kết thúc!' : `LƯỢT ${Math.min(view.round, view.rounds)}/${view.rounds} · còn ${seconds}s · đội nâng yếu nhất bị loại!`;
  headerPill(ctx, text, { color: seconds <= 5 ? '#ff6b6b' : '#fff' });
}

export const resetLifting = () => smoother.reset();
