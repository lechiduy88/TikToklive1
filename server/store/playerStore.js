// Lưu XP / cấp độ người xem qua nhiều buổi live (file JSON cục bộ).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { XP_PER_LEVEL } from '../config.js';

/** @param {number} xp */
export function levelFromXp(xp) {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

function isValidRecord(r) {
  return r && typeof r === 'object'
    && typeof r.name === 'string'
    && Number.isFinite(r.xp) && r.xp >= 0
    && Number.isFinite(r.matches) && r.matches >= 0;
}

/**
 * Cộng XP cho người tham gia trận. Không thay đổi `store`.
 * @param {Record<string, {name: string, xp: number, matches: number}>} store
 * @param {{id: string, name: string, xp: number}[]} participants
 */
export function awardXp(store, participants) {
  const next = { ...store };
  const levelUps = [];
  for (const p of participants) {
    const prev = Object.hasOwn(next, p.id) ? next[p.id] : { name: p.name, xp: 0, matches: 0 };
    const updated = { name: p.name, xp: prev.xp + p.xp, matches: prev.matches + 1 };
    // defineProperty: ID "__proto__" (tên TikTok hợp lệ) phải là khoá thường, không được thay prototype của store.
    Object.defineProperty(next, p.id, { value: updated, enumerable: true, writable: true, configurable: true });
    const level = levelFromXp(updated.xp);
    if (level > levelFromXp(prev.xp)) levelUps.push({ id: p.id, name: p.name, level });
  }
  return { store: next, levelUps };
}

/**
 * Đọc store; file thiếu hoặc hỏng thì trả về store rỗng (không làm sập server).
 * @param {string} file
 */
export async function loadStore(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, r]) => isValidRecord(r)));
}

/** Ghi an toàn: ghi ra file tạm rồi đổi tên để không bao giờ để lại file ghi dở. */
export async function saveStore(file, store) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await rename(tmp, file);
}
