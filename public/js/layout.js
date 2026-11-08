// Toạ độ khung dọc 1080x1920. Phe Xanh ở trên, phe Đỏ ở dưới; lính đi theo chiều dọc.
export const W = 1080;
export const H = 1920;
export const FIELD_LENGTH = 1000; // khớp server/config.js FIELD.length
export const LANES = 5;

export const FIELD = Object.freeze({ top: 330, bottom: 1440, left: 60, right: W - 60 });
export const BASE_Y = Object.freeze({ blue: FIELD.top - 60, red: FIELD.bottom + 60 });

export const COLORS = Object.freeze({
  red: '#ff4d5e',
  redDark: '#8f1d2a',
  blue: '#3da5ff',
  blueDark: '#164a80',
  gold: '#ffd54a',
  heal: '#5dff9a',
  text: '#ffffff',
  muted: '#9aa7c7',
  panel: 'rgba(10, 14, 28, 0.78)',
});

export const TEAM_LABEL = Object.freeze({ red: 'ĐỎ', blue: 'XANH' });

/** Vị trí logic (x dọc sân, lane) -> pixel. */
export function toScreen(x, lane) {
  const t = x / FIELD_LENGTH;
  const y = FIELD.bottom - t * (FIELD.bottom - FIELD.top);
  const laneWidth = (FIELD.right - FIELD.left) / LANES;
  return { x: FIELD.left + laneWidth * (lane + 0.5), y };
}

export const teamColor = (team) => (team === 'red' ? COLORS.red : COLORS.blue);
