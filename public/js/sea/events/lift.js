// 🏋️ Sân khấu cử tạ: 5 lực sĩ, tạ nâng cao theo sức tiếp lượt này. Đội yếu nhất nhấp nháy "NGUY HIỂM".
import { W } from '../../layout.js';
import { shape, circle, rrect, grad, offscreen } from '../../paint.js';
import { outlinedText } from '../../text.js';
import { TEAMS, teamOf, ARENA, COLUMN_W, columnX } from '../teams.js';
import { drawFlag } from '../flags.js';

const FLOOR_Y = 1150;
const BAR_LOW = 1010; // tạ ở ngực
const BAR_HIGH = 840; // tạ qua đầu
const SKIN = '#ffd2a6';
const SMOOTH = 5;
const KG_PER_EFFORT = 5; // chỉ để hiển thị cho giống cử tạ thật

let stage = null;
let shown = {};

function renderStage() {
  const h = ARENA.bottom - ARENA.top;
  const { canvas, ctx } = offscreen(W, h);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, ['#1c1236', '#2c1a4f', '#120c22']);
  ctx.fillRect(0, 0, W, h);
  for (const team of TEAMS) {
    const x = columnX(team.id);
    const cone = ctx.createLinearGradient(0, 0, 0, FLOOR_Y - ARENA.top);
    cone.addColorStop(0, 'rgba(255,240,200,0.28)');
    cone.addColorStop(1, 'rgba(255,240,200,0.04)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 20, 0);
    ctx.lineTo(x + 20, 0);
    ctx.lineTo(x + COLUMN_W / 2, FLOOR_Y - ARENA.top);
    ctx.lineTo(x - COLUMN_W / 2, FLOOR_Y - ARENA.top);
    ctx.fill();
  }
  ctx.fillStyle = grad(ctx, 0, FLOOR_Y - ARENA.top, 0, h, ['#a8743f', '#6e4520']);
  ctx.fillRect(0, FLOOR_Y - ARENA.top, W, h - (FLOOR_Y - ARENA.top));
  return canvas;
}

function drawBarbell(ctx, x, y, teamId) {
  const t = teamOf(teamId);
  ctx.fillStyle = '#c9ced8';
  ctx.fillRect(x - 84, y - 4, 168, 8);
  for (const side of [-1, 1]) {
    shape(ctx, rrect(x + side * 66 - 9, y - 40, 18, 80, 6), grad(ctx, 0, y - 40, 0, y + 40, [t.light, t.color, t.dark]), 3);
    shape(ctx, rrect(x + side * 82 - 6, y - 26, 12, 52, 5), '#2a2433', 3);
  }
}

function drawLifter(ctx, x, lift, teamId, out, now) {
  const t = teamOf(teamId);
  const shake = !out && lift > 0.85 ? Math.sin(now / 30) * 2 : 0;
  const barY = out ? FLOOR_Y - 30 : BAR_LOW - (BAR_LOW - BAR_HIGH) * lift;
  ctx.save();
  if (out) ctx.globalAlpha = 0.45;
  ctx.translate(shake, 0);
  shape(ctx, rrect(x - 26, 1060, 20, 90, 8), '#3a2a5a', 3);
  shape(ctx, rrect(x + 6, 1060, 20, 90, 8), '#3a2a5a', 3);
  shape(ctx, rrect(x - 32, 960, 64, 108, 22), grad(ctx, x - 32, 960, x + 32, 1068, [t.light, t.color, t.dark]), 4);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const grip = out ? 1000 : barY;
  ctx.moveTo(x - 28, 975);
  ctx.lineTo(x - 46, grip);
  ctx.moveTo(x + 28, 975);
  ctx.lineTo(x + 46, grip);
  ctx.stroke();
  shape(ctx, circle(x, 928, 28), SKIN, 4);
  shape(ctx, rrect(x - 28, 910, 56, 10, 5), t.color, 2);
  shape(ctx, circle(x - 9, 932, 3), '#1a1220', 0);
  shape(ctx, circle(x + 9, 932, 3), '#1a1220', 0);
  drawBarbell(ctx, x, barY, teamId);
  ctx.restore();
}

const GAUGE = Object.freeze({ top: 410, bottom: 790, w: 44 });

