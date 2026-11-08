// Các màn nghi lễ (màn hình ngang): khai mạc (chọn đội), giới thiệu môn, bục trao huy chương, bế mạc.
import { shape, rrect, grad, offscreen, seededRandom } from '../paint.js';
import { outlinedText, truncate } from '../text.js';
import { TEAMS, teamOf, MEDAL_EMOJI, MEDAL_COLOR } from './teams.js';
import { drawFlag, drawFlagOnPole } from './flags.js';
import { ARENA, ARENA_W, ARENA_H, ARENA_CX } from './stage.js';

const ICONS = Object.freeze({
  dragon_boat: '🚣', swimming: '🏊', climbing: '🧗', marathon: '🏃', cycling: '🚴',
  weightlifting: '🏋️', sepak_takraw: '🏐', shot_put: '💪', javelin: '🏹', long_jump: '🦘',
});
const NAMES = Object.freeze({
  dragon_boat: 'Đua thuyền rồng', swimming: 'Bơi lội', climbing: 'Leo núi', marathon: 'Marathon', cycling: 'Xe đạp',
  weightlifting: 'Cử tạ', sepak_takraw: 'Cầu mây', shot_put: 'Đẩy tạ', javelin: 'Ném lao', long_jump: 'Nhảy xa',
});
let stadium = null;

