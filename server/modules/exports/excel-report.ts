import ExcelJS from 'exceljs';
import { ATTITUDE_LABEL, GRADE_LABEL, QA_TYPES } from '../../../shared/constants';
import { fmtDate, weekRangeLabel } from '../../../shared/format';
import { formatCell } from '../../../shared/cell';
import type { ReportSectionKey } from '../../../shared/report-sections';
import { splitLines } from '../../../shared/text';
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
  const orgLine = `${week.orgName} · ${week.teamName} ${week.discipline} · Tuần ${week.weekNumber} (${weekRangeLabel(week.startDate, week.endDate)})`;
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

const builders: Record<ReportSectionKey, (wb: ExcelJS.Workbook, report: WeekReport) => void> = {
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
    const execHeader = headerRow(sheet, ['TÓM TẮT ĐIỀU HÀNH & KẾT LUẬN TUẦN']);
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
    const cols = report.dayLabels.length + 5;
    titleRows(sheet, report, 'BẢNG THEO DÕI SẢN LƯỢNG & KPI THEO NGÀY (T2–T7)', cols);
    headerRow(sheet, ['Thành viên', ...report.dayLabels, 'Tổng tuần', 'TB / ngày', '% KPI', 'Xếp loại']);

    for (const m of report.members) {
      const row = sheet.addRow([
        m.name,
        ...m.days.map((d) => formatCell(d) || '–'),
        m.total,
        m.avg,
        `${m.kpiPercent}%`,
        GRADE_LABEL[m.grade],
      ]);
      row.height = 22;
      row.getCell(1).font = { name: FONT_FAMILY, size: 10, bold: true };

      m.days.forEach((d, i) => {
        const cell = row.getCell(i + 2);
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

    setWidths(sheet, [26, ...report.dayLabels.map(() => 12), 12, 12, 11, 15]);
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

  quality(wb, report) {
    const sheet = wb.addWorksheet('04. Chất lượng QA');
    const headers = ['Annotator', 'Mã Job', 'Tổng Cuboid', '% Cảnh báo', ...QA_TYPES.map((t) => t.short), 'Rủi ro Cao', 'Rủi ro TB', 'Rủi ro Thấp', 'Người QC'];
    titleRows(sheet, report, 'THỐNG KÊ CẢNH BÁO TOOL QA THEO THÀNH VIÊN', headers.length);
    headerRow(sheet, headers);

    for (const m of report.members) {
      const q = m.qa;
      if (!q) continue;
      const row = sheet.addRow([
        m.name,
        q.jobCode,
        q.cuboids,
        q.warningPercent / 100,
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
    report.tracks.forEach((t) => {
      const row = sheet.addRow([t.trackNo, t.className, t.jobCount, t.inJobs, t.warnings, t.symptom]);
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

    setWidths(sheet, [26, 14, 18, 26, 32, 14, 14, 22, 50]);
    borderAll(sheet, 5);
    applyArial(sheet);
  },

  coaching(wb, report) {
    const sheet = wb.addWorksheet('06. Coaching & Issue');
    titleRows(sheet, report, 'KẾ HOẠCH KÈM CẶP 1-1 VÀ THEO DÕI ISSUE DỰ ÁN', 6);
    headerRow(sheet, ['Thành viên', 'Xếp loại & TB', 'Phong cách gán nhãn', 'Lỗi hay gặp', 'Training đề xuất', 'Mục tiêu tuần tới']);

    for (const m of report.ranking) {
      const c = m.coaching;
      const row = sheet.addRow([
        m.name,
        `${GRADE_LABEL[m.grade]} (${m.avg})`,
        c?.style ?? '–',
        splitLines(c?.commonErrors ?? '').join('\n') || '–',
        splitLines(c?.training ?? '').join('\n') || '–',
        c?.goals ?? '–',
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
    const actionTitle = headerRow(sheet, ['KẾ HOẠCH HÀNH ĐỘNG TUẦN TIẾP THEO']);
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

export async function buildReportXlsx(report: WeekReport, sections: ReportSectionKey[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ADAS KPI';
  for (const key of sections) {
    if (builders[key]) builders[key](workbook, report);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
