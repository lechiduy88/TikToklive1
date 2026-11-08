// Màn hình SEA Games LIVE (ngang 1920×1080): kết nối WebSocket, chọn cảnh theo giai đoạn và kiểu luật chơi,
// vẽ HUD và hiệu ứng.
import { outlinedText, FONT_FAMILY } from '../text.js';
import { SW, SH } from './stage.js';
import { drawSeaHud, tableRowY } from './hud.js';
import { createSeaFx } from './fx.js';
import { createCommentary } from './commentary.js';
import { drawStadium, drawOpening, drawIntro, drawPodium, drawClosing } from './screens.js';
import { drawRace, resetRace } from './events/race.js';
import { drawEndurance, resetEndurance } from './events/endurance.js';
import { drawLiftingStage, resetLifting } from './events/lift.js';
import { drawTakraw, resetTakraw } from './events/takraw.js';
import { drawThrow, resetThrow } from './events/throw.js';

const RECONNECT_MS = 2000;
const FONT_SAMPLE = 'ĐỎ XANH ắằẳẵặ ơư Việt Nam Thái Lan';
const CEREMONY_PHASES = new Set(['opening', 'intro', 'podium', 'closing']);

// Một cảnh cho mỗi kiểu luật chơi; id môn (skin) quyết định giao diện cụ thể (thuyền/bơi/leo, chạy/xe đạp...).
const SCENES = Object.freeze({
  race: { draw: drawRace, reset: resetRace },
  endurance: { draw: drawEndurance, reset: resetEndurance },
  elimination: { draw: drawLiftingStage, reset: resetLifting },
  survival: { draw: drawTakraw, reset: resetTakraw },
  throw: { draw: drawThrow, reset: resetThrow },
});

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const fx = createSeaFx();
const commentary = createCommentary(fx);

for (const weight of [700, 800]) document.fonts?.load(`${weight} 40px ${FONT_FAMILY}`, FONT_SAMPLE).catch(() => {});

let latest = null;
let status = { connected: false, message: 'Đang kết nối server...' };
let lastEventKey = null;

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
    if (data.type === 'state' && data.state?.mode === 'sea') {
      latest = data.state;
      commentary.update(latest, performance.now());
    }
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

function drawScene(state, dt, now) {
  if (state.phase === 'opening') return drawOpening(ctx, state, now);
  if (state.phase === 'intro') return drawIntro(ctx, state, now);
  if (state.phase === 'podium') return drawPodium(ctx, state, now);
  if (state.phase === 'closing') return drawClosing(ctx, state, now);
  const scene = SCENES[state.event?.kind];
  if (!scene) return drawStadium(ctx);
  // Môn mới: xoá trạng thái nội suy của lần thi trước.
  const key = `${state.session}:${state.eventIndex}`;
  if (key !== lastEventKey) {
    lastEventKey = key;
    scene.reset();
  }
  return scene.draw(ctx, state.event.view, dt, now, state.event.id);
}

let lastFrame = performance.now();
function render(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  fx.update(dt, now);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#120d22';
  ctx.fillRect(0, 0, SW, SH);
  const shake = fx.shake(now);
  ctx.save();
  try {
    ctx.translate(shake.x, shake.y);
    if (latest) {
      drawScene(latest, dt, now);
      drawSeaHud(ctx, latest, now);
      fx.drawFeed(ctx, now);
    }
    fx.drawOverlay(ctx, now, {
      ceremony: CEREMONY_PHASES.has(latest?.phase),
      rowY: (team) => tableRowY(latest?.medals, team),
    });
  } finally {
    ctx.restore();
  }
  if (!status.connected) outlinedText(ctx, status.message, SW / 2, SH / 2, { size: 36, color: '#ffd54a' });
}

function frame(now) {
  // Luôn hẹn khung hình kế tiếp trước, để một lỗi vẽ không làm đứng hình cả buổi live.
  requestAnimationFrame(frame);
  try {
    render(now);
  } catch (error) {
    console.error('Lỗi vẽ khung hình', error);
  }
}

connect();
requestAnimationFrame(frame);
