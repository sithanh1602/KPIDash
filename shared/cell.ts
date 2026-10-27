import type { DayEntry } from './types';
import { normalizeText, parseNumber } from './text';

/**
 * Ô sản lượng ngày, quy ước nhập:
 *   1200      → làm việc, 1.200 cuboid
 *   1620*     → số ước tính (dấu *)
 *   0         → có đi làm nhưng 0 cuboid (vẫn tính ngày công)
 *   Nghỉ / N  → nghỉ, không tính ngày công
 *   Done job / D → xong job, không tính ngày công
 *   (để trống) → chưa nhập
 */
const LEAVE_WORDS = new Set(['nghi', 'n', 'off', 'nghi phep']);
const DONE_WORDS = new Set(['done', 'done job', 'd', 'xong job']);

export type CellParse =
  | { ok: true; entry: Omit<DayEntry, 'note'> | null }
  | { ok: false; message: string };

export function parseCell(raw: string): CellParse {
  const text = raw.trim();
  if (!text) return { ok: true, entry: null };

  const key = normalizeText(text);
  if (LEAVE_WORDS.has(key)) return { ok: true, entry: { status: 'leave', cuboids: null, estimated: false } };
  if (DONE_WORDS.has(key)) return { ok: true, entry: { status: 'done', cuboids: null, estimated: false } };

  const estimated = text.endsWith('*');
  const value = parseNumber(estimated ? text.slice(0, -1) : text);
  if (value === null || !Number.isInteger(value) || value < 0 || value > 100000) {
    return { ok: false, message: `Ô "${text}" không hợp lệ (nhập số nguyên 0–100000, "Nghỉ" hoặc "Done job")` };
  }
  return { ok: true, entry: { status: 'work', cuboids: value, estimated } };
}

/** Chuyển ngược một ô về chuỗi để hiển thị trong bảng nhập liệu */
export function formatCell(entry: DayEntry | null): string {
  if (!entry) return '';
  if (entry.status === 'leave') return 'Nghỉ';
  if (entry.status === 'done') return 'Done job';
  return `${entry.cuboids ?? 0}${entry.estimated ? '*' : ''}`;
}
