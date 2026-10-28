import { DAY_COUNT } from './constants';
import { dayLabels, diffDays, fmtDayMonth, fmtDecimal, fmtInt, weekdayLabel } from './format';
import { initialsOf, splitLines } from './text';
import type {
  AttitudeGrade,
  DayEntry,
  Grade,
  Highlight,
  RawMemberData,
  RawWeekData,
  ReportMember,
  ReportSummary,
  WeekReport,
} from './types';

/**
 * Công thức KPI (toàn bộ nghiệp vụ tính toán nằm ở file này, có test đi kèm).
 *
 *  - Ngày công = số ô có số cuboid, kể cả 0. "Nghỉ" và "Done job" không tính.
 *  - TB/ngày = tổng cuboid / ngày công, làm tròn.
 *  - % KPI = TB / mốc KPI × 100, làm tròn.
 *  - Xếp loại: ≥ ngưỡng xuất sắc | ≥ ngưỡng bình thường | còn lại dưới KPI.
 */

export function gradeOf(avg: number, normal: number, excellent: number): Grade {
  if (avg >= excellent) return 'excellent';
  if (avg >= normal) return 'normal';
  return 'below';
}

/** Attitude: ≥95 xuất sắc, 90–94 tốt, 85–89 khá, dưới 85 cần cải thiện, 0/chưa chấm = none */
export function attitudeGradeOf(score: number | null | undefined): AttitudeGrade {
  if (!score) return 'none';
  if (score >= 95) return 'excellent';
  if (score >= 90) return 'good';
  if (score >= 85) return 'fair';
  return 'poor';
}

export function summarizeDays(days: (DayEntry | null)[], excellentThreshold: number) {
  let total = 0;
  let workDays = 0;
  let daysExcellent = 0;
  for (const day of days) {
    if (day?.status === 'work' && day.cuboids !== null) {
      const weight = day.weight ?? (day.note?.includes('[0.5c]') ? 0.5 : 1.0);
      total += day.cuboids;
      workDays += weight;
      if (day.cuboids >= excellentThreshold * weight) daysExcellent += 1;
    }
  }
  const roundedWorkDays = Math.round(workDays * 10) / 10;
  return { total, workDays: roundedWorkDays, daysExcellent, avg: roundedWorkDays ? Math.round(total / roundedWorkDays) : 0 };
}

/** Tên gọi ngắn: tên cuối. "Đặng Trường Huy" → "Huy" */
const shortName = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;

const joinNames = (names: string[]) => names.join(', ');

function buildMember(raw: RawMemberData, week: RawWeekData['week']): ReportMember {
  const days = Array.from({ length: DAY_COUNT }, (_, i) => raw.days[i] ?? null);
  const stats = summarizeDays(days, week.excellentThreshold);
  const grade = gradeOf(stats.avg, week.normalThreshold, week.excellentThreshold);
  const qa = raw.qa;
  const qaTotalWarnings = qa ? qa.s + qa.k + qa.z + qa.h + qa.o + qa.d : 0;

  const risk = qa ? `${qa.riskHigh} track rủi ro cao` : '';
  const insight = {
    excellent: `Xuất sắc sản lượng${risk ? ` · ${risk} chờ QC` : ''}`,
    normal: `Đạt sản lượng${risk ? ` · ${risk} chờ QC` : ''}`,
    below: `Dưới KPI${risk ? ` và ${risk}` : ''} · kèm 1-1`,
  }[grade];

  const absence = raw.coaching ? splitLines(raw.coaching.absenceNote)[0] : undefined;
  const rankNote = [stats.workDays ? `${stats.daysExcellent}/${stats.workDays} ngày ≥ ${fmtInt(week.excellentThreshold)}` : 'Chưa có ngày công', absence]
    .filter(Boolean)
    .join(' · ');

  const asOfIndex = diffDays(week.startDate, week.dataAsOf);
  const todayEntry = asOfIndex >= 0 && asOfIndex < DAY_COUNT ? days[asOfIndex] : null;

  return {
    id: raw.id,
    name: raw.name,
    initials: initialsOf(raw.name),
    role: raw.role,
    days,
    total: stats.total,
    workDays: stats.workDays,
    avg: stats.avg,
    kpiPercent: week.target ? Math.round((stats.avg / week.target) * 100) : 0,
    grade,
    rank: 0,
    daysExcellent: stats.daysExcellent,
    qa,
    qaTotalWarnings,
    manualQa: raw.manualQa,
    attitude: raw.attitude
      ? { score: raw.attitude.score, note: raw.attitude.note, grade: attitudeGradeOf(raw.attitude.score) }
      : null,
    coaching: raw.coaching,
    insight,
    rankNote,
    today: {
      status: todayEntry?.status ?? 'none',
      cuboids: todayEntry?.cuboids ?? null,
      note: todayEntry?.note ?? '',
    },
  };
}

