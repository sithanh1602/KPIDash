import { ISSUE_STATUSES, PRIORITIES } from '../../../shared/constants';
import { parseCell } from '../../../shared/cell';
import { normalizeText, parseNumber } from '../../../shared/text';
import type { SheetKey } from '../../../shared/sheets';
import { SHEETS } from '../../../shared/sheets';
import type { ActionItem, DayEntry, Issue, QaRow, ManualQaRow, CoachingRow, SharedTrack } from '../../../shared/types';

/**
 * Đọc và kiểm tra từng dòng của bảng nhập liệu (hàm thuần, không đụng DB).
 * Dùng chung cho: lưu bảng nhập liệu và kiểm tra khi import file.
 * Dòng trống hoàn toàn → trả về null (bỏ qua).
 */

export class RowError extends Error {}

type Values = Record<string, string>;

const text = (values: Values, key: string) => (values[key] ?? '').trim();

const columnLabel = (sheet: SheetKey, key: string) => SHEETS[sheet].columns.find((c) => c.key === key)?.header ?? key;

function isBlank(sheet: SheetKey, values: Values): boolean {
  return SHEETS[sheet].columns
    .filter((c) => !c.readOnly)
    .every((c) => !text(values, c.key));
}

function readInt(sheet: SheetKey, values: Values, key: string, max = 1_000_000): number {
  const raw = text(values, key);
  if (!raw) return 0;
  const value = parseNumber(raw);
  if (value === null || !Number.isInteger(value) || value < 0 || value > max) {
    throw new RowError(`Cột "${columnLabel(sheet, key)}": "${raw}" không phải số nguyên từ 0 đến ${max}`);
  }
  return value;
}

function readDecimal(sheet: SheetKey, values: Values, key: string, max: number): number {
  const raw = text(values, key);
  if (!raw) return 0;
  const value = parseNumber(raw.replace('%', ''));
  if (value === null || value < 0 || value > max) {
    throw new RowError(`Cột "${columnLabel(sheet, key)}": "${raw}" phải là số từ 0 đến ${max}`);
  }
  return Math.round(value * 100) / 100;
}

function readText(sheet: SheetKey, values: Values, key: string, max: number): string {
  const value = text(values, key);
  if (value.length > max) throw new RowError(`Cột "${columnLabel(sheet, key)}" tối đa ${max} ký tự`);
  return value;
}

function readSelect<T extends string>(sheet: SheetKey, values: Values, key: string, options: readonly T[], fallback: T): T {
  const raw = text(values, key);
  if (!raw) return fallback;
  const found = options.find((option) => normalizeText(option) === normalizeText(raw));
  if (!found) throw new RowError(`Cột "${columnLabel(sheet, key)}": "${raw}" không hợp lệ (chọn: ${options.join(' / ')})`);
  return found;
}

/* ------------------------------ Từng loại bảng --------------------------- */

export interface ProductionRow {
  days: (Omit<DayEntry, 'note'> | null)[];
  todayNote: string;
}

export function parseProductionRow(values: Values): ProductionRow {
  const days = Array.from({ length: 6 }, (_, i) => {
    const result = parseCell(values[`d${i}`] ?? '');
    if (!result.ok) throw new RowError(result.message);
    return result.entry;
  });
  return { days, todayNote: readText('production', values, 'todayNote', 500) };
}

export function parseQaRow(values: Values): QaRow | null {
  if (isBlank('qa', values)) return null;
  const s = 'qa' as const;
  return {
    jobCode: readText(s, values, 'jobCode', 50),
    qcName: readText(s, values, 'qcName', 150),
    cuboids: readInt(s, values, 'cuboids'),
    warningPercent: readDecimal(s, values, 'warningPercent', 100),
    s: readInt(s, values, 's'),
    k: readInt(s, values, 'k'),
    z: readInt(s, values, 'z'),
    h: readInt(s, values, 'h'),
    o: readInt(s, values, 'o'),
    d: readInt(s, values, 'd'),
    riskHigh: readInt(s, values, 'riskHigh'),
    riskMid: readInt(s, values, 'riskMid'),
    riskLow: readInt(s, values, 'riskLow'),
  };
}

