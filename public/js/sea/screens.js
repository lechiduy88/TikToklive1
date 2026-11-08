// Các màn nghi lễ: khai mạc (chọn đội), giới thiệu môn, bục trao huy chương, bế mạc.
import { W } from '../layout.js';
import { shape, rrect, grad, offscreen, seededRandom } from '../paint.js';
import { outlinedText, truncate } from '../text.js';
import { TEAMS, teamOf, ARENA, MEDAL_EMOJI, MEDAL_COLOR } from './teams.js';
import { drawFlag, drawFlagOnPole } from './flags.js';

const NAMES = Object.freeze({ dragon_boat: '🚣 Đua thuyền rồng', marathon: '🏃 Chạy marathon', weightlifting: '🏋️ Cử tạ' });
let stadium = null;

function renderStadium() {
  const h = ARENA.bottom - ARENA.top;
  const { canvas, ctx } = offscreen(W, h);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, ['#0d1b4a', '#1b2f87', '#3a1f6e', '#14102a']);
  ctx.fillRect(0, 0, W, h);
  const rand = seededRandom(3);
  for (let i = 0; i < 900; i += 1) {
    const colors = ['#e8384f', '#3d6bff', '#ff8c1a', '#f5c518', '#16b39a', '#ffffff'];
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.35 + rand() * 0.4;
    ctx.beginPath();
    ctx.arc(rand() * W, 60 + rand() * 360, 3 + rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export function drawStadium(ctx) {
  stadium ??= renderStadium();
  ctx.drawImage(stadium, 0, ARENA.top);
}

function teamCard(ctx, team, x, y, w, players, now) {
  const lift = Math.sin(now / 320 + x) * 5;
  shape(ctx, rrect(x, y + lift, w, 250, 28), grad(ctx, 0, y, 0, y + 250, [team.light, team.color, team.dark]), 5);
  drawFlag(ctx, team.id, x + w / 2 - 75, y + 20 + lift, 150, 100, now, 0.12);
  outlinedText(ctx, team.name.toUpperCase(), x + w / 2, y + 148 + lift, { size: 34, stroke: 6 });
  outlinedText(ctx, `Gõ ${team.short} / ${team.number}`, x + w / 2, y + 192 + lift, { size: 28, color: '#fff7c2', stroke: 6 });
  outlinedText(ctx, `👥 ${players}`, x + w / 2, y + 228 + lift, { size: 26, stroke: 5 });
}

export function drawOpening(ctx, state, now) {
  drawStadium(ctx);
  const pulse = 1 + Math.sin(now / 260) * 0.04;
  outlinedText(ctx, 'CHỌN ĐỘI TUYỂN CỦA BẠN!', W / 2, ARENA.top + 90, { size: 64 * pulse, color: '#ffd54a' });
  outlinedText(ctx, `Khai mạc sau ${Math.ceil(state.timeLeftMs / 1000)}s · ${state.eventCount} môn thi · tranh huy chương Vàng`, W / 2, ARENA.top + 160, { size: 30, stroke: 6 });
  const players = Object.fromEntries(state.teams.map((t) => [t.id, t.players]));
  const w = 300;
  TEAMS.forEach((team, i) => {
    const row = i < 3 ? 0 : 1;
    const inRow = row === 0 ? 3 : 2;
    const col = row === 0 ? i : i - 3;
    const x = W / 2 - (inRow * w + (inRow - 1) * 24) / 2 + col * (w + 24);
    teamCard(ctx, team, x, ARENA.top + 220 + row * 290, w, players[team.id] ?? 0, now);
  });
  drawSchedule(ctx, state.eventOrder ?? [], ARENA.top + 800);
  drawAllTime(ctx, state.allTime, ARENA.top + 930, now);
}

const SCHEDULE_ICON = Object.freeze({ dragon_boat: '🚣', marathon: '🏃', weightlifting: '🏋️' });

function drawSchedule(ctx, order, y) {
  if (!order.length) return;
  outlinedText(ctx, 'LỊCH THI ĐẤU', W / 2, y, { size: 30, color: '#ffd54a', stroke: 6 });
  const gap = 150;
  const x0 = W / 2 - ((order.length - 1) * gap) / 2;
  order.forEach((id, i) => {
    const x = x0 + i * gap;
    shape(ctx, rrect(x - 56, y + 26, 112, 86, 20), 'rgba(18,13,34,0.75)', 3);
    outlinedText(ctx, SCHEDULE_ICON[id] ?? '🏅', x, y + 62, { size: 44, stroke: 0 });
    outlinedText(ctx, `Môn ${i + 1}`, x, y + 100, { size: 20, color: '#cfc6ff', stroke: 4 });
  });
}

function drawAllTime(ctx, allTime, y, now) {
  if (!allTime?.some((r) => r.total > 0)) return;
  shape(ctx, rrect(60, y, W - 120, 200, 24), 'rgba(18,13,34,0.85)', 4);
  outlinedText(ctx, '🏆 BẢNG TỔNG SẮP TOÀN MÙA', W / 2, y + 36, { size: 32, color: '#ffd54a' });
  allTime.slice(0, 5).forEach((row, i) => {
    const x = 120 + i * 180;
    drawFlag(ctx, row.team, x - 36, y + 70, 72, 48, now, 0);
    outlinedText(ctx, `🥇${row.gold} 🥈${row.silver}`, x, y + 148, { size: 24, stroke: 5 });
    outlinedText(ctx, `🥉${row.bronze}`, x, y + 178, { size: 24, stroke: 5 });
  });
}

export function drawIntro(ctx, state, now) {
  drawStadium(ctx);
  const ev = state.event;
  if (!ev) return;
  const age = 1 - state.timeLeftMs / Math.max(1, state.phaseDurationMs ?? 5000);
  const scale = Math.min(1, 0.5 + age * 2);
  ctx.save();
  ctx.translate(W / 2, 640);
  ctx.scale(scale, scale);
  outlinedText(ctx, ev.icon, 0, -120, { size: 220, stroke: 0 });
  outlinedText(ctx, ev.name.toUpperCase(), 0, 80, { size: 86, color: '#ffd54a' });
  ctx.restore();
  outlinedText(ctx, ev.rule, W / 2, 820, { size: 34, stroke: 6 });
  outlinedText(ctx, `Bắt đầu sau ${Math.ceil(state.timeLeftMs / 1000)}`, W / 2, 920, { size: 48 });
  outlinedText(ctx, 'Tiếp sức ngay từ bây giờ cũng được tính!', W / 2, 990, { size: 30, color: '#cfc6ff', stroke: 6 });
}

const PODIUM_STEPS = Object.freeze([
  { place: 'silver', x: W / 2 - 300, h: 200 },
  { place: 'gold', x: W / 2, h: 280 },
  { place: 'bronze', x: W / 2 + 300, h: 150 },
]);

export function drawPodium(ctx, state, now) {
  drawStadium(ctx);
  const podium = state.podium;
  if (!podium) return;
  outlinedText(ctx, `${NAMES[podium.eventId] ?? ''} · TRAO HUY CHƯƠNG`, W / 2, ARENA.top + 70, { size: 44, color: '#ffd54a' });
  const base = 1180;
  for (const step of PODIUM_STEPS) {
    const team = podium.medals[step.place];
    shape(ctx, rrect(step.x - 130, base - step.h, 260, step.h, 14), grad(ctx, 0, base - step.h, 0, base, ['#ffffff', MEDAL_COLOR[step.place], '#6b5a3a']), 5);
    outlinedText(ctx, MEDAL_EMOJI[step.place], step.x, base - step.h + 60, { size: 72, stroke: 0 });
    if (!team) {
      outlinedText(ctx, '—', step.x, base - step.h - 80, { size: 60 });
      continue;
    }
    const t = teamOf(team);
    drawFlagOnPole(ctx, team, step.x - 70, base - step.h - 250, 140, 94, now, 240);
    outlinedText(ctx, t.name, step.x, base - step.h + 130, { size: 32, stroke: 6 });
    const star = podium.stars?.[team];
    if (star) outlinedText(ctx, `⭐ ${truncate(star.name, 12)}`, step.x, base + 40, { size: 28, color: t.light, stroke: 6 });
  }
  outlinedText(ctx, '⭐ = vận động viên tiếp sức nhiều nhất của đội', W / 2, base + 110, { size: 26, color: '#cfc6ff', stroke: 5 });
}

export function drawClosing(ctx, state, now) {
  drawStadium(ctx);
  const closing = state.closing;
  if (!closing) return;
  const champions = closing.champions ?? (closing.champion ? [closing.champion] : []);
  if (champions.length === 1) {
    const t = teamOf(champions[0]);
    drawFlag(ctx, champions[0], W / 2 - 240, ARENA.top + 60, 480, 320, now, 0.14);
    outlinedText(ctx, `🏆 ${t.name.toUpperCase()} VÔ ĐỊCH!`, W / 2, ARENA.top + 450, { size: 72, color: '#ffd54a' });
    outlinedText(ctx, `SEA Games LIVE kỳ ${state.session}`, W / 2, ARENA.top + 520, { size: 34, stroke: 6 });
  } else if (champions.length > 1) {
    // Bằng nhau tuyệt đối: đồng vô địch, cờ xếp cạnh nhau.
    const w = Math.min(300, (W - 160) / champions.length - 20);
    champions.forEach((team, i) => {
      const x = W / 2 - (champions.length * (w + 20)) / 2 + i * (w + 20) + 10;
      drawFlag(ctx, team, x, ARENA.top + 120, w, w * 0.66, now, 0.14);
    });
    outlinedText(ctx, '🏆 ĐỒNG VÔ ĐỊCH!', W / 2, ARENA.top + 450, { size: 72, color: '#ffd54a' });
    outlinedText(ctx, champions.map((t) => teamOf(t).name).join(' · '), W / 2, ARENA.top + 520, { size: 34, stroke: 6 });
  } else {
    outlinedText(ctx, 'Chưa có huy chương nào kỳ này', W / 2, ARENA.top + 300, { size: 48 });
  }
  shape(ctx, rrect(80, ARENA.top + 570, W - 160, 380, 24), 'rgba(18,13,34,0.8)', 4);
  outlinedText(ctx, '🌟 VẬN ĐỘNG VIÊN XUẤT SẮC NHẤT', W / 2, ARENA.top + 615, { size: 32, color: '#ffd54a' });
  closing.topAthletes.forEach((a, i) => {
    const y = ARENA.top + 680 + i * 54;
    drawFlag(ctx, a.team, 130, y - 18, 54, 36, now, 0);
    outlinedText(ctx, `${i + 1}. ${truncate(a.name, 16)}`, 205, y, { size: 32, color: teamOf(a.team).light, align: 'left', stroke: 6 });
    outlinedText(ctx, `${a.effort} sức tiếp`, W - 120, y, { size: 28, align: 'right', stroke: 5 });
  });
  outlinedText(ctx, `Kỳ mới sau ${Math.ceil(state.timeLeftMs / 1000)}s · chọn lại đội tuyển!`, W / 2, ARENA.top + 1010, { size: 32, stroke: 6 });
}