export function buildReport(raw: RawWeekData): WeekReport {
  const { week } = raw;
  const members = raw.members.map((m) => buildMember(m, week));

  const ranking = [...members].sort(
    (a, b) => b.avg - a.avg || b.total - a.total || a.name.localeCompare(b.name, 'vi'),
  );
  ranking.forEach((m, index) => {
    m.rank = index + 1;
  });

  const summary = buildSummary(raw, members, ranking);

  return {
    week,
    dayLabels: dayLabels(week.startDate),
    ranking,
    members,
    tracks: raw.tracks,
    issues: raw.issues,
    actions: raw.actions,
    summary,
  };
}

function buildSummary(raw: RawWeekData, members: ReportMember[], ranking: ReportMember[]): ReportSummary {
  const { week } = raw;
  const total = members.reduce((s, m) => s + m.total, 0);
  const workDays = members.reduce((s, m) => s + m.workDays, 0);
  const teamAvg = workDays ? Math.round(total / workDays) : 0;

  let cellsExcellent = 0;
  let cellsNormal = 0;
  let cellsBelow = 0;
  for (const m of members) {
    for (const day of m.days) {
      if (day?.status !== 'work' || day.cuboids === null) continue;
      if (day.cuboids >= week.excellentThreshold) cellsExcellent += 1;
      else if (day.cuboids >= week.normalThreshold) cellsNormal += 1;
      else cellsBelow += 1;
    }
  }

  const withQa = members.filter((m) => m.qa);
  const riskHigh = withQa.reduce((s, m) => s + (m.qa?.riskHigh ?? 0), 0);
  const qaCuboids = withQa.reduce((s, m) => s + (m.qa?.cuboids ?? 0), 0);
  const warnPercent = withQa.length
    ? qaCuboids
      ? withQa.reduce((s, m) => s + (m.qa!.warningPercent * m.qa!.cuboids), 0) / qaCuboids
      : withQa.reduce((s, m) => s + m.qa!.warningPercent, 0) / withQa.length
    : 0;

  const scored = members.filter((m) => m.attitude && m.attitude.score > 0);
  const attitudeAvg = scored.length ? scored.reduce((s, m) => s + m.attitude!.score, 0) / scored.length : 0;

  const manualTotalChecked = members.reduce((s, m) => s + (m.manualQa?.cuboidsChecked || 0), 0);
  const manualTotalFloating = members.reduce((s, m) => s + (m.manualQa?.floatingBoxCount || 0), 0);
  const manualTotalLoose = members.reduce((s, m) => s + (m.manualQa?.looseBoxCount || 0), 0);
  const manualTotalErrors = manualTotalFloating + manualTotalLoose;
  const manualErrorRate = manualTotalChecked > 0 ? Number(((manualTotalErrors / manualTotalChecked) * 100).toFixed(2)) : 0;

  const issuesOpen = raw.issues.filter((i) => i.status !== 'Đã chốt').length;
  const issuesPending = raw.issues.filter((i) => i.status === 'Chờ chốt').length;
  const byGrade = (grade: Grade) => ranking.filter((m) => m.grade === grade && m.workDays > 0);

  return {
    total,
    workDays,
    teamAvg,
    kpiPercent: week.target ? Math.round((teamAvg / week.target) * 100) : 0,
    riskHigh,
    warnPercent: Math.round(warnPercent * 10) / 10,
    issuesOpen,
    issuesPending,
    issuesTotal: raw.issues.length,
    cellsExcellent,
    cellsNormal,
    cellsBelow,
    membersMet: members.filter((m) => m.workDays > 0 && m.avg >= week.normalThreshold).length,
    membersTotal: members.length,
    attitudeAvg: Math.round(attitudeAvg * 10) / 10,
    manualTotalChecked,
    manualTotalFloating,
    manualTotalLoose,
    manualTotalErrors,
    manualErrorRate,
    executive: week.summaryOverride.trim()
      ? splitLines(week.summaryOverride)
      : buildExecutive(raw, ranking, { teamAvg, warnPercent, riskHigh, issuesOpen, byGrade, kpiPercent: week.target ? Math.round((teamAvg / week.target) * 100) : 0 }),
    highlights: buildHighlights(raw, ranking, byGrade),
  };
}

interface ExecutiveInput {
  teamAvg: number;
  kpiPercent: number;
  warnPercent: number;
  riskHigh: number;
  issuesOpen: number;
  byGrade: (grade: Grade) => ReportMember[];
}

