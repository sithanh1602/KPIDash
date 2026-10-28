import { DAY_NAMES, ISSUE_STATUSES, PRIORITIES } from './constants';

/**
 * Định nghĩa các "bảng Excel trên web".
 * Một nguồn duy nhất cho: bảng nhập liệu (web), file mẫu, import và kiểm tra dữ liệu.
 */

export type SheetKey = 'production' | 'qa' | 'manual_qa' | 'attitude' | 'coaching' | 'tracks' | 'issues' | 'actions';

export type ColumnType = 'text' | 'longtext' | 'number' | 'cell' | 'select';

export interface ColumnDef {
  key: string;
  header: string;
  type: ColumnType;
  /** Độ rộng gợi ý (px) trong bảng web */
  width?: number;
  options?: readonly string[];
  /** Tên cột khác được chấp nhận khi import (không phân biệt dấu/hoa thường) */
  aliases?: readonly string[];
  /** Hướng dẫn hiển thị ở sheet "Hướng dẫn" của file mẫu */
  hint: string;
  readOnly?: boolean;
}

export interface SheetDef {
  key: SheetKey;
  label: string;
  description: string;
  /** member: mỗi dòng gắn với một thành viên của tuần; free: danh sách tự do */
  scope: 'member' | 'free';
  columns: ColumnDef[];
}

const MEMBER_COLUMN: ColumnDef = {
  key: 'member',
  header: 'Annotator',
  type: 'text',
  width: 190,
  readOnly: true,
  aliases: ['annotator', 'thanh vien', 'ho ten', 'ho va ten', 'ten', 'member', 'nguoi lam', 'nhan vien'],
  hint: 'Họ tên thành viên, phải trùng với thành viên đã thêm vào tuần.',
};

const dayColumns: ColumnDef[] = DAY_NAMES.map((name, index) => ({
  key: `d${index}`,
  header: name,
  type: 'cell',
  width: 92,
  aliases: [name, `thu ${index + 2}`],
  hint: 'Số cuboid (vd 1200, thêm * nếu ước tính: 1620*), "Nghỉ", "Done job" hoặc để trống nếu chưa có.',
}));

const numberColumn = (key: string, header: string, hint: string, extra: Partial<ColumnDef> = {}): ColumnDef => ({
  key,
  header,
  type: 'number',
  width: 80,
  hint,
  ...extra,
});

