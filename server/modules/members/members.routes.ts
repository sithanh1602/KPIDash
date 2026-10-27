import { Router } from 'express';
import { z } from 'zod';
import type { Member } from '../../../shared/types';
import { pool, type ResultSetHeader, type Row } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { notFound, HttpError } from '../../middleware/errors';

/** Danh mục thành viên: dùng chung cho mọi tuần. */
export const membersRouter = Router();

membersRouter.use(authenticate);

const mapMember = (row: Row): Member => ({
  id: row.id,
  name: row.name,
  role: row.role,
  active: !!row.active,
});

const memberBody = z.object({
  name: z.string().trim().min(1, 'Nhập họ tên').max(150, 'Họ tên tối đa 150 ký tự'),
  role: z.string().trim().max(100).default('Annotator'),
  active: z.boolean().optional(),
});

membersRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query<Row[]>(
    `SELECT m.*, (SELECT COUNT(*) FROM week_members wm WHERE wm.member_id = m.id) AS week_count
     FROM members m ORDER BY m.active DESC, m.name`,
  );
  res.json(rows.map((row) => ({ ...mapMember(row), weekCount: Number(row.week_count) })));
});

membersRouter.post('/', requireRole('leader'), async (req, res) => {
  const body = memberBody.parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO members (name, role) VALUES (?, ?)', [body.name, body.role]);
  res.status(201).json({ id: result.insertId, name: body.name, role: body.role, active: true } satisfies Member);
});

membersRouter.put('/:id', requireRole('leader'), async (req, res) => {
  const id = Number(req.params.id);
  const body = memberBody.parse(req.body);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE members SET name = ?, role = ?, active = COALESCE(?, active) WHERE id = ?',
    [body.name, body.role, body.active === undefined ? null : Number(body.active), id],
  );
  if (!result.affectedRows) throw notFound('Không tìm thấy thành viên.');
  res.json({ id, name: body.name, role: body.role, active: body.active ?? true } satisfies Member);
});

membersRouter.delete('/:id', requireRole('leader'), async (req, res) => {
  const id = Number(req.params.id);
  const [used] = await pool.execute<Row[]>('SELECT 1 FROM week_members WHERE member_id = ? LIMIT 1', [id]);
  if (used.length) throw new HttpError(409, 'Thành viên đã có trong báo cáo tuần, hãy chuyển sang "ngừng hoạt động" thay vì xóa.');
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM members WHERE id = ?', [id]);
  if (!result.affectedRows) throw notFound('Không tìm thấy thành viên.');
  res.sendStatus(204);
});
