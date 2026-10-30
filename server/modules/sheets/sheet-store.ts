import { formatCell } from '../../../shared/cell';
import { diffDays } from '../../../shared/format';
import type { SheetKey } from '../../../shared/sheets';
import { SHEETS } from '../../../shared/sheets';
import type { RawWeekData, SheetRow } from '../../../shared/types';
import { withTransaction, type PoolConnection } from '../../config/db';
import { HttpError } from '../../middleware/errors';
import { getWeek, getWeekMembers, loadRawWeek, type Db } from '../weeks/weeks.repository';
import {
  RowError,
  isBlank,
  parseActionRow,
  parseAttitudeRow,
  parseCoachingRow,
  parseIssueRow,
  parseProductionRow,
  parseQaRow,
  parseManualQaRow,
  parseTrackRow,
} from './sheet-rows';

/**
 * Đọc/ghi các bảng nhập liệu ("Excel trên web") vào MySQL.
 * Hình dạng dòng được mô tả trong shared/sheets.ts.
 */

const str = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));

/* ------------------------------ Đọc ------------------------------------- */

function loadMemberRows(raw: RawWeekData, key: SheetKey): SheetRow[] {
  const asOfIndex = diffDays(raw.week.startDate, raw.week.dataAsOf);
  return raw.members.map((member): SheetRow => {
    const values: Record<string, string> = { member: member.name };
    switch (key) {
      case 'production':
        values.jobCode = member.jobCode || '';
        values.jobStatus = member.jobStatus || 'Chưa hoàn thành';
        member.days.forEach((day, i) => {
          values[`d${i}`] = formatCell(day);
        });
        values.todayNote = member.days[asOfIndex]?.note ?? '';
        break;
      case 'qa':
        if (member.qa) {
          const q = member.qa;
          Object.assign(values, {
            jobCode: q.jobCode,
            qcName: q.qcName,
            cuboids: str(q.cuboids),
            warningPercent: str(q.warningPercent),
            s: str(q.s),
            k: str(q.k),
            z: str(q.z),
            h: str(q.h),
            o: str(q.o),
            d: str(q.d),
            riskHigh: str(q.riskHigh),
            riskMid: str(q.riskMid),
            riskLow: str(q.riskLow),
          });
        }
        break;
      case 'manual_qa':
        if (member.manualQa) {
          const m = member.manualQa;
          Object.assign(values, {
            jobCode: m.jobCode,
            qcName: m.qcName,
            cuboidsChecked: str(m.cuboidsChecked),
            floatingBoxCount: str(m.floatingBoxCount),
            looseBoxCount: str(m.looseBoxCount),
            note: m.note,
          });
        }
        break;
      case 'attitude':
        if (member.attitude) Object.assign(values, { score: str(member.attitude.score), note: member.attitude.note });
        break;
      case 'coaching':
        if (member.coaching) Object.assign(values, member.coaching);
        break;
    }
    return { memberId: member.id, values };
  });
}

function loadFreeRows(raw: RawWeekData, key: SheetKey): SheetRow[] {
  const free = (values: Record<string, string>): SheetRow => ({ memberId: null, values });
  switch (key) {
    case 'tracks':
      return raw.tracks.map((t) =>
        free({ trackNo: t.trackNo, className: t.className, jobCount: str(t.jobCount), inJobs: t.inJobs, warnings: t.warnings, symptom: t.symptom }),
      );
    case 'issues':
      return raw.issues.map((i) =>
        free({ code: i.code, reporter: i.reporter, title: i.title, interim: i.interim, nextStep: i.nextStep, status: i.status, priority: i.priority }),
      );
    case 'actions':
      return raw.actions.map((a) => free({ title: a.title, detail: a.detail, owner: a.owner, priority: a.priority }));
    default:
      return [];
  }
}

export async function loadSheet(db: Db, weekId: number, key: SheetKey): Promise<SheetRow[]> {
  const raw = await loadRawWeek(db, weekId);
  return SHEETS[key].scope === 'member' ? loadMemberRows(raw, key) : loadFreeRows(raw, key);
}

/* ------------------------------ Ghi ------------------------------------- */

/** Gắn ngữ cảnh "Dòng N (tên)" vào lỗi kiểm tra để người dùng biết sửa ở đâu. */
function withContext<T>(line: number, label: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RowError) throw new HttpError(400, `Dòng ${line}${label ? ` (${label})` : ''}: ${error.message}`);
    throw error;
  }
}

