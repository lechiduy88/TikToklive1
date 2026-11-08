// Kết nối TikTok LIVE qua thư viện không chính thức tiktok-live-connector.
// Tự kết nối lại với thời gian chờ tăng dần khi bị ngắt.
import { normalizeLiveEvent } from './liveEvents.js';
import { logger, errorMessage } from '../logger.js';

const LIVE_EVENTS = ['chat', 'like', 'gift', 'follow', 'share'];
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

/**
 * @param {{username: string, signApiKey?: string, onAction: (a: object) => void, onStatus: (s: object) => void}} opts
 * @returns {{stop: () => Promise<void>}}
 */
export function startTikTokSource({ username, signApiKey, onAction, onStatus }) {
  let connection = null;
  let stopped = false;
  let retryMs = RETRY_MIN_MS;
  let retryTimer = null;

  const scheduleRetry = (reason) => {
    if (stopped || retryTimer) return;
    onStatus({ source: 'tiktok', connected: false, message: `${reason} — thử lại sau ${retryMs / 1000}s` });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect().catch((error) => scheduleRetry(`Lỗi: ${errorMessage(error)}`));
    }, retryMs);
    retryMs = Math.min(RETRY_MAX_MS, retryMs * 2);
  };

  async function connect() {
    const { TikTokLiveConnection } = await import('tiktok-live-connector');
    if (connection) {
      // Dọn kết nối cũ để không bị nhân đôi sự kiện sau khi kết nối lại.
      const old = connection;
      old.removeAllListeners?.();
      await old.disconnect().catch(() => {});
    }
    connection = new TikTokLiveConnection(username, signApiKey ? { signApiKey } : {});
    for (const kind of LIVE_EVENTS) {
      connection.on(kind, (data) => {
        const action = normalizeLiveEvent(kind, data);
        if (action) onAction(action);
      });
    }
    connection.on('disconnected', () => scheduleRetry('Mất kết nối TikTok'));
    connection.on('streamEnd', () => scheduleRetry('Buổi live đã kết thúc'));
    connection.on('error', (error) => logger.warn(`TikTok: ${errorMessage(error)}`));

    try {
      const state = await connection.connect();
      retryMs = RETRY_MIN_MS;
      logger.info(`Đã kết nối TikTok LIVE @${username} (roomId ${state.roomId})`);
      onStatus({ source: 'tiktok', connected: true, message: `Đang live: @${username}` });
    } catch (error) {
      logger.warn(`Không kết nối được @${username}: ${errorMessage(error)}`);
      scheduleRetry('Chưa kết nối được (kênh chưa live?)');
    }
  }

  connect().catch((error) => scheduleRetry(`Lỗi: ${errorMessage(error)}`));

  return {
    async stop() {
      stopped = true;
      clearTimeout(retryTimer);
      if (connection) await connection.disconnect().catch(() => {});
    },
  };
}
