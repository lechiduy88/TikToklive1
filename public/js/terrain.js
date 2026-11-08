// Chiến trường cỏ vẽ sẵn một lần: cỏ loang, đường đất theo làn, hoa, đá, hàng cây hai bên, viền tối.
import { W, H, FIELD, LANES } from './layout.js';
import { shape, circle, ellipse, offscreen, seededRandom } from './paint.js';

const GRASS = ['#5fa344', '#4a8f37', '#3b7a2e'];
const DIRT = 'rgba(176, 132, 82, 0.55)';
const FLOWERS = ['#fff6d6', '#ffd54a', '#ff9ec7', '#c9b8ff'];

function grass(ctx, rand) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  GRASS.forEach((c, i) => g.addColorStop(i / 2, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i += 1) {
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(170,220,110,0.07)' : 'rgba(20,60,20,0.08)';
    shape(ctx, circle(rand() * W, rand() * H, 20 + rand() * 50), ctx.fillStyle, 0);
  }
  ctx.lineWidth = 2;
  for (let i = 0; i < 2600; i += 1) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(25,70,25,0.35)' : 'rgba(170,225,120,0.3)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y - 6 - rand() * 6);
    ctx.stroke();
  }
}

function paths(ctx, rand) {
  const laneWidth = (FIELD.right - FIELD.left) / LANES;
  for (let lane = 0; lane < LANES; lane += 1) {
    const cx = FIELD.left + laneWidth * (lane + 0.5);
    for (let y = FIELD.top - 20; y < FIELD.bottom + 20; y += 8) {
      const wobble = Math.sin(y / 70 + lane * 2) * 6;
      shape(ctx, ellipse(cx + wobble + (rand() - 0.5) * 6, y, 30 + rand() * 6, 12), DIRT, 0);
    }
    for (let i = 0; i < 40; i += 1) {
      shape(ctx, ellipse(cx + (rand() - 0.5) * 50, FIELD.top + rand() * (FIELD.bottom - FIELD.top), 2 + rand() * 3, 1.5 + rand() * 2), 'rgba(90,70,50,0.5)', 0);
    }
  }
}

function frontline(ctx, rand) {
  const y = (FIELD.top + FIELD.bottom) / 2;
  for (let x = FIELD.left; x < FIELD.right; x += 26) {
    shape(ctx, ellipse(x + rand() * 8, y + (rand() - 0.5) * 8, 8 + rand() * 4, 6 + rand() * 2), rand() > 0.5 ? '#9aa2b4' : '#80889a', 2);
  }
}

function decorations(ctx, rand) {
  for (let i = 0; i < 70; i += 1) {
    const cx = FIELD.left + rand() * (FIELD.right - FIELD.left);
    const cy = FIELD.top + rand() * (FIELD.bottom - FIELD.top);
    const color = FLOWERS[Math.floor(rand() * FLOWERS.length)];
    for (let k = 0; k < 4; k += 1) shape(ctx, circle(cx + (rand() - 0.5) * 24, cy + (rand() - 0.5) * 16, 3), color, 1.5);
  }
  for (let i = 0; i < 18; i += 1) {
    const x = FIELD.left + rand() * (FIELD.right - FIELD.left);
    const y = FIELD.top + rand() * (FIELD.bottom - FIELD.top);
    shape(ctx, ellipse(x, y, 10 + rand() * 8, 7 + rand() * 4), '#8b93a6', 3);
    shape(ctx, ellipse(x - 3, y - 3, 4, 2.5), 'rgba(255,255,255,0.35)', 0);
  }
}

function treeLine(ctx, rand, x0, x1) {
  for (let y = FIELD.top - 40; y < FIELD.bottom + 60; y += 34) {
    const x = x0 + rand() * (x1 - x0);
    const r = 34 + rand() * 18;
    shape(ctx, ellipse(x + 8, y + r * 0.7, r * 0.9, r * 0.35), 'rgba(0,0,0,0.25)', 0);
    shape(ctx, circle(x, y, r), rand() > 0.5 ? '#2f6b2a' : '#265c23', 4);
    shape(ctx, circle(x - r * 0.3, y - r * 0.3, r * 0.45), 'rgba(140,200,90,0.35)', 0);
  }
}

function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function renderTerrain() {
  const rand = seededRandom(20261108);
  const { canvas, ctx } = offscreen(W, H);
  grass(ctx, rand);
  paths(ctx, rand);
  frontline(ctx, rand);
  decorations(ctx, rand);
  treeLine(ctx, rand, -20, 40);
  treeLine(ctx, rand, W - 40, W + 20);
  vignette(ctx);
  return canvas;
}