function buildExecutive(raw: RawWeekData, ranking: ReportMember[], input: ExecutiveInput): string[] {
  const { week } = raw;
  const lines: string[] = [];
  if (!ranking.length) return ['Tuần này chưa có thành viên. Thêm thành viên và nhập số liệu để xem tóm tắt.'];

  const fmtMember = (m: ReportMember) => `${shortName(m.name)} (${fmtInt(m.avg)})`;
  const parts: string[] = [];
  const excellent = input.byGrade('excellent');
  const normal = input.byGrade('normal');
  const below = input.byGrade('below');
  if (excellent.length) parts.push(`${joinNames(excellent.map(fmtMember))} xuất sắc`);
  if (normal.length) parts.push(`${joinNames(normal.map((m) => shortName(m.name)))} bình thường`);
  if (below.length) parts.push(`${joinNames(below.map(fmtMember))} dưới KPI`);
  lines.push(
    `Sản lượng: TB tuần ${fmtInt(input.teamAvg)} cuboid/ngày công (${input.kpiPercent}%)${parts.length ? `. ${parts.join('; ')}` : ''}.`,
  );

  if (week.jobsTotal > 0) {
    lines.push(
      `Tiến độ: ${week.jobsDone}/${week.jobsTotal} job Complete trước deadline; số liệu đến ${weekdayLabel(week.dataAsOf)} ${fmtDayMonth(week.dataAsOf)}.`,
    );
  }

  const withQa = ranking.filter((m) => m.qa);
  if (withQa.length) {
    const byRisk = [...withQa].sort((a, b) => a.qa!.riskHigh - b.qa!.riskHigh);
    const best = byRisk[0];
    const worstRisk = byRisk.at(-1)!.qa!.riskHigh;
    const worst = byRisk.filter((m) => m.qa!.riskHigh === worstRisk);
    lines.push(
      `Chất lượng: ${fmtDecimal(input.warnPercent)}% cuboid có cảnh báo, ${input.riskHigh} track rủi ro cao chờ QC. Sạch nhất ${best.name} (${best.qa!.riskHigh}); nhiều nhất ${joinNames(worst.map((m) => m.name))} (${worstRisk}).`,
    );
  }

  const trackPart = raw.tracks.length
    ? `${raw.tracks.length} track lỗi chung → chốt cách sửa chung. `
    : '';
  lines.push(`Lỗi chung: ${trackPart}Issue: ${input.issuesOpen} chờ chốt.`);
  return lines;
}

function buildHighlights(raw: RawWeekData, ranking: ReportMember[], byGrade: (g: Grade) => ReportMember[]): Highlight[] {
  const { week } = raw;
  const highlights: Highlight[] = [];
  const top = ranking.find((m) => m.workDays > 0);
  highlights.push(
    top
      ? {
          label: 'Sản lượng cao nhất',
          value: fmtInt(top.avg),
          unit: '',
          title: top.name,
          detail: `${top.kpiPercent}% KPI · ${top.daysExcellent}/${top.workDays} ngày ≥ ${fmtInt(week.excellentThreshold)}`,
        }
      : { label: 'Sản lượng cao nhất', value: '–', unit: '', title: 'Chưa có dữ liệu', detail: '' },
  );

  const withQa = ranking.filter((m) => m.qa);
  const best = [...withQa].sort((a, b) => a.qa!.riskHigh - b.qa!.riskHigh)[0];
  highlights.push(
    best
      ? {
          label: 'Chất lượng tốt nhất',
          value: String(best.qa!.riskHigh),
          unit: 'track',
          title: best.name,
          detail: 'Ít track rủi ro cao nhất',
        }
      : { label: 'Chất lượng tốt nhất', value: '–', unit: '', title: 'Chưa có dữ liệu QA', detail: '' },
  );

  const below = byGrade('below');
  highlights.push({
    label: 'Cần hỗ trợ',
    value: String(below.length),
    unit: 'người',
    title: below.length ? joinNames(below.map((m) => m.name)) : 'Không ai dưới KPI',
    detail: below.length
      ? `Dưới KPI (${below.map((m) => fmtInt(m.avg)).join(' · ')}) → kèm 1-1`
      : 'Cả nhóm đạt từ mốc bình thường trở lên',
  });

  const tracks = [...raw.tracks].sort((a, b) => b.jobCount - a.jobCount).slice(0, 3);
  highlights.push({
    label: 'Lỗi chung pre-label',
    value: String(raw.tracks.length),
    unit: 'track',
    title: tracks.length ? `Track ${tracks.map((t) => t.trackNo).join(' · ')}` : 'Chưa có',
    detail: tracks.length
      ? `Bị cảnh báo ở nhiều job nhất (${tracks[0].jobCount} job) → Lead chốt cách sửa chung`
      : 'Chưa ghi nhận track lỗi chung',
  });
  return highlights;
}

/** Ngày hiển thị cho "Hôm nay" */
export function asOfLabel(week: RawWeekData['week']): string {
  return `${weekdayLabel(week.dataAsOf)} ${fmtDayMonth(week.dataAsOf)}`;
}
