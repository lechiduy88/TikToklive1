// Điểm khởi động: web server + WebSocket + vòng lặp game + nguồn sự kiện (TikTok hoặc giả lập).
//   npm start -- --user ten_kenh_tiktok     (hoặc đặt biến môi trường TIKTOK_USERNAME)
//   npm run sim                             (giả lập người xem, không cần live)
// Chế độ chơi: --mode sea (mặc định, SEA Games 5 nước) | --mode battle (đại chiến 2 phe), hoặc GAME_MODE.
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';
import { TICK_MS, BROADCAST_EVERY_TICKS } from './config.js';
import * as battleEngine from './game/engine.js';
import * as seaEngine from './sea/engine.js';
import { SEA_TEAMS } from './sea/config.js';
import { addMedals, sortTable } from './sea/medals.js';
import { loadMedals, saveMedals } from './store/medalStore.js';
import { validateClientAction } from './live/liveEvents.js';
import { startTikTokSource } from './live/tiktokSource.js';
import { startSimulator } from './live/simulator.js';
import { loadStore, saveStore, awardXp, levelFromXp } from './store/playerStore.js';
import { logger, errorMessage } from './logger.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_WS_PAYLOAD = 4 * 1024;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const MODES = Object.freeze({
  sea: { engine: seaEngine, page: 'index.html', joinTexts: SEA_TEAMS.map((t) => t.short) },
  battle: { engine: battleEngine, page: 'battle.html', joinTexts: ['1', '2'] },
});

function parseArgs(argv) {
  const args = { sim: false, user: process.env.TIKTOK_USERNAME ?? '', mode: process.env.GAME_MODE ?? 'sea' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sim') args.sim = true;
    if (argv[i] === '--user') args.user = argv[i + 1] ?? '';
    if (argv[i] === '--mode') args.mode = argv[i + 1] ?? '';
  }
  args.user = args.user.replace(/^@/, '').trim();
  return args;
}

/** Bảng tổng sắp toàn mùa: cộng sau mỗi lần trao huy chương và lưu file. */
function createMedalKeeper(initial, file) {
  let table = initial;
  // Các lần lưu được xếp hàng nối tiếp để không ghi đè cùng file tạm cùng lúc.
  let saving = Promise.resolve();
  const save = async (snapshot) => {
    try {
      await saveMedals(file, snapshot);
    } catch (error) {
      logger.error(`Không lưu được bảng huy chương: ${errorMessage(error)}`);
    }
  };
  return {
    snapshot: () => sortTable(table),
    record(medals) {
      table = addMedals(table, medals);
      const snapshot = table;
      saving = saving.then(() => save(snapshot));
      return saving;
    },
    flush: () => saving,
  };
}

function createGame(engine, store, storeFile, { onEvent = () => {}, extraSnapshot = () => ({}) } = {}) {
  const { createMatch, tick, applyAction, toSnapshot } = engine;
  let state = createMatch(Date.now(), Math.random);
  let pendingEvents = [];
  let players = store;

  const levelOf = (id) => levelFromXp(players[id]?.xp ?? 0);
  const push = (events) => {
    if (!events.length) return;
    pendingEvents = [...pendingEvents, ...events];
    for (const event of events) onEvent(event);
  };

  async function onMatchEnd(result) {
    try {
      const { store: next, levelUps } = awardXp(players, result.participants);
      players = next;
      push(levelUps.map((u) => ({ type: 'level_up', ...u })));
      await saveStore(storeFile, players);
    } catch (error) {
      logger.error(`Không lưu được tiến trình người chơi: ${errorMessage(error)}`);
    }
  }

  // Lỗi trong một action/tick không được làm sập buổi live: giữ nguyên trạng thái cũ và ghi log.
  return {
    act(action) {
      try {
        const applied = applyAction(state, action, Date.now());
        state = applied.state;
        push(applied.events);
      } catch (error) {
        logger.error(`Bỏ qua action ${action?.type} lỗi: ${errorMessage(error)}`);
      }
    },
    step(dtMs) {
      try {
        const result = tick(state, dtMs, Date.now(), Math.random);
        state = result.state;
        push(result.events);
        const end = result.events.find((e) => e.type === 'match_end');
        if (end) onMatchEnd(end.result);
      } catch (error) {
        logger.error(`Lỗi tick: ${errorMessage(error)}`);
      }
    },
    drainEvents() {
      const events = pendingEvents;
      pendingEvents = [];
      return events;
    },
    snapshot: () => ({ ...toSnapshot(state, Date.now(), levelOf), ...extraSnapshot() }),
  };
}

function isLocalOrigin(origin, port) {
  try {
    const url = new URL(origin);
    return LOCAL_HOSTS.has(url.hostname) && Number(url.port || 80) === port;
  } catch {
    return false;
  }
}

/**
 * Màn hình game chỉ nhận dữ liệu. Gửi action (giả lập quà...) chỉ được phép khi bật control
 * và yêu cầu đến từ trang control.html trên chính máy này.
 */
