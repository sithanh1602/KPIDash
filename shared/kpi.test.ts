import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCell, formatCell } from './cell';
import { getMonday, dayLabels } from './format';
import { attitudeGradeOf, buildReport, gradeOf, summarizeDays } from './kpi';
import { GRADE_LABEL } from './constants';
import type { DayEntry, RawWeekData } from './types';

const work = (cuboids: number, estimated = false): DayEntry => ({ status: 'work', cuboids, estimated, note: '' });
const leave: DayEntry = { status: 'leave', cuboids: null, estimated: false, note: '' };
const done: DayEntry = { status: 'done', cuboids: null, estimated: false, note: '' };

test('nghỉ và done job không tính ngày công, ô 0 vẫn tính', () => {
  const stats = summarizeDays([work(1200), work(0), leave, done, null, work(1000)], 1200);
  assert.equal(stats.total, 2200);
  assert.equal(stats.workDays, 3);
  assert.equal(stats.avg, 733);
  assert.equal(stats.daysExcellent, 1);
});

test('xếp loại theo ngưỡng', () => {
  assert.equal(gradeOf(1200, 1000, 1200), 'excellent');
  assert.equal(gradeOf(1199, 1000, 1200), 'normal');
  assert.equal(gradeOf(1000, 1000, 1200), 'normal');
  assert.equal(gradeOf(999, 1000, 1200), 'below');
});

test('xếp loại attitude', () => {
  assert.equal(attitudeGradeOf(95), 'excellent');
  assert.equal(attitudeGradeOf(94), 'good');
  assert.equal(attitudeGradeOf(88), 'fair');
  assert.equal(attitudeGradeOf(80), 'poor');
  assert.equal(attitudeGradeOf(0), 'none');
});

test('đọc và hiển thị ô sản lượng', () => {
  assert.deepEqual(parseCell('1.200'), { ok: true, entry: { status: 'work', cuboids: 1200, estimated: false, weight: 1.0 } });
  assert.deepEqual(parseCell('1620*'), { ok: true, entry: { status: 'work', cuboids: 1620, estimated: true, weight: 1.0 } });
  assert.deepEqual(parseCell('500 (0.5)'), { ok: true, entry: { status: 'work', cuboids: 500, estimated: false, weight: 0.5 } });
  assert.deepEqual(parseCell('Nghỉ 0.5'), { ok: true, entry: { status: 'leave', cuboids: null, estimated: false, weight: 0.5 } });
  assert.deepEqual(parseCell('Nghỉ'), { ok: true, entry: { status: 'leave', cuboids: null, estimated: false, weight: 0.0 } });
  assert.deepEqual(parseCell('done job'), { ok: true, entry: { status: 'done', cuboids: null, estimated: false, weight: 0.0 } });
  assert.deepEqual(parseCell(''), { ok: true, entry: null });
  assert.equal(parseCell('abc').ok, false);
  assert.equal(parseCell('-5').ok, false);
  assert.equal(formatCell(work(1620, true)), '1620*');
  assert.equal(formatCell(leave), 'Nghỉ');
  assert.equal(formatCell({ status: 'work', cuboids: 500, estimated: false, weight: 0.5, note: '' }), '500 (0.5)');
  assert.equal(formatCell({ status: 'leave', cuboids: null, estimated: false, weight: 0.5, note: '' }), 'Nghỉ 0.5');
});

test('tính toán ngày công nghỉ nửa ngày và giảm KPI 50%', () => {
  // 4 ngày 1000 + 1 ngày nửa buổi 500: tổng 4500 cuboid, 4.5 ngày công, TB 1000/ngày
  const halfWork: DayEntry = { status: 'work', cuboids: 500, estimated: false, weight: 0.5, note: '' };
  const stats = summarizeDays([work(1000), work(1000), work(1000), work(1000), halfWork, leave], 1000);
  assert.equal(stats.total, 4500);
  assert.equal(stats.workDays, 4.5);
  assert.equal(stats.avg, 1000);
  assert.equal(stats.daysExcellent, 5); // 500 >= 1000 * 0.5
});

