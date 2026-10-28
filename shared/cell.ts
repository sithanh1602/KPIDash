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
const LEAVE_WORDS = new Set(['nghi', 'n', 'off', 'nghi phep', 'nghi 1 ngay', '1 ngay']);
const HALF_LEAVE_WORDS = new Set(['nghi 0.5', 'nghi 0,5', 'n0.5', 'n0,5', 'nua ngay', 'nghi nua ngay', '0.5', 'off 0.5']);
const DONE_WORDS = new Set(['done', 'done job', 'd', 'xong job']);

export type CellParse =
  | { ok: true; entry: (Omit<DayEntry, 'note'> & { weight?: number }) | null }
  | { ok: false; message: string };

export function parseCell(raw: string): CellParse {
  const text = raw.trim();
  if (!text) return { ok: true, entry: null };

  const key = normalizeText(text);
  if (HALF_LEAVE_WORDS.has(key)) {
    return { ok: true, entry: { status: 'leave', cuboids: null, estimated: false, weight: 0.5 } };
  }
  if (LEAVE_WORDS.has(key)) {
    return { ok: true, entry: { status: 'leave', cuboids: null, estimated: false, weight: 0.0 } };
  }
  if (DONE_WORDS.has(key)) {
    return { ok: true, entry: { status: 'done', cuboids: null, estimated: false, weight: 0.0 } };
  }

  // Nhận diện nhập kèm nửa ngày công: vd "500 (0.5)", "600/0.5", "400 (0.5 công)"
  let cleanText = text;
  let isHalf = false;
  if (/[\(\/](0[.,]5|nua ngay|0[.,]5\s*c|0[.,]5\s*cong)[\)]?/i.test(cleanText)) {
    isHalf = true;
    cleanText = cleanText.replace(/[\(\/](0[.,]5|nua ngay|0[.,]5\s*c|0[.,]5\s*cong)[\)]?/gi, '').trim();
  }

  const estimated = cleanText.endsWith('*');
  const numStr = estimated ? cleanText.slice(0, -1).trim() : cleanText;
  const value = parseNumber(numStr);
  if (value === null || !Number.isInteger(value) || value < 0 || value > 100000) {
    return { ok: false, message: `Ô "${text}" không hợp lệ (nhập số nguyên 0–100000, "500 (0.5)", "Nghỉ" hoặc "Done job")` };
  }
  return { ok: true, entry: { status: 'work', cuboids: value, estimated, weight: isHalf ? 0.5 : 1.0 } };
}

/** Chuyển ngược một ô về chuỗi để hiển thị trong bảng nhập liệu */
export function formatCell(entry: DayEntry | null): string {
  if (!entry) return '';
  const isHalf = entry.weight === 0.5 || entry.note?.includes('[0.5c]');
  if (entry.status === 'leave') return isHalf ? 'Nghỉ 0.5' : 'Nghỉ';
  if (entry.status === 'done') return 'Done job';
  const suffix = isHalf ? ' (0.5)' : '';
  return `${entry.cuboids ?? 0}${entry.estimated ? '*' : ''}${suffix}`;
}
