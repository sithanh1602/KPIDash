import { Router } from 'express';
import { z } from 'zod';
import { pool, type Row, type ResultSetHeader } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';

export const dailyReportsRouter = Router();

// Chỉ có Leader mới được xem và dùng tính năng này
dailyReportsRouter.use(authenticate);
dailyReportsRouter.use(requireRole('leader'));

const DEFAULT_SAMPLE_NAMES = [
  'Đinh Hoàng Lịch',
  'Hoàng Văn Đạt',
  'Nguyễn Trọng Minh Đức',
  'Cù Đức Quang',
  'Nguyễn Hoài Thanh',
  'Dương Văn Long',
  'Đoàn Vĩnh Nguyên',
  'Vũ Đình Sơn Lâm',
  'Nguyễn Trọng Thắng',
];

const memberSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1, 'Họ tên không được để trống').max(100),
  ids: z.coerce.number().int().min(0).default(0),
  cuboids: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

const saveReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không đúng định dạng YYYY-MM-DD'),
  team: z.string().trim().max(100).default('Team 12'),
  project: z.string().trim().max(100).default('3D LiDAR · Cuboid'),
  goal: z.coerce.number().int().min(1).max(1000000).default(800),
  session: z.string().trim().max(50).default('Buổi chiều'),
  note: z.string().max(5000).default(''),
  members: z.array(memberSchema).max(500),
});

/** Lấy danh sách các ngày đã có báo cáo trong cơ sở dữ liệu */
dailyReportsRouter.get('/dates', async (_req, res) => {
  const [rows] = await pool.query<Row[]>(
    'SELECT report_date FROM daily_reports ORDER BY report_date DESC',
  );
  const dates = rows.map((r) => r.report_date);
  res.json({ dates });
});

/** Lấy dữ liệu báo cáo của một ngày cụ thể (nếu chưa có thì sinh template tự động từ thành viên) */
dailyReportsRouter.get('/', async (req, res) => {
  const dateQuery = typeof req.query.date === 'string' ? req.query.date : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)
    ? dateQuery
    : new Date().toISOString().slice(0, 10);

  // 1. Kiểm tra ngày này đã được lưu trong DB chưa
  const [rows] = await pool.query<Row[]>(
    'SELECT * FROM daily_reports WHERE report_date = ? LIMIT 1',
    [date],
  );

  if (rows.length > 0) {
    const row = rows[0];
    let members = [];
    try {
      members = typeof row.members_json === 'string' ? JSON.parse(row.members_json) : row.members_json;
    } catch {
      members = [];
    }
    return res.json({
      date: row.report_date,
      team: row.team || 'Team 12',
      project: row.project || '3D LiDAR · Cuboid',
      goal: Number(row.goal) || 800,
      session: row.session || 'Buổi chiều',
      note: row.note || '',
      isExisting: true,
      members,
    });
  }

  // 2. Nếu chưa có, thử lấy cấu hình và danh sách từ ngày gần nhất trước đó
  const [prevRows] = await pool.query<Row[]>(
    'SELECT * FROM daily_reports WHERE report_date < ? ORDER BY report_date DESC LIMIT 1',
    [date],
  );

  if (prevRows.length > 0) {
    const prev = prevRows[0];
    let prevMembers = [];
    try {
      prevMembers = typeof prev.members_json === 'string' ? JSON.parse(prev.members_json) : prev.members_json;
    } catch {
      prevMembers = [];
    }

    const resetMembers = Array.isArray(prevMembers)
      ? prevMembers.map((m: any, i: number) => ({
          key: m.key || `m${i + 1}`,
          name: m.name || 'Thành viên mới',
          ids: 0,
          cuboids: 0,
          active: true,
        }))
      : [];

    return res.json({
      date,
      team: prev.team || 'Team 12',
      project: prev.project || '3D LiDAR · Cuboid',
      goal: Number(prev.goal) || 800,
      session: prev.session || 'Buổi chiều',
      note: '',
      isExisting: false,
      members: resetMembers,
    });
  }

  // 3. Nếu chưa có báo cáo ngày nào trong hệ thống, lấy danh sách tên thành viên từ bảng `members`
  const [memberRows] = await pool.query<Row[]>(
    'SELECT name FROM members WHERE active = 1 ORDER BY name ASC',
  );

  let initialNames: string[] = [];
  if (memberRows.length > 0) {
    initialNames = memberRows.map((r) => r.name);
  } else {
    initialNames = DEFAULT_SAMPLE_NAMES;
  }

  const generatedMembers = initialNames.map((name, i) => ({
    key: `m${i + 1}`,
    name,
    ids: 0,
    cuboids: 0,
    active: true,
  }));

  res.json({
    date,
    team: 'Team 12',
    project: '3D LiDAR · Cuboid',
    goal: 800,
    session: 'Buổi chiều',
    note: '',
    isExisting: false,
    members: generatedMembers,
  });
});

