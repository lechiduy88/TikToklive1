// Kết nối WebSocket, nội suy vị trí lính và vòng vẽ requestAnimationFrame.
import { W, H, toScreen, COLORS } from './layout.js';
import { drawBackground, drawUnits, drawFrontline, resetFrontline } from './draw.js';
import { drawHud } from './hud.js';
import { createCastles, drawCastleShots } from './castle.js';
import { drawLobby, drawVictory } from './screens.js';
import { createFx } from './fx.js';
import { outlinedText, FONT_FAMILY } from './text.js';

const RECONNECT_MS = 2000;
const VICTORY_FEED_Y = 1240; // dưới phần vinh danh để không đè chữ
const SMOOTHING = 12; // càng lớn càng bám sát vị trí server

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const fx = createFx();
const drawCastles = createCastles();

// Không có mạng thì canvas tự dùng font hệ thống thay thế.
const FONT_SAMPLE = 'ĐỎ XANH ắằẳẵặ ơư Thắng';
for (const weight of [700, 800]) document.fonts?.load(`${weight} 40px ${FONT_FAMILY}`, FONT_SAMPLE).catch(() => {});

let latest = null;
let status = { connected: false, message: 'Đang kết nối server...' };
let display = new Map(); // id -> {sx, sy}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.addEventListener('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (data.type === 'state') latest = data.state;
    if (data.type === 'status') status = data.status;
    if (data.type === 'events') {
      const now = performance.now();
      for (const event of data.events) fx.handleEvent(event, now);
    }
  });
  socket.addEventListener('close', () => {
    status = { connected: false, message: 'Mất kết nối server, đang thử lại...' };
    setTimeout(connect, RECONNECT_MS);
  });
}

function interpolateUnits(units, dt) {
  const k = Math.min(1, dt * SMOOTHING);
  const next = new Map();
  const drawn = units.map((u) => {
    const target = toScreen(u.x, u.lane);
    const prev = display.get(u.id) ?? { sx: target.x, sy: target.y };
    const pos = { sx: prev.sx + (target.x - prev.sx) * k, sy: prev.sy + (target.y - prev.sy) * k };
    next.set(u.id, pos);
    return { ...u, ...pos };
  });
  display = next;
  return drawn;
}

function drawStatus() {
  if (status.connected) return;
  outlinedText(ctx, status.message, W / 2, H / 2, { size: 36, color: COLORS.gold });
}

let lastFrame = performance.now();
function frame(now) {
  // Luôn hẹn khung hình kế tiếp trước, để một lỗi vẽ không làm đứng hình cả buổi live.
  requestAnimationFrame(frame);
  try {
    render(now);
  } catch (error) {
    console.error('Lỗi vẽ khung hình', error);
  }
}

function render(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  fx.update(dt, now);

  const shake = fx.shake(now);
  // Đặt lại trạng thái canvas mỗi khung để một lỗi vẽ ở khung trước không để lại alpha/blend/transform lạ.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  try {
    ctx.translate(shake.x, shake.y);
    drawBackground(ctx, latest?.golden?.active, now);
    if (latest) {
      drawCastles(ctx, latest, now);
      if (latest.phase === 'battle') drawFrontline(ctx, latest.balance, dt, now);
      else resetFrontline();
      const units = interpolateUnits(latest.units, dt);
      drawUnits(ctx, units, now);
      drawCastleShots(ctx, latest.castleTargets, units, now);
      drawHud(ctx, latest);
      if (latest.phase === 'lobby') drawLobby(ctx, latest, now);
      if (latest.phase === 'victory') drawVictory(ctx, latest, now);
    }
    fx.draw(ctx, now, latest?.phase === 'victory' ? VICTORY_FEED_Y : undefined);
  } finally {
    ctx.restore();
  }
  drawStatus();
}

connect();
requestAnimationFrame(frame);
