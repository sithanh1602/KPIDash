import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { HttpError } from '../../middleware/errors';

/** Bảng thô đọc từ file: hàng đầu là tiêu đề, các hàng sau là dữ liệu (đều là chuỗi). */
export interface RawTable {
  headers: string[];
  /** line = số dòng thật trong file (bắt đầu từ 2 cho dòng dữ liệu đầu tiên) */
  rows: { line: number; cells: string[] }[];
}

const DATA_SHEET_NAME = 'Dữ liệu';

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (cell.numFmt?.includes('%')) return String(Math.round(value * 10_000) / 100);
    // Làm tròn số thập phân để "1.234" không bị đọc nhầm thành 1234
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'x' : '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value && value.result !== undefined && value.result !== null) return String(value.result);
    if ('text' in value) return String(value.text);
  }
  return String(value);
}

function detectDelimiter(buffer: Buffer): string {
  const firstLine = buffer.toString('utf8', 0, 4000).split(/\r?\n/)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const char of firstLine) if (char in counts) counts[char as keyof typeof counts] += 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

export async function readTable(buffer: Buffer, fileName: string): Promise<RawTable> {
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet | undefined;
  const lower = fileName.toLowerCase();

  try {
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      sheet = await workbook.csv.read(Readable.from(buffer), {
        parserOptions: { delimiter: detectDelimiter(buffer) },
      });
    } else if (lower.endsWith('.xlsx')) {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      sheet = workbook.getWorksheet(DATA_SHEET_NAME) ?? workbook.worksheets[0];
    } else {
      throw new HttpError(400, 'Chỉ hỗ trợ file .xlsx hoặc .csv.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Không đọc được file. Hãy dùng file mẫu (.xlsx hoặc .csv UTF-8).');
  }
  if (!sheet || sheet.rowCount < 1) throw new HttpError(400, 'File không có dữ liệu.');

  const width = sheet.actualColumnCount || sheet.columnCount;
  const toCells = (row: ExcelJS.Row) => Array.from({ length: width }, (_, i) => cellText(row.getCell(i + 1)).replace(/^\uFEFF/, '').trim());

  const headers = toCells(sheet.getRow(1));
  const rows: RawTable['rows'] = [];
  for (let line = 2; line <= sheet.rowCount; line += 1) {
    const cells = toCells(sheet.getRow(line));
    if (cells.some(Boolean)) rows.push({ line, cells });
  }
  return { headers, rows };
}