function attachSockets(server, game, { port, controlEnabled, getStatus }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_WS_PAYLOAD });
  const broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) if (client.readyState === 1) client.send(data);
  };

  wss.on('connection', (socket, req) => {
    const origin = req.headers.origin;
    // OBS / LIVE Studio có thể không gửi Origin: vẫn cho xem, nhưng chỉ đọc.
    if (origin && !isLocalOrigin(origin, port)) {
      socket.close(1008, 'origin not allowed');
      return;
    }
    const canControl = controlEnabled && Boolean(origin);
    socket.send(JSON.stringify({ type: 'status', status: getStatus(), controlEnabled }));
    socket.on('message', (raw) => {
      if (!canControl) return;
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg?.type !== 'action') return;
      const action = validateClientAction(msg.action);
      if (action) game.act(action);
    });
    socket.on('error', (error) => logger.warn(`WebSocket: ${errorMessage(error)}`));
  });
  return broadcast;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  if (!args.sim && !args.user) {
    logger.error('Thiếu tên kênh. Dùng: npm start -- --user ten_kenh   hoặc   npm run sim');
    process.exit(1);
  }
  const mode = Object.hasOwn(MODES, args.mode) ? MODES[args.mode] : null;
  if (!mode) {
    logger.error(`Chế độ không hợp lệ: "${args.mode}". Dùng --mode sea hoặc --mode battle`);
    process.exit(1);
  }

  // Dữ liệu giả lập tách riêng để không làm bẩn cấp độ/huy chương thật.
  const suffix = args.sim ? '.sim.json' : '.json';
  const storeFile = join(ROOT, 'data', `players${suffix}`);
  const medalFile = join(ROOT, 'data', `medals${suffix}`);
  const medals = createMedalKeeper(await loadMedals(medalFile), medalFile);
  const hooks = args.mode === 'sea'
    ? { onEvent: (e) => { if (e.type === 'podium') medals.record(e.medals); }, extraSnapshot: () => ({ allTime: medals.snapshot() }) }
    : {};
  const game = createGame(mode.engine, await loadStore(storeFile), storeFile, hooks);
  let status = { source: 'starting', connected: false, message: 'Đang khởi động...' };

  const app = express();
  // Trang gốc "/" luôn là màn hình của chế độ đang chạy.
  app.get('/', (_req, res) => res.sendFile(join(ROOT, 'public', mode.page)));
  app.use(express.static(join(ROOT, 'public')));
  const server = createServer(app);
  // Trong buổi live thật, bảng điều khiển bị tắt trừ khi đặt ALLOW_CONTROL=1.
  const controlEnabled = args.sim || process.env.ALLOW_CONTROL === '1';
  const broadcast = attachSockets(server, game, { port, controlEnabled, getStatus: () => status });

  const onStatus = (next) => {
    status = next;
    broadcast({ type: 'status', status, controlEnabled });
  };
  const source = args.sim
    ? startSimulator({ onAction: game.act, onStatus, joinTexts: mode.joinTexts })
    : startTikTokSource({ username: args.user, signApiKey: process.env.SIGN_API_KEY, onAction: game.act, onStatus });

  let tickCount = 0;
  let last = Date.now();
  const loop = setInterval(() => {
    const now = Date.now();
    game.step(now - last);
    last = now;
    tickCount += 1;
    const events = game.drainEvents();
    if (events.length) broadcast({ type: 'events', events });
    if (tickCount % BROADCAST_EVERY_TICKS === 0) broadcast({ type: 'state', state: game.snapshot() });
  }, TICK_MS);

  // Lỗi khi mở cổng (thường là cổng đang bị chương trình khác dùng): báo rõ và thoát, không treo im lặng.
  server.on('error', (error) => {
    const hint = error.code === 'EADDRINUSE' ? ` — cổng ${port} đang bị dùng. Tắt server cũ hoặc chạy với PORT=3001` : '';
    logger.error(`Không mở được web server: ${errorMessage(error)}${hint}`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    logger.info(`Chế độ: ${args.mode === 'sea' ? 'SEA Games 5 nước' : 'Đại chiến 2 phe'}`);
    logger.info(`Màn hình game:   http://localhost:${port}/`);
    logger.info(`Bảng điều khiển: http://localhost:${port}/control.html`);
  });

  const shutdown = async () => {
    clearInterval(loop);
    await source.stop();
    await medals.flush(); // chờ lần lưu huy chương đang dở
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Lưới an toàn cuối cùng: ghi log thay vì để tiến trình chết giữa buổi live.
process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${errorMessage(reason)}`));
process.on('uncaughtException', (error) => logger.error(`Uncaught exception: ${errorMessage(error)}`));

main().catch((error) => {
  logger.error(`Không khởi động được server: ${errorMessage(error)}`);
  process.exit(1);
});
