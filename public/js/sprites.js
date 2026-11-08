// Lính chibi vẽ bằng canvas trong hộp 100x100, render sẵn một lần cho mỗi (loại, phe) rồi dùng lại.
import { OUTLINE, TEAM_PALETTE, shape, circle, ellipse, rrect, grad, offscreen } from './paint.js';

const SKIN = '#ffd2a6';
const GIANT_SKIN = '#f0b07e';
const STEEL = ['#f1f5fb', '#b9c4d3', '#6f7b8e'];
const WOOD = '#8a5a2b';
const GOLD = '#ffd54a';
const RES = 2; // vẽ gấp đôi để nét mịn khi phóng to

/** Kích thước hiển thị (px trên khung 1080x1920). Chân nằm ở 92% chiều cao sprite. */
export const SPRITE_SIZE = Object.freeze({ soldier: 62, archer: 62, knight: 88, giant: 140 });
export const FOOT_RATIO = 0.92;

function ground(ctx, p) {
  shape(ctx, ellipse(50, 92, 30, 8), 'rgba(0,0,0,0.35)', 0);
  ctx.beginPath();
  ellipse(50, 91, 25, 6)(ctx);
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.light;
  ctx.stroke();
}

function feet(ctx, spread = 10, size = 9) {
  shape(ctx, ellipse(50 - spread, 87, size, size * 0.65), '#3b2a20', 3);
  shape(ctx, ellipse(50 + spread, 87, size, size * 0.65), '#3b2a20', 3);
}

function face(ctx, x, y, r, skin = SKIN) {
  shape(ctx, circle(x, y, r), skin);
  shape(ctx, ellipse(x - r * 0.58, y + r * 0.35, r * 0.18, r * 0.12), 'rgba(255,110,110,0.4)', 0);
  shape(ctx, ellipse(x + r * 0.58, y + r * 0.35, r * 0.18, r * 0.12), 'rgba(255,110,110,0.4)', 0);
  for (const side of [-1, 1]) {
    shape(ctx, ellipse(x + side * r * 0.32, y + r * 0.08, r * 0.11, r * 0.17), OUTLINE, 0);
    shape(ctx, circle(x + side * r * 0.32 + r * 0.04, y - r * 0.02, r * 0.05), '#fff', 0);
  }
}

function body(ctx, p, x, y, w, h) {
  shape(ctx, rrect(x, y, w, h, 12), grad(ctx, x, y, x + w, y + h, [p.light, p.main, p.dark]));
}

function sword(ctx, x, y, length = 40, angle = 0.35) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  shape(ctx, rrect(-4, -length - 4, 8, length, 3), grad(ctx, -4, 0, 4, 0, STEEL), 3);
  shape(ctx, rrect(-11, -7, 22, 6, 3), GOLD, 3);
  shape(ctx, rrect(-3, -1, 6, 11, 2), WOOD, 3);
  ctx.restore();
}

function hands(ctx, left, right, skin = SKIN, r = 6) {
  shape(ctx, circle(left[0], left[1], r), skin, 3);
  shape(ctx, circle(right[0], right[1], r), skin, 3);
}

function soldier(ctx, p) {
  ground(ctx, p);
  feet(ctx);
  body(ctx, p, 31, 54, 38, 34);
  shape(ctx, rrect(31, 72, 38, 6, 2), '#5a3a1e', 0);
  sword(ctx, 74, 72);
  hands(ctx, [29, 72], [74, 72]);
  face(ctx, 50, 40, 20);
  shape(ctx, (c) => { c.arc(50, 35, 22, Math.PI, Math.PI * 2); c.closePath(); }, grad(ctx, 30, 14, 70, 36, STEEL));
  shape(ctx, rrect(26, 31, 48, 7, 3), grad(ctx, 26, 31, 74, 38, STEEL), 3);
  shape(ctx, rrect(46, 8, 8, 10, 3), p.main, 3);
}

