import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser, Role } from '../../shared/types';
import { pool, type Row } from '../config/db';
import { env } from '../config/env';
import { cacheGet, cacheSet, isTokenBlacklisted, recordUserPresence } from '../config/redis';
import { HttpError } from './errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const TOKEN_ISSUER = 'anno-kpi';
export const ACCESS_AUDIENCE = 'anno-web';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Bắt buộc đăng nhập: đọc Bearer token, xác thực qua Redis cache và DB. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  let userId: number;
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, { issuer: TOKEN_ISSUER, audience: ACCESS_AUDIENCE }) as { id: number };
    userId = payload.id;
  } catch {
    throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  }

  // 1. Kiểm tra Token Blacklist trong Redis (ngăn token đã bị thu hồi)
  if (token && (await isTokenBlacklisted(sha256(token)))) {
    throw new HttpError(401, 'Phiên đăng nhập đã bị hủy.');
  }

  // 2. Tra cứu User qua Redis Cache trước để tăng tốc cho 10 users
  const cacheKey = `user:auth:${userId}`;
  let user = await cacheGet<AuthUser>(cacheKey);

  if (!user) {
    const [rows] = await pool.execute<Row[]>('SELECT id, name, email, role FROM users WHERE id = ? AND active = 1', [userId]);
    if (!rows[0]) throw new HttpError(401, 'Tài khoản không còn hoạt động.');
    
    // Tìm memberId tương ứng trong members theo tên
    const [memberRows] = await pool.execute<Row[]>(
      'SELECT id FROM members WHERE LOWER(REPLACE(name, " ", "")) = LOWER(REPLACE(?, " ", "")) LIMIT 1',
      [rows[0].name],
    );
    const memberId = memberRows[0]?.id as number | undefined;

    user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role as Role,
      memberId: memberId ?? null,
    };
    await cacheSet(cacheKey, user, 120); // Cache 2 phút
  }

  req.user = user;

  // 3. Ghi nhận thời điểm online vào Redis Presence
  recordUserPresence(user).catch(() => {});

  next();
}

/** Giới hạn theo vai trò. Giai đoạn này chỉ Leader có quyền thao tác. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.');
    }
    next();
  };
}
