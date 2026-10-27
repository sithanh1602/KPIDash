import { DAY_COUNT, DAY_NAMES } from './constants';

/** Định dạng số/ngày kiểu Việt Nam, dùng cho cả web và server. */

export function fmtInt(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 36.9 → "36,9" */
export function fmtDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  const ms = new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** "2026-10-19" → "19/10" */
export function fmtDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "2026-10-19" → "19/10/2026" */
export function fmtDate(iso: string): string {
  return `${fmtDayMonth(iso)}/${iso.slice(0, 4)}`;
}

/** ["T2 19/10", "T3 20/10", ...] */
export function dayLabels(startDate: string): string[] {
  return Array.from({ length: DAY_COUNT }, (_, i) => `${DAY_NAMES[i]} ${fmtDayMonth(addDays(startDate, i))}`);
}

/** Tính số thứ tự tuần ISO từ ngày YYYY-MM-DD */
export function getIsoWeekNumber(dateStr: string): number {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return 1;
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  } catch {
    return 1;
  }
}

/** "20/10 - 25/10/2026" */
export function weekRangeLabel(startDate: string, endDate?: string): string {
  const end = endDate || addDays(startDate, 5);
  const startDayMonth = fmtDayMonth(startDate);
  const endFormatted = fmtDate(end);
  return `${startDayMonth} - ${endFormatted}`;
}

/** Thứ của ngày: "Thứ 7" / "Chủ nhật" */
export function weekdayLabel(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 'Chủ nhật' : `Thứ ${day + 1}`;
}
