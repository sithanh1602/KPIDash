import ExcelJS from 'exceljs';
import { dayLabels } from '../../../shared/format';
import { SHEETS, type SheetKey } from '../../../shared/sheets';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111318' } } as const;

export interface TemplateInput {
  sheet: SheetKey;
  /** Nếu có: điền sẵn tên thành viên và ngày của tuần vào mẫu */
  startDate?: string;
  memberNames: string[];
}

function headersFor({ sheet, startDate }: TemplateInput): string[] {
  const labels = startDate ? dayLabels(startDate) : [];
  return SHEETS[sheet].columns.map((column) => {
    if (column.type === 'cell' && startDate) return labels[Number(column.key.slice(1))];
    return column.header;
  });
}

/** File mẫu .xlsx: sheet "Dữ liệu" để nhập + sheet "Hướng dẫn" mô tả từng cột. */
export async function buildTemplateXlsx(input: TemplateInput): Promise<Buffer> {
  const def = SHEETS[input.sheet];
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet('Dữ liệu', { views: [{ state: 'frozen', ySplit: 1 }] });

  data.columns = def.columns.map((column, index) => ({
    header: headersFor(input)[index],
    key: column.key,
    width: Math.max(10, Math.round((column.width ?? 100) / 7)),
  }));
  const header = data.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  if (def.scope === 'member') {
    input.memberNames.forEach((name, i) => {
      data.getCell(i + 2, 1).value = name;
    });
  }
  def.columns.forEach((column, index) => {
    if (column.type === 'longtext') data.getColumn(index + 1).alignment = { wrapText: true, vertical: 'top' };
    if (column.type === 'select' && column.options) {
      for (let row = 2; row <= 201; row += 1) {
        data.getCell(row, index + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${column.options.join(',')}"`],
        };
      }
    }
  });

  const guide = workbook.addWorksheet('Hướng dẫn');
  guide.columns = [
    { header: 'Cột', key: 'header', width: 24 },
    { header: 'Kiểu', key: 'type', width: 14 },
    { header: 'Cách nhập', key: 'hint', width: 100 },
  ];
  guide.getRow(1).font = { bold: true };
  const typeLabel = { text: 'Chữ', longtext: 'Chữ dài', number: 'Số', cell: 'Sản lượng', select: 'Chọn' } as const;
  def.columns.forEach((column, index) => {
    guide.addRow({
      header: headersFor(input)[index],
      type: typeLabel[column.type],
      hint: column.options ? `${column.hint} (${column.options.join(' / ')})` : column.hint,
    });
  });
  guide.addRow({});
  guide.addRow({ header: 'Lưu ý', hint: def.description });
  guide.addRow({ hint: 'Giữ nguyên dòng tiêu đề ở hàng 1. Cột có thể đổi thứ tự. Dòng trống sẽ bị bỏ qua.' });
  if (def.scope === 'member') guide.addRow({ hint: 'Tên ở cột Annotator phải trùng với thành viên đã thêm vào tuần.' });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** File mẫu .csv (UTF-8 có BOM để Excel đọc đúng tiếng Việt). */
export function buildTemplateCsv(input: TemplateInput): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [headersFor(input).map(quote).join(',')];
  if (SHEETS[input.sheet].scope === 'member') {
    for (const name of input.memberNames) lines.push([quote(name), ...Array(SHEETS[input.sheet].columns.length - 1).fill('')].join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
