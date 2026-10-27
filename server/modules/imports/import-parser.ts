import { normalizeText } from '../../../shared/text';
import { SHEETS, type ColumnDef, type SheetKey } from '../../../shared/sheets';
import type { ImportResult, SheetRow } from '../../../shared/types';
import { HttpError } from '../../middleware/errors';
import { RowError, validateRow } from '../sheets/sheet-rows';
import { readTable } from './table-reader';

/** Tìm cột của hệ thống ứng với một tiêu đề trong file (không phân biệt dấu/hoa thường). */
export function matchColumn(sheet: SheetKey, header: string): ColumnDef | undefined {
  const normalized = normalizeText(header.replace(/\(.*?\)/g, ''));
  if (!normalized) return undefined;
  return SHEETS[sheet].columns.find((column) => {
    const names = [column.header, column.key, ...(column.aliases ?? [])].map(normalizeText);
    // Cột ngày chấp nhận "T2 19/10"
    return names.some((n) => normalized === n || (column.type === 'cell' && normalized.startsWith(`${n} `)));
  });
}

/**
 * Đọc file Excel/CSV theo mẫu của bảng `sheet`.
 * Trả về các dòng hợp lệ (đã ghép thành viên) + danh sách lỗi theo dòng; không ghi gì vào DB.
 */
export async function parseImport(
  sheet: SheetKey,
  weekMembers: { id: number; name: string }[],
  buffer: Buffer,
  fileName: string,
): Promise<ImportResult> {
  const def = SHEETS[sheet];
  const table = await readTable(buffer, fileName);

  const columns = table.headers.map((header) => matchColumn(sheet, header));
  const used = new Set<string>();
  const mapped = columns.map((column) => {
    if (!column || used.has(column.key)) return undefined;
    used.add(column.key);
    return column;
  });

  const warnings = table.headers
    .filter((header, index) => header && !mapped[index])
    .map((header) => `Bỏ qua cột "${header}" (không có trong mẫu).`);

  const dataColumns = def.columns.filter((c) => !c.readOnly);
  if (def.scope === 'member' && !used.has('member')) {
    throw new HttpError(400, 'Không tìm thấy cột "Annotator" (họ tên thành viên) ở dòng đầu tiên của file.');
  }
  if (!dataColumns.some((c) => used.has(c.key))) {
    throw new HttpError(400, `Không nhận ra cột nào. Dòng đầu cần có: ${dataColumns.map((c) => c.header).join(', ')}. Hãy tải file mẫu.`);
  }

  const byName = new Map(weekMembers.map((m) => [normalizeText(m.name), m]));
  const seen = new Set<number>();
  const rows: SheetRow[] = [];
  const errors: ImportResult['errors'] = [];

  for (const { line, cells } of table.rows) {
    const values: Record<string, string> = {};
    mapped.forEach((column, index) => {
      if (column) values[column.key] = cells[index] ?? '';
    });

    let memberId: number | null = null;
    if (def.scope === 'member') {
      const name = values.member ?? '';
      if (!name) continue;
      const member = byName.get(normalizeText(name));
      if (!member) {
        errors.push({ line, message: `Không có thành viên "${name}" trong tuần này (thêm vào tuần trước khi import).` });
        continue;
      }
      if (seen.has(member.id)) {
        errors.push({ line, message: `Thành viên "${name}" xuất hiện nhiều lần.` });
        continue;
      }
      seen.add(member.id);
      memberId = member.id;
      values.member = member.name;
    }

    try {
      validateRow(sheet, values);
    } catch (error) {
      if (error instanceof RowError) {
        errors.push({ line, message: error.message });
        continue;
      }
      throw error;
    }
    rows.push({ memberId, values });
  }

  if (!rows.length && !errors.length) warnings.push('File không có dòng dữ liệu nào.');
  return { rows, errors, warnings };
}
