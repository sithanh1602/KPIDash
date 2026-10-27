import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCell, formatCell } from './cell';
import { attitudeGradeOf, buildReport, gradeOf, summarizeDays } from './kpi';
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
  assert.deepEqual(parseCell('1.200'), { ok: true, entry: { status: 'work', cuboids: 1200, estimated: false } });
  assert.deepEqual(parseCell('1620*'), { ok: true, entry: { status: 'work', cuboids: 1620, estimated: true } });
  assert.deepEqual(parseCell('Nghỉ'), { ok: true, entry: { status: 'leave', cuboids: null, estimated: false } });
  assert.deepEqual(parseCell('done job'), { ok: true, entry: { status: 'done', cuboids: null, estimated: false } });
  assert.deepEqual(parseCell(''), { ok: true, entry: null });
  assert.equal(parseCell('abc').ok, false);
  assert.equal(parseCell('-5').ok, false);
  assert.equal(formatCell(work(1620, true)), '1620*');
  assert.equal(formatCell(leave), 'Nghỉ');
});

const baseWeek: RawWeekData['week'] = {
  id: 1,
  weekNumber: 43,
  startDate: '2026-10-19',
  endDate: '2026-10-24',
  dataAsOf: '2026-10-24',
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
  assert.equal(report.dayLabels[0], 'T2 19/10');
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
