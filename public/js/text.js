// Tiện ích vẽ chữ có viền để đọc rõ trên điện thoại.
export const FONT_FAMILY = '"Baloo 2", system-ui, "Segoe UI", Roboto, sans-serif';

export function outlinedText(ctx, text, x, y, { size = 40, color = '#fff', align = 'center', weight = 800, stroke = 8 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // lineWidth = 0 bị canvas bỏ qua, nên phải bỏ hẳn lệnh viền khi không cần.
  if (stroke > 0) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