function bow(ctx) {
  const cx = 38;
  const cy = 62;
  const r = 28;
  const a0 = Math.PI * 0.62;
  const a1 = Math.PI * 1.38;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
  ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#f4ead2';
  ctx.stroke();
  for (const [width, color] of [[9, OUTLINE], [5, WOOD]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

function archer(ctx, p) {
  ground(ctx, p);
  feet(ctx);
  shape(ctx, rrect(62, 44, 13, 32, 4), '#6b4423', 3);
  for (const [x, color] of [[65, '#fff'], [71, p.main]]) shape(ctx, (c) => { c.moveTo(x, 44); c.lineTo(x - 3, 34); c.lineTo(x + 3, 34); c.closePath(); }, color, 2);
  body(ctx, { ...p, light: '#7fbf6a', main: '#4f8f3e', dark: '#2c5a22' }, 32, 54, 36, 34);
  shape(ctx, rrect(32, 54, 36, 9, 4), p.main, 3);
  bow(ctx);
  hands(ctx, [16, 64], [70, 72]);
  face(ctx, 50, 41, 19);
  shape(ctx, (c) => {
    c.moveTo(28, 48);
    c.quadraticCurveTo(22, 14, 50, 6);
    c.quadraticCurveTo(78, 14, 72, 48);
    c.quadraticCurveTo(66, 26, 50, 26);
    c.quadraticCurveTo(34, 26, 28, 48);
    c.closePath();
  }, grad(ctx, 28, 6, 72, 48, [p.light, p.main, p.dark]));
}

function shield(ctx, p) {
  shape(ctx, (c) => {
    c.moveTo(8, 50);
    c.lineTo(44, 50);
    c.lineTo(44, 70);
    c.quadraticCurveTo(44, 90, 26, 97);
    c.quadraticCurveTo(8, 90, 8, 70);
    c.closePath();
  }, grad(ctx, 8, 50, 44, 97, [p.light, p.main, p.dark]));
  shape(ctx, rrect(23, 56, 6, 30, 2), GOLD, 2);
  shape(ctx, rrect(14, 64, 24, 6, 2), GOLD, 2);
}

function knight(ctx, p) {
  ground(ctx, p);
  feet(ctx, 11, 10);
  shape(ctx, rrect(27, 52, 46, 36, 12), grad(ctx, 27, 52, 73, 88, STEEL));
  shape(ctx, rrect(42, 52, 16, 36, 4), p.main, 3);
  sword(ctx, 78, 72, 48, 0.2);
  hands(ctx, [78, 72], [78, 72], STEEL[1]);
  shape(ctx, (c) => { c.moveTo(50, 18); c.quadraticCurveTo(54, -2, 76, 4); c.quadraticCurveTo(64, 10, 58, 22); c.closePath(); }, p.main, 3);
  shape(ctx, rrect(29, 15, 42, 44, 17), grad(ctx, 29, 15, 71, 59, STEEL));
  shape(ctx, rrect(34, 33, 32, 6, 3), OUTLINE, 0);
  shape(ctx, rrect(48, 40, 4, 14, 2), 'rgba(0,0,0,0.45)', 0);
  shield(ctx, p);
}

function club(ctx) {
  ctx.save();
  ctx.translate(82, 70);
  ctx.rotate(0.45);
  shape(ctx, (c) => { c.moveTo(-4, 6); c.lineTo(-11, -46); c.quadraticCurveTo(0, -60, 11, -46); c.lineTo(4, 6); c.closePath(); }, grad(ctx, -11, 0, 11, 0, ['#b07a43', WOOD, '#5a3517']), 3);
  for (const [x, y] of [[-10, -40], [10, -38], [0, -54], [-7, -24], [8, -26]]) shape(ctx, circle(x, y, 3), STEEL[1], 2);
  ctx.restore();
}

function giant(ctx, p) {
  ground(ctx, p);
  feet(ctx, 14, 12);
  shape(ctx, ellipse(50, 64, 33, 26), grad(ctx, 17, 38, 83, 90, [p.light, p.main, p.dark]));
  shape(ctx, ellipse(50, 70, 16, 13), grad(ctx, 34, 57, 66, 83, STEEL), 3);
  shape(ctx, rrect(20, 76, 60, 7, 3), '#5a3a1e', 3);
  club(ctx);
  for (const x of [19, 81]) shape(ctx, circle(x, 50, 11), grad(ctx, x - 11, 39, x + 11, 61, STEEL));
  hands(ctx, [18, 72], [82, 70], GIANT_SKIN, 8);
  face(ctx, 50, 33, 19, GIANT_SKIN);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(38, 29); ctx.lineTo(46, 32);
  ctx.moveTo(62, 29); ctx.lineTo(54, 32);
  ctx.stroke();
  for (const side of [-1, 1]) shape(ctx, (c) => { c.moveTo(50 + side * 14, 20); c.quadraticCurveTo(50 + side * 30, 16, 50 + side * 30, 0); c.quadraticCurveTo(50 + side * 22, 12, 50 + side * 8, 14); c.closePath(); }, '#f4ead2', 3);
  shape(ctx, (c) => { c.arc(50, 27, 20, Math.PI, Math.PI * 2); c.closePath(); }, grad(ctx, 30, 7, 70, 27, STEEL));
}

const PAINTERS = { soldier, archer, knight, giant };
const cache = new Map();

/** Sprite đã render sẵn cho (loại, phe). */
export function getSprite(type, team) {
  const key = `${type}:${team}`;
  if (cache.has(key)) return cache.get(key);
  const size = SPRITE_SIZE[type] ?? SPRITE_SIZE.soldier;
  const { canvas, ctx } = offscreen(size * RES, size * RES);
  ctx.scale((size * RES) / 100, (size * RES) / 100);
  (PAINTERS[type] ?? soldier)(ctx, TEAM_PALETTE[team] ?? TEAM_PALETTE.red);
  cache.set(key, canvas);
  return canvas;
}