function renderStadium() {
  const { canvas, ctx } = offscreen(ARENA_W, ARENA_H);
  ctx.fillStyle = grad(ctx, 0, 0, 0, ARENA_H, ['#0d1b4a', '#1b2f87', '#3a1f6e', '#14102a']);
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const rand = seededRandom(3);
  const colors = ['#e8384f', '#3d6bff', '#ff8c1a', '#f5c518', '#16b39a', '#ffffff'];
  for (let i = 0; i < 1100; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.3 + rand() * 0.4;
    ctx.beginPath();
    ctx.arc(rand() * ARENA_W, 20 + rand() * 260, 3 + rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export function drawStadium(ctx) {
  stadium ??= renderStadium();
  ctx.drawImage(stadium, ARENA.left, ARENA.top);
}

function teamCard(ctx, team, x, y, w, players, now) {
  const lift = Math.sin(now / 320 + x) * 5;
  shape(ctx, rrect(x, y + lift, w, 300, 28), grad(ctx, 0, y, 0, y + 300, [team.light, team.color, team.dark]), 5);
  drawFlag(ctx, team.id, x + w / 2 - 80, y + 22 + lift, 160, 106, now, 0.12);
  outlinedText(ctx, team.name.toUpperCase(), x + w / 2, y + 160 + lift, { size: 32, stroke: 6 });
  outlinedText(ctx, `Gõ ${team.short} / ${team.number}`, x + w / 2, y + 210 + lift, { size: 30, color: '#fff7c2', stroke: 6 });
  outlinedText(ctx, `👥 ${players}`, x + w / 2, y + 258 + lift, { size: 28, stroke: 5 });
}

function drawSchedule(ctx, order, y) {
  if (!order.length) return;
  outlinedText(ctx, 'LỊCH THI ĐẤU KỲ NÀY', ARENA_CX, y, { size: 30, color: '#ffd54a', stroke: 6 });
  const gap = 200;
  const x0 = ARENA_CX - ((order.length - 1) * gap) / 2;
  order.forEach((id, i) => {
    const x = x0 + i * gap;
    shape(ctx, rrect(x - 88, y + 26, 176, 110, 22), 'rgba(18,13,34,0.78)', 3);
    outlinedText(ctx, ICONS[id] ?? '🏅', x, y + 66, { size: 48, stroke: 0 });
    outlinedText(ctx, `${i + 1}. ${NAMES[id] ?? id}`, x, y + 112, { size: 22, color: '#cfc6ff', stroke: 4 });
  });
}

export function drawOpening(ctx, state, now) {
  drawStadium(ctx);
  const pulse = 1 + Math.sin(now / 260) * 0.04;
  outlinedText(ctx, 'CHỌN ĐỘI TUYỂN CỦA BẠN!', ARENA_CX, ARENA.top + 70, { size: 68 * pulse, color: '#ffd54a' });
  outlinedText(ctx, `Khai mạc sau ${Math.ceil(state.timeLeftMs / 1000)}s · ${state.eventCount} môn thi · tranh huy chương Vàng`, ARENA_CX, ARENA.top + 140, { size: 30, stroke: 6 });
  const players = Object.fromEntries(state.teams.map((t) => [t.id, t.players]));
  const w = 250;
  const gap = 28;
  const x0 = ARENA_CX - (TEAMS.length * w + (TEAMS.length - 1) * gap) / 2;
  TEAMS.forEach((team, i) => teamCard(ctx, team, x0 + i * (w + gap), ARENA.top + 190, w, players[team.id] ?? 0, now));
  drawSchedule(ctx, state.eventOrder ?? [], ARENA.top + 560);
  drawAllTime(ctx, state.allTime, ARENA.top + 740, now);
}

function drawAllTime(ctx, allTime, y, now) {
  if (!allTime?.some((r) => r.total > 0)) return;
  shape(ctx, rrect(ARENA_CX - 560, y, 1120, 150, 24), 'rgba(18,13,34,0.85)', 4);
  outlinedText(ctx, '🏆 BẢNG TỔNG SẮP TOÀN MÙA', ARENA_CX, y + 32, { size: 28, color: '#ffd54a' });
  allTime.slice(0, 5).forEach((row, i) => {
    const x = ARENA_CX - 440 + i * 220;
    drawFlag(ctx, row.team, x - 66, y + 62, 60, 40, now, 0);
    outlinedText(ctx, `🥇${row.gold} 🥈${row.silver} 🥉${row.bronze}`, x + 50, y + 82, { size: 22, stroke: 5 });
  });
}

export function drawIntro(ctx, state, now) {
  drawStadium(ctx);
  const ev = state.event;
  if (!ev) return;
  const age = 1 - state.timeLeftMs / Math.max(1, state.phaseDurationMs ?? 5000);
  const scale = Math.min(1, 0.5 + age * 2);
  ctx.save();
  ctx.translate(ARENA_CX, ARENA.top + 330);
  ctx.scale(scale, scale);
  outlinedText(ctx, ev.icon, 0, -110, { size: 200, stroke: 0 });
  outlinedText(ctx, ev.name.toUpperCase(), 0, 80, { size: 90, color: '#ffd54a' });
  ctx.restore();
  outlinedText(ctx, ev.rule, ARENA_CX, ARENA.top + 530, { size: 36, stroke: 6 });
  outlinedText(ctx, `Bắt đầu sau ${Math.ceil(state.timeLeftMs / 1000)}`, ARENA_CX, ARENA.top + 620, { size: 50 });
  outlinedText(ctx, 'Tiếp sức ngay từ bây giờ cũng được tính!', ARENA_CX, ARENA.top + 690, { size: 30, color: '#cfc6ff', stroke: 6 });
}

const PODIUM_STEPS = Object.freeze([
  { place: 'silver', dx: -340, h: 220 },
  { place: 'gold', dx: 0, h: 300 },
  { place: 'bronze', dx: 340, h: 160 },
]);

export function drawPodium(ctx, state, now) {
  drawStadium(ctx);
  const podium = state.podium;
  if (!podium) return;
  outlinedText(ctx, `${ICONS[podium.eventId] ?? ''} ${NAMES[podium.eventId] ?? ''} · TRAO HUY CHƯƠNG`, ARENA_CX, ARENA.top + 60, { size: 46, color: '#ffd54a' });
  const base = ARENA.bottom - 120;
  for (const step of PODIUM_STEPS) {
    const x = ARENA_CX + step.dx;
    const team = podium.medals[step.place];
    shape(ctx, rrect(x - 140, base - step.h, 280, step.h, 14), grad(ctx, 0, base - step.h, 0, base, ['#ffffff', MEDAL_COLOR[step.place], '#6b5a3a']), 5);
    outlinedText(ctx, MEDAL_EMOJI[step.place], x, base - step.h + 60, { size: 70, stroke: 0 });
    if (!team) {
      outlinedText(ctx, '—', x, base - step.h - 80, { size: 60 });
      continue;
    }
    const t = teamOf(team);
    drawFlagOnPole(ctx, team, x - 75, base - step.h - 250, 150, 100, now, 240);
    outlinedText(ctx, t.name, x, base - step.h + 130, { size: 32, stroke: 6 });
    const star = podium.stars?.[team];
    if (star) outlinedText(ctx, `⭐ ${truncate(star.name, 12)}`, x, base + 40, { size: 28, color: t.light, stroke: 6 });
  }
  outlinedText(ctx, '⭐ = vận động viên tiếp sức nhiều nhất của đội', ARENA_CX, base + 90, { size: 24, color: '#cfc6ff', stroke: 5 });
}

function drawChampion(ctx, state, now) {
  const closing = state.closing;
  const champions = closing.champions ?? (closing.champion ? [closing.champion] : []);
  const cx = ARENA.left + 380;
  if (champions.length === 0) {
    outlinedText(ctx, 'Chưa có huy chương nào kỳ này', cx, ARENA.top + 300, { size: 40 });
    return;
  }
  if (champions.length === 1) {
    drawFlag(ctx, champions[0], cx - 260, ARENA.top + 70, 520, 346, now, 0.14);
    outlinedText(ctx, `🏆 ${teamOf(champions[0]).name.toUpperCase()}`, cx, ARENA.top + 500, { size: 70, color: '#ffd54a' });
    outlinedText(ctx, 'VÔ ĐỊCH!', cx, ARENA.top + 580, { size: 70, color: '#ffd54a' });
  } else {
    const w = Math.min(240, 640 / champions.length - 20);
    champions.forEach((team, i) => drawFlag(ctx, team, cx - (champions.length * (w + 20)) / 2 + i * (w + 20), ARENA.top + 140, w, w * 0.66, now, 0.14));
    outlinedText(ctx, '🏆 ĐỒNG VÔ ĐỊCH!', cx, ARENA.top + 500, { size: 64, color: '#ffd54a' });
    outlinedText(ctx, champions.map((t) => teamOf(t).name).join(' · '), cx, ARENA.top + 570, { size: 32, stroke: 6 });
  }
  outlinedText(ctx, `SEA Games LIVE kỳ ${state.session}`, cx, ARENA.top + 650, { size: 34, stroke: 6 });
}

export function drawClosing(ctx, state, now) {
  drawStadium(ctx);
  if (!state.closing) return;
  drawChampion(ctx, state, now);
  const px = ARENA.left + 780;
  shape(ctx, rrect(px, ARENA.top + 80, 640, 520, 24), 'rgba(18,13,34,0.82)', 4);
  outlinedText(ctx, '🌟 VẬN ĐỘNG VIÊN XUẤT SẮC', px + 320, ARENA.top + 130, { size: 32, color: '#ffd54a' });
  state.closing.topAthletes.forEach((a, i) => {
    const y = ARENA.top + 210 + i * 76;
    drawFlag(ctx, a.team, px + 30, y - 20, 60, 40, now, 0);
    outlinedText(ctx, `${i + 1}. ${truncate(a.name, 14)}`, px + 110, y, { size: 32, color: teamOf(a.team).light, align: 'left', stroke: 6 });
    outlinedText(ctx, `${a.effort} sức tiếp`, px + 610, y, { size: 26, align: 'right', stroke: 5 });
  });
  outlinedText(ctx, `Kỳ mới sau ${Math.ceil(state.timeLeftMs / 1000)}s · chọn lại đội tuyển!`, ARENA_CX, ARENA.bottom - 80, { size: 34, stroke: 6 });
}
