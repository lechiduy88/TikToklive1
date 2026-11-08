// Đồ nghề dùng chung cho các cảnh thi đấu trên màn hình ngang.
import { shape, rrect } from '../../paint.js';
import { outlinedText, FONT_FAMILY } from '../../text.js';
import { TEAMS, teamOf, laneY, LANE_H, LANES_TOP } from '../teams.js';
import { drawFlag } from '../flags.js';
import { ARENA, ARENA_CX } from '../stage.js';

// Làn ngang: lề trái hiện cờ + mã đội, đường đua chạy từ TRACK_START tới TRACK_END.
export const GUTTER_W = 150;
export const TRACK_START = ARENA.left + GUTTER_W + 50;
export const TRACK_END = ARENA.right - 70;

export function drawLaneGutters(ctx, now, fill = 'rgba(10,6,20,0.55)') {
  ctx.fillStyle = fill;
  ctx.fillRect(ARENA.left, ARENA.top, GUTTER_W, ARENA.bottom - ARENA.top);
  for (const t of TEAMS) {
    const y = laneY(t.id);
    drawFlag(ctx, t.id, ARENA.left + 14, y - 32, 66, 44, now, 0.1);
    outlinedText(ctx, t.short, ARENA.left + 116, y - 10, { size: 32, color: t.light, stroke: 6 });
  }
}

/** Đường kẻ phân làn. */
export function drawLaneLines(ctx, color = 'rgba(255,255,255,0.5)') {
  ctx.fillStyle = color;
  for (let i = 0; i < TEAMS.length; i += 1) ctx.fillRect(ARENA.left, LANES_TOP + LANE_H * i - 2, ARENA.right - ARENA.left, 4);
}

export function headerPill(ctx, text, { color = '#fff', y = ARENA.top + 34 } = {}) {
  ctx.font = `800 30px ${FONT_FAMILY}`;
  const w = Math.max(420, ctx.measureText(text).width + 70);
  shape(ctx, rrect(ARENA_CX - w / 2, y - 28, w, 56, 28), 'rgba(18,13,34,0.85)', 4);
  outlinedText(ctx, text, ARENA_CX, y + 1, { size: 30, color, stroke: 6 });
}

export function leaderAura(ctx, x, y, now, radius = 130) {
  const pulse = 0.85 + Math.sin(now / 180) * 0.15;
  const g = ctx.createRadialGradient(x, y, 16, x, y, radius * pulse);
  g.addColorStop(0, 'rgba(255,220,90,0.55)');
  g.addColorStop(1, 'rgba(255,220,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Đội đang dẫn đầu theo một bảng điểm (null nếu chưa ai có điểm). */
export function leaderOf(scores, among = TEAMS.map((t) => t.id)) {
  let best = null;
  for (const id of among) if ((scores[id] ?? 0) > 0 && (best === null || scores[id] > scores[best])) best = id;
  return best;
}

/** Nội suy mượt các giá trị số theo đội giữa các bản cập nhật từ server (10 lần/giây). */
export function createSmoother(rate = 6) {
  let shown = {};
  return {
    update(target, dt) {
      const k = Math.min(1, dt * rate);
      shown = Object.fromEntries(TEAMS.map((t) => {
        const goal = target[t.id] ?? 0;
        const prev = shown[t.id] ?? goal;
        return [t.id, prev + (goal - prev) * k];
      }));
      return shown;
    },
    reset() {
      shown = {};
    },
  };
}

export const label = (ctx, text, x, y, team, { size = 28, highlight = false } = {}) =>
  outlinedText(ctx, text, x, y, { size, color: highlight ? '#ffd54a' : teamOf(team).light, stroke: 6 });