export const SHEETS: Record<SheetKey, SheetDef> = {
  production: {
    key: 'production',
    label: 'Sản lượng ngày',
    description: 'Cuboid hoàn thành từng ngày (T2–T7). Ô trống = chưa nhập, "Nghỉ" và "Done job" không tính ngày công.',
    scope: 'member',
    columns: [
      MEMBER_COLUMN,
      {
        key: 'jobCode',
        header: 'Mã Job',
        type: 'text',
        width: 140,
        aliases: ['ma job', 'job', 'job code'],
        hint: 'Mã job phân công cho annotator trong tuần.',
      },
      {
        key: 'jobStatus',
        header: 'Trạng thái Job',
        type: 'select',
        width: 150,
        options: ['Hoàn Thành', 'Chưa hoàn thành'],
        aliases: ['trang thai', 'trang thai job', 'status'],
        hint: 'Trạng thái hoàn thành job: 1. Hoàn Thành, 2. Chưa hoàn thành.',
      },
      ...dayColumns,
      {
        key: 'todayNote',
        header: 'Ghi chú ngày chốt',
        type: 'longtext',
        width: 320,
        aliases: ['ghi chu', 'ghi chu ngay chot', 'note', 'hom nay'],
        hint: 'Việc làm trong ngày chốt số liệu, hiển thị ở mục "Hôm nay" của trang Tổng quan.',
      },
    ],
  },
  qa: {
    key: 'qa',
    label: 'Chất lượng tool QA',
    description: 'Số liệu export từ tool QA theo từng annotator. Cảnh báo là nơi cần nhìn, chưa phải lỗi.',
    scope: 'member',
    columns: [
      MEMBER_COLUMN,
      { key: 'jobCode', header: 'Job', type: 'text', width: 80, aliases: ['job', 'ma job'], hint: 'Mã job, vd 1209.' },
      { key: 'qcName', header: 'Người QC', type: 'text', width: 150, aliases: ['nguoi qc', 'qc'], hint: 'Tên người QC job này.' },
      numberColumn('cuboids', 'Cuboid', 'Tổng cuboid trong job được quét.', { width: 90, aliases: ['cuboid', 'tong cuboid'] }),
      numberColumn('warningPercent', '% cảnh báo', 'Tỷ lệ cuboid có cảnh báo, 0–100 (vd 36,9).', {
        width: 100,
        aliases: ['% canh bao', 'canh bao', 'ty le canh bao'],
      }),
      numberColumn('s', 'S', 'Cảnh báo Scale.'),
      numberColumn('k', 'K', 'Cảnh báo Kích thước.'),
      numberColumn('z', 'Z', 'Cảnh báo Độ cao.'),
      numberColumn('h', 'H', 'Cảnh báo Hướng.'),
      numberColumn('o', 'O', 'Cảnh báo Chồng lấn.'),
      numberColumn('d', 'D', 'Cảnh báo Quá xa.'),
      numberColumn('riskHigh', 'Cao', 'Số track rủi ro CAO.', { aliases: ['cao', 'track cao', 'track rui ro cao'] }),
      numberColumn('riskMid', 'TB', 'Số track rủi ro trung bình.', { aliases: ['tb', 'trung binh'] }),
      numberColumn('riskLow', 'Thấp', 'Số track rủi ro thấp.', { aliases: ['thap'] }),
    ],
  },
  manual_qa: {
    key: 'manual_qa',
    label: 'Chất lượng QA Manual',
    description: 'Lỗi kiểm tra thủ công bằng tay do QC phát hiện: Lỗi bay box/chìm box (Màu tím) và Lỗi box không ôm sát pointcloud (Màu cyan).',
    scope: 'member',
    columns: [
      MEMBER_COLUMN,
      { key: 'jobCode', header: 'Mã Job', type: 'text', width: 100, aliases: ['job', 'ma job', 'job code'], hint: 'Mã bài kiểm tra.' },
      { key: 'qcName', header: 'Người QC', type: 'text', width: 150, aliases: ['nguoi qc', 'qc', 'inspector'], hint: 'Tên chuyên viên QC kiểm tra.' },
      numberColumn('cuboidsChecked', 'Cuboid kiểm tra', 'Tổng số cuboid được QC soi thủ công.', {
        width: 130,
        aliases: ['cuboid kiem tra', 'so cuboid', 'cuboid soi'],
      }),
      numberColumn('floatingBoxCount', 'Bay box / Chìm box (Tím)', 'Số lượng lỗi bay box / chìm box cao độ Z không chuẩn.', {
        width: 170,
        aliases: ['bay box', 'chim box', 'bay chim box', 'floating box', 'floating'],
      }),
      numberColumn('looseBoxCount', 'Không ôm sát (Cyan)', 'Số lượng lỗi bounding box không ôm khít điểm mây pointcloud.', {
        width: 170,
        aliases: ['khong om sat', 'box khong om sat', 'loose box', 'fitting'],
      }),
      {
        key: 'note',
        header: 'Ghi chú chi tiết frame lỗi',
        type: 'longtext',
        width: 320,
        aliases: ['ghi chu', 'note', 'chi tiet', 'frame loi'],
        hint: 'Mô tả cụ thể frame hoặc track bị lỗi.',
      },
    ],
  },
  attitude: {
    key: 'attitude',
    label: 'Attitude',
    description: 'Điểm thái độ thang 85–100: Xuất sắc ≥ 95, Tốt 90–94, Khá 85–89.',
    scope: 'member',
    columns: [
      MEMBER_COLUMN,
      numberColumn('score', 'Điểm', 'Điểm attitude, số nguyên 0–100 (để trống nếu chưa chấm).', { aliases: ['diem', 'attitude'] }),
      {
        key: 'note',
        header: 'Ghi chú · lý do',
        type: 'longtext',
        width: 520,
        aliases: ['ghi chu', 'ly do', 'ghi chu ly do', 'note'],
        hint: 'Lý do xếp loại (đúng giờ, nghỉ phép, Complete đúng deadline...).',
      },
    ],
  },
  coaching: {
    key: 'coaching',
    label: 'Coaching từng người',
    description: 'Phong cách, lỗi hay gặp và đề xuất training. Mỗi ý một dòng (Alt+Enter hoặc Shift+Enter xuống dòng).',
    scope: 'member',
    columns: [
      MEMBER_COLUMN,
      { key: 'focusTags', header: 'Nhóm lỗi chính', type: 'text', width: 200, aliases: ['nhom loi chinh', 'tag', 'nhom loi'], hint: 'Ví dụ: HƯỚNG (YAW) · SCALE.' },
      { key: 'style', header: 'Phong cách', type: 'longtext', width: 300, aliases: ['phong cach'], hint: 'Nhận xét cách làm việc.' },
      { key: 'commonErrors', header: 'Lỗi hay gặp', type: 'longtext', width: 340, aliases: ['loi hay gap'], hint: 'Mỗi lỗi một dòng.' },
      { key: 'training', header: 'Training', type: 'longtext', width: 340, aliases: ['training', 'de xuat training'], hint: 'Mỗi đề xuất một dòng. Training là đề xuất của Lead.' },
      { key: 'absenceNote', header: 'Nghỉ / ghi chú', type: 'longtext', width: 260, aliases: ['nghi', 'nghi ghi chu', 'ghi chu'], hint: 'Ghi chú ngày nghỉ, đi muộn... (hiện trong kế hoạch tuần sau).' },
      { key: 'goals', header: 'Mục tiêu tuần sau', type: 'text', width: 220, aliases: ['muc tieu', 'muc tieu tuan sau'], hint: 'Ví dụ: ≥ 1.000 cuboid/ngày; Track Cao ≤ 12 (ngăn cách bằng dấu ;).' },
    ],
  },
  tracks: {
    key: 'tracks',
    label: 'Lỗi chung cả nhóm',
    description: 'Track rủi ro cao xuất hiện ở nhiều job. Cả nhóm cùng pre-label nên là lỗi gốc, chốt cách sửa một lần.',
    scope: 'free',
    columns: [
      { key: 'trackNo', header: 'Track', type: 'text', width: 80, aliases: ['track', 'track id'], hint: 'Mã track.' },
      { key: 'className', header: 'Class', type: 'text', width: 120, aliases: ['class', 'loai'], hint: 'vehicles, pedestrian, two-wheels...' },
      numberColumn('jobCount', 'Số job', 'Số job bị cảnh báo track này.', { aliases: ['so job', 'job'] }),
      { key: 'inJobs', header: 'Ở bài của', type: 'text', width: 260, aliases: ['o bai cua', 'bai cua', 'annotator'], hint: 'Tên những người có track này (ngăn cách dấu phẩy).' },
      { key: 'warnings', header: 'Cảnh báo', type: 'text', width: 100, aliases: ['canh bao', 'loai canh bao'], hint: 'Các loại cảnh báo, vd S H D.' },
      { key: 'symptom', header: 'Biểu hiện', type: 'longtext', width: 420, aliases: ['bieu hien', 'mo ta'], hint: 'Mô tả biểu hiện lỗi.' },
    ],
  },
  issues: {
    key: 'issues',
    label: 'Issue',
    description: 'Vấn đề cần Lead chốt. Trạng thái: Chờ chốt, Tạm thời, Đã chốt.',
    scope: 'free',
    columns: [
      { key: 'code', header: 'ID', type: 'text', width: 90, aliases: ['id', 'ma'], hint: 'Mã issue, vd ISS-12.' },
      { key: 'reporter', header: 'Người báo', type: 'text', width: 110, aliases: ['nguoi bao'], hint: 'Người báo issue.' },
      { key: 'title', header: 'Vấn đề', type: 'longtext', width: 320, aliases: ['van de'], hint: 'Mô tả vấn đề.' },
      { key: 'interim', header: 'Phương án tạm', type: 'longtext', width: 260, aliases: ['phuong an tam', 'phuong an'], hint: 'Cách xử lý tạm thời nếu có.' },
      { key: 'nextStep', header: 'Bước tiếp', type: 'longtext', width: 260, aliases: ['buoc tiep', 'buoc tiep theo'], hint: 'Việc cần làm tiếp theo.' },
      { key: 'status', header: 'Trạng thái', type: 'select', width: 120, options: ISSUE_STATUSES, aliases: ['trang thai'], hint: 'Chờ chốt / Tạm thời / Đã chốt.' },
      { key: 'priority', header: 'Ưu tiên', type: 'select', width: 90, options: PRIORITIES, aliases: ['uu tien'], hint: 'Cao / TB / Thấp.' },
    ],
  },
  actions: {
    key: 'actions',
    label: 'Kế hoạch hành động',
    description: 'Việc cần làm tuần tới, mỗi dòng một hạng mục.',
    scope: 'free',
    columns: [
      { key: 'title', header: 'Hạng mục', type: 'text', width: 220, aliases: ['hang muc', 'viec'], hint: 'Tên hạng mục.' },
      { key: 'detail', header: 'Nội dung', type: 'longtext', width: 480, aliases: ['noi dung', 'mo ta'], hint: 'Chi tiết hành động.' },
      { key: 'owner', header: 'Phụ trách', type: 'text', width: 130, aliases: ['phu trach', 'nguoi phu trach'], hint: 'Ví dụ: Lead, QC + Lead, Cả nhóm.' },
      { key: 'priority', header: 'Ưu tiên', type: 'select', width: 90, options: PRIORITIES, aliases: ['uu tien'], hint: 'Cao / TB / Thấp.' },
    ],
  },
};

export const SHEET_ORDER: SheetKey[] = ['production', 'qa', 'manual_qa', 'tracks', 'attitude', 'coaching', 'issues', 'actions'];

export function isSheetKey(value: string): value is SheetKey {
  return value in SHEETS;
}
