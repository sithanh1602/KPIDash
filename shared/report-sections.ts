/** Các phần của báo cáo, dùng cho chọn nội dung khi xuất PDF/Excel. */

export const REPORT_SECTIONS = [
  { key: 'overview', label: 'Tổng quan', page: '01' },
  { key: 'kpi', label: 'KPI sản lượng theo ngày & theo người', page: '02' },
  { key: 'ranking', label: 'Bảng xếp hạng thành viên', page: '03' },
  { key: 'quality', label: 'Chất lượng theo tool QA & lỗi chung', page: '04' },
  { key: 'manual_qa', label: 'Chất lượng QA kiểm tra bằng tay (Manual)', page: '05' },
  { key: 'coaching', label: 'Coaching, issue & kế hoạch tuần tới', page: '06' },
  { key: 'attitude', label: 'Đánh giá attitude', page: '07' },
] as const;

export type ReportSectionKey = (typeof REPORT_SECTIONS)[number]['key'];

export const isReportSection = (value: string): value is ReportSectionKey => REPORT_SECTIONS.some((s) => s.key === value);