/** Lưu hoặc cập nhật báo cáo ngày */
dailyReportsRouter.post('/', async (req, res) => {
  const body = saveReportSchema.parse(req.body);
  const membersJson = JSON.stringify(body.members);

  await pool.query(
    `INSERT INTO daily_reports (report_date, team, project, goal, session, note, members_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       team = VALUES(team),
       project = VALUES(project),
       goal = VALUES(goal),
       session = VALUES(session),
       note = VALUES(note),
       members_json = VALUES(members_json),
       updated_at = CURRENT_TIMESTAMP`,
    [body.date, body.team, body.project, body.goal, body.session, body.note, membersJson],
  );

  res.json({ ok: true, date: body.date, message: 'Đã lưu báo cáo ngày thành công vào cơ sở dữ liệu' });
});

/** Xóa báo cáo của một ngày */
dailyReportsRouter.delete('/:date', async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'Ngày không đúng định dạng YYYY-MM-DD');
  }

  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM daily_reports WHERE report_date = ?',
    [date],
  );

  res.json({ ok: true, deleted: result.affectedRows > 0 });
});

/** Sao lưu tất cả các ngày (JSON export) */
dailyReportsRouter.get('/backup/all', async (_req, res) => {
  const [rows] = await pool.query<Row[]>(
    'SELECT * FROM daily_reports ORDER BY report_date ASC',
  );

  const reports: Record<string, any> = {};
  for (const r of rows) {
    let members = [];
    try {
      members = typeof r.members_json === 'string' ? JSON.parse(r.members_json) : r.members_json;
    } catch {
      members = [];
    }
    reports[r.report_date] = {
      date: r.report_date,
      team: r.team,
      project: r.project,
      goal: Number(r.goal),
      session: r.session,
      note: r.note || '',
      members,
    };
  }

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    reports,
  });
});

/** Khôi phục từ JSON backup */
dailyReportsRouter.post('/backup/restore', async (req, res) => {
  const rawReports = req.body?.reports;
  if (!rawReports || typeof rawReports !== 'object' || Array.isArray(rawReports)) {
    throw new HttpError(400, 'Dữ liệu sao lưu không đúng định dạng');
  }

  let count = 0;
  for (const [date, rep] of Object.entries(rawReports)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rep || typeof rep !== 'object') continue;
    const r = rep as any;
    const team = String(r.team || 'Team 12').slice(0, 100);
    const project = String(r.project || '3D LiDAR · Cuboid').slice(0, 100);
    const goal = Math.max(1, Math.min(1000000, Number(r.goal) || 800));
    const session = String(r.session || 'Buổi chiều').slice(0, 50);
    const note = String(r.note || '').slice(0, 5000);
    const members = Array.isArray(r.members) ? r.members : [];

    await pool.query(
      `INSERT INTO daily_reports (report_date, team, project, goal, session, note, members_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         team = VALUES(team),
         project = VALUES(project),
         goal = VALUES(goal),
         session = VALUES(session),
         note = VALUES(note),
         members_json = VALUES(members_json),
         updated_at = CURRENT_TIMESTAMP`,
      [date, team, project, goal, session, note, JSON.stringify(members)],
    );
    count++;
  }

  res.json({ ok: true, restoredCount: count });
});
