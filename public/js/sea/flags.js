// Quốc kỳ 5 nước vẽ bằng canvas (Windows không hiển thị emoji cờ). Render sẵn một lần, khi vẽ có thể cho "bay" phấp phới.
import { offscreen } from '../paint.js';

const FW = 300;
const FH = 200;
const WAVE_STRIPS = 24;

function starPath(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function stripes(ctx, colors, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let y = 0;
  colors.forEach((color, i) => {
    const h = (weights[i] / total) * FH;
    ctx.fillStyle = color;
    ctx.fillRect(0, y, FW, h + 1);
    y += h;
  });
}

const PAINTERS = {
  vn(ctx) {
    ctx.fillStyle = '#da251d';
    ctx.fillRect(0, 0, FW, FH);
    starPath(ctx, FW / 2, FH / 2 + 4, 62, 24, 5);
    ctx.fillStyle = '#ffff00';
    ctx.fill();
  },
  th(ctx) {
    stripes(ctx, ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1, 1, 2, 1, 1]);
  },
  id(ctx) {
    stripes(ctx, ['#ce1126', '#ffffff'], [1, 1]);
  },
  ph(ctx) {
    stripes(ctx, ['#0038a8', '#ce1126'], [1, 1]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(FH * 0.866, FH / 2);
    ctx.lineTo(0, FH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fcd116';
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      starPath(ctx, 58 + Math.cos(a) * 22, FH / 2 + Math.sin(a) * 22, 9, 3, 3);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(58, FH / 2, 17, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [[14, 18], [14, FH - 18], [FH * 0.866 - 18, FH / 2]]) {
      starPath(ctx, x, y, 9, 4, 5);
      ctx.fill();
    }
  },
  my(ctx) {
    const rows = 14;
    for (let i = 0; i < rows; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#cc0001' : '#ffffff';
      ctx.fillRect(0, (i * FH) / rows, FW, FH / rows + 1);
    }
    const ch = (FH * 8) / rows;
    ctx.fillStyle = '#010066';
    ctx.fillRect(0, 0, FW / 2, ch);
    ctx.fillStyle = '#fc0';
    ctx.beginPath();
    ctx.arc(62, ch / 2, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#010066';
    ctx.beginPath();
    ctx.arc(74, ch / 2, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fc0';
    starPath(ctx, 112, ch / 2, 30, 13, 14);
    ctx.fill();
  },
};

const cache = new Map();

export function flagImage(team) {
  if (cache.has(team)) return cache.get(team);
  const { canvas, ctx } = offscreen(FW, FH);
  (PAINTERS[team] ?? PAINTERS.vn)(ctx);
  // ánh sáng nhẹ cho có khối
  const shine = ctx.createLinearGradient(0, 0, 0, FH);
  shine.addColorStop(0, 'rgba(255,255,255,0.18)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, FW, FH);
  cache.set(team, canvas);
  return canvas;
}

/**
 * Vẽ cờ trong khung (x, y, w, h). wave > 0 làm cờ phấp phới (tỉ lệ biên độ theo chiều cao).
 */
export function drawFlag(ctx, team, x, y, w, h, now = 0, wave = 0) {
  const img = flagImage(team);
  if (wave <= 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    const sw = FW / WAVE_STRIPS;
    const dw = w / WAVE_STRIPS;
    for (let i = 0; i < WAVE_STRIPS; i += 1) {
      const phase = now / 260 - i * 0.45;
      const dy = Math.sin(phase) * wave * h * (i / WAVE_STRIPS);
      ctx.drawImage(img, i * sw, 0, sw, FH, x + i * dw, y + dy, dw + 1, h);
      ctx.fillStyle = `rgba(0,0,0,${(Math.sin(phase) + 1) * 0.07})`;
      ctx.fillRect(x + i * dw, y + dy, dw + 1, h);
    }
  }
  ctx.strokeStyle = 'rgba(20,14,30,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
}

/** Cờ cắm trên cột, phấp phới. (x, y) là đỉnh cột. */
export function drawFlagOnPole(ctx, team, x, y, w, h, now, poleLength = h * 2.2) {
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(x - 3, y, 6, poleLength);
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  drawFlag(ctx, team, x + 3, y + 4, w, h, now, 0.12);
}
