import ExcelJS from 'exceljs';
import { ATTITUDE_LABEL, GRADE_LABEL, QA_TYPES } from '../../../shared/constants';
import { fmtDate, fmtDayMonth, weekRangeLabel } from '../../../shared/format';
import { formatCell } from '../../../shared/cell';
import type { ReportSectionKey } from '../../../shared/report-sections';
import { splitLines } from '../../../shared/text';
import { filterMemberCoaching, filterTrack } from '../../../shared/qa';
import type { Grade, WeekReport } from '../../../shared/types';

/**
 * Xuất báo cáo tuần ra file Excel với định dạng font Arial,
 * màu sắc chuyên nghiệp, trực quan theo từng màn hình.
 */

const FONT_FAMILY = 'Arial';
const COLOR_HEADER_BG = 'FF1E293B'; // Slate 800
const COLOR_HEADER_TEXT = 'FFFFFFFF';
const COLOR_BORDER = 'FFCBD5E1'; // Slate 300

const GRADE_STYLE: Record<Grade, { bg: string; text: string }> = {
  excellent: { bg: 'FFD1FAE5', text: 'FF065F46' }, // Xanh ngọc
  normal: { bg: 'FFFEF3C7', text: 'FF92400E' },    // Vàng cam
  below: { bg: 'FFFEE2E2', text: 'FF991B1B' },     // Đỏ hồng
};

function applyArial(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ showGridLines: true }];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.font) cell.font = { name: FONT_FAMILY, size: 10 };
      else cell.font = { ...cell.font, name: FONT_FAMILY };
    });
  });
}

function titleRows(sheet: ExcelJS.Worksheet, report: WeekReport, title: string, width: number) {
  const { week } = report;
  const orgLine = `${week.orgName} · ${week.teamName} ${week.discipline} · JOB ${week.weekNumber} (${weekRangeLabel(week.startDate, week.endDate)})`;
  const subLine = `Số liệu chốt đến ${fmtDate(week.dataAsOf)}${week.leadName ? ` · Team Lead: ${week.leadName}` : ''}`;

  const r1 = sheet.addRow([orgLine]);
  const r2 = sheet.addRow([title]);
  const r3 = sheet.addRow([subLine]);
  sheet.addRow([]);

  r1.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0284C7' } };
  r2.font = { name: FONT_FAMILY, size: 15, bold: true, color: { argb: 'FF0F172A' } };
  r3.font = { name: FONT_FAMILY, size: 9.5, italic: true, color: { argb: 'FF64748B' } };

  r1.height = 18;
  r2.height = 24;
  r3.height = 16;

  for (let r = 1; r <= 3; r += 1) {
    sheet.mergeCells(r, 1, r, Math.max(2, width));
  }
}

function headerRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR_BORDER } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  return row;
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function fillCell(cell: ExcelJS.Cell, bgArgb: string, textArgb?: string, bold = false) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  if (textArgb || bold) {
    cell.font = {
      name: FONT_FAMILY,
      size: 10,
      bold: bold || cell.font?.bold,
      color: textArgb ? { argb: textArgb } : cell.font?.color,
    };
  }
}

function borderAll(sheet: ExcelJS.Worksheet, fromRow: number) {
  for (let r = fromRow; r <= sheet.rowCount; r += 1) {
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } },
      };
    });
  }
}

const builders: Record<
  ReportSectionKey,
  (wb: ExcelJS.Workbook, report: WeekReport, selectedQaTypes?: string[]) => void
