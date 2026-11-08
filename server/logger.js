// Logger tối giản có mốc thời gian. Thay bằng pino/winston nếu cần log có cấu trúc.
const stamp = () => new Date().toISOString().slice(11, 19);

export const logger = Object.freeze({
  info: (msg, ...rest) => console.info(`[${stamp()}] ${msg}`, ...rest),
  warn: (msg, ...rest) => console.warn(`[${stamp()}] WARN ${msg}`, ...rest),
  error: (msg, ...rest) => console.error(`[${stamp()}] ERROR ${msg}`, ...rest),
});

/** @param {unknown} error */
export function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string') return error.message;
    try {
      return JSON.stringify(error).slice(0, 300);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}