export function parseManualQaRow(values: Values): ManualQaRow | null {
  if (isBlank('manual_qa', values)) return null;
  const s = 'manual_qa' as const;
  const cuboidsChecked = readInt(s, values, 'cuboidsChecked');
  const floatingBoxCount = readInt(s, values, 'floatingBoxCount');
  const looseBoxCount = readInt(s, values, 'looseBoxCount');
  const totalErrors = floatingBoxCount + looseBoxCount;
  const errorRate = cuboidsChecked > 0 ? Number(((totalErrors / cuboidsChecked) * 100).toFixed(2)) : 0;
  return {
    jobCode: readText(s, values, 'jobCode', 50),
    qcName: readText(s, values, 'qcName', 150),
    cuboidsChecked,
    floatingBoxCount,
    looseBoxCount,
    totalErrors,
    errorRate,
    note: readText(s, values, 'note', 2000),
  };
}

export function parseAttitudeRow(values: Values): { score: number; note: string } | null {
  if (isBlank('attitude', values)) return null;
  return { score: readInt('attitude', values, 'score', 100), note: readText('attitude', values, 'note', 5000) };
}

export function parseCoachingRow(values: Values): CoachingRow | null {
  if (isBlank('coaching', values)) return null;
  const s = 'coaching' as const;
  return {
    focusTags: readText(s, values, 'focusTags', 255),
    style: readText(s, values, 'style', 5000),
    commonErrors: readText(s, values, 'commonErrors', 5000),
    training: readText(s, values, 'training', 5000),
    absenceNote: readText(s, values, 'absenceNote', 5000),
    goals: readText(s, values, 'goals', 255),
  };
}

export function parseTrackRow(values: Values): Omit<SharedTrack, 'id'> | null {
  if (isBlank('tracks', values)) return null;
  const s = 'tracks' as const;
  const trackNo = readText(s, values, 'trackNo', 30);
  if (!trackNo) throw new RowError('Thiếu mã track');
  return {
    trackNo,
    className: readText(s, values, 'className', 60),
    jobCount: readInt(s, values, 'jobCount', 1000),
    inJobs: readText(s, values, 'inJobs', 255),
    warnings: readText(s, values, 'warnings', 40),
    symptom: readText(s, values, 'symptom', 1000),
  };
}

export function parseIssueRow(values: Values): Omit<Issue, 'id'> | null {
  if (isBlank('issues', values)) return null;
  const s = 'issues' as const;
  const title = readText(s, values, 'title', 1000);
  if (!title) throw new RowError('Thiếu nội dung vấn đề');
  return {
    code: readText(s, values, 'code', 30),
    reporter: readText(s, values, 'reporter', 100),
    title,
    interim: readText(s, values, 'interim', 1000),
    nextStep: readText(s, values, 'nextStep', 1000),
    status: readSelect(s, values, 'status', ISSUE_STATUSES, 'Chờ chốt'),
    priority: readSelect(s, values, 'priority', PRIORITIES, 'Cao'),
  };
}

export function parseActionRow(values: Values): Omit<ActionItem, 'id'> | null {
  if (isBlank('actions', values)) return null;
  const s = 'actions' as const;
  const title = readText(s, values, 'title', 255);
  if (!title) throw new RowError('Thiếu tên hạng mục');
  return {
    title,
    detail: readText(s, values, 'detail', 5000),
    owner: readText(s, values, 'owner', 100),
    priority: readSelect(s, values, 'priority', PRIORITIES, 'TB'),
  };
}

/** Kiểm tra một dòng bất kể loại bảng (dùng khi import). Ném RowError nếu sai. */
export function validateRow(sheet: SheetKey, values: Values): void {
  switch (sheet) {
    case 'production':
      parseProductionRow(values);
      break;
    case 'qa':
      parseQaRow(values);
      break;
    case 'manual_qa':
      parseManualQaRow(values);
      break;
    case 'attitude':
      parseAttitudeRow(values);
      break;
    case 'coaching':
      parseCoachingRow(values);
      break;
    case 'tracks':
      parseTrackRow(values);
      break;
    case 'issues':
      parseIssueRow(values);
      break;
    case 'actions':
      parseActionRow(values);
      break;
  }
}

export { isBlank };