/** Cột đo lực của từng đội: đầy = nâng mạnh nhất lượt này; đội sắp bị loại viền đỏ nhấp nháy. */
function drawGauge(ctx, x, frac, teamId, out, danger, now) {
  const t = teamOf(teamId);
  const h = GAUGE.bottom - GAUGE.top;
  shape(ctx, rrect(x - GAUGE.w / 2, GAUGE.top, GAUGE.w, h, 14), 'rgba(10,6,20,0.7)', 3);
  if (!out && frac > 0) {
    const fh = Math.max(14, (h - 8) * Math.min(1, frac));
    shape(ctx, rrect(x - GAUGE.w / 2 + 4, GAUGE.bottom - 4 - fh, GAUGE.w - 8, fh, 10), grad(ctx, 0, GAUGE.bottom - fh, 0, GAUGE.bottom, [t.light, t.color, t.dark]), 0);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - GAUGE.w / 2 + 8, GAUGE.bottom - fh, 6, fh - 8);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i += 1) {
    const y = GAUGE.bottom - (h * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x - GAUGE.w / 2 + 4, y);
    ctx.lineTo(x - GAUGE.w / 2 + 14, y);
    ctx.stroke();
  }
  if (danger) {
    ctx.strokeStyle = `rgba(255,70,70,${0.55 + Math.sin(now / 110) * 0.45})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    rrect(x - GAUGE.w / 2 - 4, GAUGE.top - 4, GAUGE.w + 8, h + 8, 16)(ctx); // rrect có dự phòng cho OBS cũ
    ctx.stroke();
  }
}

function weakestAlive(view) {
  if (view.alive.length <= 1) return null;
  return [...view.alive].sort((a, b) => view.meter[a] - view.meter[b])[0];
}

/** view = { round, rounds, roundEndsInMs, meter, alive, eliminated } */
export function drawLiftingStage(ctx, view, dt, now) {
  stage ??= renderStage();
  ctx.drawImage(stage, 0, ARENA.top);
  if (!view) return;
  const k = Math.min(1, dt * SMOOTH);
  const maxMeter = Math.max(1, ...view.alive.map((tm) => view.meter[tm]));
  const danger = weakestAlive(view);
  for (const team of TEAMS) {
    const x = columnX(team.id);
    const out = view.eliminated.includes(team.id);
    const target = out ? 0 : view.meter[team.id] / maxMeter;
    shown = { ...shown, [team.id]: (shown[team.id] ?? target) + (target - (shown[team.id] ?? target)) * k };
    drawFlag(ctx, team.id, x - 54, ARENA.top + 120, 108, 72, now, out ? 0 : 0.12);
    drawGauge(ctx, x, shown[team.id], team.id, out, team.id === danger, now);
    drawLifter(ctx, x, shown[team.id], team.id, out, now);
    outlinedText(ctx, `${Math.round(view.meter[team.id] * KG_PER_EFFORT)} kg`, x, FLOOR_Y + 40, { size: 32, color: team.light, stroke: 6 });
    outlinedText(ctx, team.short, x, FLOOR_Y + 84, { size: 30, stroke: 6 });
    if (out) {
      ctx.save();
      ctx.translate(x, 980);
      ctx.rotate(-0.25);
      shape(ctx, rrect(-80, -34, 160, 68, 12), 'rgba(200,30,40,0.85)', 4);
      outlinedText(ctx, 'LOẠI', 0, 2, { size: 46, stroke: 6 });
      ctx.restore();
    } else if (team.id === danger) {
      const pulse = 1 + Math.sin(now / 120) * 0.08;
      outlinedText(ctx, '⚠️ NGUY HIỂM', x, 850, { size: 28 * pulse, color: '#ff6b6b', stroke: 6 });
    }
  }
  const seconds = Math.ceil(view.roundEndsInMs / 1000);
  const label = view.alive.length <= 1 ? 'Kết thúc!' : `LƯỢT ${Math.min(view.round, view.rounds)}/${view.rounds} · còn ${seconds}s`;
  shape(ctx, rrect(W / 2 - 260, ARENA.top + 24, 520, 60, 30), 'rgba(18,13,34,0.82)', 4);
  outlinedText(ctx, label, W / 2, ARENA.top + 56, { size: 34, color: seconds <= 3 ? '#ff6b6b' : '#fff', stroke: 6 });
  outlinedText(ctx, 'Đội nâng yếu nhất mỗi lượt bị loại!', W / 2, ARENA.top + 102, { size: 26, color: '#ffd54a', stroke: 5, weight: 700 });
}

export function resetLifting() {
  shown = {};
}
