import { Router } from 'express';
import { z } from 'zod';
import type { WeekReport } from '../../../shared/types';
import { isSheetKey } from '../../../shared/sheets';
import { buildReport } from '../../../shared/kpi';
import { isReportSection, REPORT_SECTIONS, type ReportSectionKey } from '../../../shared/report-sections';
import { pool } from '../../config/db';
import { cacheGet, cacheSet, invalidateWeekCache } from '../../config/redis';
import { authenticate, requireRole } from '../../middleware/auth';
import { badRequest, notFound, HttpError } from '../../middleware/errors';
import { buildReportXlsx } from '../exports/excel-report';
import { parseImport } from '../imports/import-parser';
import { parseToolQaBuffer } from '../imports/tool-qa-parser';
import { buildTemplateCsv, buildTemplateXlsx } from '../imports/template';
import { loadSheet, saveSheet } from '../sheets/sheet-store';
import {
  createWeek,
  deleteWeek,
  getWeek,
  getWeekMembers,
  listWeeks,
  loadRawWeek,
  setWeekMembers,
  updateWeek,
  type WeekPatch,
} from './weeks.repository';

export const weeksRouter = Router();

// Tất cả thao tác trên tuần yêu cầu đăng nhập
weeksRouter.use(authenticate);

/* ------------------------------ Danh sách & Chi tiết tuần ----------------- */

weeksRouter.get('/', async (_req, res) => {
  res.json(await listWeeks());
});