> = {
  overview(wb, report) {
    const sheet = wb.addWorksheet('01. Tổng quan');
    titleRows(sheet, report, 'BÁO CÁO TỔNG QUAN HIỆU SUẤT & CHẤT LƯỢNG', 4);
    const s = report.summary;

    headerRow(sheet, ['Chỉ số chính', 'Giá trị', 'Đơn vị / Mục tiêu', 'Ghi chú']);
    const metrics = [
      ['Năng suất trung bình (TB/ngày)', s.teamAvg, 'cuboid / ngày', s.teamAvg >= report.week.target ? 'Vượt chỉ tiêu' : 'Cần bám sát'],
      ['Tỷ lệ hoàn thành % KPI team', `${s.kpiPercent}%`, `Target: ${report.week.target}`, s.kpiPercent >= 100 ? 'ĐẠT' : 'CHƯA ĐẠT'],
      ['Tổng sản lượng cuboid toàn đội', s.total, 'cuboid', `Trong ${s.workDays} ngày công có số`],
      ['Tổng số ngày công thực tế', s.workDays, 'ngày công', 'Đã loại trừ ngày Nghỉ & Done Job'],
      ['Tiến độ hoàn thành Job', `${report.week.jobsDone} / ${report.week.jobsTotal}`, 'Job', report.week.jobsDone === report.week.jobsTotal ? 'Hoàn tất' : 'Đang xử lý'],
      ['Số lượng Track rủi ro cao (Tool QA)', s.riskHigh, 'track', 'Cần QC rà soát kỹ'],
      ['Số Issue chờ chốt', `${s.issuesOpen} / ${s.issuesTotal}`, 'issue', 'Đang phối hợp với khách hàng'],
      ['Số ngày-người Xuất sắc (≥ 1.200)', s.cellsExcellent, 'lượt', 'Đạt mức năng suất cao nhất'],
      ['Số ngày-người Bình thường (1.000–1.199)', s.cellsNormal, 'lượt', 'Đạt định mức chuẩn'],
      ['Số ngày-người Dưới ngưỡng (< 1.000)', s.cellsBelow, 'lượt', 'Đưa vào danh sách đào tạo'],
    ];

    metrics.forEach(([label, val, unit, note], idx) => {
      const row = sheet.addRow([label, val, unit, note]);
      row.height = 20;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(2).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0284C7' } };
      row.getCell(3).alignment = { horizontal: 'center' };
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          if (!c.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });

    sheet.addRow([]);
    const execHeader = headerRow(sheet, ['TÓM TẮT ĐIỀU HÀNH & KẾT LUẬN']);
    execHeader.getCell(1).alignment = { horizontal: 'left' };
    sheet.mergeCells(execHeader.number, 1, execHeader.number, 4);

    s.executive.forEach((line) => {
      const row = sheet.addRow([line]);
      sheet.mergeCells(row.number, 1, row.number, 4);
      row.alignment = { wrapText: true, vertical: 'middle' };
      row.height = 28;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, italic: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });

    sheet.addRow([]);
    headerRow(sheet, ['Điểm nổi bật', 'Chỉ số', 'Đối tượng', 'Chi tiết']);
    s.highlights.forEach((h) => {
      const row = sheet.addRow([h.label, `${h.value} ${h.unit}`.trim(), h.title, h.detail]);
      row.height = 22;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF059669' } };
      row.getCell(2).alignment = { horizontal: 'center' };
    });

    setWidths(sheet, [36, 18, 30, 60]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  kpi(wb, report) {
    const sheet = wb.addWorksheet('02. KPI theo ngày');
    const cols = report.dayLabels.length + 7;
    titleRows(sheet, report, 'BẢNG THEO DÕI SẢN LƯỢNG & KPI THEO NGÀY (T2–T7)', cols);
    headerRow(sheet, ['Thành viên', 'Mã Job', 'Trạng thái Job', ...report.dayLabels, 'Tổng Job', 'TB / ngày', '% KPI', 'Xếp loại']);

    for (const m of report.members) {
      const row = sheet.addRow([
        m.name,
        m.jobCode || '–',
        m.jobStatus || 'Chưa hoàn thành',
        ...m.days.map((d) => formatCell(d) || '–'),
        m.total,
        m.avg,
        `${m.kpiPercent}%`,
        GRADE_LABEL[m.grade],
      ]);
      row.height = 22;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).font = { name: FONT_FAMILY, size: 10 };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      
      const statusCell = row.getCell(3);
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (m.jobStatus === 'Hoàn Thành') {
        fillCell(statusCell, 'FFD1FAE5', 'FF065F46', true);
      } else {
        fillCell(statusCell, 'FFF1F5F9', 'FF64748B', false);
      }

      m.days.forEach((d, i) => {
        const cell = row.getCell(i + 4);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (d?.status === 'work' && d.cuboids !== null) {
          const g: Grade = d.cuboids >= report.week.excellentThreshold ? 'excellent' : d.cuboids >= report.week.normalThreshold ? 'normal' : 'below';
          const style = GRADE_STYLE[g];
          fillCell(cell, style.bg, style.text, g === 'excellent');
        } else if (d?.status === 'done') {
          fillCell(cell, 'FFEDE9FE', 'FF5B21B6', true); // Tím nhạt
        } else if (d?.status === 'leave') {
          fillCell(cell, 'FFF1F5F9', 'FF64748B', false); // Xám
        }
      });

      // Tổng & TB & % KPI
      row.getCell(cols - 3).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(cols - 3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(cols - 2).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(cols - 2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(cols - 1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(cols - 1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Xếp loại
      const gradeCell = row.getCell(cols);
      const style = GRADE_STYLE[m.grade];
      fillCell(gradeCell, style.bg, style.text, true);
      gradeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    sheet.addRow([]);
    const noteRow = sheet.addRow([`Ghi chú: Ô là cuboid hoàn thành; * = ước tính. Nghỉ và Done Job không tính vào ngày công. % KPI = TB / ${report.week.target}.`]);
    noteRow.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FF64748B' } };
    sheet.mergeCells(noteRow.number, 1, noteRow.number, cols);

    setWidths(sheet, [26, 14, 16, ...report.dayLabels.map(() => 12), 12, 12, 11, 15]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  ranking(wb, report) {
    const sheet = wb.addWorksheet('03. Bảng xếp hạng');
    titleRows(sheet, report, 'BẢNG XẾP HẠNG THÀNH VIÊN THEO SẢN LƯỢNG TRUNG BÌNH', 8);
    headerRow(sheet, ['Thứ hạng', 'Họ và tên', 'TB / ngày (cuboid)', 'Tổng sản lượng', 'Ngày công', '% Đạt KPI', 'Track rủi ro cao', 'Xếp loại']);

    for (const m of report.ranking) {
      const row = sheet.addRow([
        m.rank === 1 ? '🥇 Hạng 1' : m.rank === 2 ? '🥈 Hạng 2' : m.rank === 3 ? '🥉 Hạng 3' : `#${m.rank}`,
        m.name,
        m.avg,
        m.total,
        m.workDays,
        `${m.kpiPercent}%`,
        m.qa?.riskHigh ?? 0,
        GRADE_LABEL[m.grade],
      ]);
      row.height = 22;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0284C7' } };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

      const gradeCell = row.getCell(8);
      const style = GRADE_STYLE[m.grade];
      fillCell(gradeCell, style.bg, style.text, true);
      gradeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    setWidths(sheet, [12, 28, 20, 16, 12, 14, 18, 16]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  quality(wb, report, selectedQaTypes?: string[]) {
    const sheet = wb.addWorksheet('04. Chất lượng QA');
    const activeKeys = new Set(
      selectedQaTypes && selectedQaTypes.length > 0 ? selectedQaTypes : QA_TYPES.map((t) => t.key),
    );
    const isFiltered = activeKeys.size < QA_TYPES.length;

    const headers = [
      'Annotator',
      'Mã Job',
      'Tổng Cuboid',
      isFiltered ? '% Cảnh báo (Đã lọc)' : '% Cảnh báo',
      ...QA_TYPES.map((t) => (activeKeys.has(t.key) ? t.short : `${t.short} (bỏ qua)`)),
      'Rủi ro Cao',
      'Rủi ro TB',
      'Rủi ro Thấp',
      'Người QC',
    ];
    titleRows(sheet, report, 'THỐNG KÊ CẢNH BÁO TOOL QA THEO THÀNH VIÊN', headers.length);

    if (isFiltered) {
      const activeLabels = QA_TYPES.filter((t) => activeKeys.has(t.key)).map((t) => t.short).join(', ');
      const ignoredLabels = QA_TYPES.filter((t) => !activeKeys.has(t.key)).map((t) => `${t.short} (${t.label})`).join(', ');
      const noteRow = sheet.addRow([`* Lưu ý: Tỷ lệ % cảnh báo được tính theo các lỗi đã chọn: [${activeLabels}]. Đã bỏ qua: [${ignoredLabels}].`]);
      sheet.mergeCells(noteRow.number, 1, noteRow.number, headers.length);
      noteRow.getCell(1).font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FFD97706' } };
    }

    headerRow(sheet, headers);

    for (const m of report.members) {
      const q = m.qa;
      if (!q) continue;

      const activeWarnings = QA_TYPES.reduce((acc, t) => {
        return activeKeys.has(t.key) ? acc + (Number(q[t.key as keyof typeof q]) || 0) : acc;
      }, 0);
      const dynamicWarningPercent = q.cuboids > 0 ? activeWarnings / q.cuboids : (q.warningPercent / 100);

      const row = sheet.addRow([
        m.name,
        q.jobCode,
        q.cuboids,
        dynamicWarningPercent,
        q.s,
        q.k,
        q.z,
        q.h,
        q.o,
        q.d,
        q.riskHigh,
        q.riskMid,
        q.riskLow,
        q.qcName,
      ]);
      row.height = 20;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(4).numFmt = '0.0%';
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(4).font = { name: FONT_FAMILY, size: 10, bold: true };

      // Làm mờ và gạch ngang các loại lỗi bị bỏ qua
      QA_TYPES.forEach((t, idx) => {
        if (!activeKeys.has(t.key)) {
          const cell = row.getCell(5 + idx);
          cell.font = { name: FONT_FAMILY, size: 10, strike: true, color: { argb: 'FF94A3B8' } };
        }
      });

      // Tô cảnh báo rủi ro cao nếu có
      if (q.riskHigh > 0) {
        fillCell(row.getCell(11), 'FFFEE2E2', 'FF991B1B', true);
      }
    }

    sheet.addRow([]);
    const subH = headerRow(sheet, ['DANH SÁCH SHARED TRACK & CẢNH BÁO CHÉO']);
    sheet.mergeCells(subH.number, 1, subH.number, 6);
    subH.getCell(1).alignment = { horizontal: 'left' };

    headerRow(sheet, ['Mã Track', 'Loại Class', 'Số Job', 'Ở bài của', 'Tổng cảnh báo', 'Biểu hiện lỗi']);
    const activeQaList = selectedQaTypes && selectedQaTypes.length > 0 ? selectedQaTypes : QA_TYPES.map((t) => t.key);
    report.tracks.forEach((t) => {
      const dynamic = filterTrack(t, activeQaList);
      if (!dynamic.isVisible) return;
      const row = sheet.addRow([t.trackNo, t.className, t.jobCount, t.inJobs, dynamic.warningsText, dynamic.symptomText]);
      row.height = 20;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(5).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFDC2626' } };
      row.getCell(5).alignment = { horizontal: 'center' };
    });

    setWidths(sheet, [26, 14, 14, 14, 8, 8, 8, 8, 8, 8, 12, 12, 12, 22]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  manual_qa(wb, report) {
    const sheet = wb.addWorksheet('05. QA Manual');
    const headers = [
      'Annotator',
      'Mã Job',
      'Cuboid kiểm tra',
      'Bay box / Chìm box (Tím)',
      'Box không ôm sát pointcloud (Cyan)',
      'Tổng lỗi',
      'Tỷ lệ lỗi %',
      'Người QC',
      'Ghi chú chi tiết frame lỗi',
    ];
    titleRows(
      sheet,
      report,
      `CHẤT LƯỢNG KIỂM TRA THỦ CÔNG (MANUAL QC) · TỶ LỆ LỖI TOÀN ĐỘI: ${report.summary.manualErrorRate.toString().replace('.', ',')}%`,
      headers.length,
    );
    const hRow = headerRow(sheet, headers);
    fillCell(hRow.getCell(4), 'FF7C3AED', 'FFFFFFFF', true);
    fillCell(hRow.getCell(5), 'FF0891B2', 'FFFFFFFF', true);

    for (const m of report.members) {
      const q = m.manualQa;
      if (!q) continue;
      const row = sheet.addRow([
        m.name,
        q.jobCode,
        q.cuboidsChecked,
        q.floatingBoxCount,
        q.looseBoxCount,
        q.totalErrors,
        q.errorRate / 100,
        q.qcName,
        q.note || '–',
      ]);
      row.height = 22;
      row.alignment = { wrapText: true, vertical: 'middle' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(7).numFmt = '0.0%';
      row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true };

      if (q.floatingBoxCount > 0) {
        fillCell(row.getCell(4), 'FFF3E8FF', 'FF6B21A8', true);
      }
      if (q.looseBoxCount > 0) {
        fillCell(row.getCell(5), 'FFE0F2FE', 'FF0369A1', true);
      }
      if (q.totalErrors > 0) {
        fillCell(row.getCell(6), 'FFFEE2E2', 'FF991B1B', true);
      }
    }

    const summaryRow = sheet.addRow([
      'TOÀN ĐỘI',
      '–',
      report.summary.manualTotalChecked,
      report.summary.manualTotalFloating,
      report.summary.manualTotalLoose,
      report.summary.manualTotalErrors,
      report.summary.manualErrorRate / 100,
      '–',
      'Tổng kết lỗi thủ công trong tuần',
    ]);
    summaryRow.height = 24;
    summaryRow.alignment = { wrapText: true, vertical: 'middle' };
    summaryRow.font = { name: FONT_FAMILY, size: 10, bold: true };
    fillCell(summaryRow.getCell(1), 'FFF1F5F9', 'FF0F172A', true);
    fillCell(summaryRow.getCell(4), 'FFF3E8FF', 'FF6B21A8', true);
    fillCell(summaryRow.getCell(5), 'FFE0F2FE', 'FF0369A1', true);
    summaryRow.getCell(7).numFmt = '0.0%';
    summaryRow.getCell(7).alignment = { horizontal: 'center' };

    // Bảng tổng hợp lỗi thường gặp (Manual QC)
    sheet.addRow([]);
    const subH = headerRow(sheet, ['BẢNG TỔNG HỢP LỖI THƯỜNG GẶP (MANUAL QC DỰA TRÊN DỮ LIỆU ĐÃ ĐIỀN)']);
    sheet.mergeCells(subH.number, 1, subH.number, 9);
    subH.getCell(1).alignment = { horizontal: 'left' };

    headerRow(sheet, [
      'Nhóm lỗi thường gặp',
      'Mã màu quy ước',
      'Số lượng lỗi',
      'Tỷ lệ / Tổng lỗi',
      'Tỷ lệ / Cuboid soi',
      'Số annotator gặp',
      'Người gặp nhiều nhất',
      'Hướng dẫn khắc phục chuẩn',
      'Ghi chú nghiệp vụ',
    ]);

    const totalErrors = report.summary.manualTotalErrors || 0;
    const totalChecked = report.summary.manualTotalChecked || 1;
    const totalFloating = report.summary.manualTotalFloating || 0;
    const totalLoose = report.summary.manualTotalLoose || 0;

    const floatingMembers = report.members.filter((m) => (m.manualQa?.floatingBoxCount || 0) > 0);
    const looseMembers = report.members.filter((m) => (m.manualQa?.looseBoxCount || 0) > 0);

    const topFloating = [...floatingMembers].sort(
      (a, b) => (b.manualQa?.floatingBoxCount || 0) - (a.manualQa?.floatingBoxCount || 0),
    )[0];
    const topLoose = [...looseMembers].sort(
      (a, b) => (b.manualQa?.looseBoxCount || 0) - (a.manualQa?.looseBoxCount || 0),
    )[0];

    const rowFloat = sheet.addRow([
      'Lỗi bay box / Chìm box',
      '#A855F7 (Màu tím)',
      totalFloating,
      totalErrors > 0 ? totalFloating / totalErrors : 0,
      totalChecked > 0 ? totalFloating / totalChecked : 0,
      `${floatingMembers.length} / ${report.members.length}`,
      topFloating ? `${topFloating.name} (${topFloating.manualQa?.floatingBoxCount} lỗi)` : '–',
      'Căn chỉnh cao độ mặt sàn Lidar; soi kỹ chùm tia tiếp đất bánh xe hoặc chân người, tránh hạ box quá sâu.',
      'Sai lệch cao độ Z',
    ]);
    rowFloat.height = 24;
    rowFloat.alignment = { wrapText: true, vertical: 'middle' };
    rowFloat.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF7C3AED' } };
    fillCell(rowFloat.getCell(2), 'FFF3E8FF', 'FF6B21A8', true);
    rowFloat.getCell(3).alignment = { horizontal: 'right' };
    rowFloat.getCell(4).numFmt = '0.0%';
    rowFloat.getCell(4).alignment = { horizontal: 'center' };
    rowFloat.getCell(5).numFmt = '0.0%';
    rowFloat.getCell(5).alignment = { horizontal: 'center' };

    const rowLoose = sheet.addRow([
      'Lỗi box không ôm sát pointcloud',
      '#06B6D4 (Màu cyan)',
      totalLoose,
      totalErrors > 0 ? totalLoose / totalErrors : 0,
      totalChecked > 0 ? totalLoose / totalChecked : 0,
      `${looseMembers.length} / ${report.members.length}`,
      topLoose ? `${topLoose.name} (${topLoose.manualQa?.looseBoxCount} lỗi)` : '–',
      'Thu nhỏ viền 3D box ôm khít chùm điểm ngoài cùng; không để dư khoảng trống ở đuôi/mui xe và hai bên sườn.',
      'Box lỏng / dư khoảng trống',
    ]);
    rowLoose.height = 24;
    rowLoose.alignment = { wrapText: true, vertical: 'middle' };
    rowLoose.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0891B2' } };
    fillCell(rowLoose.getCell(2), 'FFE0F2FE', 'FF0369A1', true);
    rowLoose.getCell(3).alignment = { horizontal: 'right' };
    rowLoose.getCell(4).numFmt = '0.0%';
    rowLoose.getCell(4).alignment = { horizontal: 'center' };
    rowLoose.getCell(5).numFmt = '0.0%';
    rowLoose.getCell(5).alignment = { horizontal: 'center' };

    setWidths(sheet, [26, 18, 16, 16, 16, 16, 24, 45, 30]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  coaching(wb, report, selectedQaTypes?: string[]) {
    const sheet = wb.addWorksheet('06. Coaching & Issue');
    titleRows(sheet, report, 'KẾ HOẠCH KÈM CẶP 1-1 VÀ THEO DÕI ISSUE DỰ ÁN', 6);
    headerRow(sheet, ['Thành viên', 'Xếp loại & TB', 'Phong cách gán nhãn', 'Lỗi hay gặp', 'Training đề xuất', 'Mục tiêu tiếp theo']);

    const activeQaList = selectedQaTypes && selectedQaTypes.length > 0 ? selectedQaTypes : QA_TYPES.map((t) => t.key);

    for (const m of report.ranking) {
      const c = m.coaching;
      const filtered = filterMemberCoaching(c, activeQaList);
      const row = sheet.addRow([
        m.name,
        `${GRADE_LABEL[m.grade]} (${m.avg})`,
        c?.style ?? '–',
        filtered.commonErrors.join('\n') || '–',
        filtered.training.join('\n') || '–',
        filtered.goals || c?.goals || '–',
      ]);
      row.alignment = { wrapText: true, vertical: 'top' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      const style = GRADE_STYLE[m.grade];
      fillCell(row.getCell(2), style.bg, style.text, true);
    }

    sheet.addRow([]);
    const issueTitle = headerRow(sheet, ['DANH SÁCH ISSUE ĐANG MỞ (CHỜ CHỐT / TẠM THỜI)']);
    sheet.mergeCells(issueTitle.number, 1, issueTitle.number, 6);
    issueTitle.getCell(1).alignment = { horizontal: 'left' };

    headerRow(sheet, ['Mã Issue', 'Người báo', 'Tiêu đề vấn đề', 'Phương án tạm', 'Bước tiếp theo', 'Trạng thái & Ưu tiên']);
    report.issues.forEach((i) => {
      const row = sheet.addRow([i.code, i.reporter, i.title, i.interim, i.nextStep, `${i.status} · ${i.priority}`]);
      row.alignment = { wrapText: true, vertical: 'top' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      if (i.status === 'Chờ chốt') {
        fillCell(row.getCell(6), 'FFFEF3C7', 'FF92400E', true);
      }
    });

    sheet.addRow([]);
    const actionTitle = headerRow(sheet, ['KẾ HOẠCH HÀNH ĐỘNG TIẾP THEO']);
    sheet.mergeCells(actionTitle.number, 1, actionTitle.number, 4);
    actionTitle.getCell(1).alignment = { horizontal: 'left' };

    headerRow(sheet, ['Hạng mục', 'Nội dung chi tiết', 'Người phụ trách', 'Mức độ ưu tiên']);
    report.actions.forEach((a) => {
      const row = sheet.addRow([a.title, a.detail, a.owner, a.priority]);
      row.alignment = { wrapText: true, vertical: 'top' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
    });

    setWidths(sheet, [26, 24, 40, 40, 40, 24]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  attitude(wb, report) {
    const sheet = wb.addWorksheet('07. Đánh giá Attitude');
    titleRows(sheet, report, `ĐÁNH GIÁ THÁI ĐỘ & Ý THỨC · ĐIỂM TB TOÀN ĐỘI: ${report.summary.attitudeAvg.toString().replace('.', ',')} / 100`, 5);
    headerRow(sheet, ['Thứ hạng', 'Họ và tên', 'Điểm ý thức', 'Xếp loại', 'Ghi chú & Lý do trừ điểm']);

    const scored = [...report.members].filter((m) => m.attitude).sort((a, b) => b.attitude!.score - a.attitude!.score);
    scored.forEach((m, i) => {
      const att = m.attitude!;
      const row = sheet.addRow([i + 1, m.name, att.score, ATTITUDE_LABEL[att.grade], att.note || '–']);
      row.height = 22;
      row.alignment = { wrapText: true, vertical: 'middle' };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(2).font = { name: FONT_FAMILY, size: 10, bold: true };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(3).font = { name: FONT_FAMILY, size: 10, bold: true };

      const gradeCell = row.getCell(4);
      gradeCell.alignment = { horizontal: 'center' };
      if (att.score >= 95) {
        fillCell(gradeCell, 'FFD1FAE5', 'FF065F46', true);
      } else if (att.score >= 90) {
        fillCell(gradeCell, 'FFFEF3C7', 'FF92400E', true);
      } else {
        fillCell(gradeCell, 'FFFEE2E2', 'FF991B1B', true);
      }
    });

    setWidths(sheet, [10, 28, 14, 18, 80]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },
};

export async function buildReportXlsx(
  report: WeekReport,
  sections: ReportSectionKey[],
  selectedQaTypes?: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ADAS KPI';
  for (const key of sections) {
    if (builders[key]) {
      builders[key](workbook, report, selectedQaTypes);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildProjectReportXlsx(
  reports: WeekReport[],
  projectTag: string,
  selectedQaTypes?: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ADAS KPI';

  if (reports.length === 0) {
    const sheet = workbook.addWorksheet('Dự án');
    sheet.addRow([`Dự án ${projectTag} chưa có dữ liệu tuần nào.`]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // 1. Sheet Tổng hợp Lũy kế Dự án
  const summarySheet = workbook.addWorksheet('01. Lũy kế Dự án');
  const firstWeek = reports[0].week;
  const lastWeek = reports[reports.length - 1].week;
  const projectDateRange = `${fmtDayMonth(firstWeek.startDate)} - ${fmtDate(lastWeek.endDate)}`;

  const titleRow1 = summarySheet.addRow([`BÁO CÁO TỔNG HỢP TOÀN DỰ ÁN: ${projectTag.toUpperCase()}`]);
  const titleRow2 = summarySheet.addRow([`Thời gian: ${projectDateRange} · Tổng hợp ${reports.length} tuần báo cáo`]);
  summarySheet.addRow([]);

  titleRow1.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: 'FF0284C7' } };
  titleRow2.font = { name: FONT_FAMILY, size: 10, italic: true, color: { argb: 'FF64748B' } };

  const headers = [
    'Annotator',
    'Vai trò',
    'Tổng Cuboid',
    'Tổng ngày công',
    'TB / ngày công',
    '% KPI Dự án',
    'Số ngày Xuất sắc',
    'Xếp loại chung',
    'Tool QA Cảnh báo',
    'Bay/Chìm box (Tím)',
    'Không ôm sát (Cyan)',
    'Tổng lỗi QC soi tay',
  ];
  headerRow(summarySheet, headers);

  // Gom dữ liệu từng thành viên qua tất cả các tuần
  const memberMap = new Map<string, {
    name: string;
    role: string;
    totalCuboids: number;
    totalWorkDays: number;
    daysExcellent: number;
    qaWarnings: number;
    floating: number;
    loose: number;
  }>();

  let projectTarget = 1000;
  for (const rep of reports) {
    if (rep.week.target) projectTarget = rep.week.target;
    for (const m of rep.members) {
      const existing = memberMap.get(m.name) || {
        name: m.name,
        role: m.role,
        totalCuboids: 0,
        totalWorkDays: 0,
        daysExcellent: 0,
        qaWarnings: 0,
        floating: 0,
        loose: 0,
      };
      existing.totalCuboids += m.total;
      existing.totalWorkDays += m.workDays;
      existing.daysExcellent += m.daysExcellent;
      existing.qaWarnings += m.qaTotalWarnings;
      if (m.manualQa) {
        existing.floating += m.manualQa.floatingBoxCount || 0;
        existing.loose += m.manualQa.looseBoxCount || 0;
      }
      memberMap.set(m.name, existing);
    }
  }

  const aggregatedMembers = Array.from(memberMap.values()).map((m) => {
    const avg = m.totalWorkDays > 0 ? Math.round(m.totalCuboids / m.totalWorkDays) : 0;
    const kpiPercent = projectTarget > 0 ? Math.round((avg / projectTarget) * 100) : 0;
    const grade: Grade = avg >= 1000 ? 'excellent' : avg >= 800 ? 'normal' : 'below';
    return { ...m, avg, kpiPercent, grade, totalManual: m.floating + m.loose };
  }).sort((a, b) => b.totalCuboids - a.totalCuboids);

  for (const m of aggregatedMembers) {
    const row = summarySheet.addRow([
      m.name,
      m.role,
      m.totalCuboids,
      m.totalWorkDays,
      m.avg,
      m.kpiPercent / 100,
      m.daysExcellent,
      GRADE_LABEL[m.grade],
      m.qaWarnings,
      m.floating,
      m.loose,
      m.totalManual,
    ]);
    row.height = 20;
    row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
    row.getCell(6).numFmt = '0%';
    row.getCell(6).alignment = { horizontal: 'center' };
    const gradeCell = row.getCell(8);
    gradeCell.alignment = { horizontal: 'center' };
    const st = GRADE_STYLE[m.grade];
    fillCell(gradeCell, st.bg, st.text, true);
  }

  setWidths(summarySheet, [26, 14, 16, 16, 16, 14, 16, 16, 16, 18, 18, 18]);
  borderAll(summarySheet, 4);
  applyArial(summarySheet);

  // 2. Sheet Sản lượng từng JOB
  const weeklySheet = workbook.addWorksheet('02. Sản lượng từng JOB');
  const weekHeaders = ['Annotator', ...reports.map((r) => `JOB ${r.week.weekNumber} (${fmtDayMonth(r.week.startDate)})`), 'Tổng dự án', 'TB / ngày'];
  headerRow(weeklySheet, weekHeaders);

  for (const m of aggregatedMembers) {
    const weekValues = reports.map((r) => {
      const match = r.members.find((rm) => rm.name === m.name);
      return match ? match.total : 0;
    });
    const row = weeklySheet.addRow([m.name, ...weekValues, m.totalCuboids, m.avg]);
    row.height = 20;
    row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };
  }
  setWidths(weeklySheet, [26, ...reports.map(() => 16), 18, 16]);
  borderAll(weeklySheet, 1);
  applyArial(weeklySheet);

  // 3. Sheet Issues Dự án
  const issuesSheet = workbook.addWorksheet('03. Issues Dự án');
  headerRow(issuesSheet, ['JOB', 'Mã Issue', 'Người báo', 'Vấn đề', 'Phương án tạm', 'Bước tiếp theo', 'Trạng thái', 'Ưu tiên']);
  for (const r of reports) {
    for (const iss of r.issues) {
      const row = issuesSheet.addRow([
        `JOB ${r.week.weekNumber}`,
        iss.code,
        iss.reporter,
        iss.title,
        iss.interim,
        iss.nextStep,
        iss.status,
        iss.priority,
      ]);
      row.height = 20;
    }
  }
  setWidths(issuesSheet, [12, 12, 16, 36, 26, 26, 14, 10]);
  borderAll(issuesSheet, 1);
  applyArial(issuesSheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