async function saveMemberRows(connection: PoolConnection, weekId: number, key: SheetKey, rows: SheetRow[]): Promise<void> {
  const week = await getWeek(connection, weekId);
  const members = new Map((await getWeekMembers(connection, weekId)).map((m) => [m.id, m.name]));
  const asOfIndex = diffDays(week.startDate, week.dataAsOf);
  const seen = new Set<number>();

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    if (row.memberId === null || !members.has(row.memberId)) {
      throw new HttpError(400, `Dòng ${line}: thành viên không thuộc tuần này.`);
    }
    if (seen.has(row.memberId)) throw new HttpError(400, `Dòng ${line}: thành viên bị trùng.`);
    seen.add(row.memberId);
    const memberId = row.memberId;
    const label = members.get(memberId)!;

    if (key === 'production') {
      const dayCount = Math.max(1, diffDays(week.startDate, week.endDate) + 1);
      const parsed = withContext(line, label, () => parseProductionRow(row.values, dayCount));
      const [existing] = await connection.execute<import('../../config/db').Row[]>(
        'SELECT day_index, note FROM daily_entries WHERE week_id = ? AND member_id = ?',
        [weekId, memberId],
      );
      const notes = new Map(existing.map((e) => [e.day_index as number, e.note as string]));
      await connection.execute('DELETE FROM daily_entries WHERE week_id = ? AND member_id = ?', [weekId, memberId]);
      for (const [day, entry] of parsed.days.entries()) {
        if (!entry) continue;
        const userNote = day === asOfIndex ? parsed.todayNote : (notes.get(day) ?? '');
        const isHalf = entry.weight === 0.5;
        const cleanNote = userNote.replace(/\[0\.5c\]\s*/g, '').trim();
        const note = isHalf ? `[0.5c] ${cleanNote}`.trim() : cleanNote;
        await connection.execute(
          'INSERT INTO daily_entries (week_id, member_id, day_index, status, cuboids, estimated, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [weekId, memberId, day, entry.status, entry.cuboids, Number(entry.estimated), note],
        );
      }
      await connection.execute(
        'UPDATE week_members SET job_code = ?, job_status = ? WHERE week_id = ? AND member_id = ?',
        [parsed.jobCode, parsed.jobStatus, weekId, memberId],
      );
    } else if (key === 'qa') {
      const qa = withContext(line, label, () => parseQaRow(row.values));
      await connection.execute('DELETE FROM qa_results WHERE week_id = ? AND member_id = ?', [weekId, memberId]);
      if (qa) {
        await connection.execute(
          `INSERT INTO qa_results (week_id, member_id, job_code, qc_name, cuboids, warning_percent,
             s_count, k_count, z_count, h_count, o_count, d_count, risk_high, risk_mid, risk_low)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [weekId, memberId, qa.jobCode, qa.qcName, qa.cuboids, qa.warningPercent, qa.s, qa.k, qa.z, qa.h, qa.o, qa.d, qa.riskHigh, qa.riskMid, qa.riskLow],
        );
      }
    } else if (key === 'manual_qa') {
      const manual = withContext(line, label, () => parseManualQaRow(row.values));
      await connection.execute('DELETE FROM manual_qa_results WHERE week_id = ? AND member_id = ?', [weekId, memberId]);
      if (manual) {
        await connection.execute(
          `INSERT INTO manual_qa_results (week_id, member_id, job_code, qc_name, cuboids_checked, floating_box_count, loose_box_count, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [weekId, memberId, manual.jobCode, manual.qcName, manual.cuboidsChecked, manual.floatingBoxCount, manual.looseBoxCount, manual.note],
        );
      }
    } else if (key === 'attitude') {
      const attitude = withContext(line, label, () => parseAttitudeRow(row.values));
      await connection.execute('DELETE FROM attitude_scores WHERE week_id = ? AND member_id = ?', [weekId, memberId]);
      if (attitude) {
        await connection.execute('INSERT INTO attitude_scores (week_id, member_id, score, note) VALUES (?, ?, ?, ?)', [
          weekId,
          memberId,
          attitude.score,
          attitude.note,
        ]);
      }
    } else if (key === 'coaching') {
      const coaching = withContext(line, label, () => parseCoachingRow(row.values));
      await connection.execute('DELETE FROM coachings WHERE week_id = ? AND member_id = ?', [weekId, memberId]);
      if (coaching) {
        await connection.execute(
          `INSERT INTO coachings (week_id, member_id, focus_tags, style, common_errors, training, absence_note, goals)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [weekId, memberId, coaching.focusTags, coaching.style, coaching.commonErrors, coaching.training, coaching.absenceNote, coaching.goals],
        );
      }
    }
  }
}

async function saveFreeRows(connection: PoolConnection, weekId: number, key: SheetKey, rows: SheetRow[]): Promise<void> {
  await getWeek(connection, weekId);
  const table = { tracks: 'shared_tracks', issues: 'issues', actions: 'action_items' }[key as 'tracks' | 'issues' | 'actions'];
  await connection.execute(`DELETE FROM ${table} WHERE week_id = ?`, [weekId]);

  let order = 0;
  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    if (isBlank(key, row.values)) continue;
    if (key === 'tracks') {
      const t = withContext(line, '', () => parseTrackRow(row.values))!;
      await connection.execute(
        'INSERT INTO shared_tracks (week_id, track_no, class_name, job_count, in_jobs, warnings, symptom, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [weekId, t.trackNo, t.className, t.jobCount, t.inJobs, t.warnings, t.symptom, order++],
      );
    } else if (key === 'issues') {
      const i = withContext(line, '', () => parseIssueRow(row.values))!;
      await connection.execute(
        'INSERT INTO issues (week_id, code, reporter, title, interim, next_step, status, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [weekId, i.code, i.reporter, i.title, i.interim, i.nextStep, i.status, i.priority, order++],
      );
    } else if (key === 'actions') {
      const a = withContext(line, '', () => parseActionRow(row.values))!;
      await connection.execute('INSERT INTO action_items (week_id, title, detail, owner, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [
        weekId,
        a.title,
        a.detail,
        a.owner,
        a.priority,
        order++,
      ]);
    }
  }
}

/** Lưu cả bảng trong một transaction: một dòng sai thì không dòng nào được ghi. */
export async function saveSheet(weekId: number, key: SheetKey, rows: SheetRow[], userId: number): Promise<void> {
  await withTransaction(async (connection) => {
    if (SHEETS[key].scope === 'member') await saveMemberRows(connection, weekId, key, rows);
    else await saveFreeRows(connection, weekId, key, rows);
    await connection.execute('UPDATE weeks SET updated_by = ? WHERE id = ?', [userId, weekId]);
    await connection.execute('INSERT INTO audit_logs (user_id, week_id, action, detail) VALUES (?, ?, ?, ?)', [
      userId,
      weekId,
      `sheet_${key}`,
      `Lưu bảng "${SHEETS[key].label}" (${rows.length} dòng)`,
    ]);
  });
}
