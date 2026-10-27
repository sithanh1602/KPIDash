import type { Pool } from 'mysql2/promise';
import { DAY_COUNT } from '../../../shared/constants';
import type {
  ActionItem,
  DayEntry,
  Issue,
  Priority,
  IssueStatus,
  RawMemberData,
  RawWeekData,
  SharedTrack,
  WeekMeta,
} from '../../../shared/types';
import { addDays } from '../../../shared/format';
import { pool, withTransaction, type PoolConnection, type ResultSetHeader, type Row } from '../../config/db';
import { HttpError, notFound } from '../../middleware/errors';

/** Pool hoặc connection trong transaction: cả hai đều có execute(). */
export type Db = Pool | PoolConnection;

/* ------------------------------ Tuần ------------------------------------- */

export function mapWeek(row: Row): WeekMeta {
  return {
    id: row.id,
    weekNumber: Number(row.week_number ?? 1),
    startDate: row.start_date,
    endDate: row.end_date,
    dataAsOf: row.data_as_of,
    orgName: row.org_name,
    teamName: row.team_name,
    discipline: row.discipline,
    floorName: row.floor_name,
    leadName: row.lead_name,
    mentorName: row.mentor_name,
    target: row.target,
    normalThreshold: row.normal_threshold,
    excellentThreshold: row.excellent_threshold,
    jobsTotal: row.jobs_total,
    jobsDone: row.jobs_done,
    toolQaDone: row.tool_qa_done,
    dataNotes: row.data_notes,
    summaryOverride: row.summary_override,
  };
}

export async function getWeek(db: Db, id: number): Promise<WeekMeta> {
  const [rows] = await db.execute<Row[]>('SELECT * FROM weeks WHERE id = ?', [id]);
  if (!rows[0]) throw notFound('Không tìm thấy tuần báo cáo.');
  return mapWeek(rows[0]);
}

export async function listWeeks() {
  const [rows] = await pool.query<Row[]>(
    `SELECT w.id, w.week_number, w.start_date, w.end_date,
            (SELECT COUNT(*) FROM week_members wm WHERE wm.week_id = w.id) AS member_count
     FROM weeks w ORDER BY w.week_number DESC, w.start_date DESC`,
  );
  return rows.map((row) => ({
    id: row.id as number,
    weekNumber: Number(row.week_number ?? 1),
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    memberCount: Number(row.member_count),
  }));
}

