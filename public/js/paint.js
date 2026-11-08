// Tiện ích vẽ hình có viền đậm kiểu hoạt hình, dùng chung cho lính, lâu đài và địa hình.
export const OUTLINE = '#1a1220';

export const TEAM_PALETTE = Object.freeze({
  red: Object.freeze({ main: '#e8384f', light: '#ff8a96', dark: '#7c1424' }),
  blue: Object.freeze({ main: '#2f8cff', light: '#8cc8ff', dark: '#123f78' }),
});

export function shape(ctx, build, fill, line = 4) {
  ctx.beginPath();
  build(ctx);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (line) {
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

export const circle = (x, y, r) => (c) => c.arc(x, y, r, 0, Math.PI * 2);
export const ellipse = (x, y, rx, ry) => (c) => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
// OBS/LIVE Studio bản cũ (Chromium < 99) chưa có ctx.roundRect: tự vẽ bằng arcTo.
function roundRectPath(c, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}
export const rrect = (x, y, w, h, r) => (c) => (typeof c.roundRect === 'function' ? c.roundRect(x, y, w, h, r) : roundRectPath(c, x, y, w, h, r));

export function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  return g;
}

/** Canvas phụ để render sẵn hình tĩnh. */
export function offscreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

/** Bộ sinh số ngẫu nhiên có seed để địa hình luôn giống nhau mỗi lần tải. */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
