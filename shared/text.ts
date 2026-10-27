/** Tiện ích văn bản và số, dùng chung. */

/** Bỏ dấu tiếng Việt, hạ chữ thường: "Đặng Trường Huy" → "dang truong huy" */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Đọc số do người dùng gõ. Chấp nhận "1.200", "1,200", "1200", "36,9", "36.9".
 * Trả về null nếu không phải số.
 */
export function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '');
  if (!text) return null;
  // 1.200 hoặc 1,200 hoặc 1.200.000 → hàng nghìn
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ''));
  if (/^\d+([.,]\d+)?$/.test(text)) return Number(text.replace(',', '.'));
  return null;
}

/** Viết chữ cái đầu: "Đặng Trường Huy" → "TH" (2 chữ cuối) */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Tách văn bản nhiều dòng thành danh sách, bỏ dòng trống và gạch đầu dòng */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}
