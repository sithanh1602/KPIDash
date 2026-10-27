import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, type ResultSetHeader, type Row } from '../../config/db';
import { env } from '../../config/env';
import { cacheDel, getOnlineUsers, isRedisReady, redis } from '../../config/redis';
import { authenticate, requireRole } from '../../middleware/auth';
import { badRequest, notFound } from '../../middleware/errors';

export const usersRouter = Router();

// Tất cả thao tác trên users yêu cầu đăng nhập
usersRouter.use(authenticate);

/* ------------------------------ Trạng thái Redis & Online (10 Users) ----- */

usersRouter.get('/online', async (_req, res) => {
  const users = await getOnlineUsers();
  res.json({
    totalOnline: users.length,
    maxCapacity: env.redis.maxUsers,
    users,
  });
});

usersRouter.get('/redis-status', requireRole('leader'), async (_req, res) => {
  const ready = isRedisReady();
  let info = {};
  if (ready && redis) {
    try {
      const rawInfo = await redis.info('memory');
      const usedMemory = rawInfo.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'N/A';
      const maxMemory = rawInfo.match(/maxmemory_human:(.+)/)?.[1]?.trim() || '128M';
      info = {
        connected: true,
        host: env.redis.host,
        port: env.redis.port,
        usedMemory,
        maxMemory,
        maxUsers: env.redis.maxUsers,
      };
    } catch {
      info = { connected: ready };
    }
  } else {
    info = { connected: false };
  }
  res.json(info);
});

/* ------------------------------ Hồ sơ cá nhân (Mọi role) ----------------- */

usersRouter.get('/profile', async (req, res) => {
  res.json(req.user);
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(150),
});

usersRouter.patch('/profile', async (req, res) => {
  const { name } = updateProfileSchema.parse(req.body);
  await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user!.id]);
  req.user!.name = name;
  res.json(req.user);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
});

usersRouter.post('/profile/change-password', async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const [rows] = await pool.execute<Row[]>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  if (!rows[0]) throw notFound('Tài khoản không tồn tại.');

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash as string);
  if (!match) throw badRequest('Mật khẩu hiện tại không chính xác.');

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.id]);
  res.json({ ok: true, message: 'Đổi mật khẩu thành công.' });
});

/* ------------------------------ Quản lý tài khoản (Chỉ Leader) ----------- */

usersRouter.get('/', requireRole('leader'), async (_req, res) => {
  const [rows] = await pool.query<Row[]>(
    'SELECT id, name, email, role, active, created_at AS createdAt FROM users ORDER BY id ASC',
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      active: Boolean(r.active),
      createdAt: r.createdAt,
    })),
  );
});

const createUserSchema = z.object({
  name: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(150),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional(),
  role: z.enum(['leader', 'qc', 'annotator']),
});

usersRouter.post('/', requireRole('leader'), async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const rawPassword = data.password || '123456';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)',
      [data.name, data.email, passwordHash, data.role],
    );
    res.status(201).json({
      id: result.insertId,
      name: data.name,
      email: data.email,
      role: data.role,
      active: true,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw badRequest('Email này đã được sử dụng bởi một tài khoản khác.');
    }
    throw err;
  }
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional(),
  role: z.enum(['leader', 'qc', 'annotator']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự').optional(),
});

usersRouter.patch('/:id', requireRole('leader'), async (req, res) => {
  const targetId = Number(req.params.id);
  const patch = updateUserSchema.parse(req.body);

  const updates: string[] = [];
  const values: any[] = [];

  if (patch.name !== undefined) {
    updates.push('name = ?');
    values.push(patch.name);
  }
  if (patch.email !== undefined) {
    updates.push('email = ?');
    values.push(patch.email);
  }
  if (patch.role !== undefined) {
    updates.push('role = ?');
    values.push(patch.role);
  }
  if (patch.active !== undefined) {
    updates.push('active = ?');
    values.push(patch.active ? 1 : 0);
  }
  if (patch.password) {
    const hash = await bcrypt.hash(patch.password, 10);
    updates.push('password_hash = ?');
    values.push(hash);
  }

  if (updates.length === 0) {
    throw badRequest('Không có thông tin nào được cập nhật.');
  }

  values.push(targetId);

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
    if (!result.affectedRows) throw notFound('Không tìm thấy tài khoản.');

    // Xóa cache auth trong Redis
    await cacheDel(`user:auth:${targetId}`);

    // Nếu khóa tài khoản, xóa luôn các refresh tokens
    if (patch.active === false) {
      await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [targetId]);
    }

    const [rows] = await pool.execute<Row[]>(
      'SELECT id, name, email, role, active, created_at AS createdAt FROM users WHERE id = ?',
      [targetId],
    );
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      active: Boolean(rows[0].active),
      createdAt: rows[0].createdAt,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw badRequest('Email này đã được sử dụng bởi một tài khoản khác.');
    }
    throw err;
  }
});