const createWeekSchema = z.object({
  weekNumber: z.coerce.number().int().positive('Số thứ tự tuần phải lớn hơn 0'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải có dạng YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải có dạng YYYY-MM-DD'),
});

weeksRouter.post('/', requireRole('leader'), async (req, res) => {
  const input = createWeekSchema.parse(req.body);
  const week = await createWeek(input, req.user!.id);
  res.status(201).json(week);
});

weeksRouter.get('/:id', async (req, res) => {
  const weekId = Number(req.params.id);
  res.json(await getWeek(pool, weekId));
});

const updateWeekSchema = z.object({
  weekNumber: z.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orgName: z.string().max(100).optional(),
  teamName: z.string().max(100).optional(),
  discipline: z.string().max(100).optional(),
  floorName: z.string().max(100).optional(),
  leadName: z.string().max(150).optional(),
  mentorName: z.string().max(150).optional(),
  target: z.number().int().positive().optional(),
  normalThreshold: z.number().int().nonnegative().optional(),
  excellentThreshold: z.number().int().positive().optional(),
  jobsTotal: z.number().int().nonnegative().optional(),
  jobsDone: z.number().int().nonnegative().optional(),
  toolQaDone: z.number().int().nonnegative().optional(),
  dataNotes: z.string().optional(),
  summaryOverride: z.string().optional(),
});

weeksRouter.patch('/:id', requireRole('leader'), async (req, res) => {
  const weekId = Number(req.params.id);
  const patch = updateWeekSchema.parse(req.body) as WeekPatch;
  const result = await updateWeek(weekId, patch, req.user!.id);
  await invalidateWeekCache(weekId);
  res.json(result);
});

weeksRouter.delete('/:id', requireRole('leader'), async (req, res) => {
  const weekId = Number(req.params.id);
  await deleteWeek(weekId);
  await invalidateWeekCache(weekId);
  res.sendStatus(204);
});

/* ------------------------------ Báo cáo đã tính toán ---------------------- */

weeksRouter.get('/:id/report', async (req, res) => {
  const weekId = Number(req.params.id);
  const cacheKey = `week:${weekId}:report`;
  const cached = await cacheGet<WeekReport>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const raw = await loadRawWeek(pool, weekId);
  const report = buildReport(raw);
  await cacheSet(cacheKey, report, 300); // Lưu Redis 5 phút
  res.setHeader('X-Cache', 'MISS');
  res.json(report);
});

/* ------------------------------ Thành viên trong tuần --------------------- */

weeksRouter.get('/:id/members', async (req, res) => {
  const weekId = Number(req.params.id);
  res.json(await getWeekMembers(pool, weekId));
});

const setMembersSchema = z.object({
  memberIds: z.array(z.number().int().positive()),
});

weeksRouter.put('/:id/members', requireRole('leader'), async (req, res) => {
  const weekId = Number(req.params.id);
  const { memberIds } = setMembersSchema.parse(req.body);
  await setWeekMembers(weekId, memberIds);
  await invalidateWeekCache(weekId);
  res.json(await getWeekMembers(pool, weekId));
});

/* ------------------------------ Bảng nhập liệu (Web Sheets) --------------- */

weeksRouter.get('/:id/sheets/:sheetKey', async (req, res) => {
  const weekId = Number(req.params.id);
  const sheetKey = req.params.sheetKey;
  if (!isSheetKey(sheetKey)) throw notFound('Không tìm thấy loại bảng nhập liệu này.');
  const rows = await loadSheet(pool, weekId, sheetKey);
  res.json({ sheetKey, rows });
});

const saveSheetSchema = z.object({
  rows: z.array(
    z.object({
      memberId: z.number().nullable(),
      values: z.record(z.string()),
    }),
  ),
});

weeksRouter.put('/:id/sheets/:sheetKey', async (req, res) => {
  const weekId = Number(req.params.id);
  const sheetKey = req.params.sheetKey;
  if (!isSheetKey(sheetKey)) throw notFound('Không tìm thấy loại bảng nhập liệu này.');

  const role = req.user!.role;
  const memberId = req.user!.memberId;

  // 1. Attitude: Chỉ Leader được chấm điểm
  if (sheetKey === 'attitude' && role !== 'leader') {
    throw new HttpError(403, 'Chỉ Leader mới có quyền chấm điểm Attitude.');
  }

  // 2. QA, Manual QA, Coaching, Tracks, Actions: Leader và QC
  if (['qa', 'manual_qa', 'coaching', 'tracks', 'actions'].includes(sheetKey)) {
    if (role !== 'leader' && role !== 'qc') {
      throw new HttpError(403, 'Chỉ Leader hoặc QC mới có quyền chỉnh sửa mục này.');
    }
  }

  const { rows } = saveSheetSchema.parse(req.body);

  // 3. Production (Sản lượng ngày):
  // Leader được sửa toàn bộ.
  // QC và Annotator CHỈ được sửa dòng dữ liệu của chính mình!
  if (sheetKey === 'production' && role !== 'leader') {
    if (!memberId) {
      throw new HttpError(403, 'Tài khoản của bạn chưa được liên kết với hồ sơ Annotator/QC.');
    }
    const currentRows = await loadSheet(pool, weekId, 'production');
    const myNewRow = rows.find((r) => r.memberId === memberId);
    if (!myNewRow) {
      throw new HttpError(400, 'Không tìm thấy dòng dữ liệu sản lượng của bạn trong tuần này.');
    }
    const hasExisting = currentRows.some((r) => r.memberId === memberId);
    const safeRows = hasExisting
      ? currentRows.map((r) => (r.memberId === memberId ? myNewRow : r))
      : [...currentRows, myNewRow];
    await saveSheet(weekId, sheetKey, safeRows, req.user!.id);
    await invalidateWeekCache(weekId);
    return res.json({ ok: true, count: 1, message: 'Đã lưu sản lượng cá nhân thành công.' });
  }

  await saveSheet(weekId, sheetKey, rows, req.user!.id);
  await invalidateWeekCache(weekId);
  res.json({ ok: true, count: rows.length });
});

/* ------------------------------ File mẫu & Import ------------------------- */

weeksRouter.get('/:id/templates/:sheetKey.:ext', async (req, res) => {
  const weekId = Number(req.params.id);
  const sheetKey = req.params.sheetKey;
  const ext = req.params.ext;
  if (ext !== 'xlsx' && ext !== 'csv') throw notFound('Định dạng không được hỗ trợ.');
  if (!isSheetKey(sheetKey)) throw notFound('Không tìm thấy loại bảng.');

  const week = await getWeek(pool, weekId);
  const members = await getWeekMembers(pool, weekId);
  const memberNames = members.map((m) => m.name);

  if (ext === 'xlsx') {
    const buffer = await buildTemplateXlsx({ sheet: sheetKey, startDate: week.startDate, memberNames });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mau-${sheetKey}-${week.startDate}.xlsx"`);
    res.send(buffer);
  } else {
    const csv = buildTemplateCsv({ sheet: sheetKey, startDate: week.startDate, memberNames });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mau-${sheetKey}-${week.startDate}.csv"`);
    res.send(csv);
  }
});

const importSchema = z.object({
  fileName: z.string().min(1),
  // Dữ liệu base64 của file
  fileBase64: z.string().min(1),
});

weeksRouter.post('/:id/sheets/:sheetKey/import', async (req, res) => {
  const weekId = Number(req.params.id);
  const sheetKey = req.params.sheetKey;
  if (!isSheetKey(sheetKey)) throw notFound('Không tìm thấy loại bảng.');

  const role = req.user!.role;
  if (sheetKey === 'attitude' && role !== 'leader') {
    throw new HttpError(403, 'Chỉ Leader mới có quyền import Attitude.');
  }
  if (sheetKey === 'production' && role !== 'leader') {
    throw new HttpError(403, 'Chỉ Leader mới có quyền import toàn bộ bảng sản lượng.');
  }
  if (['qa', 'manual_qa', 'coaching', 'tracks', 'actions'].includes(sheetKey) && role !== 'leader' && role !== 'qc') {
    throw new HttpError(403, 'Chỉ Leader hoặc QC mới có quyền import mục này.');
  }

  const { fileName, fileBase64 } = importSchema.parse(req.body);
  const buffer = Buffer.from(fileBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw badRequest('File tối đa 5 MB.');

  const members = await getWeekMembers(pool, weekId);
  const result = await parseImport(sheetKey, members, buffer, fileName);
  res.json(result);
});

/* ------------------------------ Xuất báo cáo (Export) --------------------- */

const exportExcelSchema = z.object({
  sections: z.array(z.string()).optional(),
  selectedQaTypes: z.array(z.string()).optional(),
});

weeksRouter.post('/:id/export/excel', async (req, res) => {
  const weekId = Number(req.params.id);
  const raw = await loadRawWeek(pool, weekId);
  const report = buildReport(raw);

  const body = exportExcelSchema.parse(req.body);
  let sections: ReportSectionKey[];
  if (body.sections && body.sections.length > 0) {
    sections = body.sections.filter(isReportSection);
    if (!sections.length) throw badRequest('Không có phần hợp lệ nào được chọn.');
  } else {
    sections = REPORT_SECTIONS.map((s) => s.key);
  }

  const buffer = await buildReportXlsx(report, sections, body.selectedQaTypes);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-kpi-${report.week.startDate}.xlsx"`);
  res.send(buffer);
});

/* ------------------------------ Tool QA Import & Tự động tổng hợp --------- */

const parseToolQaSchema = z.object({
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
});

weeksRouter.post('/:id/qa/parse-preview', requireRole('leader', 'qc'), async (req, res) => {
  const weekId = Number(req.params.id);
  const { fileName, fileBase64 } = parseToolQaSchema.parse(req.body);
  const buffer = Buffer.from(fileBase64, 'base64');
  if (buffer.length > 25 * 1024 * 1024) throw badRequest('File tối đa 25 MB.');

  const parsed = await parseToolQaBuffer(buffer);

  // Thử đoán chủ nhân file dựa trên tên file và danh sách thành viên trong tuần
  const members = await getWeekMembers(pool, weekId);
  const lowerFileName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[_\-\.]/g, '');

  let suggestedMemberId: number | null = null;

  for (const m of members) {
    const rawNoAccent = m.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase();
    const parts = rawNoAccent.split(/\s+/).filter(Boolean);
    const lastName = parts[parts.length - 1] || ''; // ví dụ: thinh
    const initials = parts.map((p) => p[0]).join(''); // ví dụ: nvt
    const nameCode1 = lastName + (parts.slice(0, -1).map((p) => p[0]).join('')); // thinhnv
    const nameCode2 = parts.map((p) => p[0]).join('') + lastName; // nvtthinh

    if (
      lowerFileName.includes(nameCode1) ||
      lowerFileName.includes(nameCode2) ||
      lowerFileName.includes(lastName) ||
      lowerFileName.includes(rawNoAccent.replace(/\s+/g, ''))
    ) {
      suggestedMemberId = m.id;
      break;
    }
  }

  res.json({
    fileName,
    fileSize: buffer.length,
    parsed,
    suggestedMemberId,
  });
});

const applyToolQaSchema = z.object({
  memberId: z.number().int().positive(),
  jobCode: z.string().default('Job_01'),
  qcName: z.string().default('Leader'),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
  metrics: z.object({
    cuboids: z.number().int().nonnegative(),
    warningPercent: z.number().nonnegative(),
    s: z.number().int().nonnegative(),
    k: z.number().int().nonnegative(),
    z: z.number().int().nonnegative(),
    h: z.number().int().nonnegative(),
    o: z.number().int().nonnegative(),
    d: z.number().int().nonnegative(),
    riskHigh: z.number().int().nonnegative(),
    riskMid: z.number().int().nonnegative(),
    riskLow: z.number().int().nonnegative(),
    highRiskTracks: z.array(
      z.object({
        trackNo: z.string(),
        className: z.string(),
        totalIssues: z.number(),
        warnings: z.string(),
        symptom: z.string(),
      }),
    ).optional(),
    suggestedCoaching: z.object({
      focusTags: z.string(),
      commonErrors: z.string(),
      training: z.string(),
      goals: z.string(),
    }).optional(),
  }),
  applyToCoaching: z.boolean().default(true),
  applyToSharedTracks: z.boolean().default(true),
});

weeksRouter.post('/:id/qa/apply-tool-result', requireRole('leader', 'qc'), async (req, res) => {
  const weekId = Number(req.params.id);
  const body = applyToolQaSchema.parse(req.body);
  const fileBuffer = Buffer.from(body.fileBase64, 'base64');

  // Đảm bảo thành viên đã được gán vào tuần này
  await pool.execute(
    'INSERT IGNORE INTO week_members (week_id, member_id, sort_order) VALUES (?, ?, 0)',
    [weekId, body.memberId],
  );

  // 1. Lưu vào bảng qa_results
  await pool.execute(
    `INSERT INTO qa_results (week_id, member_id, job_code, qc_name, cuboids, warning_percent,
                            s_count, k_count, z_count, h_count, o_count, d_count, risk_high, risk_mid, risk_low)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       job_code = VALUES(job_code),
       qc_name = VALUES(qc_name),
       cuboids = VALUES(cuboids),
       warning_percent = VALUES(warning_percent),
       s_count = VALUES(s_count),
       k_count = VALUES(k_count),
       z_count = VALUES(z_count),
       h_count = VALUES(h_count),
       o_count = VALUES(o_count),
       d_count = VALUES(d_count),
       risk_high = VALUES(risk_high),
       risk_mid = VALUES(risk_mid),
       risk_low = VALUES(risk_low)`,
    [
      weekId,
      body.memberId,
      body.jobCode,
      body.qcName,
      body.metrics.cuboids,
      body.metrics.warningPercent,
      body.metrics.s,
      body.metrics.k,
      body.metrics.z,
      body.metrics.h,
      body.metrics.o,
      body.metrics.d,
      body.metrics.riskHigh,
      body.metrics.riskMid,
      body.metrics.riskLow,
    ],
  );

  // 2. Tự động cập nhật lỗi hay gặp vào Coaching (Tab 05) nếu được chọn
  if (body.applyToCoaching && body.metrics.suggestedCoaching) {
    const sc = body.metrics.suggestedCoaching;
    await pool.execute(
      `INSERT INTO coachings (week_id, member_id, focus_tags, style, common_errors, training, absence_note, goals)
       VALUES (?, ?, ?, '', ?, ?, '', ?)
       ON DUPLICATE KEY UPDATE
         focus_tags = VALUES(focus_tags),
         common_errors = VALUES(common_errors),
         training = VALUES(training),
         goals = VALUES(goals)`,
      [weekId, body.memberId, sc.focusTags, sc.commonErrors, sc.training, sc.goals],
    );
  }

  // 3. Tự động bổ sung các track rủi ro cao vào "Lỗi chung cả nhóm" (Tab 04) nếu được chọn
  if (body.applyToSharedTracks && body.metrics.highRiskTracks && body.metrics.highRiskTracks.length > 0) {
    const [memberRows]: any = await pool.execute('SELECT name FROM members WHERE id = ?', [body.memberId]);
    const memberName = memberRows[0]?.name || 'Annotator';

    for (const tr of body.metrics.highRiskTracks) {
      await pool.execute(
        `INSERT INTO shared_tracks (week_id, track_no, class_name, job_count, in_jobs, warnings, symptom, sort_order)
         VALUES (?, ?, ?, 1, ?, ?, ?, 0)`,
        [weekId, tr.trackNo, tr.className, `${body.jobCode} (${memberName})`, tr.warnings, tr.symptom],
      );
    }
  }

  // 4. Lưu vĩnh viễn file sheet gốc vào bảng qa_files
  await pool.execute(
    `INSERT INTO qa_files (week_id, member_id, file_name, file_size, file_data, metrics, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      weekId,
      body.memberId,
      body.fileName,
      fileBuffer.length,
      fileBuffer,
      JSON.stringify(body.metrics),
      req.user!.id,
    ],
  );

  await invalidateWeekCache(weekId);

  res.json({ ok: true, message: 'Đã tổng hợp kết quả Tool QA và lưu trữ sheet thành công.' });
});

weeksRouter.get('/:id/qa/files', async (req, res) => {
  const weekId = Number(req.params.id);
  const [rows]: any = await pool.execute(
    `SELECT qf.id, qf.week_id, qf.member_id, m.name as member_name,
            qf.file_name, qf.file_size, qf.metrics, qf.created_at
     FROM qa_files qf
     JOIN members m ON m.id = qf.member_id
     WHERE qf.week_id = ?
     ORDER BY qf.id DESC`,
    [weekId],
  );
  res.json(rows);
});

weeksRouter.get('/:id/qa/files/:fileId/download', async (req, res) => {
  const fileId = Number(req.params.fileId);
  const [rows]: any = await pool.execute('SELECT file_name, file_data FROM qa_files WHERE id = ?', [fileId]);
  if (!rows[0]) throw notFound('Không tìm thấy file lưu trữ.');

  const fileName = rows[0].file_name;
  const fileData = rows[0].file_data;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(fileData);
});

weeksRouter.delete('/:id/qa/files/:fileId', requireRole('leader', 'qc'), async (req, res) => {
  const fileId = Number(req.params.fileId);
  await pool.execute('DELETE FROM qa_files WHERE id = ?', [fileId]);
  res.sendStatus(204);
});
