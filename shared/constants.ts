/** Hằng số nghiệp vụ dùng chung. */

/** Số ngày làm việc ghi nhận trong tuần: T2 → T7 */
export const DAY_COUNT = 6;
export const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export const DEFAULT_TARGET = 1000;
export const DEFAULT_NORMAL = 1000;
export const DEFAULT_EXCELLENT = 1200;

export const GRADE_LABEL = {
  excellent: 'Vượt KPI',
  normal: 'Đạt KPI',
  below: 'Không đạt KPI',
} as const;

export const JOB_STATUSES = ['Hoàn Thành', 'Chưa hoàn thành'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ATTITUDE_LABEL = {
  excellent: 'Xuất sắc',
  good: 'Tốt',
  fair: 'Khá',
  poor: 'Cần cải thiện',
  none: 'Chưa chấm',
} as const;

export const ISSUE_STATUSES = ['Chờ chốt', 'Tạm thời', 'Đã chốt'] as const;
export const PRIORITIES = ['Cao', 'TB', 'Thấp'] as const;

/** Sáu loại cảnh báo của tool QA */
export const QA_TYPES = [
  { key: 's', short: 'S', label: 'Scale', color: '#b9a4ee' },
  { key: 'k', short: 'K', label: 'Kích thước', color: '#a4b8ec' },
  { key: 'z', short: 'Z', label: 'Độ cao', color: '#cfd2d9' },
  { key: 'h', short: 'H', label: 'Hướng', color: '#ee9e9e' },
  { key: 'o', short: 'O', label: 'Chồng lấn', color: '#f1c27a' },
  { key: 'd', short: 'D', label: 'Quá xa', color: '#8fd5bd' },
] as const;