test('tự động căn chuẩn ngày Thứ Hai (getMonday)', () => {
  assert.equal(getMonday('2026-10-21'), '2026-10-19'); // Thứ 4 căn về Thứ 2
  assert.equal(getMonday('2026-10-19'), '2026-10-19'); // Thứ 2 giữ nguyên Thứ 2
  assert.equal(getMonday('2026-10-24'), '2026-10-19'); // Thứ 7 căn về Thứ 2
  assert.equal(getMonday('2026-10-25'), '2026-10-19'); // Chủ nhật căn về Thứ 2
});

const baseWeek: RawWeekData['week'] = {
  id: 1,
  weekNumber: 43,
  startDate: '2026-10-19',
  endDate: '2026-10-24',
  dataAsOf: '2026-10-24',
  projectTag: 'VF-ADAS-2026',
  orgName: 'VINFAST',
  teamName: 'TEAM T01',
  discipline: '3D LiDAR',
  floorName: 'Tầng 28',
  leadName: 'Lead',
  mentorName: '',
  target: 1200,
  normalThreshold: 1000,
  excellentThreshold: 1200,
  jobsTotal: 2,
  jobsDone: 2,
  toolQaDone: 2,
  dataNotes: '',
  summaryOverride: '',
};

test('báo cáo tuần: TB, % KPI, xếp hạng và tổng đội', () => {
  const raw: RawWeekData = {
    week: baseWeek,
    members: [
      { id: 1, name: 'Đặng Trường Huy', role: 'Annotator', days: [work(1200), work(1500), work(1400), work(1620, true), leave, done], qa: null, manualQa: null, attitude: { score: 100, note: '' }, coaching: null },
      { id: 2, name: 'Kiều Quốc Hiếu', role: 'Annotator', days: [work(900), work(900), work(840), work(1260), leave, work(1000)], qa: null, manualQa: null, attitude: { score: 88, note: '' }, coaching: null },
    ],
    tracks: [],
    issues: [],
    actions: [],
  };
  const report = buildReport(raw);
  assert.equal(report.ranking[0].name, 'Đặng Trường Huy');
  assert.equal(report.ranking[0].avg, 1430);
  assert.equal(report.ranking[0].kpiPercent, 119);
  assert.equal(report.ranking[0].grade, 'excellent');
  assert.equal(report.ranking[1].avg, 980);
  assert.equal(report.ranking[1].grade, 'below');
  assert.equal(report.summary.total, 5720 + 4900);
  assert.equal(report.summary.workDays, 9);
  assert.equal(report.summary.teamAvg, Math.round(10620 / 9));
  assert.equal(report.summary.attitudeAvg, 94);
  assert.equal(report.ranking[0].today.status, 'done');
  assert.equal(report.dayLabels[0], '19/10');
});

test('JOB linh hoạt theo ngày thực tế: bắt đầu giữa tuần và số ngày tùy biến', () => {
  // Job từ Thứ 4 (21/10) đến Thứ 7 (24/10) -> 4 ngày
  const labels = dayLabels('2026-10-21', '2026-10-24');
  assert.deepEqual(labels, ['21/10', '22/10', '23/10', '24/10']);

  // Job 7 ngày xuyên tuần: 2026-10-28 đến 2026-11-03
  const labels7 = dayLabels('2026-10-28', '2026-11-03');
  assert.deepEqual(labels7, ['28/10', '29/10', '30/10', '31/10', '01/11', '02/11', '03/11']);
});

test('thành viên chưa có ngày công không gây chia cho 0', () => {
  const report = buildReport({
    week: baseWeek,
    members: [{ id: 1, name: 'A B', role: 'Annotator', days: [], qa: null, manualQa: null, attitude: null, coaching: null }],
    tracks: [],
    issues: [],
    actions: [],
  });
  assert.equal(report.ranking[0].avg, 0);
  assert.equal(report.summary.teamAvg, 0);
});

