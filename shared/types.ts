/**
 * Kiểu dữ liệu dùng chung giữa server và web.
 * Server tính toàn bộ chỉ số (TB/ngày, % KPI, xếp hạng...) rồi trả về `WeekReport`;
 * web chỉ việc hiển thị.
 */

export type Role = 'leader' | 'qc' | 'annotator';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  memberId?: number | null;
}

/* ------------------------------ Tuần báo cáo ------------------------------ */

export interface WeekMeta {
  id: number;
  /** Số thứ tự tuần trong năm (vd: 43) */
  weekNumber: number;
  /** Ngày bắt đầu tuần, dạng YYYY-MM-DD (vd: 2026-10-20) */
  startDate: string;
  /** Ngày kết thúc tuần, dạng YYYY-MM-DD (vd: 2026-10-25) */
  endDate: string;
  /** Ngày chốt số liệu (vd 2026-10-25) */
  dataAsOf: string;
  projectTag: string; // Mã/Tag dự án (vd: VF-ADAS-2026, LIDAR-PHASE-1)
  orgName: string; // VINFAST
  teamName: string; // TEAM T01
  discipline: string; // 3D LiDAR
  floorName: string; // Tầng 28
  leadName: string;
  mentorName: string;
  target: number; // mốc KPI (1.200)
  normalThreshold: number; // 1.000
  excellentThreshold: number; // 1.200
  jobsTotal: number;
  jobsDone: number;
  toolQaDone: number;
  dataNotes: string;
  /** Nếu có, thay thế phần "Tóm tắt điều hành" tự sinh */
  summaryOverride: string;
}

export interface WeekListItem {
  id: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  projectTag?: string;
  memberCount: number;
}

export interface Member {
  id: number;
  name: string;
  role: string;
  active: boolean;
}

/* ------------------------------ Sản lượng ngày ---------------------------- */

export type DayStatus = 'work' | 'leave' | 'done';

export interface DayEntry {
  status: DayStatus;
  /** Có giá trị khi status = 'work' (kể cả 0) */
  cuboids: number | null;
  /** Số ước tính (dấu * trong báo cáo) */
  estimated: boolean;
  /** Trọng số ngày công: 1.0 (chuẩn), 0.5 (nghỉ nửa ngày), 0.0 (nghỉ cả ngày) */
  weight?: number;
  note: string;
}

export type Grade = 'excellent' | 'normal' | 'below';
export type AttitudeGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'none';
export type Priority = 'Cao' | 'TB' | 'Thấp';
export type IssueStatus = 'Chờ chốt' | 'Tạm thời' | 'Đã chốt';

/* ------------------------------ Dữ liệu thô (từ DB) ----------------------- */

export interface QaRow {
  jobCode: string;
  qcName: string;
  cuboids: number;
  warningPercent: number;
  s: number;
  k: number;
  z: number;
  h: number;
  o: number;
  d: number;
  riskHigh: number;
  riskMid: number;
  riskLow: number;
}

export interface ManualQaRow {
  jobCode: string;
  qcName: string;
  cuboidsChecked: number;
  floatingBoxCount: number; // Lỗi bay box / chìm box (Màu tím)
  looseBoxCount: number;    // Lỗi box không ôm sát pointcloud (Màu cyan)
  totalErrors: number;
  errorRate: number;
  note: string;
}

export interface CoachingRow {
  focusTags: string;
  style: string;
  commonErrors: string;
  training: string;
  absenceNote: string;
  goals: string;
}

export interface SharedTrack {
  id: number;
  trackNo: string;
  className: string;
  jobCount: number;
  inJobs: string;
  warnings: string;
  symptom: string;
}

export interface Issue {
  id: number;
  code: string;
  reporter: string;
  title: string;
  interim: string;
  nextStep: string;
  status: IssueStatus;
  priority: Priority;
}

export interface ActionItem {
  id: number;
  title: string;
  detail: string;
  owner: string;
  priority: Priority;
}

export interface RawMemberData {
  id: number;
  name: string;
  role: string;
  days: (DayEntry | null)[];
  qa: QaRow | null;
  manualQa: ManualQaRow | null;
  attitude: { score: number; note: string } | null;
  coaching: CoachingRow | null;
}

export interface RawWeekData {
  week: WeekMeta;
  members: RawMemberData[];
  tracks: SharedTrack[];
  issues: Issue[];
  actions: ActionItem[];
}

/* ------------------------------ Báo cáo đã tính --------------------------- */

export interface ReportMember {
  id: number;
  name: string;
  initials: string;
  role: string;
  days: (DayEntry | null)[];
  total: number;
  workDays: number;
  /** TB cuboid / ngày công (đã làm tròn) */
  avg: number;
  kpiPercent: number;
  grade: Grade;
  rank: number;
  /** Số ngày đạt mốc xuất sắc */
  daysExcellent: number;
  qa: QaRow | null;
  qaTotalWarnings: number;
  manualQa: ManualQaRow | null;
  attitude: { score: number; note: string; grade: AttitudeGrade } | null;
  coaching: CoachingRow | null;
  /** Nhận định tự sinh ở bảng "Đạt KPI thì chất lượng thế nào" */
  insight: string;
  /** Mô tả ngắn ở bảng xếp hạng */
  rankNote: string;
  /** Ghi chú ngày chốt số liệu */
  today: { status: DayStatus | 'none'; cuboids: number | null; note: string };
}

export interface Highlight {
  label: string;
  value: string;
  unit: string;
  title: string;
  detail: string;
}

export interface ReportSummary {
  total: number;
  workDays: number;
  teamAvg: number;
  kpiPercent: number;
  riskHigh: number;
  warnPercent: number;
  issuesOpen: number;
  issuesPending: number;
  issuesTotal: number;
  /** Số ô ngày-người theo mức */
  cellsExcellent: number;
  cellsNormal: number;
  cellsBelow: number;
  membersMet: number;
  membersTotal: number;
  attitudeAvg: number;
  manualTotalChecked: number;
  manualTotalFloating: number;
  manualTotalLoose: number;
  manualTotalErrors: number;
  manualErrorRate: number;
  executive: string[];
  highlights: Highlight[];
}

export interface WeekReport {
  week: WeekMeta;
  /** Danh sách tên cột ngày: ["T2 19/10", ...] */
  dayLabels: string[];
  /** Thành viên theo thứ tự xếp hạng (TB giảm dần) */
  ranking: ReportMember[];
  /** Thành viên theo thứ tự nhập trong tuần */
  members: ReportMember[];
  tracks: SharedTrack[];
  issues: Issue[];
  actions: ActionItem[];
  summary: ReportSummary;
}

/* ------------------------------ Bảng nhập liệu ---------------------------- */

/**
 * Một dòng trong bảng nhập liệu. Mọi giá trị là chuỗi (đúng như người dùng gõ);
 * server chịu trách nhiệm đọc và kiểm tra.
 */
export interface SheetRow {
  memberId: number | null;
  values: Record<string, string>;
}

export interface SheetData {
  rows: SheetRow[];
}

export interface ImportResult {
  rows: SheetRow[];
  /** Lỗi theo dòng (số dòng tính trong file, bắt đầu từ 2) */
  errors: { line: number; message: string }[];
  warnings: string[];
}