export interface CreateWeekInput {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

/**
 * Tạo tuần mới với số thứ tự tuần, ngày bắt đầu và ngày kết thúc.
 * Kế thừa thông tin chung và danh sách thành viên từ tuần gần nhất nếu có.
 */
export async function createWeek(input: CreateWeekInput, userId: number): Promise<WeekMeta> {
  const { weekNumber, startDate, endDate } = input;
  return withTransaction(async (connection) => {
    const [previous] = await connection.execute<Row[]>(
      'SELECT * FROM weeks ORDER BY id DESC LIMIT 1',
    );
    const base = previous[0];
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO weeks (week_number, start_date, end_date, data_as_of, org_name, team_name, discipline, floor_name, lead_name, mentor_name,
                          target, normal_threshold, excellent_threshold, data_notes, summary_override, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
      [
        weekNumber,
        startDate,
        endDate,
        endDate,
        base?.org_name ?? 'ADAS',
        base?.team_name ?? 'PerFect T012',
        base?.discipline ?? '3D LiDAR',
        base?.floor_name ?? '',
        base?.lead_name ?? 'Lê Sĩ Thành',
        base?.mentor_name ?? '',
        base?.target ?? 1200,
        base?.normal_threshold ?? 1000,
        base?.excellent_threshold ?? 1200,
        userId,
      ],
    );
    if (base) {
      await connection.execute(
        `INSERT INTO week_members (week_id, member_id, sort_order)
         SELECT ?, wm.member_id, wm.sort_order FROM week_members wm
         JOIN members m ON m.id = wm.member_id AND m.active = 1 WHERE wm.week_id = ?`,
        [result.insertId, base.id],
      );
    }
    return getWeek(connection, result.insertId);
  });
}

export type WeekPatch = Partial<Omit<WeekMeta, 'id'>>;

const WEEK_COLUMNS: Record<keyof WeekPatch, string> = {
  weekNumber: 'week_number',
  startDate: 'start_date',
  endDate: 'end_date',
  dataAsOf: 'data_as_of',
  orgName: 'org_name',
  teamName: 'team_name',
  discipline: 'discipline',
  floorName: 'floor_name',
  leadName: 'lead_name',
  mentorName: 'mentor_name',
  target: 'target',
  normalThreshold: 'normal_threshold',
  excellentThreshold: 'excellent_threshold',
  jobsTotal: 'jobs_total',
  jobsDone: 'jobs_done',
  toolQaDone: 'tool_qa_done',
  dataNotes: 'data_notes',
  summaryOverride: 'summary_override',
};

export async function updateWeek(id: number, patch: WeekPatch, userId: number): Promise<WeekMeta> {
  const entries = Object.entries(patch).filter(([key, value]) => key in WEEK_COLUMNS && value !== undefined) as [keyof WeekPatch, string | number][];
  if (entries.length) {
    const assignments = entries.map(([key]) => `${WEEK_COLUMNS[key]} = ?`).join(', ');
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE weeks SET ${assignments}, updated_by = ? WHERE id = ?`,
        [...entries.map(([, value]) => value), userId, id],
      );
      if (!result.affectedRows) throw notFound('Không tìm thấy tuần báo cáo.');
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
        throw new HttpError(400, 'Số job hoàn thành không được lớn hơn tổng job, ngưỡng bình thường không được lớn hơn ngưỡng xuất sắc.');
      }
      throw error;
    }
  }
  return getWeek(pool, id);
}

export async function deleteWeek(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM weeks WHERE id = ?', [id]);
  if (!result.affectedRows) throw notFound('Không tìm thấy tuần báo cáo.');
}

/* ------------------------------ Thành viên của tuần ---------------------- */

export async function getWeekMembers(db: Db, weekId: number): Promise<{ id: number; name: string; role: string }[]> {
  const [rows] = await db.execute<Row[]>(
    `SELECT m.id, m.name, m.role FROM week_members wm JOIN members m ON m.id = wm.member_id
     WHERE wm.week_id = ? ORDER BY wm.sort_order, m.name`,
    [weekId],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, role: row.role }));
}

/** Đặt danh sách (và thứ tự) thành viên của tuần. Người bị bỏ ra sẽ mất số liệu của tuần. */
export async function setWeekMembers(weekId: number, memberIds: number[]): Promise<void> {
  await withTransaction(async (connection) => {
    await getWeek(connection, weekId);
    if (memberIds.length) {
      const [found] = await connection.query<Row[]>('SELECT id FROM members WHERE id IN (?)', [memberIds]);
      if (found.length !== new Set(memberIds).size) throw new HttpError(400, 'Có thành viên không tồn tại trong danh mục.');
      await connection.query('DELETE FROM week_members WHERE week_id = ? AND member_id NOT IN (?)', [weekId, memberIds]);
    } else {
      await connection.execute('DELETE FROM week_members WHERE week_id = ?', [weekId]);
    }
    for (const [index, memberId] of memberIds.entries()) {
      await connection.execute(
        'INSERT INTO week_members (week_id, member_id, sort_order) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)',
        [weekId, memberId, index],
      );
    }
  });
}

/* ------------------------------ Nạp dữ liệu thô cho báo cáo -------------- */

const bucketBy = <T>(rows: Row[], pick: (row: Row) => T) => {
  const map = new Map<number, T>();
  for (const row of rows) map.set(row.member_id as number, pick(row));
  return map;
};

export async function loadRawWeek(db: Db, weekId: number): Promise<RawWeekData> {
  const week = await getWeek(db, weekId);
  const members = await getWeekMembers(db, weekId);

  const [dayRows] = await db.execute<Row[]>('SELECT * FROM daily_entries WHERE week_id = ?', [weekId]);
  const [qaRows] = await db.execute<Row[]>('SELECT * FROM qa_results WHERE week_id = ?', [weekId]);
  const [manualQaRows] = await db.execute<Row[]>('SELECT * FROM manual_qa_results WHERE week_id = ?', [weekId]);
  const [attitudeRows] = await db.execute<Row[]>('SELECT * FROM attitude_scores WHERE week_id = ?', [weekId]);
  const [coachingRows] = await db.execute<Row[]>('SELECT * FROM coachings WHERE week_id = ?', [weekId]);
  const [trackRows] = await db.execute<Row[]>('SELECT * FROM shared_tracks WHERE week_id = ? ORDER BY sort_order, id', [weekId]);
  const [issueRows] = await db.execute<Row[]>('SELECT * FROM issues WHERE week_id = ? ORDER BY sort_order, id', [weekId]);
  const [actionRows] = await db.execute<Row[]>('SELECT * FROM action_items WHERE week_id = ? ORDER BY sort_order, id', [weekId]);

  const daysByMember = new Map<number, (DayEntry | null)[]>();
  for (const member of members) daysByMember.set(member.id, Array<DayEntry | null>(DAY_COUNT).fill(null));
  for (const row of dayRows) {
    const days = daysByMember.get(row.member_id);
    if (days && row.day_index < DAY_COUNT) {
      days[row.day_index] = {
        status: row.status,
        cuboids: row.cuboids,
        estimated: !!row.estimated,
        note: row.note,
      };
    }
  }

  const qa = bucketBy(qaRows, (r) => ({
    jobCode: r.job_code as string,
    qcName: r.qc_name as string,
    cuboids: r.cuboids as number,
    warningPercent: Number(r.warning_percent),
    s: r.s_count as number,
    k: r.k_count as number,
    z: r.z_count as number,
    h: r.h_count as number,
    o: r.o_count as number,
    d: r.d_count as number,
    riskHigh: r.risk_high as number,
    riskMid: r.risk_mid as number,
    riskLow: r.risk_low as number,
  }));
  const manualQa = bucketBy(manualQaRows, (r) => {
    const checked = (r.cuboids_checked as number) || 0;
    const floating = (r.floating_box_count as number) || 0;
    const loose = (r.loose_box_count as number) || 0;
    const total = floating + loose;
    return {
      jobCode: (r.job_code as string) || '',
      qcName: (r.qc_name as string) || '',
      cuboidsChecked: checked,
      floatingBoxCount: floating,
      looseBoxCount: loose,
      totalErrors: total,
      errorRate: checked > 0 ? Number(((total / checked) * 100).toFixed(2)) : 0,
      note: (r.note as string) || '',
    };
  });
  const attitude = bucketBy(attitudeRows, (r) => ({ score: r.score as number, note: r.note as string }));
  const coaching = bucketBy(coachingRows, (r) => ({
    focusTags: r.focus_tags as string,
    style: r.style as string,
    commonErrors: r.common_errors as string,
    training: r.training as string,
    absenceNote: r.absence_note as string,
    goals: r.goals as string,
  }));

  const rawMembers: RawMemberData[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    days: daysByMember.get(m.id) ?? [],
    qa: qa.get(m.id) ?? null,
    manualQa: manualQa.get(m.id) ?? null,
    attitude: attitude.get(m.id) ?? null,
    coaching: coaching.get(m.id) ?? null,
  }));

  const tracks: SharedTrack[] = trackRows.map((r) => ({
    id: r.id,
    trackNo: r.track_no,
    className: r.class_name,
    jobCount: r.job_count,
    inJobs: r.in_jobs,
    warnings: r.warnings,
    symptom: r.symptom,
  }));
  const issues: Issue[] = issueRows.map((r) => ({
    id: r.id,
    code: r.code,
    reporter: r.reporter,
    title: r.title,
    interim: r.interim,
    nextStep: r.next_step,
    status: r.status as IssueStatus,
    priority: r.priority as Priority,
  }));
  const actions: ActionItem[] = actionRows.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    owner: r.owner,
    priority: r.priority as Priority,
  }));

  return { week, members: rawMembers, tracks, issues, actions };
}