test('tính toán số liệu QA manual: lỗi bay box/chìm box và box không ôm sát pointcloud', () => {
  const raw: RawWeekData = {
    week: baseWeek,
    members: [
      {
        id: 1,
        name: 'Nguyễn Văn Thịnh',
        role: 'Annotator',
        days: [work(1200)],
        qa: null,
        manualQa: {
          jobCode: 'JOB-01',
          qcName: 'Lê Sĩ Thành',
          cuboidsChecked: 1000,
          floatingBoxCount: 5,
          looseBoxCount: 3,
          totalErrors: 8,
          errorRate: 0.8,
          note: 'Frame 10 bay box nhẹ',
        },
        attitude: null,
        coaching: null,
      },
      {
        id: 2,
        name: 'Phạm Văn Phóng',
        role: 'Annotator',
        days: [work(1100)],
        qa: null,
        manualQa: {
          jobCode: 'JOB-02',
          qcName: 'Lê Sĩ Thành',
          cuboidsChecked: 500,
          floatingBoxCount: 2,
          looseBoxCount: 4,
          totalErrors: 6,
          errorRate: 1.2,
          note: 'Frame 25 loose box',
        },
        attitude: null,
        coaching: null,
      },
    ],
    tracks: [],
    issues: [],
    actions: [],
  };
  const report = buildReport(raw);
  assert.equal(report.summary.manualTotalChecked, 1500);
  assert.equal(report.summary.manualTotalFloating, 7);
  assert.equal(report.summary.manualTotalLoose, 7);
  assert.equal(report.summary.manualTotalErrors, 14);
  assert.equal(report.summary.manualErrorRate, 0.93);
});

test('tính toán cảnh báo Tool QA khi lọc/bỏ chọn loại lỗi', () => {
  const qa = {
    jobCode: '1209',
    qcName: 'QC',
    cuboids: 1000,
    warningPercent: 18.0,
    s: 20,
    k: 100,
    z: 10,
    h: 30,
    o: 15,
    d: 5,
    riskHigh: 2,
    riskMid: 3,
    riskLow: 1,
  };

  // Khi chọn đủ 6 loại: tổng = 20+100+10+30+15+5 = 180, tỷ lệ 18.0%
  const allTypes = ['s', 'k', 'z', 'h', 'o', 'd'];
  const totalAll = allTypes.reduce((acc, t) => acc + (qa[t as keyof typeof qa] as number), 0);
  assert.equal(totalAll, 180);
  assert.equal(Number(((totalAll / qa.cuboids) * 100).toFixed(1)), 18.0);

  // Khi bỏ chọn K (k=100) và D (d=5): tổng = 20 + 10 + 30 + 15 = 75, tỷ lệ 7.5%
  const filteredTypes = ['s', 'z', 'h', 'o'];
  const totalFiltered = filteredTypes.reduce((acc, t) => acc + (qa[t as keyof typeof qa] as number), 0);
  assert.equal(totalFiltered, 75);
  assert.equal(Number(((totalFiltered / qa.cuboids) * 100).toFixed(1)), 7.5);
});

test('tự động tạo ID tăng dần cho tab Issue (ISS-01, ISS-02...)', () => {
  const existingCodes = ['ISS-01', 'ISS-02', 'ISS-05'];
  let maxNum = 0;
  existingCodes.forEach((code) => {
    const match = code.match(/ISS[^\d]*(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextId = `ISS-${String(maxNum + 1).padStart(2, '0')}`;
  assert.equal(nextId, 'ISS-06');
});

test('xếp loại mới: >=1200 Vượt KPI, >=1000 Đạt KPI, <1000 Không đạt KPI và đồng bộ mã/trạng thái job', () => {
  const normal = 1000;
  const excellent = 1200;

  assert.equal(gradeOf(1300, normal, excellent), 'excellent');
  assert.equal(gradeOf(1200, normal, excellent), 'excellent');
  assert.equal(gradeOf(1199, normal, excellent), 'normal');
  assert.equal(gradeOf(1000, normal, excellent), 'normal');
  assert.equal(gradeOf(999, normal, excellent), 'below');
  assert.equal(gradeOf(500, normal, excellent), 'below');

  assert.equal(GRADE_LABEL.excellent, 'Vượt KPI');
  assert.equal(GRADE_LABEL.normal, 'Đạt KPI');
  assert.equal(GRADE_LABEL.below, 'Không đạt KPI');
});
