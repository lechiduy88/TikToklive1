// Bảng tổng sắp huy chương toàn mùa (qua mọi buổi live), lưu file JSON cục bộ.
// Định dạng: { "vn": { "gold": 3, "silver": 1, "bronze": 0 }, "th": {...}, ... }
import { readFile } from 'node:fs/promises';
import { sanitizeTable, emptyTable } from '../sea/medals.js';
import { saveStore } from './playerStore.js';

/** File thiếu hoặc hỏng => bảng trống, không làm sập server. */
export async function loadMedals(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyTable();
    throw error;
  }
  try {
    return sanitizeTable(JSON.parse(raw));
  } catch {
    return emptyTable();
  }
}

/** Ghi an toàn (file tạm rồi đổi tên). */
export const saveMedals = saveStore;
