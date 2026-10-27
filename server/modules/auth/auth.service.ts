import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthUser, Role } from '../../../shared/types';
import { pool, withTransaction, type Row } from '../../config/db';
import { env } from '../../config/env';
import { blacklistToken } from '../../config/redis';
import { HttpError } from '../../middleware/errors';
import { ACCESS_AUDIENCE, TOKEN_ISSUER } from '../../middleware/auth';

const REFRESH_AUDIENCE = 'anno-refresh';
const ACCESS_TTL = '15m';
const REFRESH_DAYS = 7;

export const REFRESH_COOKIE = 'refreshToken';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function toUser(row: Row): Promise<AuthUser> {
  const [memberRows] = await pool.execute<Row[]>(
    'SELECT id FROM members WHERE LOWER(REPLACE(name, " ", "")) = LOWER(REPLACE(?, " ", "")) LIMIT 1',
    [row.name],
  );
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    memberId: (memberRows[0]?.id as number) ?? null,
  };
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Tạo cặp token mới và lưu hash của refresh token. */
async function issueSession(user: AuthUser, run = pool.execute.bind(pool)): Promise<Session> {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, env.jwt.accessSecret, {
    expiresIn: ACCESS_TTL,
    issuer: TOKEN_ISSUER,
    audience: ACCESS_AUDIENCE,
  });
  const refreshToken = jwt.sign({ sub: String(user.id), jti: randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: `${REFRESH_DAYS}d`,
    issuer: TOKEN_ISSUER,
    audience: REFRESH_AUDIENCE,
  });
  await run('INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    sha256(refreshToken),
    user.id,
    new Date(Date.now() + REFRESH_DAYS * 86_400_000),
  ]);
  return { accessToken, refreshToken, user };
}

export async function login(email: string, password: string): Promise<Session> {
  const [rows] = await pool.execute<Row[]>('SELECT * FROM users WHERE email = ? AND active = 1', [email.trim()]);
  const row = rows[0];
  const valid = row ? await bcrypt.compare(password, row.password_hash) : false;
  if (!row || !valid) throw new HttpError(401, 'Email hoặc mật khẩu không đúng.');
  return issueSession(await toUser(row));
}

/** Đổi refresh token cũ lấy cặp mới (xoay vòng: token cũ bị hủy ngay). */
export async function refresh(token: string | undefined): Promise<Session> {
  if (!token) throw new HttpError(401, 'Chưa đăng nhập.');
  try {
    jwt.verify(token, env.jwt.refreshSecret, { issuer: TOKEN_ISSUER, audience: REFRESH_AUDIENCE });
  } catch {
    throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
  }
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute<Row[]>(
      `SELECT u.* FROM refresh_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.active = 1 FOR UPDATE`,
      [sha256(token)],
    );
    if (!rows[0]) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
    await connection.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [sha256(token)]);
    return issueSession(await toUser(rows[0]), connection.execute.bind(connection));
  });
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) {
    const hash = sha256(token);
    await pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
    await blacklistToken(hash, 7 * 86400);
  }
}
